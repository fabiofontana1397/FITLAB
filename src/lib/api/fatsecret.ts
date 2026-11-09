// Client for the `food-search` Edge Function (FatSecret Platform API). The
// FatSecret keys live only in that function's secrets, never in the app.
// Every food it returns is already per 100 g and cached in public.food_items,
// so it can be logged (meal_entries.food_id FK) and read back on any device.
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
    source: 'fatsecret',
  };
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('food-search', { body });
  if (error) throw error;
  return data as T;
}

/** Free-text search on FatSecret. Throws on network/config errors: the caller keeps the local results. */
export async function searchFatSecret(query: string): Promise<FoodItem[]> {
  const { foods } = await call<{ foods: Raw[] }>({ action: 'search', query });
  const items = (foods ?? []).map(toFood);
  useExternalFoodsStore.getState().remember(items);
  return items;
}

/** The product behind a barcode, or null when FatSecret does not know it. */
export async function lookupBarcode(barcode: string): Promise<FoodItem | null> {
  const { food } = await call<{ food: Raw | null }>({ action: 'barcode', barcode });
  if (!food) return null;
  const item = toFood(food);
  useExternalFoodsStore.getState().remember([item]);
  return item;
}

/** Loads from the shared catalogue the FatSecret foods a logged entry points to that this device has not seen yet. */
export async function fetchFoodsByIds(ids: string[]): Promise<FoodItem[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('food_items')
    .select('id, name, brand, category, kcal100, protein100, carbs100, fats100, default_portion_g, barcode')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []).map((r) => toFood(r as Raw));
}
