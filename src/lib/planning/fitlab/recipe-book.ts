/**
 * The Ricette page: every recipe of the Fit Lab pool (recipes.ts), sized on the person's own meal targets.
 *
 * A recipe has no quantities of its own (recipes.ts): the grams come from the same solver the plan uses
 * (meal-builder.ts), run on this one recipe with the person's filters (regime, allergies, exclusions) and the
 * calories and macros of the meal it belongs to. So the card shows what the person would really eat, and
 * "Aggiungi" logs exactly those foods. Recipes the person cannot eat are left out; without a questionnaire every
 * recipe is shown, sized on the default targets. Plain data, no React Native import.
 */
import type { PlanMealItem } from '../types';
import type { SlotKind } from './catalog';
import { dishImage, type MealImage } from './dish-images';
import { buildFitLabMeal, sumNutrition } from './meal-builder';
import { buildFitLabPools, type FitLabPools } from './pools';
import { RECIPES, type Recipe } from './recipes';
import type { Macros } from './solver';

export type RecipeCard = {
  recipe: Recipe;
  kind: SlotKind;
  image?: MealImage;
  items: PlanMealItem[];
  flavorings: string[];
  totals: { kcal: number; protein: number; carbs: number; fats: number };
};

export const RECIPE_KIND_LABEL: Record<SlotKind, string> = {
  breakfast: 'Colazione',
  lunch: 'Pranzo',
  dinner: 'Cena',
  snack: 'Merenda',
};

/** Share of the day's energy each kind of meal takes when it is sized on its own (same order of the plan's slots). */
const KIND_SHARE: Record<SlotKind, number> = { breakfast: 0.22, lunch: 0.33, dinner: 0.3, snack: 0.1 };

export type DailyTargets = { kcal: number; protein: number; carbs: number; fats: number };

function targetFor(kind: SlotKind, daily: DailyTargets): Macros {
  const k = KIND_SHARE[kind];
  return { protein: daily.protein * k, carbs: daily.carbs * k, fats: daily.fats * k };
}

function build(recipe: Recipe, pools: FitLabPools, daily: DailyTargets): RecipeCard | null {
  const kind = recipe.meal;
  try {
    const meal = buildFitLabMeal({
      kind,
      slotId: `book-${kind}`,
      target: targetFor(kind, daily),
      pools,
      seed: 1,
      day: { eggGrams: 0, families: new Set(), dishes: new Set() },
      week: { dish: new Map(), food: new Map(), slot: new Map() },
      onlyDishId: recipe.id,
    });
    const n = sumNutrition(meal.items);
    return {
      recipe,
      kind,
      image: dishImage(recipe.id),
      items: meal.items,
      flavorings: meal.recipe.flavorings,
      totals: { kcal: Math.round(n.kcal), protein: Math.round(n.protein), carbs: Math.round(n.carbs), fats: Math.round(n.fats) },
    };
  } catch {
    return null;
  }
}

/**
 * Every recipe the person can eat, in the catalog order (breakfasts, snacks, lunches, dinners). `answers` is the
 * questionnaire (empty = no filters).
 */
export function buildRecipeBook(answers: Record<string, unknown>, daily: DailyTargets): RecipeCard[] {
  const pools = buildFitLabPools(answers);
  const cards = RECIPES.map((r) => build(r, pools, daily)).filter((c): c is RecipeCard => c != null);
  if (cards.length > 0) return cards;
  // filters so strict that nothing fits: the book is still shown, sized on the same targets
  const open = buildFitLabPools({});
  return RECIPES.map((r) => build(r, open, daily)).filter((c): c is RecipeCard => c != null);
}
