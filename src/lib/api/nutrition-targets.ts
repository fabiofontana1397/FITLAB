// Repository module for nutrition_target_history — the Adaptive Nutrition
// Engine's audit trail (see lib/nutrition/adaptive-engine.ts and
// FITLAB_SPEC.md §4.1 bis). Every row is either the initial onboarding
// estimate or a later adaptive correction; profiles.daily_calorie_target
// stays the single "current" value the rest of the app reads, this table
// is purely historical/explanatory.
import { supabase } from '@/lib/supabase/client';

export type NutritionTargetSource = 'initial_estimate' | 'adaptation';

export type NutritionTargetRecord = {
  effectiveDate: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  source: NutritionTargetSource;
  reason?: string;
};

export async function insertNutritionTargetHistory(userId: string, record: NutritionTargetRecord): Promise<void> {
  const { error } = await supabase.from('nutrition_target_history').insert({
    user_id: userId,
    effective_date: record.effectiveDate,
    calories: record.calories,
    protein_g: record.proteinG,
    carbs_g: record.carbsG,
    fats_g: record.fatsG,
    source: record.source,
    reason: record.reason ?? null,
  });
  if (error) throw error;
}

export async function fetchNutritionTargetHistory(userId: string): Promise<NutritionTargetRecord[]> {
  const { data, error } = await supabase
    .from('nutrition_target_history')
    .select('effective_date, calories, protein_g, carbs_g, fats_g, source, reason')
    .eq('user_id', userId)
    .order('effective_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    effectiveDate: row.effective_date,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatsG: row.fats_g,
    source: row.source as NutritionTargetSource,
    reason: row.reason ?? undefined,
  }));
}
