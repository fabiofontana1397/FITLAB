/**
 * What the person actually did during a plan month — the facts the monthly
 * recalibration (domain/recalibration.ts) works from. Pure: callers pass in the
 * logged data from the stores.
 */
import type { Adherence, CheckinSignals, WeightPoint } from '@/domain/recalibration';
import { addDaysISO, isoMondayIndex } from '@/lib/mock/dates';
import type { LoggedActivity } from '@/lib/api/activity-log';
import type { BodyMetricSnapshot } from '@/lib/mock/types';
import type { TrainingPlan } from '@/lib/planning/types';
import { macrosForEntry, type MealFoodEntry } from '@/store/nutrition-store';
import { isExerciseCompleted } from '@/store/training-progress-store';

const MONTH_DAYS = 30;

/** First and last day (ISO) of a plan month: a fixed 30-day block from the plan's start date. */
export function monthWindow(plan: { generatedAt: string }, monthIndex: number): { start: string; end: string } {
  const planStart = plan.generatedAt.slice(0, 10);
  const start = addDaysISO(planStart, (monthIndex - 1) * MONTH_DAYS);
  return { start, end: addDaysISO(start, MONTH_DAYS - 1) };
}

/** Weigh-ins inside the month window (plus a few days before it as the starting reference). */
export function weightsInMonth(entries: BodyMetricSnapshot[], window: { start: string; end: string }): WeightPoint[] {
  const from = addDaysISO(window.start, -3);
  return entries.filter((e) => e.weightKg > 0 && e.date >= from && e.date <= window.end).map((e) => ({ date: e.date, kg: e.weightKg }));
}

export function computeMonthAdherence(input: {
  training: TrainingPlan | null;
  monthIndex: number;
  window: { start: string; end: string };
  today: string;
  nutritionEntries: MealFoodEntry[];
  completedExercises: { exerciseId: string; date: string }[];
  activityLog: LoggedActivity[];
}): Adherence {
  const { training, monthIndex, window, today, nutritionEntries, completedExercises, activityLog } = input;
  const lastDay = window.end < today ? window.end : today;

  // training: planned workout days fully ticked / planned cardio days with a logged activity
  let planned = 0;
  let done = 0;
  const month = training?.months.find((m) => m.monthIndex === monthIndex);
  if (month) {
    for (let d = window.start; d <= lastDay; d = addDaysISO(d, 1)) {
      const day = month.weeklySplit[isoMondayIndex(d)];
      if (!day || day.type === 'rest') continue;
      planned++;
      if (day.type === 'workout') {
        const exercises = day.exercises ?? [];
        if (exercises.length > 0 && exercises.every((ex) => isExerciseCompleted(completedExercises as never, ex.id, d))) done++;
      } else if (activityLog.some((a) => a.date === d)) done++;
    }
  }

  // meals: days with something logged, and the average kcal of those days
  const byDay = new Map<string, MealFoodEntry[]>();
  for (const e of nutritionEntries) {
    if (e.date >= window.start && e.date <= window.end) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  }
  const dayKcal = [...byDay.values()].map((list) => list.reduce((s, e) => s + macrosForEntry(e).kcal, 0));
  const tracked = dayKcal.length;

  return {
    trainingCompletion: planned > 0 ? done / planned : null,
    mealDaysTracked: tracked,
    daysInMonth: MONTH_DAYS,
    avgEatenKcal: tracked >= 10 ? dayKcal.reduce((a, b) => a + b, 0) / tracked : null,
  };
}

/** Maps the check-in questionnaire's stored answers onto the signals the engine reads. */
export function checkinSignals(answers: Record<string, unknown>): CheckinSignals {
  const asArray = (v: unknown) => (Array.isArray(v) ? (v as string[]) : undefined);
  const adherence = Number(answers.checkinAdherence);
  return {
    adherence: Number.isFinite(adherence) && adherence > 0 ? adherence : undefined,
    energy: answers.checkinEnergyLevel as CheckinSignals['energy'],
    hunger: answers.checkinHungerLevel as CheckinSignals['hunger'],
    difficulty: asArray(answers.checkinDifficulty),
    wantsChange: asArray(answers.checkinWantsChange),
  };
}
