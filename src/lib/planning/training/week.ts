/**
 * The prescription the person sees on a given date: the month's ordinary session with that
 * week's parameters applied (engine v4 stores them on each exercise — TrainingExerciseEntry.weeks).
 * A conditional week (deload "if needed") is not applied automatically: the ordinary week is shown
 * and the exercise carries the conditional prescription for the UI to offer.
 */
import { addDaysISO } from '@/lib/mock/dates';

import type { TrainingDayPlan, TrainingExerciseEntry } from '../types';

/** Week of the plan month (1–4; days 29–30 count as week 4). */
export function weekOfMonth(plan: { generatedAt: string }, monthIndex: number, dateISO: string): number {
  const start = addDaysISO(plan.generatedAt.slice(0, 10), (monthIndex - 1) * 30);
  const days = Math.round((Date.parse(dateISO) - Date.parse(start)) / 86_400_000);
  return Math.min(4, Math.max(1, Math.floor(Math.max(0, days) / 7) + 1));
}

export function exerciseForWeek(x: TrainingExerciseEntry, week: number): TrainingExerciseEntry {
  const w = x.weeks?.find((y) => y.week === week);
  if (!w || w.conditional) return x;
  return {
    ...x,
    sets: w.sets,
    reps: w.reps,
    rir: w.rir ?? x.rir,
    rpe: w.rpe ?? x.rpe,
    restSec: w.restSec,
    suggestedKg: w.suggestedKg !== undefined ? w.suggestedKg : x.suggestedKg,
    technique: w.technique === null ? undefined : (w.technique ?? x.technique),
    activeWeek: { week, ...(w.deload ? { deload: true } : {}), ...(w.note ? { note: w.note } : {}) },
  };
}

export function dayForWeek(d: TrainingDayPlan | undefined, week: number): TrainingDayPlan | undefined {
  if (!d) return d;
  if (d.type === 'workout') {
    const exercises = (d.exercises ?? []).map((x) => exerciseForWeek(x, week));
    const before = (d.exercises ?? []).reduce((a, x) => a + x.sets, 0);
    const after = exercises.reduce((a, x) => a + x.sets, 0);
    // fewer sets → a shorter session (warm-up and set-up stay)
    const estimatedMinutes = d.estimatedMinutes && before > 0 && after !== before ? Math.round(8 + (d.estimatedMinutes - 8) * (after / before)) : d.estimatedMinutes;
    return { ...d, exercises, estimatedMinutes };
  }
  if (d.type === 'cardio' && d.run?.weeks) {
    const w = d.run.weeks.find((y) => y.week === week);
    if (w && w.minutes !== d.run.minutes) return { ...d, note: `${d.title} ${w.minutes} min${w.note ? ` · ${w.note}` : ''}`, estimatedMinutes: w.minutes, run: { ...d.run, minutes: w.minutes } };
  }
  return d;
}
