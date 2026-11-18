import type { BodyArea } from '../exercise-library';
import type { MuscleGroup } from './catalog';

/**
 * What the monthly adaptation can change in the next months of training.
 * Persisted inside PlanCalibration (jsonb), so it survives app restarts and server sync.
 * Every field is optional: an empty object means "as planned".
 */
export type TrainingCalibration = {
  /** Multiplier on the planned weekly volume (sets) of every muscle group: 0.6 – 1.15. */
  volumeFactor?: number;
  /** Per-group weekly set change on top of volumeFactor (e.g. +2 sets for a group that progresses and recovers well). */
  groupSets?: Partial<Record<MuscleGroup, number>>;
  /** Added to every RIR target (positive = further from failure). −1 … +2. */
  rirShift?: number;
  /** First week of the next month is a deload (≈ −40% sets, RIR +2). */
  deloadFirstWeek?: boolean;
  /** Days per week the person can now train (check-in answer). */
  availableDays?: number;
  /** Shorter sessions requested (questionnaire bucket id). */
  sessionBucket?: string;
  /** Split requested at the check-in. */
  split?: 'fullBody' | 'upperLower' | 'pushPullLegs';
  /** Areas reported as painful: exercises loading them are excluded and their progression is frozen. */
  avoidAreas?: BodyArea[];
  /** Exercises to replace (disliked, painful, not executable). */
  replaceIds?: string[];
  /** Month index from which this calibration applies. */
  fromMonth?: number;
  /** Engine v5: months in which running did not progress (poor recovery): the running progression is shifted back. */
  runHoldMonths?: number;
  /** Engine v5: recovery verdict of each check-in so far (oldest first): decisions look at the trend, not one answer. */
  recoveryLog?: ('good' | 'ok' | 'poor')[];
  /** Engine v5: why the last decision about recovery was taken (shown in the plan). */
  recoveryNote?: string;
};

/** One exercise's performance over the month that just ended, from the logged sets. */
export type ExercisePerformance = {
  exerciseId: string;
  name: string;
  /** Best estimated 1RM (Epley) of the first and last session in the month. */
  firstE1rm: number;
  lastE1rm: number;
  sessions: number;
  /** Average RIR logged, when available. */
  avgRir: number | null;
};
