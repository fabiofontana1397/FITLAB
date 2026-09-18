import type { Goal, Sex } from '@/lib/mock/types';

const AGE_RANGE_MIDPOINT: Record<string, number> = {
  lt18: 17,
  '18-24': 21,
  '25-34': 29,
  '35-44': 39,
  '45-54': 49,
  '55+': 60,
};

const JOB_ACTIVITY_MULTIPLIER: Record<string, number> = {
  sedentary: 1.2,
  seatedMobile: 1.3,
  standing: 1.4,
  active: 1.6,
  veryHeavy: 1.8,
};

const GOAL_CALORIE_FACTOR: Record<Goal, number> = {
  loseFat: 0.8,
  gainMuscle: 1.12,
  maintainImprove: 1.0,
  gainStrength: 1.05,
  improveEndurance: 1.0,
  generalHealth: 1.0,
};

const GOAL_PROTEIN_PER_KG: Record<Goal, number> = {
  loseFat: 2.2,
  gainMuscle: 2.0,
  maintainImprove: 1.8,
  gainStrength: 2.0,
  improveEndurance: 1.6,
  generalHealth: 1.6,
};

// Small additive nudge to the TDEE activity multiplier from the
// questionnaire's dailySteps bucket — previously collected but unused
// (spec §11/§13 point 4, "Keep+Use"). Deliberately small relative to
// jobActivityMultiplier: steps overlap with job activity for many users
// (e.g. "standing" jobs already imply more steps), so this only nudges,
// it doesn't double-count a full activity tier.
const DAILY_STEPS_BUMP: Record<string, number> = {
  lt3000: -0.03,
  '3000-5000': 0,
  '5000-8000': 0.02,
  '8000-12000': 0.05,
  gt12000: 0.08,
  unknown: 0,
};

// Never recommend below this regardless of how aggressive a deadline-driven
// adjustment would otherwise be (see deadlineAdjustedCalorieTarget) —
// covers the "calorie target sotto soglia di sicurezza" edge case (spec
// §13, edge case table) with a clamp rather than a hard reject, since this
// app has no review workflow to route a rejected value to.
const MIN_SAFE_CALORIE_TARGET = 1200;
// Caps how far a deadline can steepen/loosen the goal-driven default target.
const MAX_DEADLINE_ADJUST_FRACTION = 0.15;
const KCAL_PER_KG_BODY_MASS = 7700;

function parseItalianDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Nudges the goal-driven calorie target toward whatever rate is actually
 * needed to hit a user-declared deadline (hasDeadline/deadlineDate/
 * successWeightKg — collected since the first version of the questionnaire
 * but never used, spec §11/§13 point 4). Bounded on both sides: capped at
 * ±15% of the base target (a deadline can steepen the plan, not override
 * physiology), and never below MIN_SAFE_CALORIE_TARGET. Returns `base`
 * unchanged whenever any required input is missing/unparseable.
 */
function deadlineAdjustedCalorieTarget(base: number, input: NutritionTargetsInput): number {
  if (input.hasDeadline !== 'yes' && input.hasDeadline !== 'sì' && input.hasDeadline !== 'si') return base;
  const deadline = parseItalianDate(input.deadlineDate);
  const targetWeightKg = input.successWeightKg ?? input.targetWeightKg;
  if (!deadline || targetWeightKg == null || !input.currentWeightKg) return base;

  const weeksLeft = Math.max((deadline.getTime() - Date.now()) / (7 * 24 * 3600 * 1000), 1);
  const kgDelta = targetWeightKg - input.currentWeightKg; // negative = weight loss needed
  const weeklyRateNeeded = kgDelta / weeksLeft;
  const dailyDeltaNeeded = (weeklyRateNeeded * KCAL_PER_KG_BODY_MASS) / 7;

  const maxDelta = base * MAX_DEADLINE_ADJUST_FRACTION;
  const clampedDelta = Math.min(Math.max(dailyDeltaNeeded, -maxDelta), maxDelta);
  return Math.max(Math.round(base + clampedDelta), MIN_SAFE_CALORIE_TARGET);
}

