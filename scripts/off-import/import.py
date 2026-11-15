#!/usr/bin/env python3
"""Imports the Italian products of Open Food Facts into public.food_items.

Streams the nightly CSV export (≈1 GB gzipped, every product in the world),
keeps the products sold in Italy that have a name and a usable nutrition
table, normalises them exactly like the `food-search` Edge Function (values
per 100 g/ml, id `off-<barcode>`), and upserts the most scanned ones into
Supabase through the REST API.

Environment:
  SUPABASE_URL               project URL
  SUPABASE_SERVICE_ROLE_KEY  secret key (never commit it). Without it the
                             script only reports what it would import.
  OFF_MAX_ROWS               cap on imported products (default 150000)
  OFF_COUNTRY_TAG            default en:italy

Open Food Facts data is ODbL: keep the attribution shown in the app.
Standard library only, so it runs on a bare Python 3.
"""
import csv
import gzip
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

DUMP_URL = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz'
USER_AGENT = os.environ.get('OFF_USER_AGENT') or 'FitLab/1.0 (https://github.com/fabiofontana1397/FITLAB)'
COUNTRY = os.environ.get('OFF_COUNTRY_TAG') or 'en:italy'
MAX_ROWS = int(os.environ.get('OFF_MAX_ROWS') or 150000)
BATCH = 1000


def num(value):
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if n == n and abs(n) != float('inf') else None


def category(tags, p, c, f):
    def has(*keys):
        return any(k in tags for k in keys)

    if has('en:legumes', 'en:legumes-and-their-products', 'en:pulses'):
        return 'legumi'
    if has('en:dairies', 'en:cheeses', 'en:yogurts', 'en:milks'):
        return 'latticini'
    if has('en:fruits', 'en:fruits-based-foods', 'en:fresh-fruits'):
        return 'frutta'
    if has('en:vegetables', 'en:vegetables-based-foods', 'en:fresh-vegetables'):
        return 'verdura'
    kp, kc, kf = p * 4, c * 4, f * 9
    if kp + kc + kf < 1:
        return 'altro'
    if kp >= kc and kp >= kf:
        return 'proteine'
    return 'carboidrati' if kc >= kf else 'grassi'


def normalise(row):
    """A food_items row from a CSV row (dict), or None when it is not usable."""
    code = ''.join(ch for ch in (row.get('code') or '') if ch.isdigit())
    name = (row.get('product_name') or '').strip()
    if not (8 <= len(code) <= 14) or not name:
        return None
    protein = num(row.get('proteins_100g'))
    carbs = num(row.get('carbohydrates_100g'))
    fats = num(row.get('fat_100g'))
    kcal = num(row.get('energy-kcal_100g'))
    if kcal is None:
        kj = num(row.get('energy_100g'))
        if kj is not None:
            kcal = kj / 4.184
        elif None not in (protein, carbs, fats):
            kcal = protein * 4 + carbs * 4 + fats * 9
    if kcal is None or kcal < 0 or kcal > 950:
        return None
    if protein is None and carbs is None and fats is None:
        return None
    p = round(min(100, max(0, protein or 0)), 1)
    c = round(min(100, max(0, carbs or 0)), 1)
    f = round(min(100, max(0, fats or 0)), 1)
    serving = num(row.get('serving_quantity'))
    image = next((u for u in (row.get('image_small_url'), row.get('image_url')) if u and u.startswith('https://')), None)
    brand = (row.get('brands') or '').split(',')[0].strip()
    return {
        'id': f'off-{code}',
        'name': name[:120],
        'brand': brand[:80] or None,
        'category': category((row.get('categories_tags') or '').split(','), p, c, f),
        'kcal100': round(kcal),
        'protein100': p,
        'carbs100': c,
        'fats100': f,
        'default_portion_g': round(serving) if serving is not None and 1 <= serving <= 1000 else 100,
        'source': 'openfoodfacts',
        'barcode': code,
        'image_url': image,
        'popularity': int(num(row.get('unique_scans_n')) or 0),
    }


def read_products():
    csv.field_size_limit(sys.maxsize)
    request = urllib.request.Request(DUMP_URL, headers={'User-Agent': USER_AGENT})
    seen, kept, total = set(), [], 0
    with urllib.request.urlopen(request, timeout=120) as response:
        text = io.TextIOWrapper(gzip.GzipFile(fileobj=response), encoding='utf-8', errors='replace', newline='')
        reader = csv.reader(text, delimiter='\t', quoting=csv.QUOTE_NONE)
        header = next(reader)
        wanted = ['code', 'product_name', 'brands', 'countries_tags', 'categories_tags', 'serving_quantity', 'energy-kcal_100g',
                  'energy_100g', 'proteins_100g', 'carbohydrates_100g', 'fat_100g', 'image_small_url', 'image_url', 'unique_scans_n']
        index = {name: header.index(name) for name in wanted if name in header}
        missing = [name for name in wanted if name not in index]
        if missing:
            print(f'warning: columns missing from the export: {missing}', flush=True)
        for required in ('code', 'product_name', 'countries_tags'):
            if required not in index:
                raise SystemExit(f'the export has no "{required}" column: its format changed')
        country_col = index['countries_tags']
        for fields in reader:
            total += 1
            if total % 500000 == 0:
                print(f'  read {total:,} products, kept {len(kept):,}', flush=True)
            if len(fields) <= country_col or COUNTRY not in fields[country_col].split(','):
                continue
            food = normalise({name: (fields[i] if i < len(fields) else '') for name, i in index.items()})
            if food and food['id'] not in seen:
                seen.add(food['id'])
                kept.append(food)
    print(f'read {total:,} products; {len(kept):,} usable ones sold in {COUNTRY}', flush=True)
    return kept


def upsert(base_url, key, rows):
    now = datetime.now(timezone.utc).isoformat()
    url = f'{base_url.rstrip("/")}/rest/v1/food_items?on_conflict=id'
    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
    }
    for start in range(0, len(rows), BATCH):
        body = json.dumps([{**r, 'fetched_at': now} for r in rows[start:start + BATCH]]).encode('utf-8')
        for attempt in range(1, 5):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method='POST'), timeout=120):
                    break
            except urllib.error.HTTPError as err:
                detail = err.read().decode('utf-8', 'replace')[:300]
                if err.code < 500 and err.code != 429:
                    raise SystemExit(f'Supabase refused the upsert ({err.code}): {detail}')
                print(f'  batch at {start}: HTTP {err.code}, retry {attempt}', flush=True)
            except (urllib.error.URLError, TimeoutError) as err:
                print(f'  batch at {start}: {err}, retry {attempt}', flush=True)
            time.sleep(5 * attempt)
        else:
            raise SystemExit(f'giving up on the batch at {start}')
        if (start // BATCH) % 20 == 0:
            print(f'  upserted {min(start + BATCH, len(rows)):,} / {len(rows):,}', flush=True)


def main():
    foods = read_products()
    foods.sort(key=lambda f: (-f['popularity'], f['id']))
    with_photo = sum(1 for f in foods if f['image_url'])
    print(f'{with_photo:,} with a photo; most scanned: ' + ', '.join(f"{f['name']} ({f['brand'] or '-'})" for f in foods[:5]), flush=True)
    if len(foods) > MAX_ROWS:
        print(f'keeping the {MAX_ROWS:,} most scanned', flush=True)
        foods = foods[:MAX_ROWS]
    base_url, key = os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not base_url or not key:
        print('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set: dry run, nothing written.')
        return
    upsert(base_url, key, foods)
    print(f'done: {len(foods):,} products in food_items')


if __name__ == '__main__':
    main()
