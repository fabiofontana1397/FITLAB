import type { DietPlan, TrainingPlan } from './types';

/**
 * Where a plan comes from, for the three choices on the Piani page:
 * - 'fitlab': built by the app from the questionnaire (and adapted at every check-in);
 * - 'file': the person's own card or diet, loaded from a photo, a file or text;
 * - 'own': built by the person in the app ("Fai da te"): exercises chosen one by one, or calories and macros per month.
 */
export type PlanSource = 'fitlab' | 'file' | 'own';

export function trainingPlanSource(plan: Pick<TrainingPlan, 'source' | 'ownBuilt'> | null | undefined): PlanSource | null {
  if (!plan) return null;
  if (plan.source !== 'custom') return 'fitlab';
  return plan.ownBuilt ? 'own' : 'file';
}

export function dietPlanSource(plan: Pick<DietPlan, 'source' | 'ownTargets'> | null | undefined): PlanSource | null {
  if (!plan) return null;
  if (plan.source !== 'custom') return 'fitlab';
  return plan.ownTargets ? 'own' : 'file';
}

/** The screen that loads (file) or builds (own) a plan of this kind. */
export const PLAN_SOURCE_ROUTE = {
  training: { file: '/custom-workout', own: '/own-workout' },
  diet: { file: '/custom-diet', own: '/custom-targets' },
} as const;
