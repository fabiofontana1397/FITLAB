// Open Food Facts proxy: text search and barcode lookup for packaged products.
//
// Open Food Facts (https://world.openfoodfacts.org) is an open database (ODbL):
// no API key, no IP allow-list, and the data may be stored. What it does ask:
//   - a custom User-Agent on every call ("AppName/Version (contact)"). Set
//     yours with `supabase secrets set OFF_USER_AGENT="FitLab/1.0 (you@example.com)"`;
//   - respect of tight per-IP rate limits (10 searches/min, 15 product
//     reads/min). All calls leave from this function, so those limits are
//     shared by every user: that is why every answer is cached in Postgres
//     (products in food_items, search results in food_search_cache) and why
//     the app only searches on an explicit action, never while typing;
//   - attribution in the UI (the app shows "Open Food Facts" under results).
//
// Every product returned is normalised to the app's FoodItem (values per
// 100 g/ml) and upserted into public.food_items so meal_entries can reference it.
import { CORS_HEADERS, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { createServiceRoleClient, createUserScopedClient, getAuthenticatedUser } from '../_shared/supabase-client.ts';

const OFF = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_it,generic_name_it,brands,nutriments,serving_quantity,categories_tags';
const DEFAULT_USER_AGENT = 'FitLab/1.0 (https://github.com/fabiofontana1397/FITLAB)';
const SEARCH_TTL_MS = 30 * 24 * 3600 * 1000;
const EMPTY_SEARCH_TTL_MS = 24 * 3600 * 1000;
const COLUMNS = 'id, name, brand, category, kcal100, protein100, carbs100, fats100, default_portion_g, source, barcode';

type Body =
  | { action: 'search'; query: string; max?: number }
  | { action: 'barcode'; barcode: string };

type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_it?: string;
  generic_name_it?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
  serving_quantity?: number | string;
  categories_tags?: string[];
};

type Food = NonNullable<ReturnType<typeof normalise>>;

/** Thrown when Open Food Facts answers 429/503: the caller reports it instead of failing. */
class RateLimited extends Error {}

