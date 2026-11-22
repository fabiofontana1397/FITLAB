import { NEUTRAL_CALIBRATION } from '@/domain/recalibration';
import type { Goal } from '@/lib/mock/types';

import { DIET_ENGINE_VERSION } from './diet-planner';
import { WEEKDAY_LABELS } from './exercise-library';
import type { DietDayPlan, DietMonthPlan, DietPlan, PlanPhaseKind } from './types';

/**
 * "Crea il tuo piano" (nutrition): the person sets, month by month, the calories, protein and fats they want to eat
 * on training days and on rest days; the carbs fill the calories left. There is no menu: the plan only carries the
 * numbers, and those numbers become the target everywhere in the app (Home, Nutrizione, the week, the assistant),
 * exactly as the app's own plan would.
 */

export type MonthTargets = { calories: number; protein: number; carbs: number; fats: number };

/** Energy per gram (Atwater): what turns grams into calories and back. */
export const KCAL_PER_G = { protein: 4, carbs: 4, fats: 9 } as const;

export const TARGET_LIMITS = {
  minMonths: 1,
  maxMonths: 12,
  minCalories: 1000,
  maxCalories: 6000,
  /** Below this the plan is accepted but flagged: better followed with a professional. */
  lowCalories: 1200,
} as const;

/** Share of the calories of each macro (whole percent, summing to about 100). */
export function macroPercents(t: MonthTargets): { protein: number; carbs: number; fats: number } {
  if (t.calories <= 0) return { protein: 0, carbs: 0, fats: 0 };
  return {
    protein: Math.round(((t.protein * KCAL_PER_G.protein) / t.calories) * 100),
    carbs: Math.round(((t.carbs * KCAL_PER_G.carbs) / t.calories) * 100),
    fats: Math.round(((t.fats * KCAL_PER_G.fats) / t.calories) * 100),
  };
}

/** Grams of each macro for a calorie target and a split in percent. */
export function gramsFromPercents(calories: number, pct: { protein: number; carbs: number; fats: number }): Omit<MonthTargets, 'calories'> {
  return {
    protein: Math.round((calories * pct.protein) / 100 / KCAL_PER_G.protein),
    carbs: Math.round((calories * pct.carbs) / 100 / KCAL_PER_G.carbs),
    fats: Math.round((calories * pct.fats) / 100 / KCAL_PER_G.fats),
  };
}

/** Calories delivered by the grams of the three macros. */
export function kcalFromGrams(g: Omit<MonthTargets, 'calories'>): number {
  return Math.round(g.protein * KCAL_PER_G.protein + g.carbs * KCAL_PER_G.carbs + g.fats * KCAL_PER_G.fats);
}

export type TargetIssue = { level: 'blocker' | 'warning'; text: string };

/**
 * Carbohydrates are not typed: they fill the calories that protein and fats leave (Atwater). Never negative: when
 * protein and fats alone exceed the calories, validation blocks the day.
 */
export function carbsForCalories(calories: number, protein: number, fats: number): number {
  return Math.max(0, Math.round((calories - protein * KCAL_PER_G.protein - fats * KCAL_PER_G.fats) / KCAL_PER_G.carbs));
}

/** One day's targets from calories, protein and fats: the carbs close the calories. */
export function dayTargets(calories: number, protein: number, fats: number): MonthTargets {
  return { calories, protein, fats, carbs: carbsForCalories(calories, protein, fats) };
}

/**
 * Checks one day as the person typed it (calories, protein, fats; carbs follow). Blockers stop the plan from being
 * saved (a target that makes no sense would then be shown everywhere); warnings are shown and the person decides.
 */
export function validateDayTargets(t: Pick<MonthTargets, 'calories' | 'protein' | 'fats'>, weightKg?: number): TargetIssue[] {
  const issues: TargetIssue[] = [];
  if (!Number.isFinite(t.calories) || t.calories < TARGET_LIMITS.minCalories || t.calories > TARGET_LIMITS.maxCalories) {
    issues.push({ level: 'blocker', text: `Le calorie devono stare tra ${TARGET_LIMITS.minCalories.toLocaleString('it-IT')} e ${TARGET_LIMITS.maxCalories.toLocaleString('it-IT')} kcal al giorno.` });
    return issues;
  }
  const fixed = t.protein * KCAL_PER_G.protein + t.fats * KCAL_PER_G.fats;
  if (fixed > t.calories) {
    issues.push({ level: 'blocker', text: `Proteine e grassi valgono ${Math.round(fixed).toLocaleString('it-IT')} kcal, più delle calorie impostate: non resta spazio per i carboidrati.` });
  }
  if (t.calories < TARGET_LIMITS.lowCalories) issues.push({ level: 'warning', text: 'Sotto le 1.200 kcal al giorno è meglio farsi seguire da un professionista.' });
  const fatShare = (t.fats * KCAL_PER_G.fats) / t.calories;
  if (t.fats > 0 && fatShare < 0.15) issues.push({ level: 'warning', text: 'Grassi sotto il 15% delle calorie: difficile coprire quelli essenziali.' });
  if (weightKg && weightKg > 0) {
    const perKg = t.protein / weightKg;
    if (perKg < 0.8) issues.push({ level: 'warning', text: `Proteine basse: ${perKg.toFixed(1).replace('.', ',')} g per kg di peso, sotto il minimo di 0,8 g/kg.` });
    else if (perKg > 3.0) issues.push({ level: 'warning', text: `Proteine molto alte: ${perKg.toFixed(1).replace('.', ',')} g per kg di peso.` });
  }
  return issues;
}

