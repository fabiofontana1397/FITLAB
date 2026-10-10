/**
 * Personal energy calibration from health-app data (Apple Salute / Health
 * Connect): turns the last weeks of measured days into the two corrections the
 * energy model accepts (domain/energy.ts `EnergyCalibration`).
 *
 * - Resting kcal: the median of the measured basal energy of finished days.
 *   Needs at least 3 days, so one odd reading never moves it.
 * - Exercise factor: on a finished day, the active kcal above a normal rest
 *   day's active kcal is what the planned session really cost. Its ratio to
 *   the MET estimate, median over at least 2 workout days, scales every future
 *   session estimate. A phone alone barely records a gym session (no heart
 *   rate): when workout days look no different from rest days, the factor is
 *   not learned rather than pushed down.
 *
 * Pure TypeScript, no stores.
 */
import { sessionKcal, type EnergyCalibration, type SessionLike } from './energy';
import type { UserContext } from './user-context';

export type HealthDayData = { date: string; steps?: number; activeKcal?: number; basalKcal?: number };

export type PlannedDay = { session: SessionLike | null | undefined; completion: number };

export type CalibrationResult = EnergyCalibration & {
  /** Days with a measured basal energy the resting kcal comes from. */
  restingDays: number;
  /** Workout days the exercise factor comes from. */
  workoutDays: number;
};

const MIN_RESTING_DAYS = 3;
const MIN_WORKOUT_DAYS = 2;
const MIN_REST_DAYS = 2;
const FACTOR_RANGE = { min: 0.6, max: 1.6 } as const;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * @param days measured days (any order); today and future days are ignored.
 * @param plannedFor the planned session of a date and how much of it was done.
 */
export function calibrateEnergy(
  days: HealthDayData[],
  ctx: Pick<UserContext, 'training' | 'weightKg'>,
  plannedFor: (date: string) => PlannedDay,
  today: string
): CalibrationResult {
  const finished = days.filter((d) => d.date < today);

  const basal = finished.map((d) => d.basalKcal).filter((v): v is number => v != null && v > 500 && v < 5000);
  const restingKcal = basal.length >= MIN_RESTING_DAYS ? Math.round(median(basal)) : undefined;

  const restActive: number[] = [];
  const workouts: { active: number; estimate: number }[] = [];
  for (const d of finished) {
    if (d.activeKcal == null || d.activeKcal <= 0) continue;
    const { session, completion } = plannedFor(d.date);
    const estimate = sessionKcal(session, ctx) * completion;
    if (!session || session.type === 'rest' || completion === 0) restActive.push(d.activeKcal);
    else if (completion >= 0.5 && estimate > 0) workouts.push({ active: d.activeKcal, estimate });
  }

  let exerciseFactor: number | undefined;
  if (restActive.length >= MIN_REST_DAYS && workouts.length >= MIN_WORKOUT_DAYS) {
    const baseline = median(restActive);
    const ratio = median(workouts.map((w) => (w.active - baseline) / w.estimate));
    // Below 0.4 the device is not recording the sessions (phone in the locker): nothing to learn.
    if (ratio >= 0.4) exerciseFactor = Math.round(Math.min(Math.max(ratio, FACTOR_RANGE.min), FACTOR_RANGE.max) * 100) / 100;
  }

  return { restingKcal, exerciseFactor, restingDays: basal.length, workoutDays: exerciseFactor != null ? workouts.length : 0 };
}
