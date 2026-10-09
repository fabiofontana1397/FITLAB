/**
 * One meal, built in the Fit Lab order: slot → dish (recipe) → foods of that dish → quantities.
 *
 *  1. Dishes valid for the slot and for this person (their filters leave every role fillable)
 *     are ranked: not used today, not overused this week, liked, easy to carry when they eat out.
 *  2. For the best few dishes, the best foods per role are tried (variety: a protein already
 *     eaten today or often this week costs more) and the quantities solved for each combination.
 *  3. The combination that lands closest to the meal's macros, with the least repetition, wins.
 */
import { findFood, type FoodItem } from '@/lib/mock/food-database';

import { formatFoodQuantity } from '../food-quantity';
import type { PlanMealItem } from '../types';
import { CATALOG, COOKED, FALLBACK, short, type Role, type SlotKind } from './catalog';
import { DISHES, type Dish } from './dishes';
import { familyOf, type FitLabPools } from './pools';
import { addMacros, kcalOfMacros, macrosOfGrams, portionBounds, solvePortions, ZERO, type Macros, type PortionVar } from './solver';

/** What the week has already used: overall (dish, food) and per slot (`slotId|dish|id`, `slotId|name|recipe`, `slotId|food|id`), so the same meal never comes back more than a couple of times. */
export type WeekUsage = { dish: Map<string, number>; food: Map<string, number>; slot: Map<string, number> };
export type DayState = { eggGrams: number; families: Set<string>; dishes: Set<string> };

export type BuiltMeal = {
  items: PlanMealItem[];
  macros: Macros;
  recipe: { name: string; flavorings: string[]; portable?: boolean; dishId: string };
};

function hash(seed: number, text: string): number {
  let x = (seed + 1) * 374761393;
  for (let i = 0; i < text.length; i++) {
    x = Math.imul(x ^ text.charCodeAt(i), 668265263);
    x ^= x >>> 13;
  }
  return ((x >>> 0) % 1000) / 1000;
}

const union = (kind: SlotKind) => new Set([...Object.values(CATALOG[kind]).flat(), ...Object.values(FALLBACK[kind]).flat()]);
const UNION: Record<SlotKind, Set<string>> = { breakfast: union('breakfast'), snack: union('snack'), lunch: union('lunch'), dinner: union('dinner') };

/** Ids of a dish role that are in the slot's catalog and allowed for this person. */
function usable(ids: string[] | undefined, kind: SlotKind, pools: FitLabPools): string[] {
  return (ids ?? []).filter((id) => UNION[kind].has(id) && pools.allowed(id) && findFood(id));
}

const used = (m: Map<string, number>, id: string) => m.get(id) ?? 0;

function sortedBy(ids: string[], cost: (id: string) => number): string[] {
  return [...ids].sort((a, b) => cost(a) - cost(b));
}

type Candidate = {
  dish: Dish;
  protein: string[];
  carb: string[];
  fat: string[];
  veg: string[];
  fruit: string[];
  cost: number;
};

function candidateDishes(kind: SlotKind, slotId: string, pools: FitLabPools, seed: number, day: DayState, week: WeekUsage): Candidate[] {
  const out: Candidate[] = [];
  for (const dish of DISHES) {
    if (!dish.kinds.includes(kind)) continue;
    if (dish.meatless && !pools.meatless) continue;
    const protein = usable(pools.meatless ? [...dish.protein, ...(dish.meatlessProtein ?? [])] : dish.protein, kind, pools);
    const carb = usable(dish.carb, kind, pools);
    const fat = usable(dish.fat, kind, pools);
    const veg = usable(dish.veg, kind, pools);
    const fruit = usable(dish.fruit, kind, pools);
    const isMain = kind === 'lunch' || kind === 'dinner';
    if (protein.length === 0 || carb.length === 0) continue;
    if (isMain && veg.length === 0) continue;
    if (dish.cookingFat && fat.length === 0) continue;
    if (kind === 'breakfast' && dish.fruit && fruit.length === 0) continue;

    const liked = protein.reduce((s, id) => s + pools.weight(id, kind), 0) / protein.length;
    const inSlot = used(week.slot, `${slotId}|dish|${dish.id}`);
    const cost =
      used(week.dish, dish.id) * 3 +
      inSlot * 8 +
      (inSlot >= 2 ? 150 : 0) +
      (inSlot >= 3 ? 600 : 0) +
      (day.dishes.has(dish.id) ? 100 : 0) +
      hash(seed, dish.id) * 2 +
      (kind === 'lunch' && pools.eatsOutOften && dish.portable ? -2.5 : 0) -
      (liked - 1) * 1.5;
    out.push({ dish, protein, carb, fat, veg, fruit, cost });
  }
  return out.sort((a, b) => a.cost - b.cost);
}

