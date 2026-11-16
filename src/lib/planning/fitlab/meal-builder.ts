/**
 * One meal, built in the Fit Lab order: slot → standard meal (dishes.ts) → foods of that meal → quantities.
 *
 *  1. Meals valid for the slot and for this person (their filters leave every role fillable)
 *     are ranked: not used today, not overused this week, liked, easy to carry when they eat out.
 *  2. For the best few, the best foods per role are tried (variety: a protein already
 *     eaten today or often this week costs more) and the quantities solved for each combination.
 *  3. The combination that lands closest to the meal's macros, with the least repetition, wins.
 *
 * One source per role, always: a meal has ONE carbohydrate source (never pasta and bread), ONE protein source and,
 * at lunch and dinner, ONE vegetable with extra virgin olive oil as the only added fat. When a single source cannot
 * cover a very large meal its portion grows (within reason); a second source is never added.
 *
 * Quantities are in the catalog's state: dry pasta and rice, raw meat and fish, cooked legumes.
 */
import { formatFoodQuantity } from '../food-quantity';
import type { PlanMealItem } from '../types';
import { short, UNITS, type Role, type SlotKind } from './catalog';
import { CONTORNI, DISHES, PRIMI, SECONDI, SECONDI_VEG, type Dish } from './dishes';
import { foodByName, type FitLabFood } from './foods';
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
  proteinFallback: FitLabFood[];
  sides: FitLabFood[][];
  spread: FitLabFood[];
  fat: FitLabFood[];
};

const RESOLVED = new Map<string, ResolvedDish>();
function resolve(dish: Dish): ResolvedDish {
  let r = RESOLVED.get(dish.id);
  if (!r) {
    const all = (names?: string[]) => (names ?? []).map(foodByName);
    r = { dish, base: all(dish.base), protein: all(dish.protein), proteinFallback: all(dish.proteinFallback), sides: (dish.sides ?? []).map(all), spread: all(dish.spread), fat: all(dish.fat) };
    RESOLVED.set(dish.id, r);
  }
  return r;
}

const OIL = foodByName('Olio extravergine di oliva');
const LEGUMES = PRIMI.legumi.map(foodByName);
/** Cold cuts in the week so far (key in `WeekUsage.food`): once a week at most. */
const CURED_KEY = 'family:cured';
const CURED_PER_WEEK = 1;
const isCured = (f: FitLabFood) => f.sub === 'Salumi';

