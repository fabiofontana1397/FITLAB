// Client for the `food-search` Edge Function (Open Food Facts: packaged
// products by name or barcode). Every food it returns is already per 100 g
// and cached in public.food_items, so it can be logged (meal_entries.food_id
// FK) and read back on any device.
import type { FoodItem } from '@/lib/mock/food-database';
import { supabase } from '@/lib/supabase/client';
import { useExternalFoodsStore } from '@/store/external-foods-store';

type Raw = {
  id: string;
  name: string;
  brand?: string | null;
  category: FoodItem['category'];
  kcal100: number | string;
  protein100: number | string;
  carbs100: number | string;
  fats100: number | string;
  defaultPortionG?: number | string;
  default_portion_g?: number | string;
  barcode?: string | null;
  source?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
};

function toFood(r: Raw): FoodItem {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand ?? null,
    category: r.category,
    kcal100: Number(r.kcal100),
    protein100: Number(r.protein100),
    carbs100: Number(r.carbs100),
    fats100: Number(r.fats100),
    defaultPortionG: Number(r.defaultPortionG ?? r.default_portion_g) || 100,
    barcode: r.barcode ?? null,
    imageUrl: r.imageUrl ?? r.image_url ?? null,
    source: r.source === 'fatsecret' ? 'fatsecret' : 'openfoodfacts',
  };
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('food-search', { body });
  if (error) throw error;
  return data as T;
}

export type OnlineSearchResult = {
  foods: FoodItem[];
  /** Open Food Facts is throttling the app right now: try again in a minute. */
  rateLimited: boolean;
};

/**
 * Packaged products matching a name. Open Food Facts allows few searches per
 * minute, so call this on an explicit action (submit / tap), never per keystroke.
 * Throws on network/config errors: the caller keeps the local results.
 */
export async function searchOnlineFoods(query: string): Promise<OnlineSearchResult> {
  const { foods, rateLimited } = await call<{ foods?: Raw[]; rateLimited?: boolean }>({ action: 'search', query });
  const items = (foods ?? []).map(toFood);
  useExternalFoodsStore.getState().remember(items);
  return { foods: items, rateLimited: !!rateLimited };
}

export type BarcodeResult =
  | { status: 'found'; food: FoodItem }
  /** Unknown barcode, or known product without a nutrition table. */
  | { status: 'missing' | 'incomplete' | 'rateLimited' };

/** The product behind a barcode. */
export async function lookupBarcode(barcode: string): Promise<BarcodeResult> {
  const { food, incomplete, rateLimited } = await call<{ food: Raw | null; incomplete?: boolean; rateLimited?: boolean }>({ action: 'barcode', barcode });
  if (rateLimited) return { status: 'rateLimited' };
  if (!food) return { status: incomplete ? 'incomplete' : 'missing' };
  const item = toFood(food);
  useExternalFoodsStore.getState().remember([item]);
  return { status: 'found', food: item };
}

/** Loads from the shared catalogue the online foods a logged entry points to that this device has not seen yet. */
export async function fetchFoodsByIds(ids: string[]): Promise<FoodItem[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('food_items')
    .select('id, name, brand, category, kcal100, protein100, carbs100, fats100, default_portion_g, barcode, source, image_url')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []).map((r) => toFood(r as Raw));
}
