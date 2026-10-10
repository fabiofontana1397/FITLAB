/**
 * One meal, built in the Fit Lab order: slot → dish (recipe) → foods of that dish → quantities.
 *
 *  1. Dishes valid for the slot and for this person (their filters leave every role fillable)
 *     are ranked: not used today, not overused this week, liked, easy to carry when they eat out.
 *  2. For the best few dishes, the best foods per role are tried (variety: a protein already
 *     eaten today or often this week costs more) and the quantities solved for each combination.
 *  3. The combination that lands closest to the meal's macros, with the least repetition, wins.
 *
 * Quantities are in the catalog's state: dry pasta and rice, raw meat and fish, cooked legumes.
 */
import { formatFoodQuantity } from '../food-quantity';
import type { PlanMealItem } from '../types';
import { short, type Role, type SlotKind } from './catalog';
import { DISHES, type Dish } from './dishes';
import { FITLAB_FOODS, foodByName, type FitLabFood } from './foods';
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

const used = (m: Map<string, number>, id: string) => m.get(id) ?? 0;
const sortedBy = <T,>(items: T[], cost: (item: T) => number): T[] => [...items].sort((a, b) => cost(a) - cost(b));

// ------------------------------------------------------------ dish lookup --

type ResolvedDish = {
  dish: Dish;
  base: FitLabFood[];
  protein: FitLabFood[];
  extraProtein: FitLabFood[];
  sides: FitLabFood[][];
  spread: FitLabFood[];
  fat: FitLabFood[];
};

const RESOLVED = new Map<string, ResolvedDish>();
function resolve(dish: Dish): ResolvedDish {
  let r = RESOLVED.get(dish.id);
  if (!r) {
    const all = (names?: string[]) => (names ?? []).map(foodByName);
    r = { dish, base: all(dish.base), protein: all(dish.protein), extraProtein: all(dish.extraProtein), sides: (dish.sides ?? []).map(all), spread: all(dish.spread), fat: all(dish.fat) };
    RESOLVED.set(dish.id, r);
  }
  return r;
}

const OIL = foodByName('Olio extravergine di oliva');
const PASSATA = foodByName('Passata di pomodoro');

type Candidate = {
  r: ResolvedDish;
  base: FitLabFood[];
  protein: FitLabFood[];
  extraProtein: FitLabFood[];
  sides: FitLabFood[][];
  spread: FitLabFood[];
  fat: FitLabFood[];
  oil: boolean;
  sauce: boolean;
  cost: number;
};

function candidateDishes(kind: SlotKind, slotId: string, pools: FitLabPools, seed: number, day: DayState, week: WeekUsage): Candidate[] {
  const out: Candidate[] = [];
  const ok = (foods: FitLabFood[]) => foods.filter(pools.allowed);
  for (const dish of DISHES) {
    if (!dish.kinds.includes(kind)) continue;
    const r = resolve(dish);
    // lunch is quick: no fish to cook (canned tuna is fine); a dish built only on fish stays for dinner
    const lunchOk = (foods: FitLabFood[]) => (kind === 'lunch' ? foods.filter((f) => !isFish(f) || f.name === 'Tonno al naturale') : foods);
    // the foods the person picked as preferred join a role when they are of the same kind as the dish's own (another white meat, another cereal)
    const expand = (foods: FitLabFood[]) => {
      if (pools.preferredFoods.length === 0 || foods.length === 0) return foods;
      const subs = new Set(foods.map((f) => f.sub));
      return [...foods, ...pools.preferredFoods.filter((f) => !foods.includes(f) && subs.has(f.sub) && f.meals.includes(kind) && !(kind === 'snack' && needsCooking(f)))];
    };
    // sides: any preferred vegetable (main meals) or fruit (breakfast and snacks) can take the place of the dish's own
    const expandSide = (group: FitLabFood[]) => {
      const category = group[0]?.category;
      if (pools.preferredFoods.length === 0 || (category !== 'Verdure' && category !== 'Frutta')) return group;
      if (category === 'Verdure' && kind !== 'lunch' && kind !== 'dinner') return group;
      return [...group, ...pools.preferredFoods.filter((f) => f.category === category && !group.includes(f) && f.meals.includes(kind))];
    };
    const base = expand(ok(r.base));
    const protein = lunchOk(expand(ok(r.protein)));
    if (dish.base && base.length === 0) continue;
    if (dish.protein.length > 0 && protein.length === 0) continue;
    // a side nobody can eat (excluded) is dropped when the dish has another; a dish with a single side needs it
    const sides = r.sides.map((g) => expandSide(ok(g))).filter((g) => g.length > 0);
    if (r.sides.length > 0 && sides.length === 0) continue;
    const spread = ok(r.spread);
    if (r.spread.length > 0 && spread.length === 0) continue;

    const liked = protein.length > 0 ? protein.reduce((s, f) => s + pools.weight(f, kind), 0) / protein.length : 1;
    const inSlot = used(week.slot, `${slotId}|dish|${dish.id}`);
    const cost =
      used(week.dish, dish.id) * 3 +
      inSlot * 8 +
      (inSlot >= 2 ? 150 : 0) +
      (inSlot >= 3 ? 600 : 0) +
      (day.dishes.has(dish.id) ? 100 : 0) +
      hash(seed, dish.id) * 2 +
      (dish.source === 'excel' ? -1 : 0) + // the dishes from the workbook come first, the extras add variety
      (kind === 'lunch' && pools.eatsOutOften && dish.portable ? -2.5 : 0) +
      // lunch has to be quick to prepare: slow dishes stay for dinner (a last resort when nothing else fits)
      (kind === 'lunch' && dish.slow ? 200 : 0) -
      (liked - 1) * 1.5;
    out.push({
      r,
      base,
      protein,
      extraProtein: lunchOk(ok(r.extraProtein)),
      sides,
      spread,
      fat: expand(ok(r.fat)),
      oil: !!dish.oil && pools.allowed(OIL),
      sauce: !!dish.sauce && pools.allowed(PASSATA),
      cost,
    });
  }
  return out.sort((a, b) => a.cost - b.cost);
}

