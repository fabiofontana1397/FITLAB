import { findFood } from '@/lib/mock/food-database';
import type { Goal } from '@/lib/mock/types';
import type { MealSlot } from '@/store/nutrition-store';

import { WEEKDAY_LABELS } from './exercise-library';
import { formatFoodQuantity } from './food-quantity';
import { buildFoodPools, pick } from './food-pools';
import { buildMealSlotsFromAnswers, type MealSlotDef } from './meal-slots';
import { computePlanDurationMonths } from './plan-duration';
import { resolveTrainingSchedule } from './training-days';
import type { DietStrategy } from './strategy-types';
import type { DietDayPlan, DietMonthPlan, DietPlan, PlanMeal, PlanMealItem, PlanPhaseKind } from './types';

/** colazione/pranzo/cena get main-meal-appropriate proteins/carbs (no lean
 * beef for breakfast); the 3 snack slots get snack-appropriate ones
 * instead — see food-pools.ts's proteinFor/carbsFor. */
const SLOT_MEAL_TYPE: Record<MealSlot, 'breakfast' | 'main' | 'snack'> = {
  colazione: 'breakfast',
  spuntinoMattina: 'snack',
  pranzo: 'main',
  spuntinoPomeriggio: 'snack',
  cena: 'main',
  spuntinoSera: 'snack',
};

export type DietPlanInput = {
  answers: Record<string, unknown>;
  dailyCalorieTarget: number;
  macroTargetsG: { protein: number; carbs: number; fats: number };
  strategy?: DietStrategy | null;
  /** Monthly check-in regeneration (spec §0.4, punto 2): months before this
   * index are copied verbatim from `existingMonths` instead of regenerated
   * — a month the user already lived through never changes retroactively,
   * only the upcoming one(s) reflect the adjusted target. */
  preserveMonthsBefore?: number;
  existingMonths?: DietMonthPlan[];
};

// Real per-day-type nutrition plans (spec §0.4 examples: separate "giorni
// di allenamento"/"giorni di riposo" protocols) give rest days modestly
// fewer calories than training days — the body burns less with no session
// that day. Kept small and compensated (see dayCalorieMultipliers) so the
// week's average still lands exactly on the month's own calorieTarget;
// this only redistributes it across the week; nothing to compensate for
// when every day (or no day) is a training day.
const REST_DAY_CALORIE_MULTIPLIER = 0.93;

/** Per-weekday calorie multiplier (training days get a bit more, rest days
 * a bit less), averaging to exactly 1 across the 7 days so the month's
 * calorieTarget/macroTargetsG (used for progress rings, PDF export, etc.)
 * stay meaningful as "the average day" even though no single day matches
 * it exactly — same principle real coaches use ("more on training days,
 * less on rest days") without changing the weekly total. */
function dayCalorieMultipliers(isTrainingDay: boolean[]): number[] {
  const trainCount = isTrainingDay.filter(Boolean).length;
  const restCount = isTrainingDay.length - trainCount;
  if (trainCount === 0 || restCount === 0) return isTrainingDay.map(() => 1);
  const trainMultiplier = (isTrainingDay.length - restCount * REST_DAY_CALORIE_MULTIPLIER) / trainCount;
  return isTrainingDay.map((isTrain) => (isTrain ? trainMultiplier : REST_DAY_CALORIE_MULTIPLIER));
}

/** Main-meal (pranzo/cena) macro split — spec §0.4 examples consistently
 * give dinner a lighter carb portion than lunch ("CENA: limitato a verdure
 * fibrose l'apporto di carboidrati") and give rest days overall lighter
 * carbs than training days; both nudges stack (cena on a rest day is the
 * lightest-carb meal of the week), floored so a meal never goes near-zero
 * carb. Freed-up share always goes to fat, never protein — protein stays
 * flat since muscle-repair needs don't really track training/rest days the
 * way carb (glycogen) needs do. Breakfast/snacks are intentionally left
 * out of this — they have no separate fats line item to absorb the shift
 * (see buildDayMeals), so cycling them would just quietly under-deliver
 * their calorie target instead of redistributing it. */
