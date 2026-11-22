import { NEUTRAL_CALIBRATION } from '@/domain/recalibration';
import type { Goal } from '@/lib/mock/types';

import { DIET_ENGINE_VERSION } from './diet-planner';
import { WEEKDAY_LABELS } from './exercise-library';
import type { DietDayPlan, DietMonthPlan, DietPlan, PlanPhaseKind } from './types';

/**
 * "Imposta il tuo piano": the person sets, month by month, the calories and the macros they want to eat. There is
 * no menu: the plan only carries the numbers, and those numbers become the target everywhere in the app (Home,
 * Nutrizione, the week, the assistant), exactly as the app's own plan would.
 */

export type MacroMode = 'percent' | 'grams';
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
 * Checks one month as the person typed it. Blockers stop the plan from being saved (a target that makes no sense
 * would then be shown everywhere); warnings are shown and the person decides.
 */
export function validateMonthTargets(
  t: MonthTargets,
  mode: MacroMode,
  pct: { protein: number; carbs: number; fats: number },
  weightKg?: number
): TargetIssue[] {
  const issues: TargetIssue[] = [];
  if (!Number.isFinite(t.calories) || t.calories < TARGET_LIMITS.minCalories || t.calories > TARGET_LIMITS.maxCalories) {
    issues.push({ level: 'blocker', text: `Le calorie devono stare tra ${TARGET_LIMITS.minCalories.toLocaleString('it-IT')} e ${TARGET_LIMITS.maxCalories.toLocaleString('it-IT')} kcal al giorno.` });
    return issues;
  }
  if (mode === 'percent') {
    const sum = pct.protein + pct.carbs + pct.fats;
    if (Math.abs(sum - 100) > 0.5) issues.push({ level: 'blocker', text: `Le percentuali sommano ${Math.round(sum)}%: devono fare 100%.` });
  } else {
    const fromGrams = kcalFromGrams(t);
    if (Math.abs(fromGrams - t.calories) / t.calories > 0.05) {
      issues.push({ level: 'blocker', text: `Le macro valgono ${fromGrams.toLocaleString('it-IT')} kcal, le calorie impostate sono ${t.calories.toLocaleString('it-IT')}: allinea i due valori.` });
    }
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

const PHASE = (i: number, n: number): PlanPhaseKind => (i === 0 ? 'adattamento' : i === n - 1 ? 'consolidamento' : 'progressione');

export type TargetsPlanBase = {
  goal: Goal;
  macroMode: MacroMode;
  /** Keeps the start date of a plan being edited; a new plan starts today. */
  generatedAt?: string;
  calibration?: DietPlan['calibration'];
  recalibrations?: DietPlan['recalibrations'];
  /** Months of the old plan already lived: they stay exactly as they were. */
  keepMonths?: DietMonthPlan[];
};

/** The person's targets as a diet plan with no meals: one target per month, the same on every day of that month. */
export function buildTargetsPlan(months: MonthTargets[], base: TargetsPlanBase): DietPlan {
  const n = months.length;
  const built: DietMonthPlan[] = months.map((t, i) => {
    const kept = base.keepMonths?.find((m) => m.monthIndex === i + 1);
    if (kept) return kept;
    const macroTargetsG = { protein: Math.round(t.protein), carbs: Math.round(t.carbs), fats: Math.round(t.fats) };
    const calorieTarget = Math.round(t.calories);
    const weeklySplit: DietDayPlan[] = WEEKDAY_LABELS.map((weekday) => ({ weekday, meals: [], calorieTarget, macroTargetsG: { ...macroTargetsG } }));
    return {
      monthIndex: i + 1,
      phase: PHASE(i, n),
      title: `Mese ${i + 1} · I tuoi obiettivi`,
      focusNote: 'Obiettivi impostati da te: calorie e macro del giorno, senza un menù.',
      calorieTarget,
      macroTargetsG,
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
    ownTargets: { macroMode: base.macroMode },
    calibration: base.calibration ?? NEUTRAL_CALIBRATION,
    recalibrations: base.recalibrations,
  };
}

/** A plan of the person's own targets (no menu), as opposed to an imported diet or the app's plan. */
export function isTargetsPlan(plan: Pick<DietPlan, 'source' | 'ownTargets'> | null | undefined): boolean {
  return plan?.source === 'custom' && plan.ownTargets != null;
}
