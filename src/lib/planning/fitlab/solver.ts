/**
 * Quantities of a meal, solved AFTER the dish and its foods are chosen (Fit Lab order:
 * structure → foods → quantities). Protein, carbohydrate and fat of the whole meal are
 * matched together by coordinate descent over the grams of the variable foods, inside
 * realistic portion limits (no 400 g of yogurt, no 6 eggs), then rounded to practical
 * units (whole eggs, whole bananas, 5 g steps) and polished.
 */
import type { FoodItem } from '@/lib/mock/food-database';

import type { Role } from './catalog';

export type Macros = { protein: number; carbs: number; fats: number };

export type PortionVar = {
  food: FoodItem;
  role: Role;
  min: number;
  max: number;
  step: number;
  /** Smallest amount worth listing as an ingredient (a fat below it is left out). */
  minUse: number;
  grams: number;
};

/** Foods eaten as whole pieces/packs: [grams of one unit]. */
export const UNIT_GRAMS: Record<string, number> = {
  eggs: 50,
  banana: 120,
  apple: 150,
  orange: 150,
  pear: 150,
  kiwi: 75,
  'protein-bar': 45,
  'protein-pudding': 200,
  'protein-drink': 330,
  'rice-cakes': 9,
  'corn-cakes': 10,
  'fette-biscottate': 9,
};

type Range = [number, number];

const RANGE: Record<string, Range> = {
  // proteins
  'egg-whites': [60, 250],
  'whey-protein': [20, 40],
  'greek-yogurt-0': [100, 300],
  skyr: [100, 300],
  'yogurt-protein': [100, 300],
  kefir: [150, 300],
  'cottage-cheese': [80, 250],
  'ricotta-magra': [60, 200],
  'milk-lactose-free': [150, 300],
  bresaola: [30, 70],
  'tuna-canned': [60, 160],
  'turkey-breast-smoked': [30, 100],
  tofu: [80, 250],
  shrimp: [80, 250],
  // carbs
  pasta: [70, 350],
  'pasta-wholewheat': [70, 350],
  'rice-basmati': [80, 350],
  'rice-brown-cooked': [80, 350],
  couscous: [80, 350],
  quinoa: [80, 350],
  'farro-cooked': [80, 350],
  'barley-cooked': [80, 300],
  potato: [150, 350],
  'sweet-potato': [120, 350],
  gnocchi: [100, 350],
  'polenta-cooked': [150, 350],
  'bread-wholegrain': [40, 160],
  'bread-rye': [40, 160],
  'bread-white': [40, 160],
  oats: [20, 100],
  'cream-of-rice': [20, 70],
  muesli: [20, 80],
  granola: [20, 60],
  'cereals-wholegrain': [20, 80],
  blueberries: [50, 150],
  strawberries: [100, 250],
  // fats
  'olive-oil': [0, 15],
  avocado: [30, 60],
  tahini: [10, 25],
  'peanut-butter': [10, 30],
  'almond-butter': [10, 30],
  'chia-seeds': [5, 20],
  flaxseed: [5, 20],
};

const LEGUMES = new Set(['chickpeas', 'lentils', 'borlotti-beans', 'cannellini-beans', 'black-beans', 'white-beans']);
const NUTS = new Set(['almonds', 'walnuts', 'hazelnuts', 'pistachios', 'cashews', 'pumpkin-seeds']);

export function portionBounds(food: FoodItem, role: Role, opts: { eggRoom?: number; cookingFat?: boolean; bigMeal?: boolean } = {}): { min: number; max: number; step: number; minUse: number } {
  const unit = UNIT_GRAMS[food.id];
  if (unit) {
    // eggs: up to 3 in a meal and 4 a day; fruit: one or two pieces; packs: one or two
    const maxUnits = food.id === 'eggs' ? Math.min(3, Math.floor((opts.eggRoom ?? 200) / 50)) : food.id === 'protein-drink' || food.id === 'protein-pudding' ? 1 : food.id.endsWith('cakes') || food.id === 'fette-biscottate' ? 6 : 2;
    const minUnits = Math.min(food.id.endsWith('cakes') || food.id === 'fette-biscottate' ? 2 : 1, Math.max(maxUnits, 1));
    return { min: minUnits * unit, max: Math.max(maxUnits, minUnits) * unit, step: unit, minUse: unit };
  }
  let [min, max]: Range = RANGE[food.id] ?? [0, 0];
  if (max === 0) {
    if (LEGUMES.has(food.id)) [min, max] = role === 'carb' ? [80, 300] : [80, 250];
    else if (NUTS.has(food.id)) [min, max] = [10, 40];
    else if (food.category === 'proteine') [min, max] = [80, 280];
    else if (food.category === 'carboidrati') [min, max] = [Math.round(food.defaultPortionG * 0.5), Math.round(food.defaultPortionG * 2)];
    else if (food.category === 'grassi') [min, max] = [5, 30];
    else if (food.category === 'frutta') [min, max] = [Math.round(food.defaultPortionG * 0.7), Math.round(food.defaultPortionG * 1.6)];
    else [min, max] = [Math.round(food.defaultPortionG * 0.5), Math.round(food.defaultPortionG * 2)];
  }
  if (role === 'fat' && food.id === 'olive-oil' && opts.bigMeal) max = 25; // two spoons for a very large meal
  const minUse = role === 'fat' ? Math.max(min, 5) : min;
  if (role === 'fat') min = opts.cookingFat && food.id === 'olive-oil' ? 5 : 0;
  const step = food.id.startsWith('bread') ? 10 : 5;
  return { min, max, step, minUse: role === 'fat' ? minUse : step };
}

