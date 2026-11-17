import { buildUserContext, type Answers, type UserContext } from '@/domain/user-context';

import { WEEKDAY_PATTERN } from './exercise-library';

export type TrainingSchedule = {
  /** Weekday indices (0=Lun, matching WEEKDAY_LABELS/mondayIndex) assigned a gym session. */
  gymSlots: number[];
  /** Weekday indices assigned a running session. */
  runSlots: number[];
  /** 7-entry, true for any day in gymSlots or runSlots. */
  isTrainingDay: boolean[];
  /** Set when the requested sessions did not fit the available days: what was decided and why. */
  conflict: string | null;
};

/**
 * Single source of truth for "which weekdays are training days, and which
 * of those are gym vs running".
 *
 * Rules: gym/running frequency come from the questionnaire (less than weekly
 * counts as one session a week); the total never exceeds the days the person
 * can train; a week always keeps at least one rest day. When gym + running do
 * not fit, the activity the person said comes first (answer `trainingPriority`)
 * keeps its sessions; without an answer they share the days in proportion and
 * the plan says so, so the choice is never hidden.
 */
export function resolveSchedule(ctx: Pick<UserContext, 'training'>, override?: { availableDays?: number }): TrainingSchedule {
  const isTrainingDay: boolean[] = new Array(7).fill(false);
  const t = ctx.training;
  if (!t || (!t.gym && !t.running)) return { gymSlots: [], runSlots: [], isTrainingDay, conflict: null };

  // A check-in can change the days the person has: with only gym, the sessions follow the new days.
  const wantedGym = t.gym ? Math.max(override?.availableDays != null && !t.running ? override.availableDays : t.gym.daysPerWeek, 1) : 0;
  const wantedRun = t.running ? Math.max(t.running.daysPerWeek, 1) : 0;
  let gymDays = wantedGym;
  let runDays = wantedRun;
  const available = Math.max(1, Math.min(override?.availableDays ?? t.availableDays, 6));
  const wanted = gymDays + runDays;
  let conflict: string | null = null;
  if (wanted > available) {
    if (gymDays > 0 && runDays > 0) {
      if (available < 2) {
        if (t.priority === 'running') {
          runDays = 1;
          gymDays = 0;
        } else {
          runDays = 0;
          gymDays = 1;
        }
      } else if (t.priority === 'gym') {
        gymDays = Math.min(gymDays, available - 1);
        runDays = available - gymDays;
      } else if (t.priority === 'running') {
        runDays = Math.min(runDays, available - 1);
        gymDays = available - runDays;
      } else {
        gymDays = Math.max(1, Math.min(gymDays, Math.round((gymDays / wanted) * available)));
        runDays = Math.max(1, available - gymDays);
        if (gymDays + runDays > available) gymDays = available - runDays;
      }
      const who = t.priority === 'gym' ? 'la palestra ha la precedenza, come hai indicato' : t.priority === 'running' ? 'la corsa ha la precedenza, come hai indicato' : 'i giorni sono divisi in proporzione; puoi scegliere quale attività ha la precedenza nel profilo';
      conflict = `Hai chiesto ${wantedGym} sedute di palestra e ${wantedRun} di corsa ma hai ${available} giorni: ${who} (${gymDays} palestra, ${runDays} corsa).`;
    } else {
      gymDays = Math.min(gymDays, available);
      runDays = Math.min(runDays, available);
      if (wanted > available) conflict = `Hai chiesto ${wanted} sedute ma hai ${available} giorni disponibili: la scheda ne prevede ${gymDays + runDays}.`;
    }
  }
  gymDays = Math.min(gymDays, 6);
  runDays = Math.min(runDays, 6 - gymDays);

  const combined = Math.max(gymDays + runDays, 1);
  const dayIndices = WEEKDAY_PATTERN[combined] ?? WEEKDAY_PATTERN[3];
  const gymSlots = dayIndices.slice(0, gymDays);
  const runSlots = dayIndices.slice(gymDays, gymDays + runDays);
  for (const dayIdx of [...gymSlots, ...runSlots]) isTrainingDay[dayIdx] = true;
  return { gymSlots, runSlots, isTrainingDay, conflict };
}

