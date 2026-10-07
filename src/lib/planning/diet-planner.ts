import type { PlanTargets } from '@/domain/targets';
import type { UserContext } from '@/domain/user-context';
import { findFood, type FoodItem } from '@/lib/mock/food-database';
import type { MealSlot } from '@/store/nutrition-store';

import { WEEKDAY_LABELS } from './exercise-library';
import { formatFoodQuantity } from './food-quantity';
import { buildFoodPools, pick, type MealType } from './food-pools';
import { buildMealSlotsFromAnswers, type MealSlotDef } from './meal-slots';
import type { DietStrategy } from './strategy-types';
import type { DietDayPlan, DietMonthPlan, DietPlan, PlanMeal, PlanMealItem, PlanPhaseKind } from './types';

/** colazione/pranzo/cena get main-meal-appropriate proteins/carbs; snacks get snack-appropriate ones. */
const SLOT_MEAL_TYPE: Record<MealSlot, 'breakfast' | 'main' | 'snack'> = {
  colazione: 'breakfast',
  spuntinoMattina: 'snack',
  pranzo: 'main',
  spuntinoPomeriggio: 'snack',
  cena: 'main',
  spuntinoSera: 'snack',
};

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

// ---------------------------------------------------------------- portions --

/** Largest reasonable amount of a food in one sitting (grams). */
function maxPerMeal(food: FoodItem): number {
  switch (food.id) {
    case 'eggs':
      return 150; // 3 eggs
    case 'egg-whites':
      return 200;
    case 'whey-protein':
      return 40;
    case 'prosciutto-crudo':
    case 'bresaola':
      return 60;
    case 'tofu':
      return 250;
    case 'greek-yogurt':
    case 'cottage-cheese':
    case 'skyr':
    case 'ricotta':
      return 300;
    case 'oats':
      return 100;
    case 'pizza-margherita':
      return 350;
  }
  switch (food.category) {
    case 'proteine':
      return 220;
    case 'latticini':
      return 300;
    case 'legumi':
      return 250;
    case 'carboidrati':
      return food.kcal100 >= 200 ? 120 : 350;
    case 'grassi':
      return food.id.includes('oil') ? 25 : food.id === 'avocado' ? 80 : 35;
    case 'verdura':
      return 300;
    case 'frutta':
      return 250;
    default:
      return 200;
  }
}

type Macros = { protein: number; carbs: number; fats: number };

function macrosOfFood(food: FoodItem, grams: number): Macros {
  const k = grams / 100;
  return { protein: food.protein100 * k, carbs: food.carbs100 * k, fats: food.fats100 * k };
}

function sum(...m: Macros[]): Macros {
  return m.reduce((a, b) => ({ protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fats: a.fats + b.fats }), { protein: 0, carbs: 0, fats: 0 });
}

function kcalOf(m: Macros): number {
  return m.protein * 4 + m.carbs * 4 + m.fats * 9;
}

/** Solves a1·x + b1·y = c1, a2·x + b2·y = c2. */
function solve2(a1: number, b1: number, c1: number, a2: number, b2: number, c2: number): [number, number] | null {
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-6) return null;
  return [(c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det];
}

type Item = { food: FoodItem; grams: number; role: 'protein' | 'carb' | 'fat' | 'veg' | 'fruit' };

function toPlanItem(it: Item, substitutes?: PlanMealItem['substitutes']): PlanMealItem {
  const kcal = Math.round((it.food.kcal100 * it.grams) / 100);
  return { name: it.food.name, grams: it.grams, kcal, foodId: it.food.id, quantityLabel: formatFoodQuantity(it.food.id, it.grams), substitutes };
}

const MAX_SUBSTITUTES = 4;

/** Same-role swaps sized to deliver the same amount of the nutrient the item is there for. */
function substitutesFor(pool: string[], it: Item, seed: number): PlanMealItem['substitutes'] {
  if (it.role === 'veg' || it.role === 'fruit') return undefined;
  const result: NonNullable<PlanMealItem['substitutes']> = [];
  const nutrient = it.role === 'protein' ? 'protein100' : it.role === 'carb' ? 'carbs100' : 'fats100';
  const wanted = (it.food[nutrient] * it.grams) / 100;
  for (let offset = 1; offset <= pool.length && result.length < MAX_SUBSTITUTES; offset++) {
    const id = pick(pool, seed + offset);
    if (id === it.food.id || result.some((r) => r.foodId === id)) continue;
    const food = findFood(id);
    if (!food || food[nutrient] < 1) continue;
    const grams = round5((wanted / food[nutrient]) * 100);
    if (grams > maxPerMeal(food)) continue;
    result.push({ name: food.name, grams, foodId: food.id, quantityLabel: formatFoodQuantity(food.id, grams) });
  }
  return result.length > 0 ? result : undefined;
}

// -------------------------------------------------------------------- meals --

/** Eggs eaten so far today, and how often each protein food was already used this week (variety). */
type DayState = { eggGrams: number; usage: Map<string, number> };