// Errors are weighed in kcal (protein ×4, carbs ×4, fat ×9), with protein counting a bit more.
const W = { protein: 28, carbs: 16, fats: 81 };

function macrosOf(food: FoodItem, grams: number): Macros {
  const k = grams / 100;
  return { protein: food.protein100 * k, carbs: food.carbs100 * k, fats: food.fats100 * k };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return { protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fats: a.fats + b.fats };
}

export const ZERO: Macros = { protein: 0, carbs: 0, fats: 0 };
export const kcalOfMacros = (m: Macros) => m.protein * 4 + m.carbs * 4 + m.fats * 9;
export const macrosOfGrams = macrosOf;

function objective(total: Macros, target: Macros): number {
  const dp = total.protein - target.protein;
  const dc = total.carbs - target.carbs;
  const df = total.fats - target.fats;
  return W.protein * dp * dp + W.carbs * dc * dc + W.fats * df * df;
}

/**
 * Chooses the grams of `vars` so that fixed + variable foods land on `target`.
 * Mutates and returns `vars` (grams set, rounded). `error` is the root of the weighted
 * squared error: roughly "how many kcal off" the meal is.
 */
export function solvePortions(fixed: Macros, vars: PortionVar[], target: Macros): { vars: PortionVar[]; total: Macros; error: number } {
  const per = vars.map((v) => ({ p: v.food.protein100 / 100, c: v.food.carbs100 / 100, f: v.food.fats100 / 100 }));
  const g = vars.map((v) => (v.min + v.max) / 2);

  for (let iter = 0; iter < 80; iter++) {
    let moved = 0;
    for (let i = 0; i < vars.length; i++) {
      let rp = target.protein - fixed.protein;
      let rc = target.carbs - fixed.carbs;
      let rf = target.fats - fixed.fats;
      for (let j = 0; j < vars.length; j++) {
        if (j === i) continue;
        rp -= g[j] * per[j].p;
        rc -= g[j] * per[j].c;
        rf -= g[j] * per[j].f;
      }
      const num = W.protein * per[i].p * rp + W.carbs * per[i].c * rc + W.fats * per[i].f * rf;
      const den = W.protein * per[i].p ** 2 + W.carbs * per[i].c ** 2 + W.fats * per[i].f ** 2;
      const next = den > 0 ? Math.min(Math.max(num / den, vars[i].min), vars[i].max) : vars[i].min;
      moved = Math.max(moved, Math.abs(next - g[i]));
      g[i] = next;
    }
    if (moved < 0.05) break;
  }

  // practical units
  for (let i = 0; i < vars.length; i++) {
    const { step, min, max } = vars[i];
    g[i] = Math.min(Math.max(Math.round(g[i] / step) * step, min), max);
  }
  const totalOf = () => vars.reduce((acc, v, i) => addMacros(acc, macrosOf(v.food, g[i])), fixed);

  // polish: try one step either way on each food while the error improves
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (let i = 0; i < vars.length; i++) {
      for (const dir of [-1, 1]) {
        const cand = g[i] + dir * vars[i].step;
        if (cand < vars[i].min || cand > vars[i].max) continue;
        const before = objective(totalOf(), target);
        const old = g[i];
        g[i] = cand;
        if (objective(totalOf(), target) < before - 1e-6) improved = true;
        else g[i] = old;
      }
    }
    if (!improved) break;
  }

  vars.forEach((v, i) => (v.grams = g[i]));
  const total = totalOf();
  return { vars, total, error: Math.sqrt(objective(total, target)) };
}
