// The shape a "plan strategy" agent (supabase/functions/generate-plan-strategy)
// produces: the METHODOLOGICAL decisions behind a plan — which split,
// which set/rep scheme, how calories/macros periodize across months, and
// why — grounded in the two reference PDFs plus authoritative web search.
// Deliberately NOT the full meal-by-meal/exercise-by-exercise plan: that
// stays assembled by the existing deterministic code in diet-planner.ts /
// training-planner.ts, which only ever picks real ids from the app's own
// food-database / exercise-library — so an AI-invented food or exercise
// can never leak into the plan and break logging/progress features
// elsewhere in the app. When a strategy field is absent (no AI configured,
// or the call failed), each planner falls back to its original hardcoded
// table byte-for-byte — the AI layer is additive, never a hard dependency.
import type { SplitLabel, SetScheme } from './exercise-library';

export type MonthlyFocus = { monthIndex: number; title: string; focusNote: string };

export type TrainingStrategy = {
  splitLabels: SplitLabel[];
  gymScheme: { adattamento: SetScheme; later: SetScheme };
  runSessions?: { adattamento: string[]; later: string[] };
  monthlyFocus: MonthlyFocus[];
  /** Short, citable explanation of the methodology chosen — surfaced for
   * transparency/debugging, not necessarily shown verbatim in the UI. */
  rationale: string;
};

export type MonthlyDietTarget = {
  monthIndex: number;
  calorieTarget: number;
  macroTargetsG: { protein: number; carbs: number; fats: number };
};

export type DietStrategy = {
  monthlyTargets: MonthlyDietTarget[];
  monthlyFocus: MonthlyFocus[];
  rationale: string;
};

export type PlanStrategy = { training: TrainingStrategy | null; diet: DietStrategy | null };
