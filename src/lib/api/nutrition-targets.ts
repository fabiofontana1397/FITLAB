// Repository module for nutrition_target_history (read) and the
// adaptation-evaluate Edge Function (the Adaptive Nutrition Engine's real
// entry point, spec §4.1 bis/§14 "POST /adaptation/evaluate"). The
// evaluation itself — reading body_metrics/meal_entries, deciding whether
// to nudge the target, persisting the new profile/history/plan_versions
// rows — all happens server-side now; this module just invokes it and
// exposes read access to the resulting history.
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

export type AdaptationAction = 'none' | 'increase' | 'decrease';

export type AdaptationDecision = {
  action: AdaptationAction;
  deltaKcal: number;
  reason: string;
  weeklyRateKg: number | null;
  loggedDaysInWindow: number;
};

export type AdaptationEvaluateResponse = {
  decision: AdaptationDecision;
  updatedProfile: { dailyCalorieTarget: number; macroTargetsG: { protein: number; carbs: number; fats: number } } | null;
};

export async function evaluateNutritionAdaptation(): Promise<AdaptationEvaluateResponse> {
  const { data, error } = await supabase.functions.invoke('adaptation-evaluate');
  if (error) throw error;
  return data as AdaptationEvaluateResponse;
}
