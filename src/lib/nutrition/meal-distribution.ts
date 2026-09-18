/**
 * Single source of truth for how daily calories/macros are weighted across
 * meal slots — replaces two previously-parallel definitions that drifted
 * apart (nutrition-store.ts's fixed 6-slot percentages for the manual
 * logging UI, and meal-slots.ts's own relative weights for the generated
 * plan). Both now read from MEAL_WEIGHTS below.
 */
import type { MealSlot } from '@/store/nutrition-store';

/** Relative weight per slot — not percentages; calculateMealTargets/
 * sharePctFor normalize by the sum of whichever slots are actually active
 * for a given user (e.g. a user with no colazione never has it in the
 * denominator). */
export const MEAL_WEIGHTS: Record<MealSlot, number> = {
  colazione: 3,
  spuntinoMattina: 1,
  pranzo: 4,
  spuntinoPomeriggio: 1,
  cena: 3.5,
  spuntinoSera: 1,
};

export function sharePctFor(slot: MealSlot, activeSlots: MealSlot[]): number {
  const totalWeight = activeSlots.reduce((sum, id) => sum + MEAL_WEIGHTS[id], 0) || 1;
  return MEAL_WEIGHTS[slot] / totalWeight;
}

/** Splits `dailyTotal` (calories or a macro gram target) across `activeSlots`
 * proportionally to MEAL_WEIGHTS. */
export function calculateMealTargets(dailyTotal: number, activeSlots: MealSlot[]): Record<MealSlot, number> {
  const totalWeight = activeSlots.reduce((sum, id) => sum + MEAL_WEIGHTS[id], 0) || 1;
  const result = {} as Record<MealSlot, number>;
  for (const id of activeSlots) result[id] = dailyTotal * (MEAL_WEIGHTS[id] / totalWeight);
  return result;
}
