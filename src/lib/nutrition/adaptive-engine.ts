/**
 * Adaptive Nutrition Engine (FITLAB_SPEC.md §4.1 bis) — a scoped, MVP
 * version of the "cambio di paradigma centrale" the redesign guide asks
 * for: instead of a background/cron job, this is a pure decision function
 * that a client-triggered review action (see user-store.ts's
 * reviewNutritionTarget) calls on demand with the user's own logged data.
 *
 * The point is the same either way: the calorie target computed once at
 * onboarding (lib/nutrition/targets.ts) is an `initial_estimate`, not a
 * ground truth — this function looks at what actually happened (weight
 * trend vs. logged intake) and proposes a small, hysteresis-bounded
 * correction only when there's enough data to trust the trend and the
 * trend clearly isn't matching the goal.
 */
import type { Goal } from '@/lib/mock/types';

export type TrendWindowDays = 7 | 14 | 21;

export type AdaptationAction = 'none' | 'increase' | 'decrease';

export type AdaptationDecision = {
  action: AdaptationAction;
  /** Suggested calorie change, always positive — caller applies the sign implied by `action`. 0 when action is 'none'. */
  deltaKcal: number;
  reason: string;
  weeklyRateKg: number | null;
  loggedDaysInWindow: number;
};

export type WeightPoint = { date: string; weightKg: number };
export type IntakePoint = { date: string; kcal: number };

// Data-quality bar: need at least this many logged days inside the trend
// window before trusting a trend enough to act on it — an isolated weigh-in
// or two shouldn't move the target.
const MIN_LOGGED_DAYS_FOR_TREND = 5;
// Single-step size for a correction — conservative on purpose; repeated
// reviews compound gradually rather than one review overcorrecting.
const STEP_KCAL = 100;
// Weekly weight-change band (kg/week) treated as "on track" / "stable
// enough to leave alone" — the isteresi that stops a routine day-to-day
// oscillation from triggering a correction.
const HYSTERESIS_KG_PER_WEEK = 0.1;

function windowCutoffISO(days: number): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff.toISOString().slice(0, 10);
}

function inWindow<T extends { date: string }>(series: T[], days: number): T[] {
  const cutoff = windowCutoffISO(days);
  return series.filter((p) => p.date >= cutoff);
}

/** First-vs-last over the window, normalized to kg/week — a deliberately
 * simple trend estimate (a real linear regression is a further
 * refinement), good enough to gate a small, bounded nudge. */
function weeklyRateKg(points: WeightPoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const days = Math.max((new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000, 1);
  return ((last.weightKg - first.weightKg) / days) * 7;
}

function fmtRate(rate: number): string {
  return `${rate >= 0 ? '+' : ''}${rate.toFixed(2)}kg/settimana`;
}

/**
 * `weightSeries`/`intakeSeries` should already be ascending by date and
 * deduplicated to one point per day (callers: user-store.ts aggregates
 * body-store/nutrition-store entries before calling this).
 */
export function evaluateAdaptation(input: {
  goal: Goal;
  weightSeries: WeightPoint[];
  intakeSeries: IntakePoint[];
  windowDays?: TrendWindowDays;
}): AdaptationDecision {
  const windowDays = input.windowDays ?? 14;
  const recentWeights = inWindow(input.weightSeries, windowDays);
  const recentIntake = inWindow(input.intakeSeries, windowDays);
  const loggedDaysInWindow = Math.min(recentWeights.length, recentIntake.length);

  if (recentWeights.length < MIN_LOGGED_DAYS_FOR_TREND || recentIntake.length < MIN_LOGGED_DAYS_FOR_TREND) {
    return {
      action: 'none',
      deltaKcal: 0,
      reason: `Dati insufficienti per una stima affidabile (${recentWeights.length} pesate, ${recentIntake.length} giorni di intake negli ultimi ${windowDays} giorni, minimo richiesto ${MIN_LOGGED_DAYS_FOR_TREND}).`,
      weeklyRateKg: null,
      loggedDaysInWindow,
    };
  }

  const rate = weeklyRateKg(recentWeights);
  if (rate == null) {
    return { action: 'none', deltaKcal: 0, reason: 'Trend peso non calcolabile.', weeklyRateKg: null, loggedDaysInWindow };
  }

  const expectedDirection = input.goal === 'loseFat' ? -1 : input.goal === 'gainMuscle' || input.goal === 'gainStrength' ? 1 : 0;

  // Maintenance-type goals: any drift beyond the hysteresis band in either
  // direction gets a small correction back toward stable.
  if (expectedDirection === 0) {
    if (Math.abs(rate) <= HYSTERESIS_KG_PER_WEEK) {
      return { action: 'none', deltaKcal: 0, reason: `Peso stabile (${fmtRate(rate)}), in linea con l'obiettivo.`, weeklyRateKg: rate, loggedDaysInWindow };
    }
    return rate > 0
      ? { action: 'decrease', deltaKcal: STEP_KCAL, reason: `Il peso sta salendo (${fmtRate(rate)}) oltre la soglia di mantenimento.`, weeklyRateKg: rate, loggedDaysInWindow }
      : { action: 'increase', deltaKcal: STEP_KCAL, reason: `Il peso sta scendendo (${fmtRate(rate)}) oltre la soglia di mantenimento.`, weeklyRateKg: rate, loggedDaysInWindow };
  }

  const onTrack = Math.sign(rate) === expectedDirection && Math.abs(rate) >= HYSTERESIS_KG_PER_WEEK;
  if (onTrack) {
    return { action: 'none', deltaKcal: 0, reason: `Trend coerente con l'obiettivo (${fmtRate(rate)}).`, weeklyRateKg: rate, loggedDaysInWindow };
  }

  if (expectedDirection < 0) {
    return {
      action: 'decrease',
      deltaKcal: STEP_KCAL,
      reason: `Il calo peso è più lento del previsto (${fmtRate(rate)}).`,
      weeklyRateKg: rate,
      loggedDaysInWindow,
    };
  }
  return {
    action: 'increase',
    deltaKcal: STEP_KCAL,
    reason: `L'aumento peso è più lento del previsto (${fmtRate(rate)}).`,
    weeklyRateKg: rate,
    loggedDaysInWindow,
  };
}
