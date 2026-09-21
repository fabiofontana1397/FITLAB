import { WEEKDAY_PATTERN } from './exercise-library';

function freqNum(value: unknown): number {
  if (value === '6+') return 6;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function availableDaysNum(value: unknown): number {
  if (value === '6+') return 6;
  if (value === 'variable') return 4;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

export type TrainingSchedule = {
  /** Weekday indices (0=Lun, matching WEEKDAY_LABELS/mondayIndex) assigned a gym session. */
  gymSlots: number[];
  /** Weekday indices assigned a running session. */
  runSlots: number[];
  /** 7-entry, true for any day in gymSlots or runSlots — the single thing
   * diet-planner.ts needs to know to tell a "giorno di allenamento" from a
   * "giorno di riposo" apart (spec §0.4's diet examples: two different day
   * types, not one flat calorie target every day). */
  isTrainingDay: boolean[];
};

/**
 * Single source of truth for "which weekdays are training days, and which
 * of those are gym vs running" — training-planner.ts uses the full
 * gym/run split to decide what kind of session goes where; diet-planner.ts
 * only needs isTrainingDay. Previously this gym/run day-count-and-balance
 * logic only existed inline in training-planner.ts; extracted so a second
 * caller can't silently drift out of sync with it.
 */
export function resolveTrainingSchedule(answers: Record<string, unknown>): TrainingSchedule {
  const activities = Array.isArray(answers.activitiesPracticed) ? (answers.activitiesPracticed as string[]) : [];
  const practicesGym = activities.includes('gym');
  const practicesRunning = activities.includes('running');
  const isTrainingDay = new Array(7).fill(false);
  if (!practicesGym && !practicesRunning) return { gymSlots: [], runSlots: [], isTrainingDay };

  const totalAvailable = availableDaysNum(answers.availableDays);
  let gymDays = practicesGym ? freqNum(answers.freq_gym) || 3 : 0;
  let runDays = practicesRunning ? freqNum(answers.freq_running) || 2 : 0;
  const totalWanted = gymDays + runDays;
  if (totalWanted > totalAvailable && totalWanted > 0) {
    gymDays = Math.max(practicesGym ? 1 : 0, Math.round((gymDays / totalWanted) * totalAvailable));
    runDays = Math.max(practicesRunning ? 1 : 0, totalAvailable - gymDays);
  }
  gymDays = Math.min(gymDays, 6);
  runDays = Math.min(runDays, 6 - gymDays);

  const combinedDays = Math.max(gymDays + runDays, 1);
  const dayIndices = WEEKDAY_PATTERN[combinedDays] ?? WEEKDAY_PATTERN[3];
  const gymSlots = dayIndices.slice(0, gymDays);
  const runSlots = dayIndices.slice(gymDays, gymDays + runDays);
  for (const dayIdx of [...gymSlots, ...runSlots]) isTrainingDay[dayIdx] = true;
  return { gymSlots, runSlots, isTrainingDay };
}
