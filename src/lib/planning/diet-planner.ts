import type { PlanTargets } from '@/domain/targets';
import type { UserContext } from '@/domain/user-context';
import type { MealSlot } from '@/store/nutrition-store';

import { WEEKDAY_LABELS } from './exercise-library';
import { buildFitLabMeal, type DayState, type WeekUsage } from './fitlab/meal-builder';
import { SLOT_KIND } from './fitlab/catalog';
import { buildFitLabPools, type FitLabPools } from './fitlab/pools';
import type { Macros } from './fitlab/solver';
import { buildMealSlotsFromAnswers, type MealSlotDef } from './meal-slots';
import type { DietStrategy } from './strategy-types';
import type { DietDayPlan, DietMonthPlan, DietPlan, PlanMeal, PlanPhaseKind } from './types';

export type DietPlanInput = {
  ctx: UserContext;
  /** One entry per plan month (index 0 = month 1), from computeTargets on that month's training week. */
  monthTargets: PlanTargets[];
  /** The AI strategy contributes titles/notes only: calories and macros come from the energy model. */
  strategy?: DietStrategy | null;
  /** Rotates the picked foods (recalibration changes it every month). */
  variant?: number;
  /** Monthly recalibration: months before this index are copied verbatim. */
  preserveMonthsBefore?: number;
  existingMonths?: DietMonthPlan[];
};

// One evening a week is left unprescribed ("pasto libero"): Saturday dinner.
const FREE_MEAL_WEEKDAY_INDEX = 5;
const FREE_MEAL_SLOT: MealSlot = 'cena';

function phaseForMonth(monthIndex: number, totalMonths: number): PlanPhaseKind {
  if (monthIndex === 1) return 'adattamento';
  if (monthIndex === totalMonths) return 'consolidamento';
  return 'progressione';
}

function phaseTitle(phase: PlanPhaseKind, goal: UserContext['goal']): string {
  if (phase === 'adattamento') return 'Adattamento';
  if (phase === 'consolidamento') return 'Consolidamento';
  if (goal === 'loseFat') return 'Deficit progressivo';
  if (goal === 'gainMuscle' || goal === 'gainStrength') return 'Surplus progressivo';
  return 'Aggiustamenti mirati';
}

function phaseNote(phase: PlanPhaseKind, goal: UserContext['goal']): string {
  if (phase === 'adattamento') return 'Il primo mese serve a prendere le misure: abitudini, orari e porzioni. A fine mese l’agente rivede calorie e allenamento in base ai tuoi progressi reali.';
  if (phase === 'consolidamento') return 'I target si stabilizzano: da qui il piano si mantiene e si ricalibra ogni mese in base ai tuoi progressi reali.';
  if (goal === 'loseFat') return 'Il deficit calorico è pienamente attivo: la priorità è preservare la massa muscolare mentre il peso scende.';
  if (goal === 'gainMuscle' || goal === 'gainStrength') return 'Il surplus calorico sostiene la crescita muscolare, con un ritmo di aumento controllato.';
  return 'Piccoli aggiustamenti su calorie e macro, guidati dai tuoi progressi reali in energia e performance.';
}

function round5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

// ---------------------------------------------------------------- the week --

function buildDay(
  weekdayIndex: number,
  monthIndex: number,
  dayTarget: PlanTargets['perWeekday'][number],
  pools: FitLabPools,
  slots: MealSlotDef[],
  week: WeekUsage
): DietDayPlan {
  const day: DayState = { eggGrams: 0, families: new Set(), dishes: new Set() };
  const seed = (monthIndex - 1) * 7 + weekdayIndex;
  const isFreeDay = weekdayIndex === FREE_MEAL_WEEKDAY_INDEX && slots.some((s) => s.id === FREE_MEAL_SLOT);

  const meals: PlanMeal[] = slots.map((slot, slotIdx) => {
    const kcalShare = slot.sharePct;
    const slotKcal = dayTarget.calories * kcalShare;
    if (isFreeDay && slot.id === FREE_MEAL_SLOT) {
      return { slotId: slot.id, label: slot.label, time: slot.time, items: [], totalKcal: Math.round(slotKcal), isFreeMeal: true };
    }
    const target: Macros = {
      protein: dayTarget.macros.protein * kcalShare,
      carbs: dayTarget.macros.carbs * kcalShare,
      fats: dayTarget.macros.fats * kcalShare,
    };
    const { items, macros, recipe } = buildFitLabMeal({ kind: SLOT_KIND[slot.id], target, pools, seed: seed + slotIdx, day, week });
    return {
      slotId: slot.id,
      label: slot.label,
      time: slot.time,
      items,
      totalKcal: items.reduce((s, i) => s + i.kcal, 0),
      macros: { protein: Math.round(macros.protein), carbs: Math.round(macros.carbs), fats: Math.round(macros.fats) },
      recipe,
    };
  });

  return {
    weekday: WEEKDAY_LABELS[weekdayIndex],
    meals,
    calorieTarget: dayTarget.calories,
    macroTargetsG: dayTarget.macros,
    isTrainingDay: dayTarget.isTrainingDay,
  };
}

export function generateDietPlan(input: DietPlanInput): DietPlan {
  const { ctx, monthTargets, strategy, variant = 0, preserveMonthsBefore, existingMonths } = input;
  const durationMonths = monthTargets.length;
  const pools = buildFitLabPools(ctx.answers);
  const slots = buildMealSlotsFromAnswers(ctx.answers);

  const months: DietMonthPlan[] = [];
  for (let monthIndex = 1; monthIndex <= durationMonths; monthIndex++) {
    if (preserveMonthsBefore != null && monthIndex < preserveMonthsBefore) {
      const existing = existingMonths?.find((m) => m.monthIndex === monthIndex);
      if (existing) {
        months.push(existing);
        continue;
      }
    }
    const phase = phaseForMonth(monthIndex, durationMonths);
    const targets = monthTargets[monthIndex - 1];
    const usage: WeekUsage = { dish: new Map(), food: new Map() }; // variety within the month's week
    const monthlyFocus = strategy?.monthlyFocus?.find((m) => m.monthIndex === monthIndex);
    months.push({
      monthIndex,
      phase,
      title: monthlyFocus?.title ?? `Mese ${monthIndex} · ${phaseTitle(phase, ctx.goal)}`,
      focusNote: monthlyFocus?.focusNote ?? phaseNote(phase, ctx.goal),
      calorieTarget: targets.calories,
      macroTargetsG: targets.macros,
      weeklySplit: WEEKDAY_LABELS.map((_, i) => buildDay(i, monthIndex + variant * 5, targets.perWeekday[i], pools, slots, usage)),
    });
  }

  return { generatedAt: new Date().toISOString(), durationMonths, goal: ctx.goal, months };
}

