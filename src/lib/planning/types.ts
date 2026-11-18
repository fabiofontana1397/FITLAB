import type { PlanCalibration, RecalibrationRecord } from '@/domain/recalibration';
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
  /** What the food is there for in the meal. */
  role?: 'protein' | 'carb' | 'fat' | 'veg' | 'fruit' | 'extra';
  /** Same nutritional role (protein/carb/fat/veg/fruit), swappable 1-for-1. */
  substitutes?: PlanMealItemSubstitute[];
};

export type PlanMeal = {
  slotId: string;
  label: string;
  time: string;
  items: PlanMealItem[];
  totalKcal: number;
  /** The dish this meal makes ( e.g. "Bowl di pollo con riso basmati e zucchine" ) and the free flavourings that complete it. */
  recipe?: { name: string; flavorings: string[]; portable?: boolean; /** Recipe template id (e.g. "bowl"), for variety checks. */ dishId?: string };
  /** Macros delivered by the items (grams). Absent on a free meal. */
  macros?: { protein: number; carbs: number; fats: number };
  /** True for the one weekly unprescribed meal ("pasto libero") — items is
   * empty and totalKcal is only the reference budget, not a real total. */
  isFreeMeal?: boolean;
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
};

export type TrainingExerciseEntry = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  /** Conservative starting point in kg, or null for bodyweight/band exercises with no load to suggest. */
  suggestedKg: number | null;
  /** Execution cadence: eccentric – pause in the stretch – concentric – pause at the top ("X" = explosive intent), e.g. "3-1-1-0". */
  tempo: string;
  /** True when no exercise in this split (or the wider catalog) was
   * compatible with the user's stated pain/injury/equipment constraints, so
   * the universally-safe bodyweight fallback was used instead of a real
   * recommendation — spec §4.3/§13 edge case table: this should never be
   * silently presented as an ordinary pick. */
  needsManualReview?: boolean;
  // ---- training engine v3 (all optional: custom cards and older plans do not have them)
  repsMin?: number;
  repsMax?: number;
  /** Reps in reserve to stop at (0 = failure). */
  rir?: number;
  /** RIR-based RPE (10 − RIR). */
  rpe?: number;
  /** 'calibrate' = first-month estimate to adjust in the first sessions; 'estimate' = projection until history exists. */
  loadStatus?: 'calibrate' | 'estimate' | 'bodyweight';
  loadNote?: string;
  /** Smallest load jump for this exercise (kg). */
  loadIncrementKg?: number;
  role?: 'main' | 'secondary' | 'isolation' | 'core';
  primaryMuscle?: string;
  primaryRegion?: string;
  secondaryMuscles?: string[];
  muscleGroup?: string;
  sessionBlockId?: string;
  blockName?: string;
  blockOrder?: number;
  exerciseOrder?: number;
  orderingReason?: string;
  /** Execution cues. */
  cues?: string[];
  /** How this exercise progresses (double progression, reps, time). */
  progression?: string;
  /** Intensification technique, when appropriate. */
  technique?: { kind: string; label: string; how: string };
  /** Id of the exercise this one alternates with in an antagonist superset. */
  supersetWith?: string;
  /** Effective prescription of each week of the month (engine v4): the mesocycle's weekly
   * parameters (calibration, last-week push, deload) applied to this exercise. The top-level
   * fields are the ordinary week. */
  weeks?: ExerciseWeekRx[];
  /** Set by exerciseForWeek (training/week.ts) when the entry shows a specific week's prescription. */
  activeWeek?: { week: number; deload?: boolean; note?: string };
};

/** One week's prescription of an exercise. */
export type ExerciseWeekRx = {
  week: number;
  sets: number;
  reps: string;
  rir?: number;
  rpe?: number;
  restSec: number;
  /** Load for the week when it differs from the ordinary week (deload: ≈ −10%). */
  suggestedKg?: number | null;
  /** Intensification technique of the week; null = none (removed in a deload). */
  technique?: { kind: string; label: string; how: string } | null;
  deload?: boolean;
  /** True when the week is applied only if needed (e.g. "deload if fatigue is high"). */
  conditional?: boolean;
  note?: string;
};

export type TrainingDayPlan = {
  weekday: string;
  type: 'workout' | 'cardio' | 'rest';
  title: string;
  exercises?: TrainingExerciseEntry[];
  note?: string;
  // ---- training engine v3
  /** What the session is about ("Squat e spinta orizzontale"). */
  focus?: string;
  muscleGroups?: string[];
  blocks?: { id: string; name: string; order: number }[];
  estimatedMinutes?: number;
  /** Decisions taken while building the session (supersets, cuts to fit the time). */
  notes?: string[];
  /** Structured running session. */
  run?: {
    kind: string;
    minutes: number;
    intensity: string;
    structure: string;
    progression: string;
    /** Per-week minutes (engine v4): a recovery week shortens the runs. */
    weeks?: { week: number; minutes: number; note?: string }[];
  };
};

export type TrainingMonthPlan = {
  monthIndex: number;
  phase: PlanPhaseKind;
  title: string;
  focusNote: string;
  weeklySplit: TrainingDayPlan[];
  // ---- training engine v3
  /** Mesocycle block: adattamento, accumulo, intensificazione, consolidamento. */
  block?: string;
  mesocycle?: {
    goal: string;
    progression: string;
    exitCriteria: string;
    weeks: {
      week: number;
      label: string;
      rirOffset: number;
      setsFactor: number;
      note: string;
      /** Engine v4: deload week (reduced sets, higher RIR, no intensification). */
      deload?: boolean;
      conditional?: boolean;
      /** Weekly gym sets actually prescribed this week (sum over the sessions). */
      sets?: number;
    }[];
  };
  /** True when the time the person has, not the programme, limited the weekly volume this month. */
  timeCapped?: boolean;
  /** Weekly volume per muscle group (fractional sets: direct + half of the indirect ones). */
  weeklyVolume?: { group: string; label: string; direct: number; indirect: number; fractional: number; frequency: number; target: number; status?: 'ok' | 'under' | 'over' | 'excluded'; reason?: string }[];
  /** Engine v4: coverage of the fundamental movement patterns over the week. */
  patternCoverage?: { pattern: 'push' | 'pull' | 'knee' | 'hip' | 'core'; status: 'full' | 'partial' | 'missing'; sessions: number; exercises: string[]; note?: string }[];
  /** Engine v4: exercises excluded this month and why (pain, equipment, near-duplicates). */
  exclusions?: { group: string; reason: string; exercises: string[] }[];
  /** Engine v4: findings of the plan validator for this month. */
  validation?: { level: 'blocker' | 'warning' | 'info'; code: string; message: string }[];
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
  /** Why the plan is built the way it is: level, model, split, decisions on conflicts. */
  rationale?: { level: string; model: string; split: string; reasons: string[]; notices: string[] };
};
