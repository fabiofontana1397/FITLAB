import { findFood } from '@/lib/mock/food-database';
import type { Goal } from '@/lib/mock/types';
import type { MealSlot } from '@/store/nutrition-store';

import { WEEKDAY_LABELS } from './exercise-library';
import { buildFoodPools, pick } from './food-pools';
import { buildMealSlotsFromAnswers, type MealSlotDef } from './meal-slots';
import { computePlanDurationMonths } from './plan-duration';
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
};

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

/** Up to 2 same-role swaps for an item (e.g. another protein source at an
 * equivalent portion), so the plan reads as flexible rather than fixed —
 * "eventuali sostituzioni complementari" from the same food pool, never
 * repeating the item actually chosen. */
function buildSubstitutes(pool: string[], seed: number, primaryId: string, targetKcal: number) {
  const substitutes: PlanMealItem['substitutes'] = [];
  for (let offset = 1; offset < pool.length && substitutes.length < 2; offset++) {
    const id = pick(pool, seed + offset);
    if (id === primaryId || substitutes.some((s) => s.name === findFood(id)?.name)) continue;
    const food = findFood(id);
    if (!food) continue;
    const grams = round5((targetKcal / food.kcal100) * 100);
    substitutes.push({ name: food.name, grams, foodId: food.id });
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
    // Substitutes match the *actual* kcal this item ended up at (not the
    // raw target), so a fixed-portion item (veg/fruit) still gets swaps
    // sized to roughly the same calories rather than a near-zero portion.
    substitutes: buildSubstitutes(pool, seed, primaryId, kcal),
  };
}

function buildDayMeals(
  seed: number,
  calorieTarget: number,
  pools: ReturnType<typeof buildFoodPools>,
  slots: MealSlotDef[]
): PlanMeal[] {
  return slots.map((slot, slotIdx) => {
    const slotKcal = calorieTarget * slot.sharePct;
    const mealType = SLOT_MEAL_TYPE[slot.id];
    const isMain = mealType === 'main';
    const slotSeed = seed + slotIdx;
    const proteinPool = pools.proteinFor(mealType);
    const carbPool = pools.carbsFor(mealType);

    const items: PlanMealItem[] = [
      buildItem(proteinPool, slotSeed, slotKcal * 0.4),
      buildItem(carbPool, slotSeed + 1, slotKcal * 0.35),
    ];

    if (isMain) {
      items.push(buildItem(pools.fats, slotSeed, slotKcal * 0.25));
      items.push(buildItem(pools.vegetables, slotSeed, 0, 150));
    } else {
      const fruitId = pick(pools.fruit, slotSeed);
      const fruit = findFood(fruitId)!;
      items.push(buildItem(pools.fruit, slotSeed, 0, fruit.defaultPortionG));
    }

    const totalKcal = items.reduce((sum, item) => sum + item.kcal, 0);
    return { slotId: slot.id, label: slot.label, time: slot.time, items, totalKcal };
  });
}

/** One full week of day-by-day meals for the month — each weekday gets its
 * own rotation through the food pools (rather than one "example day"
 * repeated), so the plan reads as an actual schedule to follow. */
function buildWeeklySplit(
  monthIndex: number,
  calorieTarget: number,
  pools: ReturnType<typeof buildFoodPools>,
  slots: MealSlotDef[]
): DietDayPlan[] {
  return WEEKDAY_LABELS.map((weekday, dayIdx) => ({
    weekday,
    meals: buildDayMeals((monthIndex - 1) * 7 + dayIdx, calorieTarget, pools, slots),
  }));
}

export function generateDietPlan(input: DietPlanInput): DietPlan {
  const { answers, dailyCalorieTarget, macroTargetsG, strategy } = input;
  const goal = (answers.goal as Goal) ?? 'generalHealth';
  const durationMonths = computePlanDurationMonths(answers);
  const pools = buildFoodPools(answers);
  const slots = buildMealSlotsFromAnswers(answers);

  const months: DietMonthPlan[] = [];
  for (let monthIndex = 1; monthIndex <= durationMonths; monthIndex++) {
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
      weeklySplit: buildWeeklySplit(monthIndex, calorieTarget, pools, slots),
    });
  }

  return { generatedAt: new Date().toISOString(), durationMonths, goal, months };
}
