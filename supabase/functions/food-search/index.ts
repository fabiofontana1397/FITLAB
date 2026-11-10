// FatSecret Platform API proxy: text search, barcode lookup and detail.
//
// Why a function and not the app: the client id/secret must never ship in the
// bundle, and FatSecret only accepts calls from allow-listed IPs, so every
// call has to leave from one server. Secrets (never EXPO_PUBLIC_*):
//   supabase secrets set FATSECRET_CLIENT_ID=... FATSECRET_CLIENT_SECRET=...
// The barcode endpoint needs the `barcode` scope (Premier plan); search only
// needs `basic`. Override with FATSECRET_SCOPE="basic barcode" if enabled.
//
// Every food returned is normalised to the app's FoodItem (values per 100 g)
// and upserted into public.food_items so meal_entries can reference it.
import { CORS_HEADERS, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { createServiceRoleClient, createUserScopedClient, getAuthenticatedUser } from '../_shared/supabase-client.ts';

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API = 'https://platform.fatsecret.com/rest';

type Body =
  | { action: 'search'; query: string; max?: number }
  | { action: 'barcode'; barcode: string }
  | { action: 'get'; foodId: string };

type Serving = {
  serving_description?: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
  fiber?: string;
};

type FsFood = {
  food_id: string;
  food_name: string;
  brand_name?: string;
  servings?: { serving: Serving | Serving[] };
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const id = Deno.env.get('FATSECRET_CLIENT_ID');
  const secret = Deno.env.get('FATSECRET_CLIENT_SECRET');
  if (!id || !secret) throw new Error('FatSecret non configurato (FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET)');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: Deno.env.get('FATSECRET_SCOPE') ?? 'basic barcode' }),
  });
  if (!res.ok) throw new Error(`FatSecret token ${res.status}: ${await res.text()}`);
  const json = await res.json();
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function fsGet(path: string, params: Record<string, string>): Promise<any> {
  const url = `${API}${path}?${new URLSearchParams({ ...params, format: 'json' })}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await getToken()}` } });
  if (!res.ok) throw new Error(`FatSecret ${res.status}: ${await res.text()}`);
  const json = await res.json();
  // FatSecret reports API errors with HTTP 200 and an `error` object.
  if (json?.error) throw new Error(`FatSecret error ${json.error.code}: ${json.error.message}`);
  return json;
}

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};
const round1 = (n: number) => Math.round(n * 10) / 10;
const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Picks the serving whose numbers can be scaled to 100 g/ml, and builds the per-100 g food from it. */
function normalise(food: FsFood, barcode?: string) {
  const servings = asArray(food.servings?.serving);
  const metric = servings.filter((s) => (s.metric_serving_unit === 'g' || s.metric_serving_unit === 'ml') && num(s.metric_serving_amount) > 0);
  // Prefer the "100 g" serving (exact), else the first metric one.
  const base = metric.find((s) => num(s.metric_serving_amount) === 100) ?? metric[0];
  if (!base) return null;
  const amount = num(base.metric_serving_amount);
  const k = 100 / amount;
  const kcal100 = Math.round(num(base.calories) * k);
  const protein100 = round1(num(base.protein) * k);
  const carbs100 = round1(num(base.carbohydrate) * k);
  const fats100 = round1(num(base.fat) * k);
  // The portion: first non-100 g serving (e.g. "1 vasetto" = 125 g), else 100 g.
  const portion = metric.find((s) => num(s.metric_serving_amount) !== 100) ?? base;
  const defaultPortionG = Math.round(num(portion.metric_serving_amount)) || 100;
  return {
    id: `fs-${food.food_id}`,
    name: food.food_name,
    brand: food.brand_name ?? null,
    category: category(protein100, carbs100, fats100),
    kcal100,
    protein100,
    carbs100,
    fats100,
    defaultPortionG,
    source: 'fatsecret',
    barcode: barcode ?? null,
  };
}

/** FatSecret has no category: use the dominant macro by calories. */
function category(p: number, c: number, f: number): string {
  const kp = p * 4, kc = c * 4, kf = f * 9;
  if (kp + kc + kf < 1) return 'altro';
  if (kp >= kc && kp >= kf) return 'proteine';
  return kc >= kf ? 'carboidrati' : 'grassi';
}

async function persist(foods: NonNullable<ReturnType<typeof normalise>>[]) {
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

async function getFood(foodId: string, barcode?: string) {
  const json = await fsGet('/food/v4', { food_id: foodId, flag_default_serving: 'true', language: 'it', region: 'IT' });
  return normalise(json.food as FsFood, barcode);
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 });

  try {
    await getAuthenticatedUser(createUserScopedClient(req));
    const body = (await req.json()) as Body;

    if (body.action === 'search') {
      const query = body.query?.trim();
      if (!query || query.length < 2) return jsonResponse({ foods: [] });
      const json = await fsGet('/foods/search/v3', {
        search_expression: query,
        max_results: String(Math.min(body.max ?? 20, 50)),
        language: 'it',
        region: 'IT',
        flag_default_serving: 'true',
      });
      const raw = asArray<FsFood>(json?.foods_search?.results?.food);
      const foods = raw.map((f) => normalise(f)).filter((f): f is NonNullable<typeof f> => !!f);
      await persist(foods);
      return jsonResponse({ foods });
    }

    if (body.action === 'barcode') {
      // GTIN-13 (EAN-13); FatSecret wants 13 digits, so UPC-A/EAN-8 get left-padded with zeros.
      const digits = String(body.barcode ?? '').replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 14) return jsonResponse({ error: 'Codice a barre non valido' }, { status: 400 });
      const gtin = digits.padStart(13, '0');

      const db = createServiceRoleClient();
      const { data: cached } = await db.from('food_items').select('id').eq('barcode', gtin).maybeSingle();
      if (cached) {
        const { data } = await db.from('food_items').select('id, name, brand, category, kcal100, protein100, carbs100, fats100, default_portion_g').eq('id', cached.id).single();
        if (data) return jsonResponse({ food: { ...data, defaultPortionG: data.default_portion_g, source: 'fatsecret', barcode: gtin } });
      }

      const found = await fsGet('/food/barcode/find-by-id/v1', { barcode: gtin });
      const foodId = found?.food_id?.value ?? found?.food_id;
      if (!foodId || String(foodId) === '0') return jsonResponse({ food: null });
      const food = await getFood(String(foodId), gtin);
      if (food) await persist([food]);
      return jsonResponse({ food });
    }

    if (body.action === 'get') {
      const food = await getFood(String(body.foodId).replace(/^fs-/, ''));
      if (food) await persist([food]);
      return jsonResponse({ food });
    }

    return jsonResponse({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('food-search error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message === 'Unauthorized' || message.includes('Authorization') ? 401 : 500;
    return jsonResponse({ error: message }, { status, headers: CORS_HEADERS });
  }
});