export type NutritionTargetsInput = {
  sex: Sex;
  ageRange: string;
  heightCm: number;
  currentWeightKg: number;
  goal: Goal;
  jobActivity?: string;
  /** Total trained days/week across all activities — see deriveWeeklyTrainingDays. */
  weeklyTrainingDays?: number;
  /** Questionnaire `dailySteps` bucket (lt3000/3000-5000/5000-8000/8000-12000/gt12000/unknown). */
  dailyStepsBucket?: string;
  /** Questionnaire hasDeadline/deadlineDate ('gg/mm/aaaa')/successWeightKg — see deadlineAdjustedCalorieTarget. */
  hasDeadline?: string;
  deadlineDate?: string;
  successWeightKg?: number;
  targetWeightKg?: number;
};

export type NutritionTargets = {
  bmr: number;
  tdee: number;
  dailyCalorieTarget: number;
  macroTargetsG: { protein: number; carbs: number; fats: number };
  hydrationTargetMl: number;
};

function bmrMifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78; // midpoint when unspecified
}

/**
 * Sums every `freq_<activity>` questionnaire answer (see
 * lib/questionnaire/schema.ts buildActivityQuestions) into a single
 * weekly-training-days number. Returns 0 when the Training step never ran
 * (diet-only onboarding) or nothing was selected — TDEE then falls back to
 * job activity alone, which is the safest default.
 */
export function deriveWeeklyTrainingDays(answers: Record<string, unknown>): number {
  let total = 0;
  for (const [key, value] of Object.entries(answers)) {
    if (!key.startsWith('freq_') || typeof value !== 'string') continue;
    total += value === '6+' ? 6 : Number(value) || 0;
  }
  return Math.min(total, 7);
}

export function computeNutritionTargets(input: NutritionTargetsInput): NutritionTargets {
  const age = AGE_RANGE_MIDPOINT[input.ageRange] ?? 30;
  const bmr = bmrMifflinStJeor(input.sex, input.currentWeightKg, input.heightCm, age);

  const jobMultiplier = JOB_ACTIVITY_MULTIPLIER[input.jobActivity ?? 'sedentary'] ?? 1.2;
  const trainingDays = input.weeklyTrainingDays ?? 0;
  const trainingBump = Math.min(trainingDays, 6) * 0.03;
  const stepsBump = DAILY_STEPS_BUMP[input.dailyStepsBucket ?? 'unknown'] ?? 0;
  const tdee = bmr * (jobMultiplier + trainingBump + stepsBump);

  const goalDrivenTarget = Math.round(tdee * GOAL_CALORIE_FACTOR[input.goal]);
  const dailyCalorieTarget = deadlineAdjustedCalorieTarget(goalDrivenTarget, input);

  const proteinG = Math.round(GOAL_PROTEIN_PER_KG[input.goal] * input.currentWeightKg);
  const fatsG = Math.round((dailyCalorieTarget * 0.25) / 9);
  const carbsG = Math.max(Math.round((dailyCalorieTarget - proteinG * 4 - fatsG * 9) / 4), 0);

  const hydrationTargetMl = Math.round(input.currentWeightKg * 35 + (trainingDays >= 4 ? 350 : 0));

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    dailyCalorieTarget,
    macroTargetsG: { protein: proteinG, carbs: carbsG, fats: fatsG },
    hydrationTargetMl,
  };
}

// Typical minutes-per-session implied by each questionnaire sessionDuration
// bucket — the midpoint of its range, used to turn a completed-workout flag
// into a duration-aware kcal estimate instead of a single flat bump that
// treats a 35-minute and a 90-minute session identically.
const SESSION_DURATION_MINUTES: Record<string, number> = {
  lt30: 25,
  '30-45': 37,
  '45-60': 52,
  '60-90': 75,
  gt90: 100,
};

// Metabolic-equivalent (MET) value for a moderate-to-vigorous resistance
// training session — a standard ballpark (ACSM compendium territory, ~5-6
// METs for weight training), not a per-exercise calculation, since the plan
// doesn't track set-by-set intensity.
const RESISTANCE_TRAINING_MET = 5;