function mainMealRatios(slotId: MealSlot, isTrainingDayToday: boolean): { protein: number; carb: number; fat: number } {
  const protein = 0.4;
  let carb = 0.35;
  if (slotId === 'cena') carb -= 0.08;
  if (!isTrainingDayToday) carb -= 0.05;
  carb = Math.max(carb, 0.18);
  const fat = Math.max(1 - protein - carb, 0.15);
  return { protein, carb, fat };
}

// One evening a week left unprescribed — spec §0.4 examples all include a
// weekly "pasto libero"/"cena libera", explicitly meant to be the user's
// own choice within reason, not a planner-assigned food. Saturday dinner:
// the most common real-world default among the examples, and the natural
// end of "a week starting Monday" (WEEKDAY_LABELS[5] = 'Sab').
const FREE_MEAL_WEEKDAY_INDEX = 5;
const FREE_MEAL_SLOT: MealSlot = 'cena';

function phaseForMonth(monthIndex: number, totalMonths: number): PlanPhaseKind {
  if (monthIndex === 1) return 'adattamento';
  if (monthIndex === totalMonths) return 'consolidamento';
  return 'progressione';
}

function phaseTitle(phase: PlanPhaseKind, goal: Goal): string {
  if (phase === 'adattamento') return 'Adattamento';
  if (phase === 'consolidamento') return 'Consolidamento';
  if (goal === 'loseFat') return 'Deficit progressivo';
  if (goal === 'gainMuscle' || goal === 'gainStrength') return 'Surplus progressivo';
  return 'Aggiustamenti mirati';
}

function phaseNote(phase: PlanPhaseKind, goal: Goal): string {
  if (phase === 'adattamento') {
    return 'Calorie vicine al tuo mantenimento per abituare corpo e abitudini al nuovo piano, senza cali di energia improvvisi.';
  }
  if (phase === 'consolidamento') {
    return 'I target si stabilizzano: da qui il piano si mantiene e si ricalibra ogni mese in base ai tuoi progressi reali.';
  }
  if (goal === 'loseFat') {
    return 'Il deficit calorico è pienamente attivo: la priorità è preservare la massa muscolare mentre il peso scende.';
  }
  if (goal === 'gainMuscle' || goal === 'gainStrength') {
    return 'Il surplus calorico è pienamente attivo per sostenere la crescita muscolare, con un ritmo di aumento controllato.';
  }
  return 'Piccoli aggiustamenti su calorie e macro, guidati dai tuoi progressi reali in energia e performance.';
}

function monthCalorieTarget(phase: PlanPhaseKind, finalTarget: number, goal: Goal): number {
  if (phase !== 'adattamento') return finalTarget;
  const nudge = goal === 'loseFat' ? 150 : goal === 'gainMuscle' || goal === 'gainStrength' ? -150 : 0;
  return Math.round(finalTarget + nudge);
}

function monthMacros(
  calorieTarget: number,
  finalTarget: number,
  finalMacros: { protein: number; carbs: number; fats: number }
): { protein: number; carbs: number; fats: number } {
  const ratio = finalTarget ? calorieTarget / finalTarget : 1;
  return {
    protein: Math.round(finalMacros.protein * Math.max(ratio, 0.92)),
    carbs: Math.round(finalMacros.carbs * ratio),
    fats: Math.round(finalMacros.fats * ratio),
  };
}

function round5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

// Real isocaloric-exchange nutrition plans (spec §0.4 diet examples) list
// 3-5 alternatives per food, not 2 — a substitution list this short reads
// as an afterthought rather than a real "swap it for any of these" tool.
const MAX_SUBSTITUTES = 4;

/** Same-role swaps for an item (e.g. another protein source at an
 * equivalent portion), so the plan reads as flexible rather than fixed —
 * "eventuali sostituzioni complementari" from the same food pool, never
 * repeating the item actually chosen. */
