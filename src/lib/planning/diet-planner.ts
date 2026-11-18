import { NUTRITION_PARAMS } from '@/domain/nutrition/params';
import { SEX_FLOOR } from '@/domain/nutrition/safety';
import type { DietAdaptations } from '@/domain/nutrition/types';
import type { PlanTargets } from '@/domain/targets';
import type { UserContext } from '@/domain/user-context';
import type { MealSlot } from '@/store/nutrition-store';

import { WEEKDAY_LABELS } from './exercise-library';
import { buildFitLabMeal, resizeItem, sumNutrition, type DayState, type WeekUsage } from './fitlab/meal-builder';
import { SLOT_KIND, UNITS } from './fitlab/catalog';
import { fitlabById } from './fitlab/foods';
import { buildFitLabPools, type FitLabPools } from './fitlab/pools';
import type { Macros } from './fitlab/solver';
import { buildMealSlotsFromAnswers, type MealSlotDef } from './meal-slots';
import type { DietStrategy } from './strategy-types';
import type { DietDayPlan, DietMonthPlan, DietPlan, PlanMeal, PlanPhaseKind } from './types';

/** Bump when the generator changes in a way existing plans should pick up (they are rebuilt in place, keeping start date and history). */
export const DIET_ENGINE_VERSION = 'fitlab-8';

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

/** Meal totals are always the sum of the items (energy, macros, fibre): no value is set by hand. */
function withTotals(meal: PlanMeal): PlanMeal {
  if (meal.isFreeMeal) return meal;
  const n = sumNutrition(meal.items);
  return { ...meal, totalKcal: n.kcal, macros: { protein: Math.round(n.protein), carbs: Math.round(n.carbs), fats: Math.round(n.fats), fiber: Math.round(n.fiber) } };
}

/**
 * Day-level reconciliation. Each meal is solved on its own and rounded to practical portions, so the day can drift
 * from its target. When it drifts beyond the tolerance, the carbohydrate portions (then the olive oil) of the
 * prescribed meals move by practical steps, within ±35% of what the solver chose, until the day is back within
 * it. A free or eaten-out meal counts with its budget and is never touched. Values stay those of the catalog.
 */