/** Same as resolveSchedule, from raw questionnaire answers. */
export function resolveTrainingSchedule(answers: Answers): TrainingSchedule {
  return resolveSchedule(buildUserContext(answers));
}

/**
 * Assigns gym sessions and runs to the training weekdays so that hard runs
 * (intervals, tempo, long run) do not fall on the day before or after a leg
 * session, and two hard runs are not back to back. Small search: at most 6
 * days, so every arrangement is checked.
 */
export function arrangeWeek(days: number[], gym: { legDay: boolean }[], runs: { hard: boolean }[]): { gymAt: number[]; runAt: number[] } {
  const n = gym.length + runs.length;
  const slots = days.slice(0, n);
  let best: { cost: number; gymAt: number[]; runAt: number[] } | null = null;
  const choose = (start: number, k: number, acc: number[]): number[][] => {
    if (acc.length === k) return [acc];
    const out: number[][] = [];
    for (let i = start; i < n; i++) out.push(...choose(i + 1, k, [...acc, i]));
    return out;
  };
  for (const gymIdx of choose(0, gym.length, [])) {
    const runIdx = [...Array(n).keys()].filter((i) => !gymIdx.includes(i));
    const kind: ({ t: 'gym'; leg: boolean } | { t: 'run'; hard: boolean })[] = new Array(n);
    gymIdx.forEach((slot, i) => (kind[slot] = { t: 'gym', leg: gym[i].legDay }));
    runIdx.forEach((slot, i) => (kind[slot] = { t: 'run', hard: runs[i].hard }));
    let cost = 0;
    for (let i = 0; i < n; i++) {
      const a = kind[i];
      const bIdx = (i + 1) % n;
      const b = kind[bIdx];
      const adjacent = (slots[bIdx] - slots[i] + 7) % 7 === 1;
      if (!adjacent) continue;
      if (a.t === 'gym' && a.leg && b.t === 'run' && b.hard) cost += 3;
      if (a.t === 'run' && a.hard && b.t === 'gym' && b.leg) cost += 2;
      if (a.t === 'run' && a.hard && b.t === 'run' && b.hard) cost += 2;
      if (a.t === 'gym' && b.t === 'gym' && a.leg && b.leg) cost += 1;
    }
    // prefer gym earlier in the week on ties (stable output)
    cost += gymIdx.reduce((s, x) => s + x, 0) * 0.001;
    if (!best || cost < best.cost) best = { cost, gymAt: gymIdx.map((i) => slots[i]), runAt: runIdx.map((i) => slots[i]) };
  }
  return best ? { gymAt: best.gymAt, runAt: best.runAt } : { gymAt: [], runAt: [] };
}

/**
 * A session was missed: where (if anywhere) to make it up this week.
 * Only ONE missed session is recovered, on the next free day that is not the
 * day before another session of the same type; anything else is skipped rather
 * than piling up sessions. Returns the weekday index to move it to, or null.
 */
export function rescheduleMissed(week: { type: string; title: string }[], missedIdx: number, todayIdx: number, alreadyRecovered: boolean): number | null {
  if (alreadyRecovered) return null;
  const missed = week[missedIdx];
  if (!missed || missed.type === 'rest') return null;
  for (let d = Math.max(todayIdx, missedIdx + 1); d < 7; d++) {
    if (week[d].type !== 'rest') continue;
    const next = week[d + 1];
    const prev = week[d - 1];
    const sameNext = next && next.type === missed.type && next.title === missed.title;
    const samePrev = prev && prev.type === missed.type && prev.title === missed.title && d - 1 !== missedIdx;
    if (sameNext || samePrev) continue;
    return d;
  }
  return null;
}