const FISH_SUBS = new Set(['Pesce', 'Crostacei', 'Preparazioni di pesce']);
// a snack is assembled, not cooked: nothing to boil, roast or fry (canned tuna is fine)
const COOKED_SUBS = new Set(['Carni bianche', 'Carni rosse', 'Carni suine', 'Preparazioni di carne', 'Preparazioni di pesce', 'Pesce', 'Crostacei', 'Pasta e derivati', 'Cereali', 'Pseudocereali', 'Tuberi']);
const needsCooking = (f: FitLabFood) => (COOKED_SUBS.has(f.sub) || f.name === 'Polenta' || f.name === 'Cous cous') && f.name !== 'Tonno al naturale';
const isFish = (food: FitLabFood) => FISH_SUBS.has(food.sub);

function foodCost(food: FitLabFood, role: Role, kind: SlotKind, seed: number, pools: FitLabPools, day: DayState, week: WeekUsage): number {
  return (
    used(week.food, food.id) * 2.2 +
    // every preferred food should reach the week's table: one not used yet is favoured
    (pools.isPreferred(food) && used(week.food, food.id) === 0 ? -2.5 : 0) +
    // the same protein across the week's lunches and dinners: 3 times at most when there is any alternative
    (role === 'protein' && (kind === 'lunch' || kind === 'dinner') ? (used(week.food, food.id) >= 4 ? 150 : used(week.food, food.id) >= 3 ? 45 : 0) : 0) +
    (role === 'protein' && day.families.has(familyOf(food)) ? 12 : 0) +
    (role === 'protein' && food.name === 'Uova intere' && (kind === 'lunch' || kind === 'dinner') ? 1.2 : 0) +
    // tofu and seitan stay occasional for someone who did not ask for them
    (role === 'protein' && food.sub === 'Proteine vegetali' && !pools.wantsPlantProtein ? 5 : 0) +
    // fish takes longer to prepare: dinner, not lunch (canned tuna is quick)
    (role === 'protein' && isFish(food) ? (kind === 'lunch' && food.name !== 'Tonno al naturale' ? 100 : kind === 'dinner' ? -1.5 : 0) : 0) -
    (pools.weight(food, kind) - 1) * 1.6 +
    hash(seed + role.length, food.id) * 1.4
  );
}

// ------------------------------------------------------------------ names --

