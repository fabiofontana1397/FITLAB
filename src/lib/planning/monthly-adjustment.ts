/**
 * Monthly plan re-evaluation (spec §0.4, punto 2) — a first-pass, explicitly
 * refinable proposal: at the end of each plan month, combine the tracked
 * weight trend (when available) with the check-in questionnaire's own
 * signal to nudge next month's calorie target by a small, capped step —
 * same "small step, never a wholesale recompute" philosophy as the Adaptive
 * Nutrition Engine (supabase/functions/adaptation-evaluate), kept as a
 * separate client-side function here since this trigger is questionnaire-
 * driven and month-boundary-gated rather than an on-demand trend-only
 * review. Never a from-scratch plan: only the calorie/macro target changes,
 * the underlying planner (diet-planner.ts/training-planner.ts) still
 * regenerates using the SAME original questionnaire answers, so food/
 * exercise selection stays governed by the same preferences throughout.
 */
import type { BodyMetricSnapshot, Goal } from '@/lib/mock/types';
import { MIN_SAFE_CALORIE_TARGET } from '@/lib/nutrition/targets';

const LOOKBACK_DAYS = 30;
const CALORIE_STEP = 100;

export type MonthlyTrend = {
  /** Weight change over the lookback window, or null with fewer than 2
   * weigh-ins in that window — matches the Adaptive Engine's own "not
   * enough data quality" gate, spec §4.1 bis. */
  weightDeltaKg: number | null;
};

/** Weight change over the last `LOOKBACK_DAYS` days ending on `today`, from
 * whatever body_metrics entries are already loaded client-side (same data
 * Home/Body already read — no extra fetch needed). */
export function computeMonthlyWeightTrend(entries: BodyMetricSnapshot[], today: string): MonthlyTrend {
  const cutoff = new Date(new Date(today).getTime() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const inWindow = entries.filter((e) => e.date >= cutoff && e.date <= today && e.weightKg > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (inWindow.length < 2) return { weightDeltaKg: null };
  return { weightDeltaKg: inWindow[inWindow.length - 1].weightKg - inWindow[0].weightKg };
}

// Weekly rate-of-change corridor considered "on track" per goal — outside
// it, the target nudges by one CALORIE_STEP toward the corridor rather than
// jumping straight to a "correct" value, same hysteresis-by-small-steps
// idea as the Adaptive Engine.
const ON_TRACK_WEEKLY_RATE: Partial<Record<Goal, { min: number; max: number }>> = {
  loseFat: { min: -1.2, max: -0.15 },
  gainMuscle: { min: 0.05, max: 0.5 },
  gainStrength: { min: 0.05, max: 0.5 },
};

/**
 * Next month's calorie target: unchanged with no trend data (never guess),
 * nudged by one CALORIE_STEP if the trend fell outside the goal's "on
 * track" weekly-rate corridor, and further adjusted by ±50 kcal when the
 * check-in itself reports persistent hunger or the opposite. Clamped to
 * MIN_SAFE_CALORIE_TARGET.
 */
export function adjustMonthlyCalorieTarget(currentTarget: number, goal: Goal, trend: MonthlyTrend, checkinAnswers: Record<string, unknown>): number {
  let next = currentTarget;
  const corridor = ON_TRACK_WEEKLY_RATE[goal];
  if (trend.weightDeltaKg != null && corridor) {
    const weeklyRateKg = trend.weightDeltaKg / (LOOKBACK_DAYS / 7);
    if (weeklyRateKg > corridor.max) next -= CALORIE_STEP; // not progressing fast enough toward the goal
    else if (weeklyRateKg < corridor.min) next += CALORIE_STEP; // progressing unsafely fast
  }

  const hunger = checkinAnswers.checkinHungerLevel;
  if (hunger === 'always' || hunger === 'often') next += 50;
  else if (hunger === 'never') next -= 50;

  return Math.max(Math.round(next), MIN_SAFE_CALORIE_TARGET);
}

/** Scales macroTargetsG by the same ratio the calorie target itself moved
 * by — keeps the macro split proportionally consistent instead of leaving
 * protein/carbs/fats stale relative to a changed calorie target. */
export function scaleMacrosForTarget(
  macroTargetsG: { protein: number; carbs: number; fats: number },
  previousCalorieTarget: number,
  nextCalorieTarget: number
): { protein: number; carbs: number; fats: number } {
  const ratio = previousCalorieTarget > 0 ? nextCalorieTarget / previousCalorieTarget : 1;
  return {
    protein: Math.round(macroTargetsG.protein * ratio),
    carbs: Math.round(macroTargetsG.carbs * ratio),
    fats: Math.round(macroTargetsG.fats * ratio),
  };
}
