/**
 * Shared types of the adaptive nutrition engine (monthly check-in → decision → new plan).
 *
 *   A monitoring.ts   collects and validates every check-in datum, turns the free notes into structured facts
 *   B analysis.ts     weight trend, adherence, sustainability (hunger, energy, recovery, difficulties)
 *   C decision.ts     ordered decision hierarchy → calorie step + non-caloric interventions
 *   D safety.ts       individual calorie / macro limits, supervision cases, dynamic TDEE
 *   E meal planner    lib/planning/diet-planner.ts + fitlab/meal-builder.ts, driven by `DietAdaptations`
 *   F validation.ts   nutritional, mathematical and structural checks of a plan and of an update
 *   G explanation.ts  plain-Italian changes, reasons and the decision log
 *
 * Calculations, limits and safety are deterministic. An AI agent may contribute only structured
 * note interpretations (`NoteFacts`) and proposals; both pass through the same deterministic gates.
 */

export type Energy = 'veryLow' | 'low' | 'normal' | 'high' | 'veryHigh';
export type Hunger = 'never' | 'rarely' | 'sometimes' | 'often' | 'always';
export type QuantityDirection = 'tooMuch' | 'tooLittle' | 'mixed';
export type SkippedMeals = 'none' | '1-2' | '3-5' | 'gt5';
export type ActivityChange = 'less' | 'same' | 'more';
export type TemporaryEvent = 'travel' | 'illness' | 'cycle' | 'salty' | 'intenseTraining' | 'stress';
export type SpecialCondition = 'pregnancy' | 'breastfeeding' | 'medical' | 'eatingDisorder';

/** How the meal planner adapts the next months (persisted in `PlanCalibration.diet`). */
export type DietAdaptations = {
  /** Fixed new times per slot (HH:MM), from the person's answer. */
  mealTimes?: Partial<Record<string, string>>;
  /** Flexible times: each meal shows a window of ±this many minutes around its time. */
  timeWindowMin?: number;
  /** How the day's calories are split across meals. */
  distribution?: 'standard' | 'even' | 'lighterMains';
  /** More energy per gram: smaller volume for the same calories (less bulky vegetables, denser carbs, nuts). */
  energyDense?: boolean;
  /** More volume for the same calories (more vegetables): satiety. */
  highVolume?: boolean;
  /** Stronger rotation: last month's dishes and repeated proteins are avoided much more. */
  strongVariety?: boolean;
  /** Fewer different recipes, quicker meals: easier to follow. */
  simplify?: boolean;
  /** Meals eaten out every week: those slots become a guided "fuori casa" meal with its calorie budget. */
  eatOut?: { slot: 'pranzo' | 'cena'; perWeek: number };
  /** Foods the person asked to replace (hard exclusion from now on). */
  dislikedFoodIds?: string[];
  /** Foods the person asked for in the check-in (treated like preferred foods). */
  extraPreferredFoodIds?: string[];
  /** Protein per kg nudged up for satiety (on a deficit with frequent hunger). */
  macroProfile?: 'standard' | 'satiety';
};

/** Structured reading of the free-text notes (deterministic keyword parser, or an AI agent's validated output). */
export type NoteFacts = {
  eatingOut?: { slot: 'pranzo' | 'cena' | 'any'; perWeek: number | null };
  events: TemporaryEvent[];
  specialConditions: SpecialCondition[];
  foodsToReplace: string[];
  foodsWanted: string[];
  /** Note fragments that were not understood: they become a clarification question, never a guess. */
  unclear: string[];
};

