import { useMemo } from 'react';

import { dailyStepsTarget, stepsHistory } from '@/lib/mock/activity';
import { currentWeekDates, daysAgoISO } from '@/lib/mock/dates';
import type { BodyMetricSnapshot } from '@/lib/mock/types';
import type { LoggedActivity } from '@/lib/api/activity-log';
import { dayEnergy } from '@/domain/energy';
import { useUserContext } from '@/hooks/use-user-context';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useBodyStore } from '@/store/body-store';
import { useNutritionStore, sumMacros } from '@/store/nutrition-store';
import { usePlanStore } from '@/store/plan-store';
import { isExerciseCompleted, useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

export type WeekEnergyDay = {
  date: string;
  label: string;
  isToday: boolean;
  hasHappened: boolean;
  trainingProgress: number;
  dietProgress: number;
  stepsProgress: number;
  estimatedExpenditureKcal: number;
  eatenKcal: number;
};

export function sumActivityKcalForDate(entries: LoggedActivity[], date: string): number {
  return entries.filter((e) => e.date === date).reduce((sum, e) => sum + e.estimatedKcal, 0);
}

/** Most recent body_metrics row marked as a baseline (see body-store.ts's
 * resetStartingWeight), or undefined for accounts with none — either
 * pre-dating the baseline column, or that have never (re)done onboarding. */
function mostRecentBaselineDate(entries: BodyMetricSnapshot[]): string | undefined {
  let latest: string | undefined;
  for (const e of entries) {
    if (e.isBaseline && (!latest || e.date > latest)) latest = e.date;
  }
  return latest;
}

/**
 * The per-day estimated-expenditure-vs-eaten pipeline for the calendar
 * week containing `referenceDate` (defaults to today) — shared by Home's
 * weekly goal hero card (which also uses it to browse past weeks) and the
 * Progressi tab's "Dispendio stimato e calorie assunte" chart, so callers
 * can never silently drift apart on the same numbers. Self-contained
 * (reads its own stores) so any caller can use it with no prop drilling.
 * `today`/`isToday` inside the result always mean the real calendar
 * today, regardless of which week's window is being read — only ever
 * true for a week that actually contains today.
 */
export function useWeeklyEnergy(referenceDate?: string): {
  weekDaysWithActivity: WeekEnergyDay[];
  todayEstimatedBalance: number;
  weekEstimatedExpenditureSoFar: number;
  weeklyProgrammedKcal: number;
  /** Planned intake minus planned expenditure over the week (negative = deficit goal) — the single "obiettivo settimanale" every screen shows. */
  weeklyGoalKcal: number;
} {
  const today = daysAgoISO(0);
  const currentUser = useUserStore();
  const ctx = useUserContext();
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const nutritionEntries = useNutritionStore((s) => s.entries);
  const bodyEntries = useBodyStore((s) => s.entries);
  const activityLogEntries = useActivityLogStore((s) => s.entries);

  const dietMonth = dietPlan?.months.find((m) => m.monthIndex === currentMonthIndex(dietPlan));
  const calorieTarget = dietMonth?.calorieTarget ?? currentUser.dailyCalorieTarget;
  /** The target of a given weekday: that day's own (training days eat more), else the month's, else the profile's. */
  const targetForWeekday = (i: number) => dietMonth?.weeklySplit[i]?.calorieTarget ?? calorieTarget;

  // One entry per weekday of the CURRENT calendar week — past days read
  // from what was actually logged, today is live, and days still ahead
  // simply have nothing yet (0% rings, no burn plotted) rather than a
  // fabricated forecast. "Past" here also means before THIS account
  // existed (resetStartingWeight creates the account's first body_metrics
  // entry on signup day), so a day before that predates the account
  // entirely rather than getting a fabricated BMR-based estimate.
  const weekDates = useMemo(() => currentWeekDates(referenceDate ? new Date(referenceDate) : new Date()), [referenceDate]);
  const accountStartDate = mostRecentBaselineDate(bodyEntries) ?? bodyEntries[0]?.date ?? today;
  const weekDays = useMemo(() => {
    const monthIdx = trainingPlan ? currentMonthIndex(trainingPlan) : null;
    const month = trainingPlan?.months.find((m) => m.monthIndex === monthIdx);
    const split = month?.weeklySplit ?? [];

    return weekDates.map((date, i) => {
      if (date < accountStartDate) {
        return {
          date,
          label: WEEKDAY_LABELS[i][0],
          isToday: false,
          hasHappened: false,
          trainingProgress: 0,
          dietProgress: 0,
          stepsProgress: 0,
          estimatedExpenditureKcal: 0,
          eatenKcal: 0,
        };
      }

      const dayPlan = split[i];
      const exercises = dayPlan?.type === 'workout' ? (dayPlan.exercises ?? []) : [];
      const completed = exercises.filter((ex) => isExerciseCompleted(completedExercises, ex.id, date)).length;
      const dayTrainingProgress = dayPlan?.type === 'workout' ? (exercises.length > 0 ? completed / exercises.length : 1) : 1;
      const completionFraction = dayPlan?.type === 'workout' && exercises.length > 0 ? completed / exercises.length : 0;

      const dayTotals = sumMacros(nutritionEntries.filter((e) => e.date === date));
      const dayTarget = targetForWeekday(i);
      const dayDietProgress = dayTarget > 0 ? dayTotals.kcal / dayTarget : 0;

      const stepsEntry = stepsHistory.find((s) => s.date === date);
      const dayStepsProgress = stepsEntry ? stepsEntry.steps / dailyStepsTarget : 0;

      // A cardio day earns its calories through the activity the person logs (added below), not from the plan.
      const estimatedExpenditureKcal = dayEnergy(ctx, dayPlan, completionFraction).total;

      return {
        date,
        label: WEEKDAY_LABELS[i][0],
        isToday: date === today,
        hasHappened: date <= today,
        trainingProgress: dayTrainingProgress,
        dietProgress: dayDietProgress,
        stepsProgress: dayStepsProgress,
        estimatedExpenditureKcal,
        eatenKcal: dayTotals.kcal,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingPlan, weekDates, accountStartDate, completedExercises, nutritionEntries, calorieTarget, dietMonth, ctx, today]);

  // Folded in as a plain post-processing pass (not inside the useMemo
  // above) so this dependency never touches that hook's own compiler-
  // preserved memoization boundary.
  const weekDaysWithActivity = weekDays.map((d) => ({
    ...d,
    estimatedExpenditureKcal: d.estimatedExpenditureKcal + sumActivityKcalForDate(activityLogEntries, d.date),
  }));

  const todayExpenditure = weekDaysWithActivity.find((d) => d.isToday);
  const weekEstimatedExpenditureSoFar = weekDaysWithActivity.filter((d) => d.hasHappened).reduce((sum, d) => sum + d.estimatedExpenditureKcal, 0);
  const weeklyProgrammedKcal = weekDaysWithActivity.reduce((sum, _d, i) => sum + targetForWeekday(i), 0);
  // "If the plan is followed": intake target of each weekday minus what that weekday's planned training makes the person burn.
  const planSplit = trainingPlan?.months.find((m) => m.monthIndex === currentMonthIndex(trainingPlan))?.weeklySplit ?? [];
  const weeklyGoalKcal = Math.round(weekDaysWithActivity.reduce((sum, _d, i) => sum + targetForWeekday(i) - dayEnergy(ctx, planSplit[i] ?? null, 1).total, 0));
  const todayEstimatedBalance = todayExpenditure ? todayExpenditure.estimatedExpenditureKcal - todayExpenditure.eatenKcal : 0;

  return { weekDaysWithActivity, todayEstimatedBalance, weekEstimatedExpenditureSoFar, weeklyProgrammedKcal, weeklyGoalKcal };
}