function render(template: string, names: Record<string, string | undefined>): string {
  let text = template;
  for (const key of ['spread', 'fat', 's2', 's1', 'base', 'protein']) {
    const value = names[key];
    if (value) {
      text = text.replace(`{${key}}`, value);
      continue;
    }
    text = text
      .replace(new RegExp(`\\s(?:con|e|di)\\s\\{${key}\\}`), '')
      .replace(new RegExp(`,\\s\\{${key}\\}`), '')
      .replace(`{${key}}`, '');
  }
  text = text.replace(/\s{2,}/g, ' ').replace(/\s,/g, ',').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function recipeNameFor(dish: Dish, picks: { base?: FitLabFood; protein?: FitLabFood; sides: FitLabFood[]; fat?: FitLabFood; spread?: FitLabFood }): string {
  const n = (f?: FitLabFood) => (f ? short(f.name) : undefined);
  return render(dish.name, { base: n(picks.base), protein: n(picks.protein), s1: n(picks.sides[0]), s2: n(picks.sides[1]), fat: n(picks.fat), spread: picks.spread ? (picks.spread.name === 'Miele' ? 'miele' : 'marmellata') : undefined });
}

/** A meal that already appeared this week in the same slot costs a lot; more than twice is practically ruled out. */
const repeatPenalty = (n: number, soft: number, hard: number) => (n >= 4 ? hard * 5 : n >= 3 ? hard : n >= 2 ? hard / 3 : n >= 1 ? soft : 0);

// ------------------------------------------------------------- substitutes --

function toItem(food: FitLabFood, grams: number, role: NonNullable<PlanMealItem['role']>, substitutes?: PlanMealItem['substitutes']): PlanMealItem {
  return {
    name: food.name,
    grams,
    kcal: Math.round((food.kcal * grams) / 100),
    foodId: food.id,
    quantityLabel: formatFoodQuantity(food.id, grams),
    role,
    substitutes,
  };
}

const NUTRIENT: Record<string, 'p' | 'c' | 'f'> = { protein: 'p', carb: 'c', fat: 'f' };
const CARB_SUBS = new Set(['Pasta e derivati', 'Cereali', 'Pseudocereali', 'Tuberi', 'Pane e prodotti da forno', 'Cereali e derivati', 'Cereali da colazione', 'Cereali e farine']);

/** Same-category swaps (Fit Lab §17), re-sized to deliver the same amount of the nutrient the item is there for. */
function substitutesFor(item: { food: FitLabFood; grams: number; role: Role }, kind: SlotKind, pools: FitLabPools, seed: number): PlanMealItem['substitutes'] {
  const nutrient = NUTRIENT[item.role];
  if (!nutrient) return undefined;
  const category = item.role === 'protein' ? 'Proteine' : item.role === 'carb' ? 'Carboidrati' : 'Grassi';
  const legume = item.food.sub === 'Legumi';
  const wanted = (item.food[nutrient] * item.grams) / 100;
  const candidates = FITLAB_FOODS.filter((f) => {
    if (f.id === item.food.id || f.category !== category || !pools.allowed(f) || !f.meals.includes(kind)) return false;
    if (item.role === 'carb' && !CARB_SUBS.has(f.sub)) return false;
    if (item.role === 'fat' && (f.sub === 'Cioccolato' || f.sub === 'Preparazioni composte')) return false;
    if (item.role === 'protein' && (kind === 'lunch' || kind === 'dinner') && (f.sub === 'Salumi' || f.sub === 'Bevande vegetali' || f.sub === 'Latte')) return false;
    return legume === (f.sub === 'Legumi') || item.role !== 'protein';
  });
  const out: NonNullable<PlanMealItem['substitutes']> = [];
  for (const f of sortedBy(candidates, (x) => hash(seed, x.id))) {
    if (out.length >= 4) break;
    if (f[nutrient] < 1) continue;
    const b = portionBounds(f, item.role);
    const grams = Math.round(((wanted / f[nutrient]) * 100) / b.step) * b.step;
    if (grams < Math.max(b.min, b.step) || grams > b.max) continue;
    if (wanted >= 4 && Math.abs((f[nutrient] * grams) / 100 / wanted - 1) > 0.25) continue;
    out.push({ name: f.name, grams, foodId: f.id, quantityLabel: formatFoodQuantity(f.id, grams) });
  }
  return out.length > 0 ? out : undefined;
}

// ------------------------------------------------------------ fixed amounts --

const VEG_GRAMS: Record<string, number> = { Lattuga: 60, Rucola: 40, Radicchio: 60, Germogli: 30, Carote: 100, Pomodori: 100, Zucca: 200, Funghi: 150, Cetrioli: 100, Sedano: 80, Finocchi: 150, Asparagi: 150, Carciofi: 150 };
const vegGrams = (food: FitLabFood, sides: number, kind: SlotKind, kcalTarget: number): number => {
  const base = VEG_GRAMS[food.name] ?? 150;
  const factor = (kind === 'snack' ? 0.6 : 1) * (sides > 1 ? 0.8 : 1) * (kcalTarget < 350 ? 0.7 : 1);
  return Math.max(30, Math.round((base * factor) / 10) * 10);
};

// ------------------------------------------------------------------ builder --

type Solved = { vars: PortionVar[]; total: Macros; error: number; score: number };
type Fixed = { food: FitLabFood; grams: number; kind: 'veg' | 'spread' | 'sauce' };

export function buildFitLabMeal(args: { kind: SlotKind; slotId: string; target: Macros; pools: FitLabPools; seed: number; day: DayState; week: WeekUsage }): BuiltMeal {
  const { kind, slotId, target, pools, seed, day, week } = args;
  const kcalTarget = kcalOfMacros(target);
  const candidates = candidateDishes(kind, slotId, pools, seed, day, week);
  if (candidates.length === 0) throw new Error(`No dish can be built for ${kind}`);
  const isMain = kind === 'lunch' || kind === 'dinner';
  const eggRoom = Math.max(200 - day.eggGrams, 0);

  const rank = (foods: FitLabFood[], role: Role, n: number) => sortedBy(foods, (f) => foodCost(f, role, kind, seed, pools, day, week)).slice(0, n);

  let best: (Solved & { cand: Candidate; picks: Picks; fixed: Fixed[] }) | null = null;

  for (const cand of candidates.slice(0, kcalTarget > 900 ? 6 : 4)) {
    // lunch and dinner never share a protein source (unless the dish has no other)
    const fresh = isMain ? cand.protein.filter((f) => !day.families.has(familyOf(f))) : cand.protein;
    const proteins: (FitLabFood | null)[] = cand.protein.length === 0 ? [null] : rank(fresh.length > 0 ? fresh : cand.protein, 'protein', 3);
    const bases: (FitLabFood | null)[] = cand.base.length === 0 ? [null] : rank(cand.base, 'carb', 2);
    const spreadPick = cand.spread.length > 0 ? rank(cand.spread, 'fat', 1)[0] : null;
    // each side: a vegetable (fixed amount), a fruit (variable) or a spread; fruit gets two options for variety
    // (the same food never serves as two sides of one dish)
    const buildSides = (i: number, chosen: FitLabFood[]): FitLabFood[][] => {
      if (i === cand.sides.length) return [chosen];
      const group = cand.sides[i].filter((f) => !chosen.includes(f));
      if (group.length === 0) return [];
      const isFruit = group[0].category === 'Frutta';
      return rank(group, isFruit ? 'fruit' : 'veg', isFruit ? 2 : 1).flatMap((f) => buildSides(i + 1, [...chosen, f]));
    };
    const sideCombos: FitLabFood[][] = buildSides(0, []);
    const fatTop = cand.fat.length > 0 ? rank(cand.fat, 'fat', 2) : [];
    const fatOptions: FitLabFood[][] = fatTop.length === 0 ? [[]] : [...fatTop.map((f) => [f]), ...(fatTop.length === 2 ? [fatTop] : [])];

    for (const pf of proteins) {
      for (const bf of bases) {
        for (const sides of sideCombos) {
          for (const fats of fatOptions) {
            const vars: PortionVar[] = [];
            if (pf) {
              const pb = portionBounds(pf, 'protein', { eggRoom });
              // the main protein food brings most of the meal's protein (not a token amount next to a mountain of carbs)
              // (legumes and dairy are bulky for their protein: they only need a normal portion, a second source tops up)
              const needed = pf.p >= 15 ? Math.ceil((0.45 * target.protein) / (pf.p / 100) / pb.step) * pb.step : 0;
              vars.push({ food: pf, role: 'protein', ...pb, min: Math.min(Math.max(pb.min, needed), pb.max), grams: 0 });
            }
            if (bf) vars.push({ food: bf, role: 'carb', ...portionBounds(bf, 'carb'), grams: 0 });
            const fixed: Fixed[] = [];
            let fixedMacros = ZERO;
            const nVeg = sides.filter((s) => s.category === 'Verdure').length;
            for (const s of sides) {
              if (s.category === 'Frutta') vars.push({ food: s, role: 'fruit', ...portionBounds(s, 'fruit'), grams: 0 });
              else if (s.category === 'Verdure') {
                const g = vegGrams(s, nVeg, kind, kcalTarget);
                fixed.push({ food: s, grams: g, kind: 'veg' });
                fixedMacros = addMacros(fixedMacros, macrosOfGrams(s, g));
              }
            }
            if (spreadPick) {
              const g = spreadPick.name === 'Miele' ? 10 : 20;
              fixed.push({ food: spreadPick, grams: g, kind: 'spread' });
              fixedMacros = addMacros(fixedMacros, macrosOfGrams(spreadPick, g));
            }
            if (cand.sauce) {
              fixed.push({ food: PASSATA, grams: 60, kind: 'sauce' });
              fixedMacros = addMacros(fixedMacros, macrosOfGrams(PASSATA, 60));
            }
            if (cand.oil) vars.push({ food: OIL, role: 'fat', ...portionBounds(OIL, 'fat', { cookingFat: true, bigMeal: kcalTarget > 900 }), grams: 0 });
            for (const f of fats) {
              const pb = portionBounds(f, 'fat', { bigMeal: kcalTarget > 900 });
              vars.push({ food: f, role: 'fat', ...pb, min: cand.r.dish.fatRequired ? pb.minUse : pb.min, grams: 0 });
            }
            if (vars.length === 0) continue;

            const solved = solvePortions(fixedMacros, vars, target);
            const kcalOff = Math.abs(kcalOfMacros(solved.total) - kcalTarget) / Math.max(kcalTarget, 1);
            const fruit = sides.find((s) => s.category === 'Frutta');
            const picks: Picks = { base: bf ?? undefined, protein: pf ?? undefined, sides, fat: fats[0], spread: spreadPick ?? undefined, fruit };
            const variety =
              cand.cost +
              (pf ? foodCost(pf, 'protein', kind, seed, pools, day, week) : 0) +
              (bf ? foodCost(bf, 'carb', kind, seed, pools, day, week) * 0.7 : 0) +
              fats.reduce((sum, f) => sum + foodCost(f, 'fat', kind, seed, pools, day, week) * 0.4, 0) +
              sides.reduce((sum, s) => sum + foodCost(s, s.category === 'Frutta' ? 'fruit' : 'veg', kind, seed, pools, day, week) * 0.5, 0);
            const proteinShort = Math.max(target.protein - solved.total.protein, 0);
            const name = recipeNameFor(cand.r.dish, { base: bf ?? undefined, protein: pf ?? undefined, sides, fat: fats[0], spread: spreadPick ?? undefined });
            const repeats =
              repeatPenalty(used(week.slot, `${slotId}|name|${name}`), 70, 600) +
              (pf ? repeatPenalty(used(week.slot, `${slotId}|food|${pf.id}`), 0, 120) : 0) +
              (bf ? repeatPenalty(used(week.slot, `${slotId}|food|${bf.id}`), 0, 40) : 0);
            const score = solved.error / 6 + variety + kcalOff * 500 + proteinShort * 0.6 + repeats;
            if (!best || score < best.score) best = { ...solved, score, cand, picks, fixed };
          }
        }
      }
    }
  }
  const chosen = best!;
  const dish = chosen.cand.r.dish;

  let { vars, total } = chosen;
  const fixedMacros = chosen.fixed.reduce((a, f) => addMacros(a, macrosOfGrams(f.food, f.grams)), ZERO);

  // protein still short because one source hit its portion limit → a second, different source
  const proteinVars = vars.filter((v) => v.role === 'protein');
  if (target.protein - total.protein > 4 && proteinVars.length > 0) {
    const taken = new Set(vars.map((v) => v.food.id));
    const legumeFirst = proteinVars[0].food.sub === 'Legumi';
    const pool = [...chosen.cand.protein, ...chosen.cand.extraProtein];
    const alts = pool.filter((f) => !taken.has(f.id) && !(f.name === 'Uova intere' && eggRoom <= 0) && !(legumeFirst && f.sub === 'Legumi'));
    let bestAlt: { vars: PortionVar[]; total: Macros; error: number } | null = null;
    for (const f of sortedBy(alts, (x) => foodCost(x, 'protein', kind, seed, pools, day, week)).slice(0, 2)) {
      const trial: PortionVar[] = [...vars.map((v) => ({ ...v })), { food: f, role: 'protein', ...portionBounds(f, 'protein', { eggRoom }), grams: 0 }];
      const solved = solvePortions(fixedMacros, trial, target);
      if (!bestAlt || solved.error < bestAlt.error) bestAlt = solved;
    }
    if (bestAlt && bestAlt.error < chosen.error && kcalOfMacros(bestAlt.total) <= kcalTarget * 1.04) ({ vars, total } = bestAlt);
  }

  // still well under the meal's calories (large appetites, few meals) → a side of bread (fruit at breakfast), as at any table
  if (kcalOfMacros(total) < kcalTarget * 0.92 && kind !== 'snack') {
    const side = foodByName(kind === 'breakfast' ? 'Banana' : 'Pane integrale');
    if (pools.allowed(side) && !vars.some((v) => v.food.id === side.id)) {
      const trial: PortionVar[] = [...vars.map((v) => ({ ...v })), { food: side, role: 'carb', ...portionBounds(side, 'carb'), grams: 0 }];
      const solved = solvePortions(fixedMacros, trial, target);
      if (solved.error < chosen.error) ({ vars, total } = solved);
    }
  }

  // an amount too small to be a real portion is no ingredient at all (a pinch of nuts, a drop of oil)
  const kept = vars.filter((v) => v.grams >= v.minUse);
  total = kept.reduce((a, v) => addMacros(a, macrosOfGrams(v.food, v.grams)), fixedMacros);

  const proteinKept = kept.filter((v) => v.role === 'protein');
  const carbKept = kept.filter((v) => v.role === 'carb');
  const fatKept = kept.filter((v) => v.role === 'fat');
  const fruitKept = kept.filter((v) => v.role === 'fruit');
  const nonOilFat = fatKept.find((v) => v.food.id !== OIL.id);

  const picks = chosen.picks;
  const recipeName = recipeNameFor(dish, {
    base: carbKept.find((v) => picks.base && v.food.id === picks.base.id)?.food ?? carbKept[0]?.food,
    protein: proteinKept[0]?.food,
    sides: picks.sides,
    fat: nonOilFat?.food,
    spread: picks.spread,
  });

  const sub = (v: { food: FitLabFood; grams: number; role: Role }) => substitutesFor(v, kind, pools, seed);
  const items: PlanMealItem[] = [];
  for (const v of proteinKept) items.push(toItem(v.food, v.grams, 'protein', sub(v)));
  for (const v of carbKept) items.push(toItem(v.food, v.grams, 'carb', sub(v)));
  for (const f of chosen.fixed.filter((x) => x.kind === 'veg')) items.push(toItem(f.food, f.grams, 'veg'));
  for (const v of fruitKept) items.push(toItem(v.food, v.grams, 'fruit'));
  for (const f of chosen.fixed.filter((x) => x.kind === 'spread' || x.kind === 'sauce')) items.push(toItem(f.food, f.grams, 'extra'));
  for (const v of fatKept) items.push(toItem(v.food, v.grams, 'fat', v.food.id === OIL.id ? undefined : sub(v)));

  // remember what was used: variety within the day and across the week
  week.dish.set(dish.id, used(week.dish, dish.id) + 1);
  day.dishes.add(dish.id);
  const bump = (key: string) => week.slot.set(key, used(week.slot, key) + 1);
  bump(`${slotId}|dish|${dish.id}`);
  bump(`${slotId}|name|${recipeName}`);
  for (const v of kept) {
    week.food.set(v.food.id, used(week.food, v.food.id) + 1);
    if (v.role === 'protein' || v.role === 'carb') bump(`${slotId}|food|${v.food.id}`);
    if (v.role === 'protein') day.families.add(familyOf(v.food));
    if (v.food.name === 'Uova intere') day.eggGrams += v.grams;
  }
  for (const f of chosen.fixed) if (f.kind === 'veg') week.food.set(f.food.id, used(week.food, f.food.id) + 1);

  const flavorings = dish.aromas.filter((a) => pools.allowed(foodByName(a)));
  return { items, macros: total, recipe: { name: recipeName, flavorings, portable: dish.portable, dishId: dish.id } };
}

type Picks = { base?: FitLabFood; protein?: FitLabFood; sides: FitLabFood[]; fat?: FitLabFood; spread?: FitLabFood; fruit?: FitLabFood };