type Candidate = {
  r: ResolvedDish;
  base: FitLabFood[];
  protein: FitLabFood[];
  sides: FitLabFood[][];
  spread: FitLabFood[];
  fat: FitLabFood[];
  oil: boolean;
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
    // (lunch and dinner only: breakfasts and snacks are the standard ones, as written)
    const expand = (foods: FitLabFood[]) => {
      if (pools.preferredFoods.length === 0 || foods.length === 0 || (kind !== 'lunch' && kind !== 'dinner')) return foods;
      const subs = new Set(foods.map((f) => f.sub));
      return [...foods, ...pools.preferredFoods.filter((f) => !foods.includes(f) && subs.has(f.sub) && f.meals.includes(kind) && f.name !== "Albume d'uovo")];
    };
    // sides: any preferred vegetable (main meals) or fruit (breakfast and snacks) can take the place of the dish's own
    const expandSide = (group: FitLabFood[]) => {
      const category = group[0]?.category;
      if (pools.preferredFoods.length === 0 || (category !== 'Verdure' && category !== 'Frutta')) return group;
      if (category === 'Verdure' && kind !== 'lunch' && kind !== 'dinner') return group;
      return [...group, ...pools.preferredFoods.filter((f) => f.category === category && !group.includes(f) && f.meals.includes(kind))];
    };
    const isMain = kind === 'lunch' || kind === 'dinner';
    const base = expand(ok(r.base));
    let protein = lunchOk(expand(ok(r.protein)));
    // who eats no meat (and at lunch no fish to cook) has few secondi left: eggs and fresh cheese join;
    // who eats neither meat nor fish also has legumes as a secondo, next to a cereal
    if (protein.length < 4) protein = [...protein, ...ok(r.proteinFallback).filter((f) => !protein.includes(f))];
    if (isMain && r.base[0]?.sub !== 'Legumi' && !ok(r.protein).some((f) => f.sub !== 'Uova')) protein = [...protein, ...ok(LEGUMES).filter((f) => !protein.includes(f))];
    // cold cuts once a week: after that, the meals built on them wait for next week
    if (used(week.food, CURED_KEY) >= CURED_PER_WEEK) protein = protein.filter((f) => !isCured(f));
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
      (day.dishes.has(dish.id) ? 300 : 0) +
      hash(seed, dish.id) * 2 +
      // legumes once a day: as primo or as a vegetarian's secondo, not at both lunch and dinner
      (r.base[0]?.sub === 'Legumi' && day.families.has('legumes') ? 100 : 0) +
      // a reserve meal only fills the week when the standard ones are too few for this person
      (dish.reserve ? 25 : 0) +
      (kind === 'lunch' && pools.eatsOutOften && dish.portable ? -2.5 : 0) -
      (liked - 1) * 1.5;
    out.push({
      r,
      base,
      protein,
      sides,
      spread,
      fat: expand(ok(r.fat)),
      oil: !!dish.oil && pools.allowed(OIL),
      cost,
    });
  }
  // the reserve meals only come in when the person's exclusions leave fewer than three standard ones
  const standard = out.filter((c) => !c.r.dish.reserve);
  return (standard.length >= 3 ? standard : out).sort((a, b) => a.cost - b.cost);
}

const FISH_SUBS = new Set(['Pesce', 'Crostacei', 'Preparazioni di pesce']);
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
    // plant proteins (none in the catalog at the moment) would stay occasional for someone who did not ask for them
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
    quantityLabel: food.sub === 'Latte' || food.sub === 'Bevande vegetali' ? `${grams} ml` : formatFoodQuantity(food.id, grams),
    role,
    substitutes,
  };
}

const NUTRIENT: Record<string, 'p' | 'c' | 'f'> = { protein: 'p', carb: 'c', fat: 'f' };

// The standard swaps of a main meal: any primo for any primo, any secondo for any secondo, any classic vegetable for another.
const PRIMI_SWAPS = ['Pasta', 'Riso', 'Patate', 'Pane integrale', 'Gallette di riso', 'Pasta integrale', 'Riso integrale', 'Ceci', 'Fagioli cannellini', 'Lenticchie'].map(foodByName);
const SECONDI_SWAPS = SECONDI.filter((n) => n !== 'Salmone' && n !== 'Uova intere' && n !== 'Lonza di maiale magra' && !/^Hamburger di (pollo|tacchino)/.test(n)).map(foodByName);
const CONTORNI_SWAPS = CONTORNI.map(foodByName);
const VEG_SWAPS = [...SECONDI_VEG, ...PRIMI.legumi.slice(0, 3)].map(foodByName);
const MAX_SWAPS = 6;
/** Foods that replace each other outside the primo / secondo lists: same kind, same way of eating them. */
const SWAP_GROUPS: FitLabFood[][] = [
  ['Yogurt greco 0%', 'Yogurt greco 2%', 'Skyr', 'Yogurt proteico', 'Kefir'],
  ['Uova intere', "Albume d'uovo"],
  ['Ricotta magra', 'Fiocchi di latte'],
  ['Fesa di tacchino affettata', 'Bresaola', 'Prosciutto crudo'],
  ['Latte senza lattosio', 'Bevanda di soia non zuccherata', 'Latte vaccino'],
  ["Fiocchi d'avena", 'Avena istantanea', 'Cereali integrali', 'Muesli', 'Cereali da colazione senza zuccheri aggiunti'],
  ['Pane integrale', 'Pane di segale', 'Pan bauletto', 'Fette biscottate integrali', 'Gallette di riso'],
  ['Burro di arachidi 100%', 'Burro di mandorle 100%', 'Burro di nocciole 100%'],
  ['Mandorle', 'Noci', 'Nocciole', 'Pistacchi'],
  ['Ceci', 'Fagioli cannellini', 'Lenticchie', 'Fagioli borlotti', 'Fagioli'],
].map((g) => g.map(foodByName));

