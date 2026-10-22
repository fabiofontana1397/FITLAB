/**
 * What onboarding writes to the user profile, derived from the UserContext and
 * the month-1 targets — never from loose answers, so the profile can never
 * hold invented values:
 *  - `sports` is empty for a diet-only user (no phantom "gym");
 *  - `targetWeightKg` is 0 when the person gave none (0 = "not set").
 */
import { ACTIVITY_TO_SPORT, practicedActivities } from '@/lib/questionnaire/schema';

import type { PlanTargets } from './targets';
import type { Goal, Sex, UserContext } from './user-context';

export type ProfileSport = 'gym' | 'functional' | 'running' | 'swimming' | 'tennis' | 'cycling' | 'other';

export type ProfileInput = {
  goal: Goal;
  sports: ProfileSport[];
  sex: Sex;
  age: number;
  heightCm: number;
  /** 0 = not set. */
  targetWeightKg: number;
  dailyCalorieTarget: number;
  macroTargetsG: { protein: number; carbs: number; fats: number };
  hydrationTargetMl: number;
};

export function profileFromContext(ctx: UserContext, targets: PlanTargets): ProfileInput {
  // Gym and running come from the built training profile; the other sports are the ones ticked in the questionnaire.
  const sports: ProfileInput['sports'] = [];
  if (ctx.training) {
    if (ctx.training.gym) sports.push('gym');
    if (ctx.training.running) sports.push('running');
    for (const activity of practicedActivities(ctx.answers.activitiesPracticed)) {
      const sport = ACTIVITY_TO_SPORT[activity];
      if (sport && !sports.includes(sport)) sports.push(sport);
    }
  }
  return {
    goal: ctx.goal,
    sports,
    sex: ctx.sex,
    age: ctx.age,
    heightCm: ctx.heightCm,
    targetWeightKg: ctx.targetWeightKg ?? 0,
    dailyCalorieTarget: targets.calories,
    macroTargetsG: targets.macros,
    hydrationTargetMl: targets.hydrationMl,
  };
}