function foodCost(id: string, role: Role, kind: SlotKind, seed: number, pools: FitLabPools, day: DayState, week: WeekUsage): number {
  return (
    used(week.food, id) * 2.2 +
    (role === 'protein' && day.families.has(familyOf(id)) ? 12 : 0) +
    (role === 'protein' && id === 'eggs' && (kind === 'lunch' || kind === 'dinner') ? 1.2 : 0) -
    (pools.weight(id, kind) - 1) * 1.6 +
    hash(seed + role.length, id) * 1.4
  );
}

function render(template: string, names: Record<string, string | undefined>): string {
  let text = template;
  for (const key of ['f', 'fr', 'v', 'c', 'p', 'pc']) {
    const value = names[key];
    if (value) text = text.replace(`{${key}}`, value);
    else text = text.replace(new RegExp(`\\s(?:con|e|di)\\s\\{${key}\\}`), '').replace(`{${key}}`, '');
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toItem(food: FoodItem, grams: number, substitutes?: PlanMealItem['substitutes']): PlanMealItem {
  return { name: food.name, grams, kcal: Math.round((food.kcal100 * grams) / 100), foodId: food.id, quantityLabel: formatFoodQuantity(food.id, grams), substitutes };
}

const NUTRIENT: Record<string, 'protein100' | 'carbs100' | 'fats100'> = { protein: 'protein100', carb: 'carbs100', fat: 'fats100' };
const LEGUMES = ['chickpeas', 'lentils', 'borlotti-beans', 'cannellini-beans', 'black-beans', 'white-beans'];

/** Same-category swaps (Fit Lab §17), re-sized to deliver the same amount of the nutrient the item is there for. */
function substitutesFor(item: { food: FoodItem; grams: number; role: Role }, kind: SlotKind, dish: Dish, pools: FitLabPools, seed: number): PlanMealItem['substitutes'] {
  if (!NUTRIENT[item.role]) return undefined;
  const legume = (id: string) => LEGUMES.includes(id);
  // legumes are swapped for legumes by energy (they are both the protein and the carbohydrate of the dish)
  const nutrient = legume(item.food.id) ? 'kcal100' : NUTRIENT[item.role];
  const catalogRole = item.role as 'protein' | 'carb' | 'fat';
  const dishList = (item.role === 'protein' ? dish.protein : item.role === 'carb' ? dish.carb : dish.fat) ?? [];
  const ids = [...new Set([...dishList, ...(CATALOG[kind][catalogRole] ?? [])])].filter((id) => id !== item.food.id && pools.allowed(id) && UNION[kind].has(id));
  const wanted = (item.food[nutrient] * item.grams) / 100;
  const out: NonNullable<PlanMealItem['substitutes']> = [];
  for (const id of sortedBy(ids, (x) => hash(seed, x))) {
    if (out.length >= 4) break;
    const food = findFood(id);
    if (!food || food[nutrient] < 1) continue;
    if (legume(id) !== legume(item.food.id) && (item.role === 'carb' || item.role === 'protein') && kind !== 'breakfast' && kind !== 'snack') continue;
    if (item.role === 'protein' && (kind === 'lunch' || kind === 'dinner') && ['whey-protein', 'protein-bar', 'greek-yogurt-0', 'skyr'].includes(id)) continue;
    const b = portionBounds(food, item.role);
    const grams = Math.round(((wanted / food[nutrient]) * 100) / b.step) * b.step;
    if (grams < Math.max(b.min, b.step) || grams > b.max) continue;
    // after rounding to a practical unit it must still deliver about the same of the nutrient
    if (wanted >= 4 && Math.abs((food[nutrient] * grams) / 100 / wanted - 1) > 0.25) continue;
    out.push({ name: food.name, grams, foodId: food.id, quantityLabel: formatFoodQuantity(food.id, grams) });
  }
  return out.length > 0 ? out : undefined;
}

type Solved = { vars: PortionVar[]; total: Macros; error: number; fixedItems: { food: FoodItem; grams: number; role: Role }[]; score: number };

function recipeNameFor(dish: Dish, picks: { protein?: FoodItem; carb?: FoodItem; veg?: FoodItem; fat?: FoodItem; fruit?: FoodItem }): string {
  const nameOf = (food?: FoodItem) => (food ? short(food.id, food.name) : undefined);
  const p = nameOf(picks.protein);
  return render(dish.name, {
    p,
    pc: picks.protein ? (COOKED[picks.protein.id] ?? (p ? p[0].toUpperCase() + p.slice(1) : undefined)) : undefined,
    c: nameOf(picks.carb),
    v: nameOf(picks.veg),
    f: nameOf(picks.fat),
    fr: nameOf(picks.fruit),
  });
}

/** A meal that already appeared this week in the same slot costs a lot; more than twice is practically ruled out. */
const repeatPenalty = (n: number, soft: number, hard: number) => (n >= 4 ? hard * 5 : n >= 3 ? hard : n >= 2 ? hard / 3 : n >= 1 ? soft : 0);

export function buildFitLabMeal(args: {
  kind: SlotKind;
  slotId: string;
  target: Macros;
  pools: FitLabPools;
  seed: number;
  day: DayState;
  week: WeekUsage;
}): BuiltMeal {
  const { kind, slotId, target, pools, seed, day, week } = args;
  const isMain = kind === 'lunch' || kind === 'dinner';
  const kcalTarget = kcalOfMacros(target);
  const candidates = candidateDishes(kind, slotId, pools, seed, day, week);
  if (candidates.length === 0) throw new Error(`No dish can be built for ${kind}`);

  const eggRoom = Math.max(200 - day.eggGrams, 0);
  let best: (Solved & { cand: Candidate }) | null = null;

  for (const cand of candidates.slice(0, kcalTarget > 900 ? 6 : 4)) {
    const rank = (ids: string[], role: Role, n: number) => sortedBy(ids, (id) => foodCost(id, role, kind, seed, pools, day, week)).slice(0, n);
    // lunch and dinner never share a protein source (unless the dish has no other)
    const fresh = isMain ? cand.protein.filter((id) => !day.families.has(familyOf(id))) : cand.protein;
    const proteins = rank(fresh.length > 0 ? fresh : cand.protein, 'protein', 3);
    const carbs = rank(cand.carb, 'carb', 2);
    const fatTop = cand.fat.length > 0 ? rank(cand.fat, 'fat', 2) : [];
    // one fat food, or two together when the meal needs a lot of fat (oil plus nuts, say)
    const fats: (string[] | null)[] = fatTop.length === 0 ? [null] : [...fatTop.map((id) => [id]), ...(fatTop.length === 2 ? [fatTop] : [])];
    const vegs = isMain ? rank(cand.veg, 'veg', 1) : [null];
    const fruits = kind === 'breakfast' && cand.fruit.length > 0 ? rank(cand.fruit, 'fruit', 2) : [null];

    for (const pid of proteins) {
      for (const cid of carbs) {
        for (const fid of fats) {
          for (const vid of vegs) {
            for (const frid of fruits) {
              if (cid === pid) continue;
              const pf = findFood(pid)!;
              const cf = findFood(cid)!;
              const pb = portionBounds(pf, 'protein', { eggRoom });
              // the main protein food brings most of the meal's protein (not a token amount next to a mountain of carbs)
              const needed = Math.ceil((0.45 * target.protein) / (pf.protein100 / 100) / pb.step) * pb.step;
              const vars: PortionVar[] = [
                { food: pf, role: 'protein', ...pb, min: Math.min(Math.max(pb.min, needed), pb.max), grams: 0 },
                { food: cf, role: 'carb', ...portionBounds(cf, 'carb'), grams: 0 },
              ];
              for (const id of fid ?? []) {
                const fatFood = findFood(id)!;
                vars.push({ food: fatFood, role: 'fat', ...portionBounds(fatFood, 'fat', { cookingFat: cand.dish.cookingFat && id === 'olive-oil', bigMeal: kcalTarget > 900 }), grams: 0 });
              }
              const fruitFood = frid ? findFood(frid)! : null;
              if (fruitFood) vars.push({ food: fruitFood, role: 'fruit', ...portionBounds(fruitFood, 'fruit'), grams: 0 });
              const fixedItems: Solved['fixedItems'] = [];
              let fixed = ZERO;
              if (vid) {
                const vegFood = findFood(vid)!;
                const grams = kcalTarget < 350 ? 100 : 150;
                fixedItems.push({ food: vegFood, grams, role: 'veg' });
                fixed = addMacros(fixed, macrosOfGrams(vegFood, grams));
              }
              const solved = solvePortions(fixed, vars, target);
              const kcalOff = Math.abs(kcalOfMacros(solved.total) - kcalTarget) / Math.max(kcalTarget, 1);
              const variety =
                cand.cost +
                foodCost(pid, 'protein', kind, seed, pools, day, week) +
                foodCost(cid, 'carb', kind, seed, pools, day, week) * 0.7 +
                (fid ? fid.reduce((sum, id) => sum + foodCost(id, 'fat', kind, seed, pools, day, week) * 0.4, 0) : 0) +
                (vid ? foodCost(vid, 'veg', kind, seed, pools, day, week) * 0.5 : 0) +
                (frid ? foodCost(frid, 'fruit', kind, seed, pools, day, week) * 0.5 : 0);
              const proteinShort = Math.max(target.protein - solved.total.protein, 0);
              const name = recipeNameFor(cand.dish, { protein: pf, carb: cf, veg: vid ? findFood(vid)! : undefined, fat: fid ? findFood(fid[0])! : undefined, fruit: frid ? findFood(frid)! : undefined });
              const repeats =
                repeatPenalty(used(week.slot, `${slotId}|name|${name}`), 70, 600) +
                repeatPenalty(used(week.slot, `${slotId}|food|${pid}`), 0, 120) +
                repeatPenalty(used(week.slot, `${slotId}|food|${cid}`), 0, 40);
              const score = solved.error / 6 + variety + kcalOff * 200 + proteinShort * 0.6 + repeats;
              if (!best || score < best.score) best = { ...solved, fixedItems, score, cand };
            }
          }
        }
      }
    }
  }
  const chosen = best!;

  // protein still short because one source hit its portion limit → a second, different source of the same dish
  let { vars, total } = chosen;
  const fixedMacros = chosen.fixedItems.reduce((a, f) => addMacros(a, macrosOfGrams(f.food, f.grams)), ZERO);
  if (target.protein - total.protein > 4) {
    const taken = new Set(vars.map((v) => v.food.id));
    const families = new Set(vars.map((v) => familyOf(v.food.id)));
    const legumeFirst = LEGUMES.includes(vars[0].food.id);
    const alts = chosen.cand.protein.filter((id) => !taken.has(id) && !families.has(familyOf(id)) && !(id === 'eggs' && eggRoom <= 0) && !(legumeFirst && LEGUMES.includes(id)));
    let bestAlt: Solved | null = null;
    for (const id of sortedBy(alts, (x) => foodCost(x, 'protein', kind, seed, pools, day, week)).slice(0, 2)) {
      const food = findFood(id)!;
      const trial: PortionVar[] = [...vars.map((v) => ({ ...v })), { food, role: 'protein', ...portionBounds(food, 'protein', { eggRoom }), grams: 0 }];
      const solved = solvePortions(fixedMacros, trial, target);
      if (!bestAlt || solved.error < bestAlt.error) bestAlt = { ...solved, fixedItems: chosen.fixedItems, score: 0 };
    }
    if (bestAlt && bestAlt.error < chosen.error) ({ vars, total } = bestAlt);
  }

  // still well under the meal's calories (large appetites, few meals) → a side of bread (fruit at breakfast), as at any table
  if (kcalOfMacros(total) < kcalTarget * 0.92 && kind !== 'snack') {
    const sideId = kind === 'breakfast' ? 'banana' : 'bread-wholegrain';
    const side = findFood(sideId);
    if (side && pools.allowed(sideId) && !vars.some((v) => v.food.id === sideId)) {
      const trial: PortionVar[] = [...vars.map((v) => ({ ...v })), { food: side, role: 'carb', ...portionBounds(side, 'carb'), grams: 0 }];
      const solved = solvePortions(fixedMacros, trial, target);
      if (solved.error < chosen.error) ({ vars, total } = solved);
    }
  }

  // an amount too small to be a real portion is no ingredient at all (a pinch of nuts, a drop of oil)
  const kept = vars.filter((v) => v.grams >= v.minUse);
  total = kept.reduce((a, v) => addMacros(a, macrosOfGrams(v.food, v.grams)), fixedMacros);

  const proteinVar = kept.find((v) => v.role === 'protein')!;
  const carbVars = kept.filter((v) => v.role === 'carb');
  const carbVar = carbVars[0];
  const fatVars = kept.filter((v) => v.role === 'fat');
  const fatVar = fatVars[0];
  const fruitVar = kept.find((v) => v.role === 'fruit');
  const vegItem = chosen.fixedItems.find((f) => f.role === 'veg');

  const dish = chosen.cand.dish;
  const recipeName = recipeNameFor(dish, { protein: proteinVar.food, carb: carbVar.food, veg: vegItem?.food, fat: fatVar?.food, fruit: fruitVar?.food });

  const sub = (v: { food: FoodItem; grams: number; role: Role }) => substitutesFor(v, kind, dish, pools, seed);
  const items: PlanMealItem[] = [];
  for (const v of kept.filter((x) => x.role === 'protein')) items.push(toItem(v.food, v.grams, sub(v)));
  for (const v of carbVars) items.push(toItem(v.food, v.grams, sub(v)));
  if (vegItem) items.push(toItem(vegItem.food, vegItem.grams));
  if (fruitVar) items.push(toItem(fruitVar.food, fruitVar.grams));
  for (const v of fatVars) items.push(toItem(v.food, v.grams, sub(v)));

  // remember what was used: variety within the day and across the week
  week.dish.set(dish.id, used(week.dish, dish.id) + 1);
  day.dishes.add(dish.id);
  const bump = (key: string) => week.slot.set(key, used(week.slot, key) + 1);
  bump(`${slotId}|dish|${dish.id}`);
  bump(`${slotId}|name|${recipeName}`);
  for (const v of kept) if (v.role === 'protein' || v.role === 'carb') bump(`${slotId}|food|${v.food.id}`);
  for (const v of kept) {
    week.food.set(v.food.id, used(week.food, v.food.id) + 1);
    if (v.role === 'protein') day.families.add(familyOf(v.food.id));
    if (v.food.id === 'eggs') day.eggGrams += v.grams;
  }
  if (vegItem) week.food.set(vegItem.food.id, used(week.food, vegItem.food.id) + 1);

  return { items, macros: total, recipe: { name: recipeName, flavorings: dish.flavor, portable: dish.portable, dishId: dish.id } };
}
