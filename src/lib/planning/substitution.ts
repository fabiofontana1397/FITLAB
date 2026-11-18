/**
 * Food substitution engine. A plan item lists SUGGESTED alternatives (`item.substitutes`): they are only a
 * proposal, the menu does not change. `applySubstitution` turns one of them into an APPLIED substitution:
 *
 *   1. the alternative must still be allowed (regime, allergies, intolerances, exclusions): otherwise refused;
 *   2. the item becomes the new food at the portion sized for its role (see meal-builder.substitutesFor), with
 *      every value recomputed from the catalog, and `substitutedFrom` keeps the original for traceability;
 *   3. the new item's alternatives are sized on it (the original food is among them, to go back);
 *   4. the meal's totals are the sum of its items again; the recipe name follows the new ingredient;
 *   5. the day and the week are derived from the meals (no stored total to go stale); when the day leaves its
 *      energy band, the other portions of the day are rebalanced (the substituted food is not touched).
 *
 * The result reports original and new values, the differences, and the effect on meal, day and week.
 */
import { buildFitLabPools } from './fitlab/pools';
import { fitlabById } from './fitlab/foods';
import { SLOT_KIND } from './fitlab/catalog';
import { describeSubstitute, resizeItem, substitutesFor, toItem } from './fitlab/meal-builder';
import { reconcileDay, withTotals } from './diet-planner';
import { dayNutrition } from '@/domain/nutrition/validation';
import { NUTRITION_PARAMS } from '@/domain/nutrition/params';
import { SEX_FLOOR } from '@/domain/nutrition/safety';
import type { DietAdaptations } from '@/domain/nutrition/types';
import type { DietMonthPlan, DietPlan, PlanMeal, PlanMealItem } from './types';

export type SubstitutionRequest = { monthIndex: number; dayIndex: number; slotId: string; itemIndex: number; substituteFoodId: string };

export type NutritionValues = { kcal: number; protein: number; carbs: number; fats: number; fiber: number };

export type SubstitutionChange = {
  original: { foodId: string; name: string; grams: number } & NutritionValues;
  substitute: { foodId: string; name: string; grams: number } & NutritionValues;
  delta: NutritionValues;
  equivalence: 'equivalent' | 'tradeoff';
  note?: string;
  meal: { before: number; after: number };
  day: { target: number; before: number; after: number; afterDevPct: number; rebalanced: string[] };
  week: { target: number; beforeAvg: number; afterAvg: number };
};

const valuesOf = (i: PlanMealItem): NutritionValues => ({ kcal: i.kcal, protein: i.protein ?? 0, carbs: i.carbs ?? 0, fats: i.fats ?? 0, fiber: i.fiber ?? 0 });
const r1 = (x: number) => Math.round(x * 10) / 10;
const weekAvg = (m: DietMonthPlan) => m.weeklySplit.reduce((s, d) => s + dayNutrition(d.meals).kcal, 0) / m.weeklySplit.length;

/** The recipe name follows the new ingredient ("Pasta con ricotta" → "Pasta con fiocchi di latte"). */
function renameRecipe(recipe: PlanMeal['recipe'], from: string, to: string): PlanMeal['recipe'] {
  if (!recipe) return recipe;
  const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const name = re.test(recipe.name) ? recipe.name.replace(re, (m) => (m[0] === m[0].toUpperCase() ? to : to.toLowerCase())) : `${recipe.name} (con ${to.toLowerCase()} al posto di ${from.toLowerCase()})`;
  return { ...recipe, name };
}