function pickDistinct(pool: string[], seed: number, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; out.length < count && i < pool.length * 2; i++) {
    const id = pick(pool, seed + i);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

const OLIVE_OIL_ID = 'olive-oil';

/**
 * Builds one meal for a slot's macro targets. Protein and CALORIES are solved
 * exactly (so the day lands on its calorie target and its protein target);
 * carbohydrates absorb whatever fat the foods bring along:
 *
 *   1. fixed items first — vegetables or fruit, and a spoon of olive oil sized
 *      to the meal's fat budget;
 *   2. protein-food and carb-food grams solved from the remaining protein and
 *      calories, trying a few protein candidates and keeping the one whose fat
 *      lands closest to budget;
 *   3. portion caps are respected (max 4 eggs a day, no 400 g of potatoes): when
 *      a cap binds, a second protein / carb source covers the rest;
 *   4. a last calorie top-up from fat or carbs if caps left the meal short.
 */
function buildMeal(
  mealType: 'breakfast' | 'main' | 'snack',
  target: Macros,
  pools: ReturnType<typeof buildFoodPools>,
  seed: number,
  day: DayState
): { items: PlanMealItem[]; macros: Macros } {
  const week = day;
  const isMain = mealType === 'main';
  const proteinPool = pools.proteinFor(mealType);
  const carbPool = pools.carbsFor(mealType);
  const kcalTarget = kcalOf(target);
  const fixed: Item[] = [];

  if (isMain) {
    const veg = findFood(pick(pools.vegetablesFor(mealType), seed));
    if (veg) fixed.push({ food: veg, grams: 150, role: 'veg' });
    const oil = pools.fats.includes(OLIVE_OIL_ID) ? (findFood(OLIVE_OIL_ID) ?? null) : null;
    const oilGrams = Math.min(10, Math.floor((target.fats * 0.4) / 5) * 5);
    if (oil && oilGrams >= 5) fixed.push({ food: oil, grams: oilGrams, role: 'fat' });
  } else if (kcalTarget >= 120) {
    const fruit = findFood(pick(pools.fruitFor(mealType), seed));
    if (fruit) {
      const grams = Math.min(fruit.defaultPortionG, Math.max(50, Math.round(((kcalTarget * 0.3) / fruit.kcal100) * 100 / 5) * 5));
      fixed.push({ food: fruit, grams, role: 'fruit' });
    }
  }
  const carbFood = findFood(pick(carbPool, seed + 1)) ?? null;
  const candidates = pickDistinct(proteinPool, seed, 6)
    .map((id) => findFood(id))
    .filter((f): f is FoodItem => !!f);

  type Solution = { protein: FoodItem; px: number; carb: FoodItem | null; cy: number; score: number; fixed: Item[] };
  const variants: Item[][] = [fixed];
  if (fixed.some((f) => f.food.id === OLIVE_OIL_ID)) variants.push(fixed.filter((f) => f.food.id !== OLIVE_OIL_ID)); // no oil when the protein foods already bring enough fat

  let best: Solution | null = null;
  for (const variantFixed of variants) {
    const fixedMacros = sum(...variantFixed.map((f) => macrosOfFood(f.food, f.grams)));
    const remP = Math.max(target.protein - fixedMacros.protein, 0);
    const remK = Math.max(kcalTarget - kcalOf(fixedMacros), 0);
    const remF = Math.max(target.fats - fixedMacros.fats, 0);
    for (const pf of candidates) {
      const eggRoom = pf.id === 'eggs' ? Math.max(200 - day.eggGrams, 0) : Infinity; // ≤ 4 eggs a day
      const pCap = Math.min(maxPerMeal(pf), eggRoom);
      let x = 0;
      let y = 0;
      if (carbFood) {
        const sol = solve2(pf.protein100 / 100, carbFood.protein100 / 100, remP, pf.kcal100 / 100, carbFood.kcal100 / 100, remK);
        if (sol && sol[0] > 0 && sol[1] >= 0) {
          x = sol[0];
          y = sol[1];
        } else {
          x = pf.protein100 > 0 ? (remP / pf.protein100) * 100 : 0;
          y = Math.max((remK - (pf.kcal100 * x) / 100) / (carbFood.kcal100 / 100), 0);
        }
      } else {
        x = pf.protein100 > 0 ? (remP / pf.protein100) * 100 : 0;
      }
      const capped = x > pCap || y > (carbFood ? maxPerMeal(carbFood) : 0);
      x = Math.min(x, pCap);
      y = Math.min(y, carbFood ? maxPerMeal(carbFood) : 0);
      const got = sum(macrosOfFood(pf, x), carbFood ? macrosOfFood(carbFood, y) : { protein: 0, carbs: 0, fats: 0 });
      const score = (week.usage.get(pf.id) ?? 0) * 3 + Math.abs(got.fats - remF) * 2 + (capped ? 8 : 0) + Math.abs(kcalOf(got) - remK) * 0.05 + Math.abs(got.protein - remP);
      if (!best || score < best.score) best = { protein: pf, px: x, carb: carbFood, cy: y, score, fixed: variantFixed };
    }
  }

  const items: Item[] = [...(best ? best.fixed : fixed)];
  if (best) {
    const px = pick5(best.px, best.protein);
    if (px > 0) items.push({ food: best.protein, grams: px, role: 'protein' });
    day.usage.set(best.protein.id, (day.usage.get(best.protein.id) ?? 0) + 1);
    if (best.protein.id === 'eggs') day.eggGrams += px;
    if (best.carb && best.cy >= 10) items.push({ food: best.carb, grams: pick5(best.cy, best.carb), role: 'carb' });
  }

  const totalOf = () => sum(...items.map((i) => macrosOfFood(i.food, i.grams)));
  let got = totalOf();

  // protein still short because of a cap → a second, different protein source
  if (target.protein - got.protein > 8) {
    const second = pickDistinct(proteinPool, seed + 7, 5)
      .map((id) => findFood(id))
      .find((f): f is FoodItem => !!f && !items.some((i) => i.food.id === f.id) && !(f.id === 'eggs' && day.eggGrams >= 200));
    if (second && second.protein100 > 0) {
      const grams = Math.min(((target.protein - got.protein) / second.protein100) * 100, maxPerMeal(second));
      if (grams >= 20) {
        items.push({ food: second, grams: pick5(grams, second), role: 'protein' });
        if (second.id === 'eggs') day.eggGrams += grams;
      }
    }
    got = totalOf();
  }

  // calories still short (caps) → carbs first, then fat
  for (const pool of [[...carbPool, ...pools.fruitFor(mealType)], pools.fatsFor(mealType)]) {
    const missing = kcalTarget - kcalOf(got);
    if (missing < 60) break;
    const extra = pool
      .map((id) => findFood(id))
      .find((f): f is FoodItem => !!f && f.kcal100 > 0 && (!items.some((i) => i.food.id === f.id) || f.category === 'grassi'));
    if (!extra) continue;
    const grams = Math.min((missing / extra.kcal100) * 100, maxPerMeal(extra));
    if (grams < 15 && extra.category !== 'grassi') continue;
    if (grams < 5) continue;
    const existing = items.find((i) => i.food.id === extra.id);
    if (existing) existing.grams = pick5(existing.grams + grams, extra);
    else items.push({ food: extra, grams: pick5(grams, extra), role: extra.category === 'grassi' ? 'fat' : extra.category === 'frutta' ? 'fruit' : 'carb' });
    got = totalOf();
  }

  // far too little fat → swap some carb calories for a fat source (kcal-neutral)
  if (got.fats < target.fats * 0.85 && target.fats - got.fats > 3) {
    const fatId = pools.fatsFor(mealType).find((id) => id !== OLIVE_OIL_ID && !items.some((i) => i.food.id === id)) ?? OLIVE_OIL_ID;
    const fat = findFood(fatId);
    const carbItem = [...items].reverse().find((i) => i.role === 'carb');
    if (fat && carbItem && fat.fats100 > 0) {
      const fatGrams = Math.min(((target.fats * 0.9 - got.fats) / fat.fats100) * 100, maxPerMeal(fat));
      const carbDrop = Math.min(((fatGrams * fat.kcal100) / carbItem.food.kcal100), carbItem.grams * 0.6);
      if (fatGrams >= 5 && carbDrop > 0) {
        carbItem.grams = pick5(carbItem.grams - carbDrop, carbItem.food);
        const existing = items.find((i) => i.food.id === fat.id);
        if (existing) existing.grams = pick5(existing.grams + fatGrams, fat);
        else items.push({ food: fat, grams: pick5(fatGrams, fat), role: 'fat' });
        got = totalOf();
      }
    }
  }

  const planItems = items.map((it) => {
    const pool = it.role === 'protein' ? proteinPool : it.role === 'carb' ? carbPool : it.role === 'fat' ? pools.fats : [];
    return toPlanItem(it, substitutesFor(pool, it, seed));
  });
  return { items: planItems, macros: got };
}

/** Rounds a portion: eggs to whole eggs (50 g), everything else to 5 g. */
function pick5(grams: number, food: FoodItem): number {
  if (food.id === 'eggs') return Math.max(50, Math.round(grams / 50) * 50);
  return round5(Math.min(grams, maxPerMeal(food)));
}

// ---------------------------------------------------------------- the week --

function buildDay(
  weekdayIndex: number,
  monthIndex: number,
  dayTarget: PlanTargets['perWeekday'][number],
  pools: ReturnType<typeof buildFoodPools>,
  slots: MealSlotDef[],
  usage: Map<string, number>
): DietDayPlan {
  const day: DayState = { eggGrams: 0, usage };
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
    const { items, macros } = buildMeal(SLOT_MEAL_TYPE[slot.id], target, pools, seed + slotIdx, day);
    return {
      slotId: slot.id,
      label: slot.label,
      time: slot.time,
      items,
      totalKcal: items.reduce((s, i) => s + i.kcal, 0),
      macros: { protein: Math.round(macros.protein), carbs: Math.round(macros.carbs), fats: Math.round(macros.fats) },
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
  const pools = buildFoodPools(ctx.answers);
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
    const usage = new Map<string, number>(); // protein variety within the month's week
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

/** Which meal type a pool lookup should use for a slot (re-exported for tests). */
export type { MealType };