/** Swaps of the same role, re-sized to deliver the same amount of the nutrient the item is there for. At lunch and dinner
 * they are the standard lists (primo for primo, secondo for secondo); elsewhere, foods of the same kind (SWAP_GROUPS). */
function substitutesFor(item: { food: FitLabFood; grams: number; role: Role }, kind: SlotKind, pools: FitLabPools, kcalTarget: number): PlanMealItem['substitutes'] {
  const isMain = kind === 'lunch' || kind === 'dinner';
  if (item.role === 'veg') {
    if (!isMain) return undefined;
    const out = CONTORNI_SWAPS.filter((f) => f.id !== item.food.id && pools.allowed(f))
      .slice(0, 4)
      .map((f) => {
        const grams = vegGrams(f, 1, kind, kcalTarget);
        return { name: f.name, grams, foodId: f.id, quantityLabel: formatFoodQuantity(f.id, grams) };
      });
    return out.length > 0 ? out : undefined;
  }
  const nutrient = NUTRIENT[item.role];
  if (!nutrient) return undefined;
  const wanted = (item.food[nutrient] * item.grams) / 100;
  const sized = (foods: FitLabFood[]): NonNullable<PlanMealItem['substitutes']> => {
    const out: NonNullable<PlanMealItem['substitutes']> = [];
    for (const f of foods) {
      if (out.length >= MAX_SWAPS) break;
      if (f[nutrient] < 1) continue;
      const b = item.role === 'carb' && isMain ? primoBounds(f, kcalTarget) : portionBounds(f, item.role);
      // a portion just past the food's range is brought back to it (the tolerance below still applies)
      const grams = Math.min(Math.max(Math.round(((wanted / f[nutrient]) * 100) / b.step) * b.step, Math.max(b.min, b.step)), b.max);
      if (wanted >= 4 && Math.abs((f[nutrient] * grams) / 100 / wanted - 1) > 0.25) continue;
      out.push({ name: f.name, grams, foodId: f.id, quantityLabel: formatFoodQuantity(f.id, grams) });
    }
    return out;
  };
  const fits = (f: FitLabFood) => f.id !== item.food.id && pools.allowed(f);
  if (isMain && (item.role === 'carb' || item.role === 'protein')) {
    // fish to cook stays a dinner food: a quick lunch is not swapped for it
    const standard = (item.role === 'carb' ? PRIMI_SWAPS : SECONDI_SWAPS).filter((f) => fits(f) && !(kind === 'lunch' && isFish(f) && f.name !== 'Tonno al naturale'));
    const out = sized(standard);
    if (out.length >= 2) return out;
    // who eats no meat: eggs, fresh cheese and legumes are the secondi to swap
    if (item.role === 'protein') {
      const veg = sized([...standard, ...VEG_SWAPS.filter((f) => fits(f) && !standard.includes(f))]);
      if (veg.length > 0) return veg;
    }
  }
  // breakfast and snacks (and whatever is left): foods of the same kind, eaten the same way
  const group = SWAP_GROUPS.find((g) => g.some((f) => f.id === item.food.id));
  const out = group ? sized(group.filter(fits)) : [];
  return out.length > 0 ? out : undefined;
}

/** The primo is the meal's only carbohydrate source: for a large meal its portion grows instead of a second source being added. */
function primoBounds(food: FitLabFood, kcalTarget: number): ReturnType<typeof portionBounds> {
  const b = portionBounds(food, 'carb');
  const unit = UNITS[food.name];
  if (unit) return { ...b, max: Math.max(b.max, 10 * unit.grams) }; // rice cakes as a primo: up to a sleeve
  if (food.sub === 'Legumi') return { ...b, min: 100, max: 350 };
  if (food.c < 40) return b; // potatoes and gnocchi are bulky already: their portion stays a plate
  const stretch = Math.min(Math.max(kcalTarget / 750, 1), 1.8);
  return { ...b, max: Math.round((b.max * stretch) / b.step) * b.step };
}

