// nutrition and training logs stay local-first zustand (their Postgres tables
// exist but aren't wired up yet). Rather than have the nutrition/training
// specialist agents answer blind, the client computes this small real-data
// snapshot from its own local stores and sends it alongside the chat message /
// insights request. The shape here must stay in sync with `ClientContext` in
// supabase/functions/_shared/agents/types.ts (duplicated, not imported, across
// the Deno/Node boundary — see that file's comment).
//
// Everything about the PLAN comes from the generated plans (the same ones the
// screens show) — never from the old static weekly template.
import { weeklyBalanceGoal, computeTargets } from '@/domain/targets';
import { buildUserContext } from '@/domain/user-context';
import { addDaysISO, daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { loggingStreakInfo, sumMacros, useNutritionStore } from '@/store/nutrition-store';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { isExerciseCompleted, useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

export type ClientContext = {
  nutritionToday?: {
    kcalEaten: number;
    kcalTarget: number;
    proteinEatenG: number;
    proteinTargetG: number;
    carbsEatenG: number;
    fatsEatenG: number;
    loggingStreakDays: number;
  };
  trainingToday?: {
    planType: 'workout' | 'cardio' | 'rest';
    title: string;
    exercises?: { name: string; targetSets: number; targetReps: string }[];
    alreadyLoggedToday: boolean;
  };
  trainingAdherence14d?: { planned: number; done: number };
  /** Where the person is in their plan and what the monthly recalibration last decided. */
  plan?: {
    goal: string;
    monthIndex: number;
    durationMonths: number;
    phase: string;
    /** Planned daily calorie balance (negative = deficit) and the weight change per week it aims at. */
    dailyBalanceKcal: number;
    expectedWeeklyKg: number;
    lastRecalibration?: { monthIndex: number; verdict: string; weeklyRateKg: number | null; changes: string[] };
  };
};

export function buildClientContext(): ClientContext {
  const today = daysAgoISO(0);

  const profile = useUserStore.getState();
  const { entries: nutritionEntries } = useNutritionStore.getState();
  const { dietPlan, trainingPlan } = usePlanStore.getState();
  const { completed } = useTrainingProgressStore.getState();
  const { entries: activityLog } = useActivityLogStore.getState();
  const answers = useOnboardingStore.getState().answers;

  const todaysEntries = nutritionEntries.filter((e) => e.date === today);
  const macros = sumMacros(todaysEntries);
  const streak = loggingStreakInfo(nutritionEntries, today);

  // today's plan day and the day's own calorie target
  const dietMonth = dietPlan?.months.find((m) => m.monthIndex === currentMonthIndex(dietPlan));
  const dietDay = dietMonth?.weeklySplit[isoMondayIndex(today)];
  const trainingMonth = trainingPlan?.months.find((m) => m.monthIndex === currentMonthIndex(trainingPlan));
  const planDay = trainingMonth?.weeklySplit[isoMondayIndex(today)];

  let trainingToday: ClientContext['trainingToday'];
  if (planDay) {
    if (planDay.type === 'rest') trainingToday = { planType: 'rest', title: 'Riposo', alreadyLoggedToday: false };
    else if (planDay.type === 'cardio') trainingToday = { planType: 'cardio', title: planDay.note ?? 'Corsa', alreadyLoggedToday: activityLog.some((a) => a.date === today) };
    else {
      const exercises = planDay.exercises ?? [];
      trainingToday = {
        planType: 'workout',
        title: planDay.title,
        exercises: exercises.map((e) => ({ name: e.name, targetSets: e.sets, targetReps: e.reps })),
        alreadyLoggedToday: exercises.length > 0 && exercises.every((e) => isExerciseCompleted(completed, e.id, today)),
      };
    }
  }

  // sessions planned vs done in the last 14 days
  let planned = 0;
  let done = 0;
  if (trainingMonth) {
    for (let i = 13; i >= 0; i--) {
      const date = addDaysISO(today, -i);
      const day = trainingMonth.weeklySplit[isoMondayIndex(date)];
      if (!day || day.type === 'rest') continue;
      planned++;
      if (day.type === 'workout') {
        const ex = day.exercises ?? [];
        if (ex.length > 0 && ex.every((e) => isExerciseCompleted(completed, e.id, date))) done++;
      } else if (activityLog.some((a) => a.date === date)) done++;
    }
  }

  // plan summary for the agents
  let plan: ClientContext['plan'];
  const anyPlan = dietPlan ?? trainingPlan;
  if (anyPlan) {
    const ctx = buildUserContext(answers);
    const monthIdx = currentMonthIndex(anyPlan);
    const targets = computeTargets(ctx, trainingMonth?.weeklySplit ?? null, anyPlan.calibration);
    const last = [...(anyPlan.recalibrations ?? [])].sort((a, b) => b.monthIndex - a.monthIndex)[0];
    plan = {
      goal: ctx.goal,
      monthIndex: monthIdx,
      durationMonths: anyPlan.durationMonths,
      phase: (dietMonth ?? trainingMonth)?.phase ?? 'progressione',
      dailyBalanceKcal: Math.round(weeklyBalanceGoal(targets) / 7),
      expectedWeeklyKg: Math.round(targets.pace.weeklyKg * 100) / 100,
      lastRecalibration: last ? { monthIndex: last.monthIndex, verdict: last.verdict, weeklyRateKg: last.weeklyRateKg, changes: last.changes.map((c) => c.text) } : undefined,
    };
  }

  return {
    nutritionToday: {
      kcalEaten: Math.round(macros.kcal),
      kcalTarget: Math.round(dietDay?.calorieTarget ?? dietMonth?.calorieTarget ?? profile.dailyCalorieTarget),
      proteinEatenG: Math.round(macros.protein),
      proteinTargetG: Math.round(dietDay?.macroTargetsG?.protein ?? dietMonth?.macroTargetsG.protein ?? profile.macroTargetsG.protein),
      carbsEatenG: Math.round(macros.carbs),
      fatsEatenG: Math.round(macros.fats),
      loggingStreakDays: streak.streak,
    },
    trainingToday,
    trainingAdherence14d: { planned, done },
    plan,
  };
}
