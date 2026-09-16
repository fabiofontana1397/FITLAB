import { supabase } from '@/lib/supabase/client';
import type { PlanStrategy } from '@/lib/planning/strategy-types';

/** Calls the generate-plan-strategy Edge Function. Returns null on any
 * failure (no Claude configured, network error, timeout) — callers must
 * treat null exactly like "no strategy available" and fall back to the
 * deterministic planner tables, never block onboarding on this. */
export async function fetchPlanStrategy(
  answers: Record<string, unknown>,
  dailyCalorieTarget: number,
  macroTargetsG: { protein: number; carbs: number; fats: number },
  durationMonths: number
): Promise<PlanStrategy | null> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-plan-strategy', {
      body: { answers, dailyCalorieTarget, macroTargetsG, durationMonths },
    });
    if (error) throw error;
    return (data?.strategy as PlanStrategy) ?? null;
  } catch (err) {
    console.warn('generate-plan-strategy unavailable, falling back to deterministic planner', err);
    return null;
  }
}
