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

export type PlanVersionTrigger = 'onboarding' | 'regenerate' | 'adaptation';

/**
 * Records one row in `plan_versions` per generation/regeneration/adaptation
 * event — a lightweight audit trail on top of the existing one-row-per-user
 * diet_plans/training_plans jsonb storage (spec §12 bis: the full normalized
 * plan schema is a larger follow-up, this is the versioning piece that's
 * safe to ship without rewriting every plan-consuming screen). Version
 * numbers are computed client-side from the existing row count, which is
 * good enough for a single device generating a plan at a time — a real
 * concurrent-write guarantee would move this into a Postgres function.
 */
export async function insertPlanVersion(
  userId: string,
  planType: 'diet' | 'training',
  trigger: PlanVersionTrigger,
  algorithmVersion: string
): Promise<void> {
  const { count, error: countError } = await supabase
    .from('plan_versions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('plan_type', planType);
  if (countError) throw countError;

  const { error } = await supabase.from('plan_versions').insert({
    user_id: userId,
    plan_type: planType,
    version: (count ?? 0) + 1,
    status: 'active',
    trigger,
    algorithm_version: algorithmVersion,
  });
  if (error) throw error;
}
