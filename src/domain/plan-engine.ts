/**
 * The plan engine: from a UserContext to the two plans, built TOGETHER so the
 * diet always follows the training.
 *
 *   1. provisional training week → energy → pace → plan duration
 *   2. training plan (all months)
 *   3. calorie/macro targets for EACH month from that month's training week
 *   4. diet plan from those targets
 *
 * One function, one result type: the app store, the onboarding results
 * screen, the monthly recalibration and the test harness all call
 * `buildPlans`, so there is a single place where plans come from.
 */
import { generateDietPlan } from '@/lib/planning/diet-planner';
import { generateTrainingPlan, provisionalTrainingWeek, type TrainingTuning } from '@/lib/planning/training-planner';
import type { PlanStrategy } from '@/lib/planning/strategy-types';
import type { DietMonthPlan, DietPlan, TrainingMonthPlan, TrainingPlan } from '@/lib/planning/types';

import { NEUTRAL_CALIBRATION, type PlanCalibration } from './recalibration';
import { computeTargets, planDurationMonths, type PlanTargets } from './targets';
import type { UserContext } from './user-context';

export type PlanBundle = {
  durationMonths: number;
  /** Targets per month (index 0 = month 1); `monthTargets[0]` is what the profile and onboarding summary show. */
  monthTargets: PlanTargets[];
  diet: DietPlan | null;
  training: TrainingPlan | null;
};

export type BuildPlansOptions = {
  strategy?: PlanStrategy | null;
  /** Recalibration state: calorie adjustment, training tuning, food rotation. */
  calibration?: PlanCalibration;
  /** Recalibration: keep every month before this index exactly as it is. */
  preserveMonthsBefore?: number;
  existing?: { diet: DietPlan | null; training: TrainingPlan | null };
};

/** Month-1 targets only (onboarding summary / profile) — same numbers the full plan will use. */
export function initialTargets(ctx: UserContext, calibration?: PlanCalibration): PlanTargets {
  return computeTargets(ctx, provisionalTrainingWeek(ctx), calibration);
}

export function buildPlans(ctx: UserContext, opts: BuildPlansOptions = {}): PlanBundle {
  const { strategy, preserveMonthsBefore, existing } = opts;
  const calibration = opts.calibration ?? existing?.diet?.calibration ?? existing?.training?.calibration ?? NEUTRAL_CALIBRATION;
  const tuning: TrainingTuning = { setsDelta: calibration.setsDelta, loadFactor: calibration.loadFactor, fromMonth: calibration.fromMonth };

  const durationMonths = existing?.diet?.durationMonths ?? existing?.training?.durationMonths ?? planDurationMonths(ctx, initialTargets(ctx, calibration));

  const training =
    ctx.mode === 'diet'
      ? null
      : generateTrainingPlan({
          ctx,
          durationMonths,
          strategy: strategy?.training ?? null,
          preserveMonthsBefore,
          existingMonths: existing?.training?.months as TrainingMonthPlan[] | undefined,
          tuning,
        });

  const monthTargets = Array.from({ length: durationMonths }, (_, i) => computeTargets(ctx, training?.months[i]?.weeklySplit ?? null, calibration));

  const diet =
    ctx.mode === 'training'
      ? null
      : generateDietPlan({
          ctx,
          monthTargets,
          strategy: strategy?.diet ?? null,
          variant: calibration.mealVariant,
          preserveMonthsBefore,
          existingMonths: existing?.diet?.months as DietMonthPlan[] | undefined,
        });

  // A regenerated plan keeps its own start date: month timing is anchored on it.
  if (existing?.diet && diet) diet.generatedAt = existing.diet.generatedAt;
  if (existing?.training && training) training.generatedAt = existing.training.generatedAt;

  if (diet) diet.calibration = calibration;
  if (training) training.calibration = calibration;
  if (existing?.diet?.recalibrations && diet) diet.recalibrations = existing.diet.recalibrations;
  if (existing?.training?.recalibrations && training) training.recalibrations = existing.training.recalibrations;

  return { durationMonths, monthTargets, diet, training };
}
