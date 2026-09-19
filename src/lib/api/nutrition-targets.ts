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

function fromHistoryRow(row: {
  effective_date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  source: string;
  reason: string | null;
}): NutritionTargetRecord {
  return {
    effectiveDate: row.effective_date,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatsG: row.fats_g,
    source: row.source as NutritionTargetSource,
    reason: row.reason ?? undefined,
  };
}

export async function fetchNutritionTargetHistory(userId: string): Promise<NutritionTargetRecord[]> {
  const { data, error } = await supabase
    .from('nutrition_target_history')
    .select('effective_date, calories, protein_g, carbs_g, fats_g, source, reason')
    .eq('user_id', userId)
    .order('effective_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromHistoryRow);
}

/**
 * The `initial_estimate` half of spec §0.3/§4.1 bis's "initial_estimate vs
 * current_target": the most recent time a fresh baseline was established
 * (first-ever onboarding, or a later "Rifai il questionario" — each writes
 * a new `initial_estimate` row rather than overwriting one, same baseline
 * philosophy as body_metrics.is_baseline). `profiles.daily_calorie_target`
 * is the `current_target` half — it's the one the Adaptive Nutrition
 * Engine (adaptation-evaluate) is allowed to nudge; this row never changes
 * once written, so the two can be compared to see how far the live target
 * has actually drifted from where the questionnaire started it.
 */
export async function fetchLatestInitialEstimate(userId: string): Promise<NutritionTargetRecord | null> {
  const { data, error } = await supabase
    .from('nutrition_target_history')
    .select('effective_date, calories, protein_g, carbs_g, fats_g, source, reason')
    .eq('user_id', userId)
    .eq('source', 'initial_estimate')
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? fromHistoryRow(data) : null;
}

export async function insertNutritionTargetHistory(
  userId: string,
  record: { effectiveDate: string; calories: number; proteinG: number; carbsG: number; fatsG: number; source: NutritionTargetSource; reason?: string }
): Promise<void> {
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
