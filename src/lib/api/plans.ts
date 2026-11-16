// Repository module for plan-store.ts. One row per user per plan type
// (upsert-on-regenerate, matching the app's existing "replace wholesale"
// behavior) — the deeply-nested `months` tree stays a single jsonb
// column, only the top-level metadata (generatedAt/durationMonths/goal)
// gets real columns. See supabase/migrations/0006_plans.sql for the
// schema_version rationale.
import { supabase } from '@/lib/supabase/client';
import type { DietMonthPlan, DietPlan, TrainingMonthPlan, TrainingPlan } from '@/lib/planning/types';

/**
 * What a plan carries besides its months: which generator built it, whether it is the person's own card or diet, and the
 * monthly recalibration state. The tables have no column for it and `plan` must stay an array of months (the admin views
 * and the notification function read it that way), so it travels on the first month under `planMeta` and is lifted
 * back out on read. Without it a plan read from the server looked outdated and was rebuilt, losing a custom card.
 */
type PlanMeta = Pick<TrainingPlan, 'engine' | 'source' | 'calibration' | 'recalibrations'> & { needsManualReview?: boolean };

function packMonths<M extends object>(months: M[], meta: PlanMeta): M[] {
  return months.map((month, i) => (i === 0 ? { ...month, planMeta: meta } : month));
}

function unpackMonths<M extends object>(raw: unknown): { months: M[]; meta: PlanMeta } {
  const rows = (Array.isArray(raw) ? raw : []) as (M & { planMeta?: PlanMeta })[];
  const meta = rows[0]?.planMeta ?? {};
  return { months: rows.map(({ planMeta: _meta, ...month }) => month as unknown as M), meta };
}

export async function fetchDietPlan(userId: string): Promise<DietPlan | null> {
  const { data, error } = await supabase
    .from('diet_plans')
    .select('generated_at, duration_months, goal, plan')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { months, meta } = unpackMonths<DietMonthPlan>(data.plan);
  return { generatedAt: data.generated_at, durationMonths: data.duration_months, goal: data.goal, months, engine: meta.engine, source: meta.source, calibration: meta.calibration, recalibrations: meta.recalibrations };
}

export async function upsertDietPlan(userId: string, plan: DietPlan): Promise<void> {
  const { error } = await supabase.from('diet_plans').upsert(
    {
      user_id: userId,
      generated_at: plan.generatedAt,
      duration_months: plan.durationMonths,
      goal: plan.goal,
      plan: packMonths(plan.months, { engine: plan.engine, source: plan.source, calibration: plan.calibration, recalibrations: plan.recalibrations }),
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
  const { months, meta } = unpackMonths<TrainingMonthPlan>(data.plan);
  return { generatedAt: data.generated_at, durationMonths: data.duration_months, months, engine: meta.engine, source: meta.source, calibration: meta.calibration, recalibrations: meta.recalibrations, needsManualReview: meta.needsManualReview };
}

export async function upsertTrainingPlan(userId: string, plan: TrainingPlan): Promise<void> {
  const { error } = await supabase.from('training_plans').upsert(
    {
      user_id: userId,
      generated_at: plan.generatedAt,
      duration_months: plan.durationMonths,
      plan: packMonths(plan.months, { engine: plan.engine, source: plan.source, calibration: plan.calibration, recalibrations: plan.recalibrations, needsManualReview: plan.needsManualReview }),
    },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

export async function deleteTrainingPlan(userId: string): Promise<void> {
  const { error } = await supabase.from('training_plans').delete().eq('user_id', userId);
  if (error) throw error;
}

export type PlanVersionTrigger = 'onboarding' | 'regenerate' | 'adaptation' | 'monthly_checkin';

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
