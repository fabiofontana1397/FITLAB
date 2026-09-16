// nutrition-store.ts and training-store.ts stay local-first zustand this
// pass (their Postgres tables exist but aren't wired up yet — see the
// backend plan's repository-module fast-follow convention). Rather than
// have the nutrition/training specialist agents answer blind, the client
// computes this small real-data snapshot from its own local stores and
// sends it alongside the chat message / insights request. The shape here
// must stay in sync with `ClientContext` in
// supabase/functions/_shared/agents/types.ts (duplicated, not imported,
// across the Deno/Node boundary — see that file's comment).
import { daysAgoISO } from '@/lib/mock/dates';
import { loggingStreakInfo, sumMacros, useNutritionStore } from '@/store/nutrition-store';
import { isTemplateLoggedOnDate, planAdherence, templateById, useTrainingStore } from '@/store/training-store';
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
};

export function buildClientContext(): ClientContext {
  const today = daysAgoISO(0);

  const profile = useUserStore.getState();
  const { entries: nutritionEntries } = useNutritionStore.getState();
  const todaysEntries = nutritionEntries.filter((e) => e.date === today);
  const macros = sumMacros(todaysEntries);
  const streak = loggingStreakInfo(nutritionEntries, today);

  const { plan, templates, logs } = useTrainingStore.getState();
  const weekday = new Date(today).getDay();
  const planIndex = (weekday + 6) % 7;
  const planDay = plan[planIndex];

  let trainingToday: ClientContext['trainingToday'];
  if (planDay.type === 'rest') {
    trainingToday = { planType: 'rest', title: 'Riposo', alreadyLoggedToday: false };
  } else if (planDay.type === 'cardio') {
    trainingToday = { planType: 'cardio', title: planDay.label, alreadyLoggedToday: false };
  } else {
    const template = templateById(templates, planDay.templateId);
    trainingToday = {
      planType: 'workout',
      title: template?.title ?? planDay.templateId,
      exercises: template?.exercises.map((e) => ({ name: e.name, targetSets: e.targetSets, targetReps: e.targetReps })),
      alreadyLoggedToday: isTemplateLoggedOnDate(logs, planDay.templateId, today),
    };
  }

  return {
    nutritionToday: {
      kcalEaten: Math.round(macros.kcal),
      kcalTarget: Math.round(profile.dailyCalorieTarget),
      proteinEatenG: Math.round(macros.protein),
      proteinTargetG: Math.round(profile.macroTargetsG.protein),
      carbsEatenG: Math.round(macros.carbs),
      fatsEatenG: Math.round(macros.fats),
      loggingStreakDays: streak.streak,
    },
    trainingToday,
    trainingAdherence14d: planAdherence(plan, logs, 14),
  };
}