/** Estimated kcal contribution of a single completed workout — replaces the
 * previous flat "+18% of BMR" bonus (which gave a 35-minute and a 90-minute
 * session the exact same credit) with a duration-aware estimate using the
 * user's own declared typical session length. Still an estimate, not a
 * measurement: there's no wearable/HR data behind it. */
function exerciseContributionKcal(input: { weightKg: number; sessionDurationBucket?: string; trainedThisDay: boolean }): number {
  if (!input.trainedThisDay) return 0;
  const minutes = SESSION_DURATION_MINUTES[input.sessionDurationBucket ?? '45-60'] ?? 45;
  return Math.round(RESISTANCE_TRAINING_MET * input.weightKg * (minutes / 60));
}

export type EnergyExpenditureBreakdown = {
  /** Resting expenditure — the BMR itself. */
  resting: number;
  /** Baseline daily activity/NEAT — what the job-activity multiplier adds over pure resting. */
  baselineActivity: number;
  /** Estimated contribution of today's completed workout, if any — see exerciseContributionKcal. */
  exercise: number;
  /** resting + baselineActivity + exercise — the estimated total for the day. */
  total: number;
};

/** Decomposed version of estimateDailyBurnedKcal (§5 bis, "Modello di
 * visualizzazione energetica proposto"): splits the one number into the
 * three components that produce it, so a UI can show where the estimate
 * comes from instead of a single opaque figure. */
export function estimateEnergyExpenditureBreakdown(input: {
  sex: Sex;
  ageRange: string;
  heightCm: number;
  weightKg: number;
  jobActivity?: string;
  sessionDurationBucket?: string;
  trainedThisDay: boolean;
}): EnergyExpenditureBreakdown {
  const age = AGE_RANGE_MIDPOINT[input.ageRange] ?? 30;
  const bmr = bmrMifflinStJeor(input.sex, input.weightKg, input.heightCm, age);
  const jobMultiplier = JOB_ACTIVITY_MULTIPLIER[input.jobActivity ?? 'sedentary'] ?? 1.2;
  const resting = Math.round(bmr);
  const baselineActivity = Math.round(bmr * (jobMultiplier - 1));
  const exercise = exerciseContributionKcal({
    weightKg: input.weightKg,
    sessionDurationBucket: input.sessionDurationBucket,
    trainedThisDay: input.trainedThisDay,
  });
  return { resting, baselineActivity, exercise, total: resting + baselineActivity + exercise };
}

/** A single day's estimated total energy expenditure — an ESTIMATE, not a
 * measurement (no wearable/HR data feeds this). Thin wrapper around
 * estimateEnergyExpenditureBreakdown for callers that only need the total. */
export function estimateDailyBurnedKcal(input: {
  sex: Sex;
  ageRange: string;
  heightCm: number;
  weightKg: number;
  jobActivity?: string;
  sessionDurationBucket?: string;
  trainedThisDay: boolean;
}): number {
  return estimateEnergyExpenditureBreakdown(input).total;
}

/** Just the estimated exercise contribution — the same figure
 * estimateDailyBurnedKcal folds in, exposed on its own so a UI can show
 * "calories from training" apart from resting/baseline-activity burn. */
export function estimateTrainingBonusKcal(input: {
  sex: Sex;
  ageRange: string;
  heightCm: number;
  weightKg: number;
  sessionDurationBucket?: string;
  trainedThisDay: boolean;
}): number {
  return exerciseContributionKcal({ weightKg: input.weightKg, sessionDurationBucket: input.sessionDurationBucket, trainedThisDay: input.trainedThisDay });
}

// A commonly used ballpark for walking: roughly 0.04 kcal per step for a
// 70kg adult (so ~10,000 steps ≈ 350-400 kcal), scaled linearly by weight
// since heavier bodies burn more per step.
const KCAL_PER_STEP_AT_70KG = 0.04;

/** Rough estimate of calories burned from a day's step count. */
export function estimateStepsKcal(steps: number, weightKg: number): number {
  return Math.round(steps * KCAL_PER_STEP_AT_70KG * (weightKg / 70));
}