function reconcileDay(
  meals: PlanMeal[],
  target: number,
  proteinTarget: number,
  floor: number,
  resize: (mealIndex: number, item: PlanMeal['items'][number], grams: number) => PlanMeal['items'][number] | null
): void {
  const tol = target * NUTRITION_PARAMS.planning.dayKcalTolerance;
  // never under the day's safety floor, whatever the tolerance
  const lo = Math.max(target - tol, floor);
  const hi = Math.max(target + tol, lo + 10);
  const total = () => meals.reduce((sum, m) => sum + m.totalKcal, 0);
  const original = new Map<PlanMeal['items'][number], number>();
  // the new portion must stay within the food's bounds for that meal; its swaps are sized again on it
  const replace = (mi: number, idx: number, grams: number): boolean => {
    const item = meals[mi].items[idx];
    const next = resize(mi, item, grams);
    if (!next) return false;
    original.set(next, original.get(item) ?? item.grams);
    const items = [...meals[mi].items];
    items[idx] = next;
    meals[mi] = withTotals({ ...meals[mi], items });
    return true;
  };
  // protein first: when the meals fall short of the day's protein (on the prescribed share of the day), the
  // protein portions of lunch and dinner grow by practical steps (≤ +35%), the energy check below then
  // brings the carbohydrates back to the day's calories
  const budget = meals.filter((m) => m.isFreeMeal).reduce((sum, m) => sum + m.totalKcal, 0);
  const wantedProtein = proteinTarget * (1 - budget / Math.max(target, 1)) * (1 - NUTRITION_PARAMS.validation.proteinWarnShare / 2);
  const protein = () => meals.reduce((sum, m) => sum + (m.isFreeMeal ? 0 : m.items.reduce((s, i) => s + (i.protein ?? 0), 0)), 0);
  for (let pass = 0; pass < 10 && protein() < wantedProtein; pass++) {
    let moved = false;
    const eggs = () => meals.reduce((sum, m) => sum + m.items.filter((i) => i.name === 'Uova intere').reduce((s2, i) => s2 + i.grams, 0), 0);
    // main meals first, then breakfast and snacks; counted foods (eggs) grow by one unit, eggs ≤ 200 g a day
    const order = [...meals.keys()].sort((a, b) => Number(meals[b].slotId === 'pranzo' || meals[b].slotId === 'cena') - Number(meals[a].slotId === 'pranzo' || meals[a].slotId === 'cena'));
    for (const mi of order) {
      if (moved) break;
      const meal = meals[mi];
      if (meal.isFreeMeal) continue;
      const idx = meal.items.findIndex((it) => it.role === 'protein');
      if (idx < 0) continue;
      const item = meal.items[idx];
      const base = original.get(item) ?? item.grams;
      const unit = UNITS[item.name]?.grams;
      const grams = item.grams + (unit ?? 10);
      if (unit ? grams > base + unit : grams > base * 1.35) continue;
      if (item.name === 'Uova intere' && eggs() + (unit ?? 0) > 200) continue;
      moved = replace(mi, idx, grams);
    }
    if (!moved) break;
  }
  // energy: carbohydrate portions first (main meals, then breakfast and snacks), then fats, then proteins —
  // each by its practical step (a counted food by one unit), within its portion bounds and ±35% of the solver's
  // choice. The move closest to the remaining gap is taken each time.
  const isMain = (m: PlanMeal) => m.slotId === 'pranzo' || m.slotId === 'cena';
  for (let pass = 0; pass < 40 && (total() < lo || total() > hi); pass++) {
    const gap = total() < lo ? lo - total() : hi - total(); // > 0: add energy, < 0: remove
    let moved = false;
    for (const role of ['carb', 'fat', 'protein'] as const) {
      const options: { mi: number; idx: number; grams: number; delta: number }[] = [];
      for (let mi = 0; mi < meals.length; mi++) {
        const meal = meals[mi];
        if (meal.isFreeMeal) continue;
        meal.items.forEach((item, idx) => {
          if (item.role !== role) return;
          const food = fitlabById(item.foodId);
          if (!food) return;
          const base = original.get(item) ?? item.grams;
          const unit = UNITS[item.name]?.grams;
          const step = unit ?? (role === 'fat' ? 5 : item.grams >= 100 ? 10 : 5);
          const grams = item.grams + (gap > 0 ? step : -step);
          if (grams < base * 0.6 || grams > base * 1.6 + (unit ?? 0)) return;
          options.push({ mi, idx, grams, delta: ((grams - item.grams) * food.kcal) / 100 + (isMain(meal) ? 0 : 0.01) });
        });
      }
      // the move that lands the day inside the band, or else best closes the gap
      const now = total();
      const lands = (o: (typeof options)[number]) => now + o.delta >= lo && now + o.delta <= hi;
      options.sort((a, b) => Number(lands(b)) - Number(lands(a)) || Math.abs(gap - a.delta) - Math.abs(gap - b.delta) || Number(isMain(meals[b.mi])) - Number(isMain(meals[a.mi])));
      for (const o of options) {
        if (!lands(o) && Math.abs(gap - o.delta) >= Math.abs(gap)) continue; // would not improve
        if (replace(o.mi, o.idx, o.grams)) { moved = true; break; }
      }
      if (moved) break;
    }
    if (!moved) break;
  }
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
  vegetarian: boolean,
  floor: number
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
    const { items, recipe } = buildFitLabMeal({ kind: SLOT_KIND[slot.id], slotId: slot.id, target, pools, seed: seed + slotIdx, day, week, adapt });
    return withTotals({ slotId: slot.id, label: slot.label, time: slot.time, ...when, items, totalKcal: 0, recipe });
  });
  reconcileDay(meals, dayTarget.calories, dayTarget.macros.protein, floor, (mi, item, grams) =>
    resizeItem(item, grams, { kind: SLOT_KIND[slots[mi].id], pools, kcalTarget: dayTarget.calories * slots[mi].sharePct, adapt })
  );

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
    const previous = new Map<string, number>();
    for (const [back, weight] of [[2, 0.5], [1, 1]] as const) {
      const m = months[months.length - back];
      for (const id of m?.weeklySplit.flatMap((d) => d.meals.map((x) => x.recipe?.dishId)) ?? []) if (id) previous.set(id, weight);
    }
    const usage: WeekUsage = { dish: new Map(), food: new Map(), slot: new Map(), previous, strongVariety: !!adapt?.strongVariety };
    const monthlyFocus = strategy?.monthlyFocus?.find((m) => m.monthIndex === monthIndex);
    months.push({
      monthIndex,
      phase,
      title: monthlyFocus?.title ?? `Mese ${monthIndex} · ${phaseTitle(phase, ctx.goal)}`,
      focusNote: monthlyFocus?.focusNote ?? phaseNote(phase, ctx.goal),
      calorieTarget: targets.calories,
      macroTargetsG: targets.macros,
      weeklySplit: WEEKDAY_LABELS.map((_, i) => {
        const day = buildDay(i, monthIndex + variant * 5, targets.perWeekday[i], pools, slots, usage, adapt, vegetarian, SEX_FLOOR[ctx.sex]);
        usage.yesterday = new Set(day.meals.map((m) => m.recipe?.dishId).filter((id): id is string => !!id));
        return day;
      }),
    });
  }

  return { generatedAt: new Date().toISOString(), durationMonths, goal: ctx.goal, months, engine: DIET_ENGINE_VERSION };
}

