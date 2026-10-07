/**
 * What onboarding writes to the user profile, derived from the UserContext and
 * the month-1 targets — never from loose answers, so the profile can never
 * hold invented values:
 *  - `sports` is empty for a diet-only user (no phantom "gym");
 *  - `targetWeightKg` is 0 when the person gave none (0 = "not set").
 */
import type { PlanTargets } from './targets';
import type { Goal, Sex, UserContext } from './user-context';

export type ProfileInput = {
  goal: Goal;
  sports: ('gym' | 'running')[];
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
  const sports: ProfileInput['sports'] = [];
  if (ctx.training?.gym) sports.push('gym');
  if (ctx.training?.running) sports.push('running');
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
