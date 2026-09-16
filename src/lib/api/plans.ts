// Repository module for plan-store.ts. One row per user per plan type
// (upsert-on-regenerate, matching the app's existing "replace wholesale"
// behavior) — the deeply-nested `months` tree stays a single jsonb
// column, only the top-level metadata (generatedAt/durationMonths/goal)
// gets real columns. See supabase/migrations/0006_plans.sql for the
// schema_version rationale.
import { supabase } from '@/lib/supabase/client';
import type { DietPlan, TrainingPlan } from '@/lib/planning/types';

export async function fetchDietPlan(userId: string): Promise<DietPlan | null> {
  const { data, error } = await supabase
    .from('diet_plans')
    .select('generated_at, duration_months, goal, plan')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { generatedAt: data.generated_at, durationMonths: data.duration_months, goal: data.goal, months: data.plan };
}

export async function upsertDietPlan(userId: string, plan: DietPlan): Promise<void> {
  const { error } = await supabase.from('diet_plans').upsert(
    {
      user_id: userId,
      generated_at: plan.generatedAt,
      duration_months: plan.durationMonths,
      goal: plan.goal,
      plan: plan.months,
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

export async function deleteDietPlan(userId: string): Promise<void> {
  const { error } = await supabase.from('diet_plans').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function fetchTrainingPlan(userId: string): Promise<TrainingPlan | null> {
  const { data, error } = await supabase.from('training_plans').select('generated_at, duration_months, plan').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { generatedAt: data.generated_at, durationMonths: data.duration_months, months: data.plan };
}

export async function upsertTrainingPlan(userId: string, plan: TrainingPlan): Promise<void> {
  const { error } = await supabase.from('training_plans').upsert(
    { user_id: userId, generated_at: plan.generatedAt, duration_months: plan.durationMonths, plan: plan.months },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

export async function deleteTrainingPlan(userId: string): Promise<void> {
  const { error } = await supabase.from('training_plans').delete().eq('user_id', userId);
  if (error) throw error;
}
