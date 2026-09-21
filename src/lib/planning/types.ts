import type { Goal } from '@/lib/mock/types';

export type PlanPhaseKind = 'adattamento' | 'progressione' | 'consolidamento';

export type PlanMealItemSubstitute = {
  name: string;
  grams: number;
  foodId: string;
  /** Human-friendly quantity — "2 uova" for count-based foods, "120g" otherwise. See food-quantity.ts. */
  quantityLabel: string;
};

export type PlanMealItem = {
  name: string;
  grams: number;
  kcal: number;
  /** lib/mock/food-database id — lets a logged day be pre-filled with the
   * plan's actual foods instead of just displaying their names. */
  foodId: string;
  /** Human-friendly quantity — "2 uova" for count-based foods, "120g" otherwise. See food-quantity.ts. */
  quantityLabel: string;
  /** Same nutritional role (protein/carb/fat/veg/fruit), swappable 1-for-1. */
  substitutes?: PlanMealItemSubstitute[];
};

export type PlanMeal = {
  slotId: string;
  label: string;
  time: string;
  items: PlanMealItem[];
  totalKcal: number;
  /** True for the one weekly unprescribed meal ("pasto libero") — items is
   * empty and totalKcal is only the reference budget, not a real total. */
  isFreeMeal?: boolean;
};

export type DietDayPlan = {
  weekday: string;
  meals: PlanMeal[];
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
  /** True if any exercise anywhere in the plan needed the safe-fallback
   * substitution (see TrainingExerciseEntry.needsManualReview) — surfaced
   * as a plan-level banner rather than requiring the UI to scan every day. */
  needsManualReview?: boolean;
};
