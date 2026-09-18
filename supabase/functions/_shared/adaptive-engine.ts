// Deno copy of src/lib/nutrition/adaptive-engine.ts's evaluateAdaptation —
// deliberately duplicated (same convention as _shared/agents/types.ts's
// ClientContext) because Deno Edge Functions and the Expo/RN client don't
// share a bundler here. Keep both in sync by hand if the algorithm changes.
// This is the copy that actually runs: adaptation-evaluate/index.ts is the
// "POST /adaptation/evaluate" domain endpoint (spec §14) — the real
// decision now runs server-side against RLS-scoped data, not duplicated
// client-side logic re-deriving it from locally-cached stores.

// Bump whenever evaluateAdaptation's logic changes materially — recorded
// on every plan_versions row this function inserts (spec §12 bis, §4.2).
export const ALGORITHM_VERSION = 'adaptive-engine-2026-09-19-p1';

export type AdaptationAction = 'none' | 'increase' | 'decrease';

export type AdaptationDecision = {
  action: AdaptationAction;
  deltaKcal: number;
  reason: string;
  weeklyRateKg: number | null;
  loggedDaysInWindow: number;
};

export type WeightPoint = { date: string; weightKg: number };
export type IntakePoint = { date: string; kcal: number };

const MIN_LOGGED_DAYS_FOR_TREND = 5;
const STEP_KCAL = 100;
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

export function evaluateAdaptation(input: {
  goal: string;
  weightSeries: WeightPoint[];
  intakeSeries: IntakePoint[];
  windowDays?: 7 | 14 | 21;
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

  if (expectedDirection === 0) {
    if (Math.abs(rate) <= HYSTERESIS_KG_PER_WEEK) {
      return { action: 'none', deltaKcal: 0, reason: `Peso stabile (${fmtRate(rate)}), in linea con l'obiettivo.`, weeklyRateKg: rate, loggedDaysInWindow };
    }
    return rate > 0
      ? {
          action: 'decrease',
          deltaKcal: STEP_KCAL,
          reason: `Il peso sta salendo (${fmtRate(rate)}) oltre la soglia di mantenimento.`,
          weeklyRateKg: rate,
          loggedDaysInWindow,
        }
      : {
          action: 'increase',
          deltaKcal: STEP_KCAL,
          reason: `Il peso sta scendendo (${fmtRate(rate)}) oltre la soglia di mantenimento.`,
          weeklyRateKg: rate,
          loggedDaysInWindow,
        };
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