function buildSubstitutes(pool: string[], seed: number, primaryId: string, targetKcal: number) {
  const substitutes: PlanMealItem['substitutes'] = [];
  for (let offset = 1; offset < pool.length && substitutes.length < MAX_SUBSTITUTES; offset++) {
    const id = pick(pool, seed + offset);
    if (id === primaryId || substitutes.some((s) => s.name === findFood(id)?.name)) continue;
    const food = findFood(id);
    if (!food) continue;
    const grams = round5((targetKcal / food.kcal100) * 100);
    substitutes.push({ name: food.name, grams, foodId: food.id, quantityLabel: formatFoodQuantity(food.id, grams) });
  }
  return substitutes.length > 0 ? substitutes : undefined;
}

function buildItem(pool: string[], seed: number, targetKcal: number, portionOverride?: number): PlanMealItem {
  const primaryId = pick(pool, seed);
  const food = findFood(primaryId)!;
  const grams = portionOverride ?? round5((targetKcal / food.kcal100) * 100);
  const kcal = Math.round((food.kcal100 * grams) / 100);
  return {
    name: food.name,
    grams,
    kcal,
    foodId: primaryId,
    quantityLabel: formatFoodQuantity(primaryId, grams),
    // Substitutes match the *actual* kcal this item ended up at (not the
    // raw target), so a fixed-portion item (veg/fruit) still gets swaps
    // sized to roughly the same calories rather than a near-zero portion.
    substitutes: buildSubstitutes(pool, seed, primaryId, kcal),
  };
}

// Standard Mediterranean-diet condiment: a fixed olive oil serving at every
// main meal, not one more rotating option in the fats pool — diet
// restructure request: "pranzo e cena non viene messo l'olio d'oliva"
// (today it only shows up when the fats-pool rotation happens to land on
// it). Still respects hard exclusions: only forced in when 'olive-oil'
// actually survived the user's allergy/exclusion filtering.
const OLIVE_OIL_ID = 'olive-oil';

function buildOliveOilItem(): PlanMealItem | null {
  const food = findFood(OLIVE_OIL_ID);
  if (!food) return null;
  const grams = food.defaultPortionG;
  const kcal = Math.round((food.kcal100 * grams) / 100);
  return { name: food.name, grams, kcal, foodId: OLIVE_OIL_ID, quantityLabel: formatFoodQuantity(OLIVE_OIL_ID, grams) };
}

function buildDayMeals(
  seed: number,
  calorieTarget: number,
  pools: ReturnType<typeof buildFoodPools>,
  slots: MealSlotDef[],
  isTrainingDayToday: boolean,
  isFreeMealDay: boolean
): PlanMeal[] {
  return slots.map((slot, slotIdx) => {
    const slotKcal = calorieTarget * slot.sharePct;
    const mealType = SLOT_MEAL_TYPE[slot.id];
    const isMain = mealType === 'main';
    const slotSeed = seed + slotIdx;

    if (isFreeMealDay && slot.id === FREE_MEAL_SLOT) {
      return { slotId: slot.id, label: slot.label, time: slot.time, items: [], totalKcal: Math.round(slotKcal), isFreeMeal: true };
    }

    const proteinPool = pools.proteinFor(mealType);
    const carbPool = pools.carbsFor(mealType);
    const ratios = isMain ? mainMealRatios(slot.id, isTrainingDayToday) : { protein: 0.4, carb: 0.35, fat: 0.25 };

    const items: PlanMealItem[] = [
      buildItem(proteinPool, slotSeed, slotKcal * ratios.protein),
      buildItem(carbPool, slotSeed + 1, slotKcal * ratios.carb),
    ];

    if (isMain) {
      const fatsPool = pools.fatsFor(mealType);
      const vegetablesPool = pools.vegetablesFor(mealType);
      const fatsTargetKcal = slotKcal * ratios.fat;
      // 'olive-oil' surviving in the unrestricted pool means it wasn't
      // excluded (allergy/exclusion text) — only then is it safe to force.
      const oliveOilItem = pools.fats.includes(OLIVE_OIL_ID) ? buildOliveOilItem() : null;
      if (oliveOilItem) {
        items.push(oliveOilItem);
        const remainingFatsKcal = Math.max(fatsTargetKcal - oliveOilItem.kcal, 0);
        const otherFatsPool = fatsPool.filter((id) => id !== OLIVE_OIL_ID);
        // Below this, a second fats item would round down to a near-zero,
        // not-worth-listing portion — the olive oil alone already covers
        // the slot's fats target closely enough.
        if (remainingFatsKcal > 20 && otherFatsPool.length > 0) {
          items.push(buildItem(otherFatsPool, slotSeed, remainingFatsKcal));
        }
      } else {
        items.push(buildItem(fatsPool, slotSeed, fatsTargetKcal));
      }
      items.push(buildItem(vegetablesPool, slotSeed, 0, 150));
    } else {
      const fruitPool = pools.fruitFor(mealType);
      const fruitId = pick(fruitPool, slotSeed);
      const fruit = findFood(fruitId)!;
      items.push(buildItem(fruitPool, slotSeed, 0, fruit.defaultPortionG));
    }

    const totalKcal = items.reduce((sum, item) => sum + item.kcal, 0);
    return { slotId: slot.id, label: slot.label, time: slot.time, items, totalKcal };
  });
}

