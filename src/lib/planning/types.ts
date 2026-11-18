import type { PlanCalibration, RecalibrationRecord } from '@/domain/recalibration';
import type { Goal } from '@/lib/mock/types';

export type PlanPhaseKind = 'adattamento' | 'progressione' | 'consolidamento';

/**
 * A SUGGESTED alternative of a plan item. It does not change the menu until the person picks it
 * (`applySubstitution`). Its portion is sized for the food's role and its values come from the catalog.
 */
export type PlanMealItemSubstitute = {
  name: string;
  grams: number;
  foodId: string;
  /** Human-friendly quantity — "2 uova" for count-based foods, "120g" otherwise. See food-quantity.ts. */
  quantityLabel: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  fiber?: number;
  /** 'equivalent' for the food's role in the meal, or 'tradeoff' (same role nutrient, different energy/macros). */
  equivalence?: 'equivalent' | 'tradeoff';
  /** What changes compared with the original (e.g. "−58% kcal, meno grassi"). */
  note?: string;
};

export type PlanMealItem = {
  name: string;
  grams: number;
  /** Energy and macros of these grams, from the catalog row (label energy: fibre counted at 2 kcal/g). */
  kcal: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  fiber?: number;
  /** lib/mock/food-database id — lets a logged day be pre-filled with the
   * plan's actual foods instead of just displaying their names. */
  foodId: string;
  /** Human-friendly quantity — "2 uova" for count-based foods, "120g" otherwise. See food-quantity.ts. */
  quantityLabel: string;
  /** What the food is there for in the meal. */
  role?: 'protein' | 'carb' | 'fat' | 'veg' | 'fruit' | 'extra';
  /** Same nutritional role (protein/carb/fat/veg/fruit), swappable 1-for-1. */
  substitutes?: PlanMealItemSubstitute[];
  /** Set when the person APPLIED a substitution: what was there before (for traceability and the report). */
  substitutedFrom?: { foodId: string; name: string; grams: number; kcal: number; protein: number; carbs: number; fats: number; fiber: number; at: string };
};

export type PlanMeal = {
  slotId: string;
  label: string;
  time: string;
  items: PlanMealItem[];
  totalKcal: number;
  /** The dish this meal makes ( e.g. "Bowl di pollo con riso basmati e zucchine" ) and the free flavourings that complete it. */
  recipe?: { name: string; flavorings: string[]; portable?: boolean; /** Recipe template id (e.g. "bowl"), for variety checks. */ dishId?: string };
  /** Macros delivered by the items (grams): the sum of the items, never set by hand. Absent on a free meal. */
  macros?: { protein: number; carbs: number; fats: number; fiber?: number };
  /** True for the one weekly unprescribed meal ("pasto libero") — items is
   * empty and totalKcal is only the reference budget, not a real total. */
  isFreeMeal?: boolean;
  /**
   * What is known of a free (or eaten-out) meal. Without a log: budget only, macros NOT available (never 0).
   * With a log: 'measured' (foods and grams → catalog values) or 'estimated' (calories only, or foods without
   * quantities → standard portions scaled to the stated calories), always labelled as such.
   */
  freeMealLog?: {
    status: 'measured' | 'estimated' | 'calories_only';
    kcal: number;
    macros?: { protein: number; carbs: number; fats: number; fiber: number };
    items?: PlanMealItem[];
    description?: string;
    method: string;
  };
  /** A meal eaten out (work, restaurant): unprescribed like a free meal, with its budget and practical guidance. */
  eatOut?: { guidance: string[] };
  /** Flexible time, e.g. "12:00–14:00" (the check-in asked for flexible times); `time` stays the reference. */
  timeWindow?: string;
};

export type DietDayPlan = {
  weekday: string;
  meals: PlanMeal[];
  /** The day's own target: it follows that day's training (more on training days, less on rest days). */
  calorieTarget?: number;
  macroTargetsG?: { protein: number; carbs: number; fats: number };
  isTrainingDay?: boolean;
};

export type DietMonthPlan = {
  monthIndex: number;
  phase: PlanPhaseKind;
  title: string;
  focusNote: string;
  calorieTarget: number;
  macroTargetsG: { protein: number; carbs: number; fats: number };
  weeklySplit: DietDayPlan[];
};

export type DietPlan = {
  generatedAt: string;
  durationMonths: number;
  goal: Goal;
  months: DietMonthPlan[];
  /** Version of the diet generator that built it: an older plan is rebuilt in place (see DIET_ENGINE_VERSION). */
  engine?: string;
  /** 'custom' = the person's own diet, imported as written: never rebuilt by the generator or the monthly recalibration. */
  source?: 'generated' | 'custom';
  /** Monthly recalibration state and history (see domain/recalibration.ts). */
  calibration?: PlanCalibration;
  recalibrations?: RecalibrationRecord[];
  /**
   * Professional supervision (domain/nutrition/safety.ts): set when a check-in reports a condition that needs a
   * professional. The plan is frozen as it was — no new month, rotation, calorie or macro change — and stays
   * so until `reactivateNutrition` (conditions re-assessed AND an explicit confirmation). History is kept.
   */
  supervision?: NutritionSupervision;
};

export type NutritionSupervision = {
  status: 'professional_review';
  reasons: string[];
  since: string;
  /** Where it was detected: the questionnaire (before any plan) or a monthly check-in. */
  source: 'questionnaire' | 'checkin';
  monthIndex?: number;
};

export type TrainingExerciseEntry = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  /** Conservative starting point in kg, or null for bodyweight/band exercises with no load to suggest. */
  suggestedKg: number | null;
  /** Execution cadence in seconds as "eccentric-isometric-concentric", e.g. "3-0-1". */
  tempo: string;
  /** True when no exercise in this split (or the wider catalog) was
   * compatible with the user's stated pain/injury/equipment constraints, so
   * the universally-safe bodyweight fallback was used instead of a real
   * recommendation — spec §4.3/§13 edge case table: this should never be
   * silently presented as an ordinary pick. */
  needsManualReview?: boolean;
};

export type TrainingDayPlan = {
  weekday: string;
  type: 'workout' | 'cardio' | 'rest';
  title: string;
  exercises?: TrainingExerciseEntry[];
  note?: string;
};

export type TrainingMonthPlan = {
  monthIndex: number;
  phase: PlanPhaseKind;
  title: string;
  focusNote: string;
  weeklySplit: TrainingDayPlan[];
};

export type TrainingPlan = {
  generatedAt: string;
  durationMonths: number;
  months: TrainingMonthPlan[];
  /** Version of the training generator that built it: an older plan is rebuilt in place (see TRAINING_ENGINE_VERSION). */
  engine?: string;
  /** 'custom' = the person's own card, imported as written: never rebuilt by the generator or the monthly recalibration. */
  source?: 'generated' | 'custom';
  calibration?: PlanCalibration;
  recalibrations?: RecalibrationRecord[];
  /** True if any exercise anywhere in the plan needed the safe-fallback
   * substitution (see TrainingExerciseEntry.needsManualReview) — surfaced
   * as a plan-level banner rather than requiring the UI to scan every day. */
  needsManualReview?: boolean;
};