// ------------------------------------------------------------ fixed amounts --

const VEG_GRAMS: Record<string, number> = { Lattuga: 60, Rucola: 40, Radicchio: 60, Germogli: 30, Carote: 100, Pomodori: 100, Zucca: 200, Funghi: 150, Cetrioli: 100, Sedano: 80, Finocchi: 150, Asparagi: 150, Carciofi: 150 };
/** A recipe's accessory amount (given for a `refKcal` meal) follows the meal's calories, within a sensible range, in whole steps. */
const accessoryGrams = (grams: number, step: number, kcalTarget: number, refKcal = 400): number => {
  const scale = Math.min(Math.max(kcalTarget / refKcal, 0.4), 1.5);
  return Math.max(step, Math.round((grams * scale) / step) * step);
};
const vegGrams = (food: FitLabFood, sides: number, kind: SlotKind, kcalTarget: number): number => {
  const base = VEG_GRAMS[food.name] ?? 150;
  const factor = (kind === 'snack' || kind === 'breakfast' ? 0.6 : 1) * (sides > 1 ? 0.8 : 1) * (kcalTarget < 350 ? 0.7 : 1);
  return Math.max(30, Math.round((base * factor) / 10) * 10);
};

// ------------------------------------------------------------------ builder --

type Solved = { vars: PortionVar[]; total: Macros; error: number; score: number };
type Fixed = { food: FitLabFood; grams: number; kind: 'veg' | 'spread' | 'accessory' };

