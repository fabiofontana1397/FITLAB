import { NUTRITION_PARAMS } from '@/domain/nutrition/params';
import type { DietAdaptations } from '@/domain/nutrition/types';
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

/** Bump when the generator changes in a way existing plans should pick up (they are rebuilt in place, keeping start date and history). */
export const DIET_ENGINE_VERSION = 'fitlab-7';

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
  /** What the check-ins changed: times, distribution, density, volume, variety, simpler week, meals out, foods. */
  adapt?: DietAdaptations;
};

const MAIN_SLOTS = new Set(['pranzo', 'cena']);
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (min: number) => {
  const m = Math.min(Math.max(min, 0), 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** The person's slots with the check-in's new times, flexible windows and calorie distribution. */
export function adaptSlots(slots: MealSlotDef[], adapt?: DietAdaptations): (MealSlotDef & { timeWindow?: string })[] {
  if (!adapt) return slots;
  let out = slots.map((s) => ({ ...s, time: adapt.mealTimes?.[s.id] ?? s.time }));
  if (adapt.distribution === 'even') {
    const b = NUTRITION_PARAMS.planning.evenBlend;
    out = out.map((s) => ({ ...s, sharePct: s.sharePct * (1 - b) + b / out.length }));
  } else if (adapt.distribution === 'lighterMains') {
    const cut = NUTRITION_PARAMS.planning.lighterMainsShare;
    const others = out.filter((s) => !MAIN_SLOTS.has(s.id));
    if (others.length > 0) {
      const freed = out.filter((s) => MAIN_SLOTS.has(s.id)).reduce((sum, s) => sum + s.sharePct * cut, 0);
      const otherTotal = others.reduce((sum, s) => sum + s.sharePct, 0);
      out = out.map((s) => ({ ...s, sharePct: MAIN_SLOTS.has(s.id) ? s.sharePct * (1 - cut) : s.sharePct + (freed * s.sharePct) / otherTotal }));
    }
  }
  const total = out.reduce((sum, s) => sum + s.sharePct, 0) || 1;
  return out.map((s) => ({
    ...s,
    sharePct: s.sharePct / total,
    timeWindow: adapt.timeWindowMin ? `${toTime(toMinutes(s.time) - adapt.timeWindowMin)}–${toTime(toMinutes(s.time) + adapt.timeWindowMin)}` : undefined,
  }));
}

/** Weekdays whose `slot` is eaten out: spread over the week, never on the free-meal day. */
export function eatOutDays(perWeek: number): number[] {
  return [1, 3, 2, 0, 4, 6].filter((d) => d !== FREE_MEAL_WEEKDAY_INDEX).slice(0, Math.max(0, Math.min(perWeek, 5)));
}

function eatOutGuidance(kcal: number, slotLabel: string, vegetarian: boolean): string[] {
  return [
    `${slotLabel} fuori casa: circa ${Math.round(kcal / 10) * 10} kcal.`,
    `Scegli un piatto con una fonte di proteine (${vegetarian ? 'uova, formaggi freschi o legumi' : 'carne o pesce alla griglia, oppure legumi'}) e verdure, con una sola porzione di carboidrati (pasta, riso, pane o patate).`,
    'Condimenti a parte quando puoi; tra pane, alcol e dolce scegline al massimo uno.',
    'Non serve compensare negli altri pasti: il piano tiene già conto di questa uscita.',
  ];
}

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

// ---------------------------------------------------------------- the week --

function buildDay(
  weekdayIndex: number,
  monthIndex: number,
  dayTarget: PlanTargets['perWeekday'][number],
  pools: FitLabPools,
  slots: (MealSlotDef & { timeWindow?: string })[],
  week: WeekUsage,
  adapt: DietAdaptations | undefined,
  vegetarian: boolean
): DietDayPlan {
  const day: DayState = { eggGrams: 0, families: new Set(), dishes: new Set() };
  const seed = (monthIndex - 1) * 7 + weekdayIndex;
  const isFreeDay = weekdayIndex === FREE_MEAL_WEEKDAY_INDEX && slots.some((s) => s.id === FREE_MEAL_SLOT);
  const outSlot = adapt?.eatOut && eatOutDays(adapt.eatOut.perWeek).includes(weekdayIndex) ? adapt.eatOut.slot : null;

  const meals: PlanMeal[] = slots.map((slot, slotIdx) => {
    const kcalShare = slot.sharePct;
    const slotKcal = dayTarget.calories * kcalShare;
    const when = slot.timeWindow ? { timeWindow: slot.timeWindow } : {};
    if (isFreeDay && slot.id === FREE_MEAL_SLOT) {
      return { slotId: slot.id, label: slot.label, time: slot.time, ...when, items: [], totalKcal: Math.round(slotKcal), isFreeMeal: true };
    }
    if (outSlot === slot.id) {
      return { slotId: slot.id, label: slot.label, time: slot.time, ...when, items: [], totalKcal: Math.round(slotKcal), isFreeMeal: true, eatOut: { guidance: eatOutGuidance(slotKcal, slot.label, vegetarian) } };
    }
    const target: Macros = {
      protein: dayTarget.macros.protein * kcalShare,
      carbs: dayTarget.macros.carbs * kcalShare,
      fats: dayTarget.macros.fats * kcalShare,
    };
    const { items, macros, recipe } = buildFitLabMeal({ kind: SLOT_KIND[slot.id], slotId: slot.id, target, pools, seed: seed + slotIdx, day, week, adapt });
    return {
      slotId: slot.id,
      label: slot.label,
      time: slot.time,
      ...when,
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
  const { ctx, monthTargets, strategy, variant = 0, preserveMonthsBefore, existingMonths, adapt } = input;
  const durationMonths = monthTargets.length;
  const pools = buildFitLabPools(ctx.answers, adapt);
  const slots = adaptSlots(buildMealSlotsFromAnswers(ctx.answers), adapt);
  const vegetarian = ctx.answers.dietaryPattern === 'vegetarian' || ctx.answers.dietaryPattern === 'vegan';

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
    // variety within the month's week, and rotation from the previous month (the pool's other recipes come first)
    const prev = months[months.length - 1];
    const previous = prev ? new Set(prev.weeklySplit.flatMap((d) => d.meals.map((m) => m.recipe?.dishId).filter((id): id is string => !!id))) : undefined;
    const usage: WeekUsage = { dish: new Map(), food: new Map(), slot: new Map(), previous, strongVariety: !!adapt?.strongVariety };
    const monthlyFocus = strategy?.monthlyFocus?.find((m) => m.monthIndex === monthIndex);
    months.push({
      monthIndex,
      phase,
      title: monthlyFocus?.title ?? `Mese ${monthIndex} · ${phaseTitle(phase, ctx.goal)}`,
      focusNote: monthlyFocus?.focusNote ?? phaseNote(phase, ctx.goal),
      calorieTarget: targets.calories,
      macroTargetsG: targets.macros,
      weeklySplit: WEEKDAY_LABELS.map((_, i) => buildDay(i, monthIndex + variant * 5, targets.perWeekday[i], pools, slots, usage, adapt, vegetarian)),
    });
  }

  return { generatedAt: new Date().toISOString(), durationMonths, goal: ctx.goal, months, engine: DIET_ENGINE_VERSION };
}