export function applySubstitution(
  plan: DietPlan,
  req: SubstitutionRequest,
  person: { answers: Record<string, unknown>; sex: keyof typeof SEX_FLOOR; adapt?: DietAdaptations },
  opts: { rebalance?: boolean; now?: string } = {}
): { ok: true; plan: DietPlan; change: SubstitutionChange } | { ok: false; reason: string } {
  const month = plan.months.find((m) => m.monthIndex === req.monthIndex);
  const day = month?.weeklySplit[req.dayIndex];
  const mealIdx = day?.meals.findIndex((m) => m.slotId === req.slotId) ?? -1;
  if (!month || !day || mealIdx < 0) return { ok: false, reason: 'pasto non trovato' };
  const meal = day.meals[mealIdx];
  const item = meal.items[req.itemIndex];
  if (meal.isFreeMeal || !item) return { ok: false, reason: 'alimento non trovato nel pasto' };
  const proposal = item.substitutes?.find((s) => s.foodId === req.substituteFoodId);
  if (!proposal) return { ok: false, reason: `${fitlabById(req.substituteFoodId)?.name ?? 'questo alimento'} non è tra le alternative proposte per ${item.name}` };
  const food = fitlabById(proposal.foodId);
  const originalFood = fitlabById(item.foodId);
  if (!food || !originalFood || !item.role) return { ok: false, reason: 'alimento non presente nel catalogo' };
  const pools = buildFitLabPools(person.answers, person.adapt);
  // restrictions come first: an alternative proposed before a change of allergies or regime is refused now
  if (!pools.allowed(food)) return { ok: false, reason: `${food.name} non è compatibile con regime, allergie, intolleranze o esclusioni` };
  if (person.adapt?.dislikedFoodIds?.includes(food.id)) return { ok: false, reason: `${food.name} è tra gli alimenti che hai chiesto di togliere` };

  const kind = SLOT_KIND[meal.slotId as keyof typeof SLOT_KIND];
  const original = valuesOf(item);
  // the new item: catalog values at the portion sized for the role; its own alternatives include the original food
  const role = item.role;
  const back = role === 'protein' || role === 'carb' || role === 'fat' || role === 'veg' ? describeSubstitute(originalFood, item.grams, role, { kcal: Math.round((food.kcal * proposal.grams) / 100), p: (food.p * proposal.grams) / 100, c: (food.c * proposal.grams) / 100, f: (food.f * proposal.grams) / 100 }) : undefined;
  const others = role === 'fruit' || role === 'extra' ? undefined : substitutesFor({ food, grams: proposal.grams, role }, kind, pools, meal.totalKcal, person.adapt);
  const subs = [...(back ? [back] : []), ...(others ?? []).filter((s) => s.foodId !== originalFood.id)].slice(0, 5);
  const now = opts.now ?? new Date().toISOString();
  const next: PlanMealItem = {
    ...toItem(food, proposal.grams, role, subs.length ? subs : undefined),
    substitutedFrom: { foodId: originalFood.id, name: originalFood.name, grams: item.grams, ...original, at: now },
  };
  const before = { meal: meal.totalKcal, day: dayNutrition(day.meals).kcal, week: weekAvg(month) };

  const meals = day.meals.map((m) => ({ ...m, items: [...m.items] }));
  meals[mealIdx].items[req.itemIndex] = next;
  meals[mealIdx] = withTotals({ ...meals[mealIdx], recipe: renameRecipe(meal.recipe, originalFood.name, food.name) });

  // the day back in its band when it left it: the other portions move (energy, protein, then carbs and fats)
  const target = day.calorieTarget ?? month.calorieTarget;
  const macroTarget = day.macroTargetsG ?? month.macroTargetsG;
  const rebalanced: string[] = [];
  const outOfBand = () => Math.abs(dayNutrition(meals).kcal / target - 1) > NUTRITION_PARAMS.planning.dayKcalTolerance;
  if ((opts.rebalance ?? true) && outOfBand()) {
    const snapshot = meals.map((m) => m.items.map((i) => `${i.name}|${i.grams}`));
    reconcileDay(meals, target, macroTarget, SEX_FLOOR[person.sex], (mi, it, grams) => resizeItem(it, grams, { kind: SLOT_KIND[meals[mi].slotId as keyof typeof SLOT_KIND], pools, kcalTarget: meals[mi].totalKcal, adapt: person.adapt }), new Set([`${mealIdx}|${req.itemIndex}`]));
    meals.forEach((m, mi) => m.items.forEach((i, ii) => { const was = snapshot[mi][ii]; if (was && was !== `${i.name}|${i.grams}`) rebalanced.push(`${m.label}: ${i.name} ${was.split('|')[1]} → ${i.grams} g`); }));
  }

  const weeklySplit = month.weeklySplit.map((d, i) => (i === req.dayIndex ? { ...d, meals } : d));
  const nextMonth = { ...month, weeklySplit };
  const afterDay = dayNutrition(meals).kcal;
  const sub = valuesOf(next);
  return {
    ok: true,
    plan: { ...plan, months: plan.months.map((m) => (m === month ? nextMonth : m)) },
    change: {
      original: { foodId: originalFood.id, name: originalFood.name, grams: item.grams, ...original },
      substitute: { foodId: food.id, name: food.name, grams: proposal.grams, ...sub },
      delta: { kcal: sub.kcal - original.kcal, protein: r1(sub.protein - original.protein), carbs: r1(sub.carbs - original.carbs), fats: r1(sub.fats - original.fats), fiber: r1(sub.fiber - original.fiber) },
      equivalence: proposal.equivalence ?? 'equivalent',
      note: proposal.note,
      meal: { before: before.meal, after: meals[mealIdx].totalKcal },
      day: { target, before: before.day, after: afterDay, afterDevPct: Math.round((afterDay / target - 1) * 1000) / 10, rebalanced },
      week: { target: month.calorieTarget, beforeAvg: Math.round(before.week), afterAvg: Math.round(weekAvg(nextMonth)) },
    },
  };
}
