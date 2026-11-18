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
import { NoCompatibleDishError } from '@/lib/planning/fitlab/meal-builder';

import { generateTrainingPlan, provisionalTrainingWeek, type TrainingTuning } from '@/lib/planning/training-planner';
import type { PlanStrategy } from '@/lib/planning/strategy-types';
import type { DietMonthPlan, DietPlan, TrainingMonthPlan, TrainingPlan } from '@/lib/planning/types';

import { supervisionReasons } from './nutrition/safety';
import { publishable, validateDietMonth, type ValidationIssue } from './nutrition/validation';
import { NEUTRAL_CALIBRATION, type PlanCalibration } from './recalibration';
import { computeTargets, planDurationMonths, type PlanTargets } from './targets';
import type { UserContext } from './user-context';

const SLOT_LABEL: Record<string, string> = { colazione: 'la colazione', spuntinoMattina: 'lo spuntino del mattino', pranzo: 'il pranzo', spuntinoPomeriggio: 'lo spuntino del pomeriggio', cena: 'la cena' };

export type PlanBundle = {
  durationMonths: number;
  /** Targets per month (index 0 = month 1); `monthTargets[0]` is what the profile and onboarding summary show. */
  monthTargets: PlanTargets[];
  diet: DietPlan | null;
  training: TrainingPlan | null;
  /** Safety engine: why no nutrition plan was generated / why the existing one is frozen (empty = none). */
  dietSupervision: string[];
  /** Validation of the generated diet months; with a BLOCKER the new diet is not published (`diet` keeps the previous one). */
  dietIssues: ValidationIssue[];
  dietBlocked: boolean;
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

  const customTraining = existing?.training?.source === 'custom' ? existing.training : null;
  const training =
    ctx.mode === 'diet'
      ? null
      : customTraining
        ? { ...customTraining }
        : generateTrainingPlan({
          ctx,
          durationMonths,
          strategy: strategy?.training ?? null,
          preserveMonthsBefore,
          existingMonths: existing?.training?.months as TrainingMonthPlan[] | undefined,
          tuning,
        });

  const monthTargets = Array.from({ length: durationMonths }, (_, i) => computeTargets(ctx, training?.months[i]?.weeklySplit ?? null, calibration));

  // Safety engine first: a frozen plan stays frozen; a condition that needs a professional generates no plan
  // (an existing one is frozen as it is, with its history).
  const supervision = supervisionReasons(ctx);
  const frozen = existing?.diet?.supervision
    ? existing.diet
    : supervision.length > 0 && existing?.diet && existing.diet.source !== 'custom'
      ? { ...existing.diet, supervision: { status: 'professional_review' as const, reasons: supervision, since: new Date().toISOString(), source: 'questionnaire' as const } }
      : null;
  const dietSupervision = frozen?.supervision?.reasons ?? supervision;

  // The person's own diet is followed as written, like their own workout card.
  const customDiet = existing?.diet?.source === 'custom' ? existing.diet : null;
  let dietIssues: ValidationIssue[] = [];
  let generated: DietPlan | null = null;
  if (!(ctx.mode === 'training' || frozen || (supervision.length > 0 && !customDiet))) {
    try {
      generated = customDiet
        ? { ...customDiet }
        : generateDietPlan({
          ctx,
          monthTargets,
          strategy: strategy?.diet ?? null,
          variant: calibration.mealVariant,
          adapt: calibration.diet,
          preserveMonthsBefore,
          existingMonths: existing?.diet?.months as DietMonthPlan[] | undefined,
        });
    } catch (err) {
      // restrictions so strict that a meal has no compatible recipe: nothing is invented, the plan is not published
      if (!(err instanceof NoCompatibleDishError)) throw err;
      dietIssues.push({
        level: 'BLOCKER',
        code: 'V21',
        kind: 'catalog_insufficient',
        message: `Nessuna ricetta del catalogo è compatibile con regime, allergie ed esclusioni per ${SLOT_LABEL[err.slotId] ?? err.slotId}: il piano non viene pubblicato. Serve rivedere le esclusioni o i pasti scelti, oppure un piano costruito con un professionista.`,
      });
    }
  }

  // Validation before publication: a BLOCKER in a newly generated month keeps the previous diet in place.
  let diet: DietPlan | null = frozen ? { ...frozen } : generated;
  if (generated && generated.source !== 'custom') {
    const from = preserveMonthsBefore ?? 1;
    for (const month of generated.months.filter((m) => m.monthIndex >= from)) {
      const t = monthTargets[month.monthIndex - 1];
      const previous = generated.months.find((m) => m.monthIndex === month.monthIndex - 1);
      dietIssues = dietIssues.concat(validateDietMonth(month, ctx, { expenditure: t.averageExpenditure + (calibration.expenditureOffset ?? 0), previous, adapt: calibration.diet }));
    }
  }
  const dietBlocked = !publishable(dietIssues);
  if (dietBlocked) diet = existing?.diet ?? null;

  // A regenerated plan keeps its own start date: month timing is anchored on it.
  if (existing?.diet && diet && diet !== existing.diet && !frozen) diet.generatedAt = existing.diet.generatedAt;
  if (existing?.training && training) training.generatedAt = existing.training.generatedAt;

  if (diet && !frozen && !dietBlocked) diet.calibration = calibration;
  if (training) training.calibration = calibration;
  if (existing?.diet?.recalibrations && diet && !frozen && !dietBlocked) diet.recalibrations = existing.diet.recalibrations;
  if (existing?.training?.recalibrations && training) training.recalibrations = existing.training.recalibrations;

  return { durationMonths, monthTargets, diet, training, dietSupervision, dietIssues, dietBlocked };
}