/**
 * The calendar month a plan month is named after: the plan's start month, then the next ones (a plan started on
 * 22 November reads Novembre, Dicembre, Gennaio…). `monthIndex` starts at 1.
 */
export function planMonthName(startedAt: string | number, monthIndex: number, style: 'long' | 'short' = 'long'): string {
  const start = new Date(startedAt);
  const d = new Date(start.getFullYear(), start.getMonth() + monthIndex - 1, 1);
  const name = d.toLocaleDateString('it-IT', { month: style }).replace('.', '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Training-day and rest-day targets of one month. */
export type MonthDayTargets = { training: MonthTargets; rest: MonthTargets };
export type DayKind = keyof MonthDayTargets;

/** Weekdays (0 = Monday) the person trains on when nothing else says so. */
export const DEFAULT_TRAINING_DAYS = [0, 2, 4];

const PHASE = (i: number, n: number): PlanPhaseKind => (i === 0 ? 'adattamento' : i === n - 1 ? 'consolidamento' : 'progressione');

export type TargetsPlanBase = {
  goal: Goal;
  /** Weekdays (0 = Monday) that get the training-day targets; the others get the rest-day ones. */
  trainingDays?: number[];
  /** Keeps the start date of a plan being edited; a new plan starts today. */
  generatedAt?: string;
  calibration?: DietPlan['calibration'];
  recalibrations?: DietPlan['recalibrations'];
  /** Months of the old plan already lived: they stay exactly as they were. */
  keepMonths?: DietMonthPlan[];
};

const roundTargets = (t: MonthTargets): MonthTargets => ({ calories: Math.round(t.calories), protein: Math.round(t.protein), carbs: Math.round(t.carbs), fats: Math.round(t.fats) });

/**
 * The person's targets as a diet plan with no meals: one target per month, different on training and rest days.
 * Each weekday carries its own target (the whole app reads the day's one); the month target is the week's average.
 * A month given as a single target uses it on every day.
 */
export function buildTargetsPlan(months: (MonthTargets | MonthDayTargets)[], base: TargetsPlanBase): DietPlan {
  const n = months.length;
  const trainingDays = [...new Set(base.trainingDays ?? [])].filter((d) => d >= 0 && d < 7).sort((a, b) => a - b);
  const built: DietMonthPlan[] = months.map((input, i) => {
    const kept = base.keepMonths?.find((m) => m.monthIndex === i + 1);
    if (kept) return kept;
    const pair: MonthDayTargets = 'training' in input ? input : { training: input, rest: input };
    const training = roundTargets(pair.training);
    const rest = roundTargets(pair.rest);
    const weeklySplit: DietDayPlan[] = WEEKDAY_LABELS.map((weekday, d) => {
      const isTrainingDay = trainingDays.includes(d);
      const t = isTrainingDay ? training : rest;
      return { weekday, meals: [], calorieTarget: t.calories, macroTargetsG: { protein: t.protein, carbs: t.carbs, fats: t.fats }, isTrainingDay };
    });
    const avg = (pick: (t: MonthTargets) => number) => Math.round(weeklySplit.reduce((sum, _, d) => sum + pick(trainingDays.includes(d) ? training : rest), 0) / 7);
    return {
      monthIndex: i + 1,
      phase: PHASE(i, n),
      title: `Mese ${i + 1} · Il tuo piano`,
      focusNote: 'Piano impostato da te: calorie e macro del giorno, senza un menù.',
      calorieTarget: avg((t) => t.calories),
      macroTargetsG: { protein: avg((t) => t.protein), carbs: avg((t) => t.carbs), fats: avg((t) => t.fats) },
      weeklySplit,
    };
  });
  return {
    generatedAt: base.generatedAt ?? new Date().toISOString(),
    durationMonths: n,
    goal: base.goal,
    months: built,
    engine: DIET_ENGINE_VERSION,
    // 'custom' like an imported diet: the generator and the monthly recalibration never change it
    source: 'custom',
    ownTargets: { trainingDays },
    calibration: base.calibration ?? NEUTRAL_CALIBRATION,
    recalibrations: base.recalibrations,
  };
}

/**
 * A month's targets for training days and for rest days, read back from its weekdays. A month whose days all share
 * one target (older plans, or no training day) returns it for both.
 */
export function monthDayTargets(month: DietMonthPlan): MonthDayTargets {
  const of = (d: DietDayPlan | undefined): MonthTargets =>
    d?.calorieTarget != null && d.macroTargetsG ? { calories: d.calorieTarget, ...d.macroTargetsG } : { calories: month.calorieTarget, ...month.macroTargetsG };
  const training = month.weeklySplit.find((d) => d.isTrainingDay);
  const rest = month.weeklySplit.find((d) => !d.isTrainingDay);
  return { training: of(training ?? rest), rest: of(rest ?? training) };
}

/** A plan of the person's own targets (no menu), as opposed to an imported diet or the app's plan. */
export function isTargetsPlan(plan: Pick<DietPlan, 'source' | 'ownTargets'> | null | undefined): boolean {
  return plan?.source === 'custom' && plan.ownTargets != null;
}
