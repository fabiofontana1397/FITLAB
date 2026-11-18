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
  /** Engine v5: an easy run done on the same day as this strength session, in a separate moment. */
  extraRun?: {
    kind: string;
    title: string;
    minutes: number;
    intensity: string;
    structure: string;
    progression: string;
    weeks?: { week: number; minutes: number; note?: string }[];
    /** Which comes first (the activity with priority), and the minimum gap between the two. */
    order: 'runFirst' | 'gymFirst';
    gapHours: number;
    note: string;
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
  /** Engine v4/v5: findings of the plan validator for this month. */
  validation?: PlanFinding[];
  /** Engine v5: conflicts of this month (requests vs possibilities), with decision and alternatives. */
  conflicts?: PlanConflict[];
  /** Engine v5: split and session length the month was built with (for month-to-month traceability). */
  splitKind?: string;
  sessionMinutes?: number;
  /** Engine v5: layout compromises that could not be avoided with the days available (hybrid weeks). */
  compromises?: string[];
  /** Engine v5: estimated fatigue of the month's ordinary week (see training/fatigue.ts). */
  fatigue?: {
    weekly: number;
    capacity: number;
    ratio: number;
    status: 'low' | 'ok' | 'high' | 'excessive';
    capacityNotes: string[];
    days: { weekday: string; strength: number; running: number; total: number; legs: number }[];
    groups: { group: string; label: string; load: number; sessions: number; closeStimuli: string[] }[];
    joints: { area: string; load: number }[];
    runningShare: number;
    notes: string[];
    /** What the planner did about it, if anything. */
    action?: string;
  };
  /** Engine v5: change of each group's weekly volume vs the previous month, with its reason. */
  volumeChanges?: { group: string; label: string; previous: number; current: number; changePct: number; direct: number; indirect: number; frequency: number; deload: boolean; temporary: boolean; reason: string }[];
  /** Engine v5: exercises that changed vs the previous month (same session), with the reason. */
  exerciseChanges?: { session: string; from: string | null; to: string | null; role?: string; reason: string }[];
};

/** A structured validation finding (engine v5). */
export type PlanFinding = {
  level: 'blocker' | 'warning' | 'info' | 'review';
  code: string;
  message: string;
  /** volume, safety, deload, schedule, hybrid, fatigue, patterns, conflict, prescription, progression, equipment */
  category?: string;
  /** Muscle group, session or day involved. */
  subject?: string;
  cause?: string;
  impact?: string;
  action?: string;
  /** Same key = same underlying problem (used to count unique problems across months). */
  groupKey?: string;
};

/** A conflict between what the person asked and what can be done (engine v5). */
export type PlanConflict = {
  id: string;
  /** Hierarchy: 1 safety, 2 availability, 3 main goal, 4 frequency, 5 split preference, 6 secondary preferences. */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  description: string;
  alternatives: string[];
  decision: string;
  /** True when the plan is provisional until the person chooses. */
  needsConfirmation: boolean;
  /** Months of the plan it applies to. */
  months?: number[];
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
  /** Engine v5: conflicts between requests and possibilities, with the decision taken and the alternatives. */
  conflicts?: PlanConflict[];
};
