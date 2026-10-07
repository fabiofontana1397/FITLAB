import { buildUserContext, type Answers, type UserContext } from '@/domain/user-context';

import { WEEKDAY_PATTERN } from './exercise-library';

export type TrainingSchedule = {
  /** Weekday indices (0=Lun, matching WEEKDAY_LABELS/mondayIndex) assigned a gym session. */
  gymSlots: number[];
  /** Weekday indices assigned a running session. */
  runSlots: number[];
  /** 7-entry, true for any day in gymSlots or runSlots. */
  isTrainingDay: boolean[];
};

/**
 * Single source of truth for "which weekdays are training days, and which
 * of those are gym vs running".
 *
 * Rules: gym/running frequency come from the questionnaire (less than weekly
 * counts as one session a week); the total never exceeds the days the person
 * can train; when there are not enough days, gym and running share them in
 * proportion, each keeping at least one if there is room; a week always keeps
 * at least one rest day.
 */
export function resolveSchedule(ctx: Pick<UserContext, 'training'>): TrainingSchedule {
  const isTrainingDay: boolean[] = new Array(7).fill(false);
  const t = ctx.training;
  if (!t || (!t.gym && !t.running)) return { gymSlots: [], runSlots: [], isTrainingDay };

  let gymDays = t.gym ? Math.max(t.gym.daysPerWeek, 1) : 0;
  let runDays = t.running ? Math.max(t.running.daysPerWeek, 1) : 0;
  const available = Math.min(t.availableDays, 6);
  const wanted = gymDays + runDays;
  if (wanted > available) {
    if (gymDays > 0 && runDays > 0) {
      if (available >= 2) {
        gymDays = Math.max(1, Math.min(gymDays, Math.round((gymDays / wanted) * available)));
        runDays = Math.max(1, available - gymDays);
        if (gymDays + runDays > available) gymDays = available - runDays;
      } else {
        runDays = 0; // a single day: the gym session wins
        gymDays = 1;
      }
    } else {
      gymDays = Math.min(gymDays, available);
      runDays = Math.min(runDays, available);
    }
  }
  gymDays = Math.min(gymDays, 6);
  runDays = Math.min(runDays, 6 - gymDays);

  const combined = Math.max(gymDays + runDays, 1);
  const dayIndices = WEEKDAY_PATTERN[combined] ?? WEEKDAY_PATTERN[3];
  const gymSlots = dayIndices.slice(0, gymDays);
  const runSlots = dayIndices.slice(gymDays, gymDays + runDays);
  for (const dayIdx of [...gymSlots, ...runSlots]) isTrainingDay[dayIdx] = true;
  return { gymSlots, runSlots, isTrainingDay };
}

/** Same as resolveSchedule, from raw questionnaire answers. */
export function resolveTrainingSchedule(answers: Answers): TrainingSchedule {
  return resolveSchedule(buildUserContext(answers));
}