async function offGet(url: string): Promise<any | null> {
  const res = await fetch(url, {
    headers: { 'User-Agent': Deno.env.get('OFF_USER_AGENT') ?? DEFAULT_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (res.status === 429 || res.status === 503) throw new RateLimited(`Open Food Facts ${res.status}`);
  if (!res.ok) throw new Error(`Open Food Facts ${res.status}`);
  return await res.json();
}

const num = (v: unknown): number | null => {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Builds the per-100 g food, or null when the product has no usable name or nutrition table. */
function normalise(p: OffProduct, fallbackCode?: string) {
  const code = String(p.code ?? fallbackCode ?? '').replace(/\D/g, '');
  const name = (p.product_name_it || p.product_name || p.generic_name_it || '').trim();
  if (!code || !name) return null;

  const n = p.nutriments ?? {};
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fats = num(n['fat_100g']);
  // Energy: kcal when declared, else from kJ, else from the macros.
  const kj = num(n['energy_100g']);
  let kcal = num(n['energy-kcal_100g']) ?? (kj !== null ? kj / 4.184 : null);
  if (kcal === null && protein !== null && carbs !== null && fats !== null) kcal = protein * 4 + carbs * 4 + fats * 9;
  // Community-entered data: drop rows without a nutrition table or with impossible values.
  if (kcal === null || kcal < 0 || kcal > 950) return null;
  if (protein === null && carbs === null && fats === null) return null;
  const p100 = round1(Math.min(100, Math.max(0, protein ?? 0)));
  const c100 = round1(Math.min(100, Math.max(0, carbs ?? 0)));
  const f100 = round1(Math.min(100, Math.max(0, fats ?? 0)));

  const serving = num(p.serving_quantity);
  const brand = (p.brands ?? '').split(',')[0].trim();
  return {
    id: `off-${code}`,
    name: name.slice(0, 120),
    brand: brand || null,
    category: category(p.categories_tags ?? [], p100, c100, f100),
    kcal100: Math.round(kcal),
    protein100: p100,
    carbs100: c100,
    fats100: f100,
    defaultPortionG: serving !== null && serving >= 1 && serving <= 1000 ? Math.round(serving) : 100,
    source: 'openfoodfacts',
    barcode: code,
  };
}

/** The app's category from the Open Food Facts taxonomy when it is clear, else from the dominant macro. */
function category(tags: string[], p: number, c: number, f: number): string {
  const has = (...keys: string[]) => keys.some((k) => tags.includes(k));
  if (has('en:legumes', 'en:legumes-and-their-products', 'en:pulses')) return 'legumi';
  if (has('en:dairies', 'en:cheeses', 'en:yogurts', 'en:milks')) return 'latticini';
  if (has('en:fruits', 'en:fruits-based-foods', 'en:fresh-fruits')) return 'frutta';
  if (has('en:vegetables', 'en:vegetables-based-foods', 'en:fresh-vegetables')) return 'verdura';
  const kp = p * 4, kc = c * 4, kf = f * 9;
  if (kp + kc + kf < 1) return 'altro';
  if (kp >= kc && kp >= kf) return 'proteine';
  return kc >= kf ? 'carboidrati' : 'grassi';
}

// deno-lint-ignore no-explicit-any
const fromRow = (r: any) => ({
  id: r.id, name: r.name, brand: r.brand, category: r.category,
  kcal100: Number(r.kcal100), protein100: Number(r.protein100), carbs100: Number(r.carbs100), fats100: Number(r.fats100),
  defaultPortionG: Number(r.default_portion_g) || 100, source: r.source, barcode: r.barcode,
});

async function persist(foods: Food[]) {
  if (foods.length === 0) return;
  const db = createServiceRoleClient();
  const { error } = await db.from('food_items').upsert(
    foods.map((f) => ({
      id: f.id, name: f.name, brand: f.brand, category: f.category,
      kcal100: f.kcal100, protein100: f.protein100, carbs100: f.carbs100, fats100: f.fats100,
      default_portion_g: f.defaultPortionG, source: f.source, barcode: f.barcode, fetched_at: new Date().toISOString(),
    })),
    { onConflict: 'id' },
  );
  if (error) throw error;
}

async function search(rawQuery: string, max: number) {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, ' ');
  if (query.length < 3) return { foods: [] };
  const db = createServiceRoleClient();

  // Same query asked before (by anyone): answer from Postgres, no call to Open Food Facts.
  const { data: hit } = await db.from('food_search_cache').select('food_ids, fetched_at').eq('query', query).maybeSingle();
  if (hit) {
    const age = Date.now() - new Date(hit.fetched_at).getTime();
    const ids: string[] = hit.food_ids ?? [];
    if (age < (ids.length > 0 ? SEARCH_TTL_MS : EMPTY_SEARCH_TTL_MS)) {
      if (ids.length === 0) return { foods: [] };
      const { data } = await db.from('food_items').select(COLUMNS).in('id', ids);
      const byId = new Map((data ?? []).map((r) => [r.id, fromRow(r)]));
      return { foods: ids.map((id) => byId.get(id)).filter((f) => !!f) };
    }
  }

  // Products sold in Italy, most scanned first, names in Italian.
  const params = new URLSearchParams({
    search_terms: query, search_simple: '1', action: 'process', json: '1',
    tagtype_0: 'countries', tag_contains_0: 'contains', tag_0: 'italy',
    sort_by: 'unique_scans_n', page_size: String(max), lc: 'it', fields: FIELDS,
  });
  const json = await offGet(`${OFF}/cgi/search.pl?${params}`);
  const seen = new Set<string>();
  const foods = ((json?.products ?? []) as OffProduct[])
    .map((p) => normalise(p))
    .filter((f): f is Food => !!f && !seen.has(f.id) && !!seen.add(f.id));
  await persist(foods);
  await db.from('food_search_cache').upsert({ query, food_ids: foods.map((f) => f.id), fetched_at: new Date().toISOString() }, { onConflict: 'query' });
  return { foods };
}

async function barcode(raw: string) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  // UPC-A (12 digits) is stored as EAN-13 with a leading zero; EAN-8 stays as it is.
  const code = digits.length === 12 ? `0${digits}` : digits;

  const db = createServiceRoleClient();
  const { data: cached } = await db.from('food_items').select(COLUMNS).in('barcode', [code, code.padStart(13, '0')]).limit(1).maybeSingle();
  if (cached) return { food: fromRow(cached) };

  const json = await offGet(`${OFF}/api/v2/product/${code}?fields=${FIELDS}&lc=it`);
  if (!json || json.status === 0 || !json.product) return { food: null };
  const food = normalise(json.product as OffProduct, code);
  if (food) await persist([food]);
  // Known product without a nutrition table: tell the app, so it can say so instead of "not found".
  return { food, incomplete: !food };
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 });

  try {
    await getAuthenticatedUser(createUserScopedClient(req));
    const body = (await req.json()) as Body;

    if (body.action === 'search') {
      return jsonResponse(await search(String(body.query ?? ''), Math.min(Math.max(body.max ?? 20, 1), 50)));
    }

    if (body.action === 'barcode') {
      const result = await barcode(body.barcode);
      if (!result) return jsonResponse({ error: 'Codice a barre non valido' }, { status: 400 });
      return jsonResponse(result);
    }

    return jsonResponse({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    // Open Food Facts is throttling us: a normal answer the app can explain, not a failure.
    if (err instanceof RateLimited) return jsonResponse({ foods: [], food: null, rateLimited: true });
    console.error('food-search error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message === 'Unauthorized' || message.includes('Authorization') ? 401 : 500;
    return jsonResponse({ error: message }, { status, headers: CORS_HEADERS });
  }
});
