import type { Goal, Sex } from '@/lib/mock/types';

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

// Small additive TDEE nudge from the questionnaire's sleepHoursRange bucket
// — previously collected but unused (spec §11/§13 point 4, "Keep+Use").
// Chronic short sleep measurably reduces NEAT/spontaneous activity in the
// literature; kept intentionally small (same order of magnitude as the
// steps bump) since this app has no direct NEAT measurement to calibrate
// against.
const SLEEP_HOURS_BUMP: Record<string, number> = {
  lt5: -0.03,
  '5-6': -0.01,
  '6-7': 0,
  '7-8': 0.01,
  gt8: 0,
};

// Never recommend below this — a floor of last resort, independent of
// whatever combination of inputs produced the goal-driven target (spec §13
// edge case table, "calorie target sotto soglia di sicurezza").
export const MIN_SAFE_CALORIE_TARGET = 1200;

export type NutritionTargetsInput = {
  sex: Sex;
  /** Precise age in years (questionnaire v2 — replaces the earlier ageRange bucket). */
  age: number;
  heightCm: number;
  currentWeightKg: number;
  goal: Goal;
  jobActivity?: string;
  /** Total trained days/week across all activities — see deriveWeeklyTrainingDays. */
  weeklyTrainingDays?: number;
  /** Questionnaire `dailySteps` bucket (lt3000/3000-5000/5000-8000/8000-12000/gt12000/unknown). */
  dailyStepsBucket?: string;
  /** Questionnaire `sleepHoursRange` bucket (lt5/5-6/6-7/7-8/gt8). */
  sleepHoursBucket?: string;
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
  const bmr = bmrMifflinStJeor(input.sex, input.currentWeightKg, input.heightCm, input.age);

  const jobMultiplier = JOB_ACTIVITY_MULTIPLIER[input.jobActivity ?? 'sedentary'] ?? 1.2;
  const trainingDays = input.weeklyTrainingDays ?? 0;
  const trainingBump = Math.min(trainingDays, 6) * 0.03;
  const stepsBump = DAILY_STEPS_BUMP[input.dailyStepsBucket ?? 'unknown'] ?? 0;
  const sleepBump = SLEEP_HOURS_BUMP[input.sleepHoursBucket ?? '6-7'] ?? 0;
  const tdee = bmr * (jobMultiplier + trainingBump + stepsBump + sleepBump);

  const dailyCalorieTarget = Math.max(Math.round(tdee * GOAL_CALORIE_FACTOR[input.goal]), MIN_SAFE_CALORIE_TARGET);

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

/** Estimated kcal contribution of today's workout — spec §5 bis replaces the
 * previous flat "+18% of BMR if the workout is 100% complete" bonus (which
 * gave a 35-minute and a 90-minute session the exact same credit, and gave
 * zero credit for a session stopped at 90%) with a duration-and-completion
 * aware estimate: session length from the user's own declared typical
 * duration, scaled by how much of today's planned session was actually
 * completed (the closest proxy this app has to intensity, absent real
 * wearable/HR data). Still an estimate, not a measurement. */
function exerciseContributionKcal(input: { weightKg: number; sessionDurationBucket?: string; completionFraction: number }): number {
  if (input.completionFraction <= 0) return 0;
  const minutes = SESSION_DURATION_MINUTES[input.sessionDurationBucket ?? '45-60'] ?? 45;
  return Math.round(RESISTANCE_TRAINING_MET * input.weightKg * (minutes / 60) * Math.min(input.completionFraction, 1));
}

export type EnergyExpenditureBreakdown = {
  /** Resting expenditure — the BMR itself. */
  resting: number;
  /** Baseline daily activity/NEAT — what the job-activity multiplier adds over pure resting. */
  baselineActivity: number;
  /** Estimated contribution of today's workout, scaled by how much of it was completed — see exerciseContributionKcal. */
  exercise: number;
  /** resting + baselineActivity + exercise — the estimated total for the day. */
  total: number;
};

/** Decomposed estimated-energy-expenditure model (§5 bis, "Modello di
 * visualizzazione energetica proposto"): splits the one number into the
 * three components that produce it, so a UI can show where the estimate
 * comes from instead of a single opaque figure. Deliberately named
 * "expenditure", not "burned" — this is a Mifflin-St Jeor-based estimate,
 * never a wearable/HR measurement, and neither the code nor the UI should
 * imply otherwise. */
export function estimateEnergyExpenditureBreakdown(input: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  jobActivity?: string;
  sessionDurationBucket?: string;
  /** Fraction (0-1) of today's planned workout actually completed — 0 on a
   * rest/cardio day or a day with no plan at all. Replaces the previous
   * all-or-nothing "trainedThisDay" flag so a half-finished session earns
   * half the estimated exercise contribution instead of zero. */
  completionFraction: number;
}): EnergyExpenditureBreakdown {
  const bmr = bmrMifflinStJeor(input.sex, input.weightKg, input.heightCm, input.age);
  const jobMultiplier = JOB_ACTIVITY_MULTIPLIER[input.jobActivity ?? 'sedentary'] ?? 1.2;
  const resting = Math.round(bmr);
  const baselineActivity = Math.round(bmr * (jobMultiplier - 1));
  const exercise = exerciseContributionKcal({
    weightKg: input.weightKg,
    sessionDurationBucket: input.sessionDurationBucket,
    completionFraction: input.completionFraction,
  });
  return { resting, baselineActivity, exercise, total: resting + baselineActivity + exercise };
}

/** A single day's estimated total energy expenditure — an ESTIMATE, not a
 * measurement (no wearable/HR data feeds this). Thin wrapper around
 * estimateEnergyExpenditureBreakdown for callers that only need the total. */
export function estimateDailyEnergyExpenditure(input: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  jobActivity?: string;
  sessionDurationBucket?: string;
  completionFraction: number;
}): number {
  return estimateEnergyExpenditureBreakdown(input).total;
}

/** Just the estimated exercise contribution — the same figure
 * estimateDailyEnergyExpenditure folds in, exposed on its own so a UI can
 * show "calories from training" apart from resting/baseline-activity burn. */
export function estimateTrainingContributionKcal(input: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  sessionDurationBucket?: string;
  completionFraction: number;
}): number {
  return exerciseContributionKcal({ weightKg: input.weightKg, sessionDurationBucket: input.sessionDurationBucket, completionFraction: input.completionFraction });
}

// A commonly used ballpark for walking: roughly 0.04 kcal per step for a
// 70kg adult (so ~10,000 steps ≈ 350-400 kcal), scaled linearly by weight
// since heavier bodies burn more per step.
const KCAL_PER_STEP_AT_70KG = 0.04;

/** Rough estimate of calories burned from a day's step count. */
export function estimateStepsKcal(steps: number, weightKg: number): number {
  return Math.round(steps * KCAL_PER_STEP_AT_70KG * (weightKg / 70));
}
