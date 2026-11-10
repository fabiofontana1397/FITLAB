import { goalBand, readBalance, type GoalBandState } from '@/domain/calorie-balance';
import { dayEnergy } from '@/domain/energy';
import { useElapsedHours } from '@/hooks/use-elapsed-hours';
import { useHealthEnergy } from '@/hooks/use-health-energy';
import { useUserContext } from '@/hooks/use-user-context';
import { useWeeklyEnergy, sumActivityKcalForDate } from '@/hooks/use-weekly-energy';
import { daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { useActivityLogStore } from '@/store/activity-log-store';
import { macrosForEntry, useNutritionStore } from '@/store/nutrition-store';
import { usePlanStore } from '@/store/plan-store';
import { isExerciseCompleted, useTrainingProgressStore } from '@/store/training-progress-store';
import { planIndexFor, useTrainingSwapStore } from '@/store/training-swap-store';
import { useUserStore } from '@/store/user-store';

/**
 * How a day's calorie balance stands against its goal, for any date (the same
 * reading Home's gauge uses: intake − burned against the daily share of the
 * weekly goal). 'missing' for a day with nothing to read — not yet lived, or
 * no meal logged. Only call it where it is needed (the calendar sheet): it reads
 * several stores.
 */
export function useDayGoalStatus(): (date: string) => GoalBandState {
  const today = daysAgoISO(0);
  const ctx = useUserContext();
  const currentUser = useUserStore();
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const completed = useTrainingProgressStore((s) => s.completed);
  const swaps = useTrainingSwapStore((s) => s.swaps);
  const nutritionEntries = useNutritionStore((s) => s.entries);
  const activityEntries = useActivityLogStore((s) => s.entries);
  const { calibration, measuredFor } = useHealthEnergy();
  const elapsedHours = useElapsedHours();
  const { weeklyGoalKcal } = useWeeklyEnergy();

  // No memo: this only runs while the calendar sheet is open, and the closure is cheap.
  const goalKcal = weeklyGoalKcal / 7;
  const split = trainingPlan?.months.find((m) => m.monthIndex === currentMonthIndex(trainingPlan))?.weeklySplit ?? [];
  const dietMonth = dietPlan?.months.find((m) => m.monthIndex === currentMonthIndex(dietPlan));
  const eatenByDate = new Map<string, number>();
  for (const e of nutritionEntries) eatenByDate.set(e.date, (eatenByDate.get(e.date) ?? 0) + macrosForEntry(e).kcal);
  return (date: string): GoalBandState => {
    if (date > today) return 'missing';
    const eaten = eatenByDate.get(date) ?? 0;
    if (eaten <= 0) return 'missing';
    const dayPlan = split[planIndexFor(date, swaps)] ?? null;
    const exercises = dayPlan?.type === 'workout' ? (dayPlan.exercises ?? []) : [];
    const done = exercises.filter((ex) => isExerciseCompleted(completed, ex.id, date)).length;
    const fraction = exercises.length > 0 ? done / exercises.length : 0;
    const burned = dayEnergy(ctx, dayPlan, fraction, sumActivityKcalForDate(activityEntries, date), {
      calibration,
      measured: measuredFor(date),
      elapsedHours: date === today ? elapsedHours : undefined,
    }).total;
    const reading = readBalance({ eatenKcal: eaten, burnedKcal: burned, goalKcal });
    const target = dietMonth?.weeklySplit[isoMondayIndex(date)]?.calorieTarget ?? dietMonth?.calorieTarget ?? currentUser.dailyCalorieTarget;
    return goalBand({ reading, eatenKcal: eaten, burnedKcal: burned, plannedEatenKcal: target, dayComplete: date < today }).state;
  };
}
