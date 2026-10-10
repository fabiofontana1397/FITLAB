/**
 * What a change to the questionnaire answers (edited from Profilo) actually
 * changes downstream — so the app rebuilds a plan only when it would really
 * come out different, instead of guessing from a hand-kept list of fields.
 *
 * How: the deterministic engine (plan-engine.ts `buildPlans`) is run twice on
 * the same base — same weight, calibration, start date, lived months — once
 * with the old answers and once with the new ones. If the diet (or the
 * training) comes out identical, the edit was informational for that plan
 * (e.g. coffee or eating out habits) and the plan stays as it is.
 *
 * A new goal or goal weight is a different journey, not a tweak: both plans
 * restart from month 1 with a freshly computed duration.
 *
 * Pure TypeScript, no stores.
 */
import { buildPlans, initialTargets } from './plan-engine';
import { buildUserContext, type Answers } from './user-context';
import { parseNumericAnswer } from '@/lib/questionnaire/parse-answer';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import type { DietPlan, TrainingPlan } from '@/lib/planning/types';

export type AnswersImpact = {
  /** The diet plan must be rebuilt. */
  diet: boolean;
  /** The training plan must be rebuilt. */
  training: boolean;
  /** The calorie / macro / hydration targets on the profile change. */
  targets: boolean;
  /** Both plans (re)start from month 1: the goal or goal weight changed, or a requested plan did not exist yet. */
  restart: boolean;
  /** True when the restart is only because a requested plan was missing. */
  created?: boolean;
  /** First month that gets rebuilt (months before it are already lived and stay untouched). */
  fromMonth: number;
};

type ImpactInput = {
  prev: Answers;
  next: Answers;
  /** Latest logged weight, the one plans are rebuilt on. */
  weightKg?: number;
  existing: { diet: DietPlan | null; training: TrainingPlan | null };
};

// Plans are compared on what the person sees, not on bookkeeping fields.
const stableJson = (plan: unknown): string => JSON.stringify(plan, (key, value) => (key === 'generatedAt' ? undefined : value));

export function analyzeAnswersImpact({ prev, next, weightKg, existing }: ImpactInput): AnswersImpact {
  const withWeight = (answers: Answers) => {
    const ctx = buildUserContext(answers);
    return weightKg ? { ...ctx, weightKg } : ctx;
  };
  const before = withWeight(prev);
  const after = withWeight(next);
  const calibration = existing.diet?.calibration ?? existing.training?.calibration;
  const targets = stableJson(initialTargets(before, calibration)) !== stableJson(initialTargets(after, calibration));
  const hasDiet = after.mode !== 'training';
  const hasTraining = after.mode !== 'diet';

  const newGoal = prev.goal !== next.goal || parseNumericAnswer(prev.targetWeightKg) !== parseNumericAnswer(next.targetWeightKg);
  const missing = (hasDiet && !existing.diet) || (hasTraining && !existing.training);
  if (newGoal || missing) return { diet: hasDiet, training: hasTraining, targets, restart: true, created: !newGoal, fromMonth: 1 };

  const plan = existing.diet ?? existing.training;
  const fromMonth = plan ? currentMonthIndex(plan) : 1;
  const opts = { existing, preserveMonthsBefore: fromMonth };
  const a = buildPlans(before, opts);
  const b = buildPlans(after, opts);
  return {
    diet: hasDiet && stableJson(a.diet) !== stableJson(b.diet),
    training: hasTraining && stableJson(a.training) !== stableJson(b.training),
    targets,
    restart: false,
    fromMonth,
  };
}
