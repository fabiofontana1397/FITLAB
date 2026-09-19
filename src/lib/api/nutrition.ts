// Repository module for nutrition-store.ts — same convention as
// src/lib/api/body.ts: plain async functions on the app's existing types
// (MealFoodEntry), not raw DB rows, mapping snake_case<->camelCase at this
// one boundary.
import { supabase } from '@/lib/supabase/client';
import type { MealFoodEntry, MealSlot } from '@/store/nutrition-store';

type MealEntryRow = { id: string; date: string; slot: MealSlot; food_id: string; grams: number };

function fromRow(row: MealEntryRow): MealFoodEntry {
  return { id: row.id, date: row.date, slot: row.slot, foodId: row.food_id, grams: row.grams };
}

export async function fetchMealEntries(userId: string): Promise<MealFoodEntry[]> {
  const { data, error } = await supabase.from('meal_entries').select('id, date, slot, food_id, grams').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function insertMealEntry(userId: string, entry: MealFoodEntry): Promise<void> {
  const { error } = await supabase
    .from('meal_entries')
    .insert({ id: entry.id, user_id: userId, date: entry.date, slot: entry.slot, food_id: entry.foodId, grams: entry.grams });
  if (error) throw error;
}

export async function insertMealEntries(userId: string, entries: MealFoodEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await supabase
    .from('meal_entries')
    .insert(entries.map((e) => ({ id: e.id, user_id: userId, date: e.date, slot: e.slot, food_id: e.foodId, grams: e.grams })));
  if (error) throw error;
}

export async function updateMealEntry(userId: string, id: string, foodId: string, grams: number): Promise<void> {
  const { error } = await supabase.from('meal_entries').update({ food_id: foodId, grams }).eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export async function deleteMealEntry(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from('meal_entries').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export async function fetchSeededDates(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('nutrition_seeded_dates').select('date').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.date as string);
}

export async function insertSeededDate(userId: string, date: string): Promise<void> {
  const { error } = await supabase.from('nutrition_seeded_dates').upsert({ user_id: userId, date }, { onConflict: 'user_id,date' });
  if (error) throw error;
}

/** Removes only the plan-seeded entries for a date (id prefix 'plan-',
 * see seedDayFromPlan) — never touches entries the user logged by hand,
 * even on the same date. Used when the user switches the "segui il piano"
 * flag back off (spec: tracking must be opt-in, never silently populated). */
export async function deletePlanSeededEntriesForDate(userId: string, date: string): Promise<void> {
  const { error } = await supabase.from('meal_entries').delete().eq('user_id', userId).eq('date', date).like('id', 'plan-%');
  if (error) throw error;
}

export async function deleteSeededDate(userId: string, date: string): Promise<void> {
  const { error } = await supabase.from('nutrition_seeded_dates').delete().eq('user_id', userId).eq('date', date);
  if (error) throw error;
}
