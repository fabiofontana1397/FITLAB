/**
 * The app's single energy-expenditure model.
 *
 * Everything that talks about calories burned — the calorie targets in the
 * diet plan, Home's "kcal bruciate" and weekly goal, the recalibration engine —
 * calls these functions, so they can never disagree.
 *
 *   total(day) = resting (BMR) + everyday activity (NEAT) + planned exercise
 *
 * - BMR: Mifflin–St Jeor.
 * - NEAT: BMR × (job factor + small steps/sleep nudges) − BMR, i.e. everything
 *   except planned training (the job factors already include normal leisure).
 * - Exercise: NET kcal of a session (MET − 1, because the resting part is
 *   already inside BMR), from the session's real length and the person's weight.
 *
 * An ESTIMATE, never a measurement — wearable data does not feed it.
 */
import type { TrainingDayPlan } from '@/lib/planning/types';

import type { UserContext } from './user-context';

const JOB_FACTOR: Record<UserContext['lifestyle']['job'], number> = {
  sedentary: 1.2,
  seatedMobile: 1.3,
  standing: 1.4,
  active: 1.6,
  veryHeavy: 1.8,
};

// Small additive nudges on top of the job factor.
const STEPS_BUMP: Record<UserContext['lifestyle']['steps'], number> = {
  lt3000: -0.03,
  '3000-5000': 0,
  '5000-8000': 0.02,
  '8000-12000': 0.05,
  gt12000: 0.08,
  unknown: 0,
};
const SLEEP_BUMP: Record<UserContext['lifestyle']['sleep'], number> = { lt5: -0.03, '5-6': -0.01, '6-7': 0, '7-8': 0.01, gt8: 0 };

/** Net MET (gross MET − 1) of the two kinds of session the app plans. */
const NET_MET_GYM = 4; // weight training ≈ 5 MET gross
const NET_MET_RUN = 8; // easy-to-moderate running ≈ 9 MET gross

export function bmr(ctx: Pick<UserContext, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * ctx.weightKg + 6.25 * ctx.heightCm - 5 * ctx.age;
  if (ctx.sex === 'male') return base + 5;
  if (ctx.sex === 'female') return base - 161;
  return base - 78; // midpoint when unspecified
}

/** Multiplier on BMR for everyday life (everything except planned training). */
export function neatFactor(lifestyle: UserContext['lifestyle']): number {
  const f = JOB_FACTOR[lifestyle.job] + STEPS_BUMP[lifestyle.steps] + SLEEP_BUMP[lifestyle.sleep];
  return Math.min(Math.max(f, 1.15), 2);
}

/** Resting + everyday activity, no planned training. */
export function baselineKcal(ctx: Pick<UserContext, 'sex' | 'age' | 'heightCm' | 'weightKg' | 'lifestyle'>): { resting: number; everyday: number; total: number } {
  const resting = bmr(ctx);
  const total = resting * neatFactor(ctx.lifestyle);
  return { resting: Math.round(resting), everyday: Math.round(total - resting), total: Math.round(total) };
}

export function gymSessionKcal(weightKg: number, minutes: number): number {
  return Math.round(NET_MET_GYM * weightKg * (minutes / 60));
}

export function runSessionKcal(weightKg: number, minutes: number): number {
  return Math.round(NET_MET_RUN * weightKg * (minutes / 60));
}

/** Minutes of a running session described in text ("Corsa facile 35 min", "Lungo lento 60-70 min", "Ripetute 6-8×400m…"). */
export function parseRunMinutes(note: string | undefined, fallback = 35): number {
  const m = (note ?? '').match(/(\d+)\s*(?:-\s*(\d+))?\s*min/);
  if (!m) return fallback;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  return Math.round((lo + hi) / 2);
}

export type SessionLike = Pick<TrainingDayPlan, 'type'> & { note?: string };

/** Minutes a planned day takes (0 on a rest day). */
export function sessionMinutes(day: SessionLike | null | undefined, ctx: Pick<UserContext, 'training'>): number {
  if (!day || day.type === 'rest') return 0;
  if (day.type === 'cardio') return parseRunMinutes(day.note);
  return ctx.training?.sessionMinutes ?? 52;
}

/** Net kcal of the planned session of a day (0 on a rest day). */
export function sessionKcal(day: SessionLike | null | undefined, ctx: Pick<UserContext, 'training' | 'weightKg'>): number {
  if (!day || day.type === 'rest') return 0;
  const minutes = sessionMinutes(day, ctx);
  return day.type === 'cardio' ? runSessionKcal(ctx.weightKg, minutes) : gymSessionKcal(ctx.weightKg, minutes);
}

export type DayEnergy = { resting: number; everyday: number; exercise: number; total: number };

/**
 * Expenditure of one day. `completion` scales the planned session (a half-
 * finished workout earns half of its exercise kcal); `extraKcal` adds
 * manually logged activities.
 */
export function dayEnergy(
  ctx: Pick<UserContext, 'sex' | 'age' | 'heightCm' | 'weightKg' | 'lifestyle' | 'training'>,
  day: SessionLike | null | undefined,
  completion = 1,
  extraKcal = 0
): DayEnergy {
  const base = baselineKcal(ctx);
  const exercise = Math.round(sessionKcal(day, ctx) * Math.min(Math.max(completion, 0), 1)) + extraKcal;
  return { resting: base.resting, everyday: base.everyday, exercise, total: base.resting + base.everyday + exercise };
}

/** The seven days (Monday first) with the average, for a planned week. */
export function weekEnergy(
  ctx: Pick<UserContext, 'sex' | 'age' | 'heightCm' | 'weightKg' | 'lifestyle' | 'training'>,
  week: (SessionLike | null | undefined)[] | null
): { days: DayEnergy[]; averageTotal: number; weeklyTotal: number; averageExercise: number } {
  const days = Array.from({ length: 7 }, (_, i) => dayEnergy(ctx, week?.[i] ?? null));
  const weeklyTotal = days.reduce((s, d) => s + d.total, 0);
  const averageExercise = days.reduce((s, d) => s + d.exercise, 0) / 7;
  return { days, averageTotal: weeklyTotal / 7, weeklyTotal, averageExercise };
}