export function buildFitLabMeal(args: { kind: SlotKind; slotId: string; target: Macros; pools: FitLabPools; seed: number; day: DayState; week: WeekUsage }): BuiltMeal {
  const { kind, slotId, target, pools, seed, day, week } = args;
  const kcalTarget = kcalOfMacros(target);
  const candidates = candidateDishes(kind, slotId, pools, seed, day, week);
  if (candidates.length === 0) throw new Error(`No dish can be built for ${kind}`);
  const isMain = kind === 'lunch' || kind === 'dinner';
  const eggRoom = Math.max(200 - day.eggGrams, 0);

  const rank = (foods: FitLabFood[], role: Role, n: number) => sortedBy(foods, (f) => foodCost(f, role, kind, seed, pools, day, week)).slice(0, n);

  let best: (Solved & { cand: Candidate; picks: Picks; fixed: Fixed[] }) | null = null;

  // lunch and dinner: every primo is tried (they are few), so the best fit for the person's secondi is never left out
  for (const cand of candidates.slice(0, isMain || kcalTarget > 900 ? 6 : 4)) {
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
    // one fat at most (and at lunch and dinner only the oil: the standard meals name no other)
    const fatOptions: FitLabFood[][] = fatTop.length === 0 ? [[]] : fatTop.map((f) => [f]);

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
            if (bf) vars.push({ food: bf, role: 'carb', ...(isMain ? primoBounds(bf, kcalTarget) : stretched(portionBounds(bf, 'carb'), kcalTarget, kind)), grams: 0 });
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
            // the recipe's small fixed ingredients (milk, honey, lemon…): sized on the meal's calories, always counted
            for (const a of cand.r.dish.accessories ?? []) {
              const food = a.foods.map(foodByName).find(pools.allowed);
              if (!food) continue;
              const grams = accessoryGrams(a.grams, a.step, kcalTarget, cand.r.dish.refKcal);
              fixed.push({ food, grams, kind: 'accessory' });
              fixedMacros = addMacros(fixedMacros, macrosOfGrams(food, grams));
            }
            if (cand.oil) vars.push({ food: OIL, role: 'fat', ...oilBounds(kcalTarget), grams: 0 });
            for (const f of fats) {
              const pb = portionBounds(f, 'fat', { bigMeal: kcalTarget > 900 });
              vars.push({ food: f, role: 'fat', ...pb, min: cand.r.dish.fatRequired ? pb.minUse : pb.min, grams: 0 });
            }
            if (vars.length === 0) continue;

            const solved = solvePortions(fixedMacros, vars, target);
            // the calories the person will read on the plan (fibre included: it counts for meals rich in legumes)
            const labelKcal = [...fixed, ...solved.vars].reduce((sum, x) => sum + (x.food.kcal * x.grams) / 100, 0);
            const kcalOff = (Math.abs(kcalOfMacros(solved.total) - kcalTarget) + Math.max(labelKcal - kcalTarget * 1.04, 0)) / Math.max(kcalTarget, 1);
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
              (pf ? repeatPenalty(used(week.slot, `${slotId}|food|${pf.id}`), 10, 300) : 0) +
              (bf ? repeatPenalty(used(week.slot, `${slotId}|food|${bf.id}`), 0, 40) : 0);
            const score = solved.error / 6 + variety + kcalOff * 500 + proteinShort * 1.5 + repeats;
            if (!best || score < best.score) best = { ...solved, score, cand, picks, fixed };
          }
        }
      }
    }
  }
  const chosen = best!;
  const dish = chosen.cand.r.dish;

  const { vars } = chosen;
  let { total } = chosen;
  const fixedMacros = chosen.fixed.reduce((a, f) => addMacros(a, macrosOfGrams(f.food, f.grams)), ZERO);

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

  const sub = (v: { food: FitLabFood; grams: number; role: Role }) => substitutesFor(v, kind, pools, kcalTarget);
  const items: PlanMealItem[] = [];
  for (const v of proteinKept) items.push(toItem(v.food, v.grams, 'protein', sub(v)));
  for (const v of carbKept) items.push(toItem(v.food, v.grams, 'carb', sub(v)));
  for (const f of chosen.fixed.filter((x) => x.kind === 'veg')) items.push(toItem(f.food, f.grams, 'veg', sub({ food: f.food, grams: f.grams, role: 'veg' })));
  for (const v of fruitKept) items.push(toItem(v.food, v.grams, 'fruit'));
  for (const f of chosen.fixed.filter((x) => x.kind === 'spread' || x.kind === 'accessory')) items.push(toItem(f.food, f.grams, 'extra'));
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
    if (v.food.sub === 'Legumi') day.families.add('legumes');
    if (isCured(v.food)) week.food.set(CURED_KEY, used(week.food, CURED_KEY) + 1);
  }
  for (const f of chosen.fixed) if (f.kind === 'veg') week.food.set(f.food.id, used(week.food, f.food.id) + 1);

  const flavorings = dish.aromas.filter((a) => pools.allowed(foodByName(a)));
  return { items, macros: total, recipe: { name: recipeName, flavorings, portable: dish.portable, dishId: dish.id } };
}

/** Olive oil is the only added fat of a main meal: one spoon, up to two for a normal lunch or dinner, three for a very large one. */
function oilBounds(kcalTarget: number): ReturnType<typeof portionBounds> {
  const b = portionBounds(OIL, 'fat', { cookingFat: true });
  return { ...b, max: kcalTarget > 900 ? 30 : kcalTarget > 700 ? 25 : kcalTarget > 450 ? 20 : b.max };
}

/** Breakfast and snacks: the single carbohydrate source grows with a large meal (no second source is added). */
function stretched(b: ReturnType<typeof portionBounds>, kcalTarget: number, kind: SlotKind): ReturnType<typeof portionBounds> {
  const stretch = Math.min(Math.max(kcalTarget / (kind === 'snack' ? 300 : 500), 1), 1.6);
  return { ...b, max: Math.max(b.max, Math.floor((b.max * stretch) / b.step) * b.step) };
}

type Picks = { base?: FitLabFood; protein?: FitLabFood; sides: FitLabFood[]; fat?: FitLabFood; spread?: FitLabFood; fruit?: FitLabFood };