/** One full week of day-by-day meals for the month — each weekday gets its
 * own rotation through the food pools (rather than one "example day"
 * repeated), so the plan reads as an actual schedule to follow. `isTrainingDay`
 * (Monday-first, matching WEEKDAY_LABELS) drives the training/rest-day
 * calorie and carb cycling — see dayCalorieMultipliers/mainMealRatios. */
function buildWeeklySplit(
  monthIndex: number,
  calorieTarget: number,
  pools: ReturnType<typeof buildFoodPools>,
  slots: MealSlotDef[],
  isTrainingDay: boolean[]
): DietDayPlan[] {
  const calorieMultipliers = dayCalorieMultipliers(isTrainingDay);
  return WEEKDAY_LABELS.map((weekday, dayIdx) => ({
    weekday,
    meals: buildDayMeals(
      (monthIndex - 1) * 7 + dayIdx,
      calorieTarget * calorieMultipliers[dayIdx],
      pools,
      slots,
      isTrainingDay[dayIdx],
      dayIdx === FREE_MEAL_WEEKDAY_INDEX
    ),
  }));
}

export function generateDietPlan(input: DietPlanInput): DietPlan {
  const { answers, dailyCalorieTarget, macroTargetsG, strategy, preserveMonthsBefore, existingMonths } = input;
  const goal = (answers.goal as Goal) ?? 'generalHealth';
  const durationMonths = computePlanDurationMonths(answers);
  const pools = buildFoodPools(answers);
  const slots = buildMealSlotsFromAnswers(answers);
  const { isTrainingDay } = resolveTrainingSchedule(answers);

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
    const strategyTarget = strategy?.monthlyTargets?.find((m) => m.monthIndex === monthIndex);
    const calorieTarget = strategyTarget?.calorieTarget ?? monthCalorieTarget(phase, dailyCalorieTarget, goal);
    const macros = strategyTarget?.macroTargetsG ?? monthMacros(calorieTarget, dailyCalorieTarget, macroTargetsG);
    const monthlyFocus = strategy?.monthlyFocus?.find((m) => m.monthIndex === monthIndex);

    months.push({
      monthIndex,
      phase,
      title: monthlyFocus?.title ?? `Mese ${monthIndex} · ${phaseTitle(phase, goal)}`,
      focusNote: monthlyFocus?.focusNote ?? phaseNote(phase, goal),
      calorieTarget,
      macroTargetsG: macros,
      weeklySplit: buildWeeklySplit(monthIndex, calorieTarget, pools, slots, isTrainingDay),
    });
  }

  return { generatedAt: new Date().toISOString(), durationMonths, goal, months };
}
