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
export const DIET_ENGINE_VERSION = 'fitlab-9';

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
export function withTotals(meal: PlanMeal): PlanMeal {
  if (meal.isFreeMeal) return meal;
  const n = sumNutrition(meal.items);
  return { ...meal, totalKcal: n.kcal, macros: { protein: Math.round(n.protein), carbs: Math.round(n.carbs), fats: Math.round(n.fats), fiber: Math.round(n.fiber) } };
}

/**
 * Day-level reconciliation (the macronutrient engine). Each meal is solved on its own and rounded to practical
 * portions, so the day can drift from its energy and macro targets. The day is then improved by single portion
 * moves (one practical step of one food: a counted food by one unit), each chosen as the one that most reduces
 *
 *   cost = energy outside the ±tolerance band (dominant)  ≫  protein deviation  >  carbohydrate / fat deviation
 *
 * so the priorities are: energy, then protein (a shortfall weighs more than an excess), then carbohydrates and fats.
 * Macro targets apply to the prescribed share of the day (a free or eaten-out meal counts with its budget and is
 * never touched). Every portion stays within its bounds for that meal and within 60–160% of what the solver chose
 * (proteins 65–150%); eggs ≤ 200 g a day; never under the day's safety floor. Days are reconciled one by one:
 * there is no compensation between days. Items in `locked` (an applied substitution) are not moved.
 * Values always come from the catalog (resizeItem → toItem).
 */
export function reconcileDay(
  meals: PlanMeal[],
  target: number,
  macroTarget: Macros,
  floor: number,
  resize: (mealIndex: number, item: PlanMeal['items'][number], grams: number) => PlanMeal['items'][number] | null,
  locked: Set<string> = new Set()
): void {
  const P = NUTRITION_PARAMS.macros;
  const tol = target * NUTRITION_PARAMS.planning.dayKcalTolerance;
  const lo = Math.max(target - tol, floor);
  const hi = Math.max(target + tol, lo + 10);
  const budget = meals.filter((m) => m.isFreeMeal).reduce((sum, m) => sum + m.totalKcal, 0);
  const share = 1 - budget / Math.max(target, 1);
  const want = { p: macroTarget.protein * share, c: macroTarget.carbs * share, f: macroTarget.fats * share };
  const original = new Map<PlanMeal['items'][number], number>();
  const state = () => {
    let kcal = budget, p = 0, c = 0, f = 0, fib = 0, eggs = 0;
    for (const m of meals) {
      if (m.isFreeMeal) continue;
      for (const i of m.items) {
        kcal += i.kcal; p += i.protein ?? 0; c += i.carbs ?? 0; f += i.fats ?? 0; fib += i.fiber ?? 0;
        if (i.name === 'Uova intere') eggs += i.grams;
      }
    }
    return { kcal, p, c: c + fib / 2, f, eggs };
  };
  const cost = (x: { kcal: number; p: number; c: number; f: number }) => {
    const out = Math.max(0, lo - x.kcal, x.kcal - hi) / Math.max(target, 1);
    const centre = x.kcal / Math.max(target, 1) - 1; // inside the band, closer to the target is better (no weekly drift)
    const dp = x.p / Math.max(want.p, 1) - 1;
    const dc = x.c / Math.max(want.c, 1) - 1;
    const df = x.f / Math.max(want.f, 1) - 1;
    return P.kcalWeight * out + P.kcalCentreWeight * centre * centre + (dp < 0 ? P.proteinUnderWeight : P.proteinOverWeight) * dp * dp + P.carbsWeight * dc * dc + P.fatsWeight * df * df;
  };
  type Move = { mi: number; idx: number; grams: number; d: { kcal: number; p: number; c: number; f: number }; egg: number; main: boolean };
  for (let pass = 0; pass < P.maxMoves; pass++) {
    const now = state();
    const current = cost(now);
    const moves: Move[] = [];
    for (let mi = 0; mi < meals.length; mi++) {
      const meal = meals[mi];
      if (meal.isFreeMeal) continue;
      for (let idx = 0; idx < meal.items.length; idx++) {
        const item = meal.items[idx];
        if (item.role !== 'carb' && item.role !== 'fat' && item.role !== 'protein') continue;
        if (locked.has(`${mi}|${idx}`) || item.substitutedFrom) continue;
        const food = fitlabById(item.foodId);
        if (!food) continue;
        const base = original.get(item) ?? item.grams;
        const unit = UNITS[item.name]?.grams;
        const step = unit ?? (item.role === 'fat' ? 5 : item.grams >= 100 ? 10 : 5);
        const [minS, maxS] = item.role === 'protein' ? [0.65, 1.5] : [0.6, 1.6];
        for (const dir of [1, -1]) {
          const grams = item.grams + dir * step;
          if (grams < Math.max(step, base * minS) || grams > base * maxS + (unit ?? 0)) continue;
          const k = (grams - item.grams) / 100;
          moves.push({ mi, idx, grams, d: { kcal: food.kcal * k, p: food.p * k, c: food.c * k + (food.fib * k) / 2, f: food.f * k }, egg: item.name === 'Uova intere' ? grams - item.grams : 0, main: meal.slotId === 'pranzo' || meal.slotId === 'cena' });
        }
      }
    }
    // single moves, and pairs of moves on two different foods (more protein AND fewer carbohydrates at the same
    // energy: a single move would leave the band). Breakfast and snacks keep their portions on ties.
    let best: { moves: Move[]; cost: number } | null = null;
    const consider = (ms: Move[]) => {
      if (now.eggs + ms.reduce((s2, m) => s2 + m.egg, 0) > 200 && ms.some((m) => m.egg > 0)) return;
      const next = { kcal: now.kcal, p: now.p, c: now.c, f: now.f };
      for (const m of ms) { next.kcal += m.d.kcal; next.p += m.d.p; next.c += m.d.c; next.f += m.d.f; }
      const c = cost(next) + ms.filter((m) => !m.main).length * 1e-5 + (ms.length - 1) * P.minGain;
      if (c < current - P.minGain && (!best || c < best.cost)) best = { moves: ms, cost: c };
    };
    for (let i = 0; i < moves.length; i++) {
      consider([moves[i]]);
      for (let j = i + 1; j < moves.length; j++) if (moves[i].mi !== moves[j].mi || moves[i].idx !== moves[j].idx) consider([moves[i], moves[j]]);
    }
    if (!best) break;
    for (const m of (best as { moves: Move[] }).moves) {
      const item = meals[m.mi].items[m.idx];
      const next = resize(m.mi, item, m.grams);
      if (!next) {
        locked.add(`${m.mi}|${m.idx}`); // outside the food's bounds for that meal: not a candidate any more
        continue;
      }
      original.set(next, original.get(item) ?? item.grams);
      const items = [...meals[m.mi].items];
      items[m.idx] = next;
      meals[m.mi] = withTotals({ ...meals[m.mi], items });
    }
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
  reconcileDay(meals, dayTarget.calories, dayTarget.macros, floor, (mi, item, grams) =>
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