/** Every datum of a check-in, normalised (A). */
export type MonitoringData = {
  adherenceSelf: number | null;
  energy: Energy | null;
  hunger: Hunger | null;
  difficulties: string[];
  wantsChange: string[];
  quantity: { direction: QuantityDirection | null; inferred: boolean } | null;
  skippedMeals: SkippedMeals | null;
  eatingOutPerWeek: number | null;
  eatingOutSlot: 'pranzo' | 'cena' | 'any' | null;
  preferredTimes: Partial<Record<string, string>>;
  foodsToReplace: string[];
  foodsWanted: string[];
  activityChange: ActivityChange | null;
  waistCm: number | null;
  events: TemporaryEvent[];
  specialConditions: SpecialCondition[];
  notes: string;
  notesFacts: NoteFacts;
  /** Questions the engine needs answered before acting on something it could not interpret. */
  clarifications: string[];
  /** Which raw answers were read (proof that nothing was ignored). */
  used: string[];
};

export type WeightClass =
  | 'on_track'
  | 'too_slow'
  | 'plateau'
  | 'wrong_direction'
  | 'too_fast'
  | 'weight_up'
  | 'weight_down'
  | 'temporary_variation'
  | 'insufficient_data';

export type WeightAnalysis = {
  count: number;
  spanDays: number;
  /** none: no trend; limited: trend usable for safety decisions only; good: ≥3 weeks, representative. */
  quality: 'none' | 'limited' | 'good';
  anomalies: { date: string; kg: number }[];
  /** Least-squares slope over the clean weigh-ins, kg/week. */
  rateKgWeek: number | null;
  /** Same over the second half of the month (persistence check). */
  recentRateKgWeek: number | null;
  /** Difference between the first and the last weekly mean, per week. */
  weeklyMeansRate: number | null;
  /** 7-day moving average at each clean weigh-in. */
  movingAverage: { date: string; kg: number }[];
  weeklyMeans: number[];
  pctBodyWeightPerWeek: number | null;
  /** Rate, recent rate and weekly means all point the same way. */
  persistent: boolean;
  expectedKgWeek: number;
  classification: WeightClass;
  explanation: string;
};

export type AdherenceAnalysis = {
  score: number | null;
  level: 'high' | 'medium' | 'low' | 'unknown';
  intakeRatio: number | null;
  /** An identified cause of partial adherence (eating out, skipped meals, events). */
  causes: string[];
  explanation: string;
};

export type SustainabilityAnalysis = {
  level: 'ok' | 'strained' | 'critical';
  signals: string[];
};

export type InterventionKind =
  | 'confirm_calories'
  | 'increase_calories'
  | 'decrease_calories'
  | 'change_macros'
  | 'change_distribution'
  | 'change_times'
  | 'change_foods'
  | 'energy_density'
  | 'reduce_volume'
  | 'increase_volume'
  | 'eat_out_alternatives'
  | 'simplify_week'
  | 'request_info'
  | 'professional_review'
  | 'training_signal';

export type Intervention = { kind: InterventionKind; text: string; rule: string };

export type SafetyCheck = { id: string; ok: boolean; message: string; blocked?: boolean };

export type DecisionLog = {
  monthIndex: number;
  previousTarget: number;
  newTarget: number;
  /** Target change declared by the decision, and the documented reasons for any other change. */
  calorieStep: number;
  otherChanges: string[];
  tdeeModel: number;
  tdeeEstimate: number;
  balancePct: number;
  previousMacros: { protein: number; carbs: number; fats: number };
  newMacros: { protein: number; carbs: number; fats: number };
  weight: Pick<WeightAnalysis, 'count' | 'spanDays' | 'quality' | 'rateKgWeek' | 'recentRateKgWeek' | 'pctBodyWeightPerWeek' | 'classification' | 'anomalies'>;
  adherence: Pick<AdherenceAnalysis, 'score' | 'level' | 'causes'>;
  sustainability: SustainabilityAnalysis;
  feedbackUsed: string[];
  interventions: Intervention[];
  rulesApplied: string[];
  excludedAlternatives: string[];
  safety: SafetyCheck[];
  clarifications: string[];
  supervision: boolean;
  expectedOutcome: string;
  /** Filled at the next check-in: what really happened after this decision. */
  observedOutcome?: string;
};
