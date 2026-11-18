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
import { NUTRITION_PARAMS } from '@/domain/nutrition/params';

import { formatFoodQuantity } from '../food-quantity';
import type { PlanMealItem } from '../types';
import { short, UNITS, type Role, type SlotKind } from './catalog';
import { CONTORNI, DISHES, PRIMI, SECONDI, SECONDI_VEG, type Dish } from './dishes';
import { fitlabById, foodByName, type FitLabFood } from './foods';
import { familyOf, proteinCategory, type FitLabPools } from './pools';
import { addMacros, kcalOfMacros, macrosOfGrams, portionBounds, solvePortions, ZERO, type Macros, type PortionVar } from './solver';

/** What the week has already used: overall (dish, food) and per slot (`slotId|dish|id`, `slotId|name|recipe`, `slotId|food|id`), so the same meal never comes back more than a couple of times. */
export type WeekUsage = {
  dish: Map<string, number>;
  food: Map<string, number>;
  slot: Map<string, number>;
  /** Recipes of the previous months (weight 1 last month, 0.5 the month before): the pool rotates, so a new month
   * (or an updated plan) brings mostly other recipes. */
  previous?: Map<string, number>;
  /** Recipes eaten the day before: the same lunch or dinner is not served two days in a row. */
  yesterday?: Set<string>;
  /** The person asked for different foods: last month's recipes and repeated proteins cost much more. */
  strongVariety?: boolean;
};

/** The meal-level part of the check-in adaptations (domain/nutrition DietAdaptations). */
export type MealAdaptations = { energyDense?: boolean; highVolume?: boolean; simplify?: boolean };
export type DayState = { eggGrams: number; families: Set<string>; dishes: Set<string> };

export type BuiltMeal = {
  items: PlanMealItem[];
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
  fatIfPreferred: FitLabFood[];
};

const RESOLVED = new Map<string, ResolvedDish>();
function resolve(dish: Dish): ResolvedDish {
  let r = RESOLVED.get(dish.id);
  if (!r) {
    const all = (names?: string[]) => (names ?? []).map(foodByName);
    r = { dish, base: all(dish.base), protein: all(dish.protein), proteinFallback: all(dish.proteinFallback), sides: (dish.sides ?? []).map(all), spread: all(dish.spread), fat: all(dish.fat), fatIfPreferred: all(dish.fatIfPreferred) };
    RESOLVED.set(dish.id, r);
  }
  return r;
}

const OIL = foodByName('Olio extravergine di oliva');
const TUNA = foodByName('Tonno al naturale');
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
  /** Nuts the person picked, added to a yogurt or porridge when they fit the meal. */
  optionalFat: FitLabFood[];
  oil: boolean;
  cost: number;
};

function candidateDishes(kind: SlotKind, slotId: string, pools: FitLabPools, seed: number, day: DayState, week: WeekUsage, adapt?: MealAdaptations): Candidate[] {
  const out: Candidate[] = [];
  const ok = (foods: FitLabFood[]) => foods.filter(pools.allowed);
  for (const dish of DISHES) {
    if (!dish.kinds.includes(kind)) continue;
    const r = resolve(dish);
    // lunch is quick: no fish to cook (canned tuna is fine); a dish built only on fish stays for dinner
    const lunchOk = (foods: FitLabFood[]) => (kind === 'lunch' ? foods.filter((f) => !isFish(f) || f.name === 'Tonno al naturale') : foods);
    // a pool recipe keeps its own foods: the person's preferences decide how often it comes up (below), never what is in it
    const isMain = kind === 'lunch' || kind === 'dinner';
    // alternatives in a role only differ where they must (pasta / gluten-free pasta, milk / lactose-free milk): the first allowed one
    const base = ok(r.base).slice(0, 1);
    let protein = lunchOk(ok(r.protein));
    // cold cuts once a week: after that, the meals built on them wait for next week
    if (used(week.food, CURED_KEY) >= CURED_PER_WEEK) protein = protein.filter((f) => !isCured(f));
    // canned tuna twice a week at most: after that, the meals built on it wait for next week
    if (used(week.food, TUNA.id) >= NUTRITION_PARAMS.planning.maxTunaPerWeek) protein = protein.filter((f) => f.id !== TUNA.id);
    if (dish.base && base.length === 0) continue;
    if (dish.protein.length > 0 && protein.length === 0) continue;
    // a side nobody can eat (excluded) is dropped when the dish has another; a dish with a single side needs it
    // every side of a recipe is part of it (its name and photo show it): a recipe whose side the person cannot eat is skipped
    const sides = r.sides.map((g) => ok(g).slice(0, 1));
    if (sides.some((g) => g.length === 0)) continue;
    const spread = ok(r.spread);
    if (r.spread.length > 0 && spread.length === 0) continue;

    // the foods picked in the questionnaire: a recipe that contains them comes up more often (and one with a preferred
    // food not yet eaten this week first of all, so every preferred food reaches the table)
    const foodsOf = [base[0], protein[0], ...sides.map((g) => g[0]), ok(r.fat)[0]].filter((f): f is FitLabFood => !!f);
    const liked = foodsOf.reduce((sum, f) => sum + (pools.weight(f, kind) - 1) * (f === base[0] && isMain ? 4 : f === protein[0] ? 3 : 2), 0);
    const freshPreferred = foodsOf.some((f) => pools.isRequested(f) && used(week.food, f.id) === 0) ? 10 : foodsOf.some((f) => pools.isPreferred(f) && used(week.food, f.id) === 0) ? 3 : 0;
    // lunch and dinner of the same day do not share a protein family (chicken twice, fish twice)
    const sameFamily = isMain && protein[0] && day.families.has(familyOf(protein[0])) ? 80 : 0;
    const inSlot = used(week.slot, `${slotId}|dish|${dish.id}`);
    // a simpler week: breakfasts and snacks recur on purpose, quick or portable mains come first
    const recurring = !!adapt?.simplify && !isMain;
    const cost =
      used(week.dish, dish.id) * (recurring ? 0 : 3) +
      (recurring ? (inSlot > 0 ? -4 : 0) : inSlot * 8) +
      // rotation: last month's recipes wait (they come back when the pool for this person is small)
      (week.previous?.get(dish.id) ?? 0) * (week.strongVariety ? NUTRITION_PARAMS.planning.previousMonthCostStrong : NUTRITION_PARAMS.planning.previousMonthCost) +
      (isMain && week.yesterday?.has(dish.id) ? NUTRITION_PARAMS.planning.consecutiveDayCost : 0) +
      // protein categories rotate in the main meals (meat, fish, eggs, dairy, legumes, plant), within what the
      // person can eat: a category already used often this week costs a little more each time
      (isMain && protein[0] ? Math.max(0, used(week.food, `cat|${proteinCategory(protein[0])}`) - 2) * NUTRITION_PARAMS.planning.categoryRepeatCost : 0) +
      (!recurring && inSlot >= 2 ? 150 : 0) +
      (!recurring && inSlot >= 3 ? 600 : 0) +
      (adapt?.simplify && isMain && dish.portable ? -3 : 0) +
      (day.dishes.has(dish.id) ? 300 : 0) +
      hash(seed, dish.id) * 2 +
      // legumes once a day: as primo or as a vegetarian's secondo, not at both lunch and dinner
      (r.base[0]?.sub === 'Legumi' && day.families.has('legumes') ? 100 : 0) +
      // a reserve meal only fills the week when the standard ones are too few for this person
      (dish.reserve ? 25 : 0) +
      sameFamily +
      (kind === 'lunch' && pools.eatsOutOften && dish.portable ? -2.5 : 0) -
      liked -
      freshPreferred;
    out.push({
      r,
      base,
      protein,
      sides,
      spread,
      fat: ok(r.fat).slice(0, 1),
      // nuts on yogurt or porridge: when picked, or when the meals must be denser
      optionalFat: ok(r.fatIfPreferred).filter((f) => pools.isPreferred(f) || !!adapt?.energyDense),
      oil: !!dish.oil && pools.allowed(OIL),
      cost,
    });
  }
  // the reserve meals only come in when the person's exclusions leave too few standard ones for a varied week
  const standard = out.filter((c) => !c.r.dish.reserve);
  return (standard.length >= 6 ? standard : out).sort((a, b) => a.cost - b.cost);
}

const FISH_SUBS = new Set(['Pesce', 'Crostacei', 'Preparazioni di pesce']);
const isFish = (food: FitLabFood) => FISH_SUBS.has(food.sub);

function foodCost(food: FitLabFood, role: Role, kind: SlotKind, seed: number, pools: FitLabPools, day: DayState, week: WeekUsage, adapt?: MealAdaptations): number {
  const main = kind === 'lunch' || kind === 'dinner';
  const maxSame = week.strongVariety ? NUTRITION_PARAMS.planning.maxSameProteinPerWeek - 1 : NUTRITION_PARAMS.planning.maxSameProteinPerWeek;
  return (
    used(week.food, food.id) * 2.2 +
    // canned tuna twice a week at most (mercury), whatever the regime
    (role === 'protein' && food.name === 'Tonno al naturale' && used(week.food, food.id) >= NUTRITION_PARAMS.planning.maxTunaPerWeek ? 400 : 0) +
    // denser meals: carbohydrate sources with little energy per gram (potatoes, cooked legumes) step back
    (adapt?.energyDense && role === 'carb' && food.kcal < 150 ? 3 : 0) +
    // every preferred food should reach the week's table: one not used yet is favoured
    (pools.isPreferred(food) && used(week.food, food.id) === 0 ? -2.5 : 0) +
    // the same protein across the week's lunches and dinners: 3 times at most when there is any alternative
    (role === 'protein' && main ? (used(week.food, food.id) >= maxSame + 1 ? 150 : used(week.food, food.id) >= maxSame ? 45 : 0) : 0) +
    (role === 'protein' && day.families.has(familyOf(food)) ? 12 : 0) +
    (role === 'protein' && food.name === 'Uova intere' && (kind === 'lunch' || kind === 'dinner') ? 1.2 : 0) +
    // plant proteins (none in the catalog at the moment) would stay occasional for someone who did not ask for them
    (role === 'protein' && food.sub === 'Proteine vegetali' && !pools.wantsPlantProtein ? 5 : 0) +
    // fish takes longer to prepare: dinner, not lunch (canned tuna is quick)
    (role === 'protein' && isFish(food) ? (kind === 'lunch' && food.name !== 'Tonno al naturale' ? 100 : kind === 'dinner' ? -1.5 : 0) : 0) -
    // the foods picked in the questionnaire come first, the others of the same group only for variety
    (pools.weight(food, kind) - 1) * 3 +
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

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The nutrition of a set of items, aggregated from the items (ingredient → meal → day → week all use this):
 * label energy, macros and fibre, plus the energy derived from the macros with the EU conversion factors
 * (protein 4, available carbohydrate 4, fat 9, fibre 2 kcal/g; the catalog has no polyols or alcohol).
 */
export function sumNutrition(items: Pick<PlanMealItem, 'kcal' | 'protein' | 'carbs' | 'fats' | 'fiber' | 'foodId' | 'grams'>[]): { kcal: number; protein: number; carbs: number; fats: number; fiber: number; derivedKcal: number } {
  const t = items.reduce(
    (acc, i) => {
      const food = fitlabById(i.foodId);
      const k = i.grams / 100;
      // items saved by an older engine have no macros: they come from the catalog row, never estimated
      const p = i.protein ?? (food ? food.p * k : NaN);
      const c = i.carbs ?? (food ? food.c * k : NaN);
      const f = i.fats ?? (food ? food.f * k : NaN);
      const fib = i.fiber ?? (food ? food.fib * k : NaN);
      return { kcal: acc.kcal + i.kcal, protein: acc.protein + p, carbs: acc.carbs + c, fats: acc.fats + f, fiber: acc.fiber + fib };
    },
    { kcal: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 }
  );
  return { ...t, derivedKcal: t.protein * 4 + t.carbs * 4 + t.fats * 9 + t.fiber * 2 };
}

/**
 * Resizes one item of a built meal (day-level reconciliation): the new grams must stay within the food's portion
 * bounds for that meal, and the substitutes are sized again on the new portion (same rules as at build time).
 * Returns null when the new portion is outside the bounds.
 */
export function resizeItem(item: PlanMealItem, grams: number, at: { kind: SlotKind; pools: FitLabPools; kcalTarget: number; adapt?: MealAdaptations }): PlanMealItem | null {
  const food = fitlabById(item.foodId);
  if (!food || !item.role || item.role === 'fruit' || item.role === 'extra') return null;
  const role: Role = item.role;
  const isMain = at.kind === 'lunch' || at.kind === 'dinner';
  const b = food.id === OIL.id ? oilBounds(at.kcalTarget) : role === 'carb' && isMain ? primoBounds(food, at.kcalTarget) : portionBounds(food, role, { bigMeal: at.kcalTarget > 900 });
  // a very large meal (high-calorie days) may stretch a portion a little past its usual maximum
  const max = at.kcalTarget > 900 ? b.max * 1.25 : b.max;
  if (grams < Math.max(b.min, b.minUse ?? 0) || grams > max) return null;
  const subs = food.id === OIL.id ? undefined : substitutesFor({ food, grams, role }, at.kind, at.pools, at.kcalTarget, at.adapt);
  return toItem(food, grams, item.role, subs);
}

/** Rescales one item to new grams (practical step), keeping its substitutes equivalent; values from the catalog. */
export function rescaleItem(item: PlanMealItem, grams: number): PlanMealItem {
  const food = fitlabById(item.foodId);
  if (!food) return item;
  const ratio = grams / item.grams;
  const subs = item.substitutes?.map((s) => {
    const sf = fitlabById(s.foodId);
    const step = sf ? (UNITS[sf.name]?.grams ?? 5) : 5;
    const g = Math.max(step, Math.round((s.grams * ratio) / step) * step);
    return sf ? { ...s, grams: g, quantityLabel: sf.sub === 'Latte' || sf.sub === 'Bevande vegetali' ? `${g} ml` : formatFoodQuantity(sf.id, g) } : s;
  });
  return toItem(food, grams, item.role ?? 'extra', subs);
}

/** A plan item: grams, energy and macros all from the catalog row (the single source of nutritional values). */
export function toItem(food: FitLabFood, grams: number, role: NonNullable<PlanMealItem['role']>, substitutes?: PlanMealItem['substitutes']): PlanMealItem {
  const k = grams / 100;
  return {
    name: food.name,
    grams,
    kcal: Math.round(food.kcal * k),
    protein: r1(food.p * k),
    carbs: r1(food.c * k),
    fats: r1(food.f * k),
    fiber: r1(food.fib * k),
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
function substitutesFor(item: { food: FitLabFood; grams: number; role: Role }, kind: SlotKind, pools: FitLabPools, kcalTarget: number, adapt?: MealAdaptations): PlanMealItem['substitutes'] {
  const isMain = kind === 'lunch' || kind === 'dinner';
  if (item.role === 'veg') {
    if (!isMain) return undefined;
    const out = CONTORNI_SWAPS.filter((f) => f.id !== item.food.id && pools.allowed(f))
      .slice(0, 4)
      .map((f) => {
        const grams = vegGrams(f, 1, kind, kcalTarget, adapt);
        return { name: f.name, grams, foodId: f.id, quantityLabel: formatFoodQuantity(f.id, grams) };
      });
    return out.length > 0 ? out : undefined;
  }
  const nutrient = NUTRIENT[item.role];
  if (!nutrient) return undefined;
  const wanted = (item.food[nutrient] * item.grams) / 100;
  const wantedKcal = (item.food.kcal * item.grams) / 100;
  const kcalTol = NUTRITION_PARAMS.validation.substituteKcalShare;
  // An equivalent swap keeps the role's nutrient AND the energy: the portion is the practical step that best
  // balances the two, and a food that cannot stay within ±25% of the nutrient and ±kcalTol of the energy is
  // not offered (salmon for chicken breast at equal protein would add half the calories again).
  const sized = (foods: FitLabFood[]): NonNullable<PlanMealItem['substitutes']> => {
    const out: NonNullable<PlanMealItem['substitutes']> = [];
    const farther: { f: FitLabFood; grams: number; off: number }[] = [];
    for (const f of foods) {
      if (out.length >= MAX_SWAPS) break;
      if (f[nutrient] < 1) continue;
      const b = item.role === 'carb' && isMain ? primoBounds(f, kcalTarget) : portionBounds(f, item.role);
      let best: { grams: number; err: number; nut: number; kcal: number } | null = null;
      for (let g = Math.max(b.min, b.step); g <= b.max + 1e-6; g += b.step) {
        const nut = (f[nutrient] * g) / 100 / Math.max(wanted, 1e-6) - 1;
        const kcal = (f.kcal * g) / 100 / Math.max(wantedKcal, 1e-6) - 1;
        const err = Math.abs(nut) + Math.abs(kcal);
        if (!best || err < best.err) best = { grams: Math.round(g), err, nut, kcal };
      }
      if (!best) continue;
      if (wanted >= 4 && Math.abs(best.nut) > 0.25) continue;
      if (wantedKcal >= 40 && Math.abs(best.kcal) > kcalTol) {
        farther.push({ f, grams: best.grams, off: Math.abs(best.kcal) });
        continue;
      }
      out.push({ name: f.name, grams: best.grams, foodId: f.id, quantityLabel: formatFoodQuantity(f.id, best.grams) });
    }
    // with no equivalent swap at all, the closest one in energy is still offered (the validator reports it
    // with the difference), so no food is left without an alternative
    for (const x of farther.sort((a, b) => a.off - b.off)) {
      // (proteins swap by protein: a lean food such as canned tuna has no swap within the energy tolerance)
      if (out.length >= 1 || x.off > NUTRITION_PARAMS.validation.substituteFallbackShare * (item.role === 'protein' ? 1.5 : 1)) break;
      out.push({ name: x.f.name, grams: x.grams, foodId: x.f.id, quantityLabel: formatFoodQuantity(x.f.id, x.grams) });
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
const vegGrams = (food: FitLabFood, sides: number, kind: SlotKind, kcalTarget: number, adapt?: MealAdaptations): number => {
  const base = VEG_GRAMS[food.name] ?? 150;
  const main = kind === 'lunch' || kind === 'dinner';
  const volume = main && adapt?.highVolume ? 1.5 : main && adapt?.energyDense ? 0.6 : 1;
  const factor = (kind === 'snack' || kind === 'breakfast' ? 0.6 : 1) * (sides > 1 ? 0.8 : 1) * (kcalTarget < 350 ? 0.7 : 1) * volume;
  return Math.max(30, Math.round((base * factor) / 10) * 10);
};

// ------------------------------------------------------------------ builder --

type Solved = { vars: PortionVar[]; total: Macros; error: number; score: number };
type Fixed = { food: FitLabFood; grams: number; kind: 'veg' | 'spread' | 'accessory' };

/** How many different recipes this person can have in a slot (regime, allergies, exclusions applied). */
export function slotPoolSize(kind: SlotKind, slotId: string, pools: FitLabPools): number {
  const day: DayState = { eggGrams: 0, families: new Set(), dishes: new Set() };
  const week: WeekUsage = { dish: new Map(), food: new Map(), slot: new Map() };
  return new Set(candidateDishes(kind, slotId, pools, 0, day, week).map((c) => c.r.dish.id)).size;
}

export function buildFitLabMeal(args: { kind: SlotKind; slotId: string; target: Macros; pools: FitLabPools; seed: number; day: DayState; week: WeekUsage; adapt?: MealAdaptations }): BuiltMeal {
  const { kind, slotId, target, pools, seed, day, week, adapt } = args;
  const kcalTarget = kcalOfMacros(target);
  const candidates = candidateDishes(kind, slotId, pools, seed, day, week, adapt);
  if (candidates.length === 0) throw new Error(`No dish can be built for ${kind}`);
  const isMain = kind === 'lunch' || kind === 'dinner';
  const eggRoom = Math.max(200 - day.eggGrams, 0);

  const rank = (foods: FitLabFood[], role: Role, n: number) => sortedBy(foods, (f) => foodCost(f, role, kind, seed, pools, day, week, adapt)).slice(0, n);

  let best: (Solved & { cand: Candidate; picks: Picks; fixed: Fixed[] }) | null = null;

  // lunch and dinner: every primo is tried (they are few), so the best fit for the person's secondi is never left out
  // the recipes are fixed, so more of them are tried: the one whose foods fit the person's macros best wins
  for (const cand of candidates.slice(0, isMain ? 12 : 8)) {
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
    const optional = fatTop.length === 0 && cand.optionalFat.length > 0 ? rank(cand.optionalFat, 'fat', 2) : [];
    const fatOptions: FitLabFood[][] = fatTop.length > 0 ? fatTop.map((f) => [f]) : [[], ...optional.map((f) => [f])];

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
                const g = vegGrams(s, nVeg, kind, kcalTarget, adapt);
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
            if (cand.oil) {
              const ob = oilBounds(kcalTarget);
              vars.push({ food: OIL, role: 'fat', ...ob, max: adapt?.energyDense ? ob.max + 5 : ob.max, grams: 0 });
            }
            for (const f of fats) {
              const pb = portionBounds(f, 'fat', { bigMeal: kcalTarget > 900 });
              vars.push({ food: f, role: 'fat', ...pb, min: cand.r.dish.fatRequired || optional.includes(f) ? pb.minUse : pb.min, grams: 0 });
            }
            if (vars.length === 0) continue;

            // The meal's energy is the catalog (label) energy, fibre included (2 kcal/g). The solver works on
            // protein, carbs and fats: a second pass takes the fibre's energy off the carbohydrate target, so the
            // label calories land on the meal's share of the day instead of above it on fibre-rich meals.
            let solved = solvePortions(fixedMacros, vars, target);
            const fibreOf = (xs: { food: FitLabFood; grams: number }[]) => xs.reduce((sum, x) => sum + (x.food.fib * x.grams) / 100, 0);
            const fib = fibreOf([...fixed, ...solved.vars]);
            if (fib >= 1) solved = solvePortions(fixedMacros, vars, { ...target, carbs: Math.max(target.carbs - fib / 2, 0) });
            const labelKcal = [...fixed, ...solved.vars].reduce((sum, x) => sum + (x.food.kcal * x.grams) / 100, 0);
            const kcalOff = Math.abs(labelKcal - kcalTarget) / Math.max(kcalTarget, 1);
            const fruit = sides.find((s) => s.category === 'Frutta');
            const picks: Picks = { base: bf ?? undefined, protein: pf ?? undefined, sides, fat: fats[0], spread: spreadPick ?? undefined, fruit };
            const variety =
              cand.cost +
              (pf ? foodCost(pf, 'protein', kind, seed, pools, day, week, adapt) : 0) +
              (bf ? foodCost(bf, 'carb', kind, seed, pools, day, week, adapt) * 0.7 : 0) +
              fats.reduce((sum, f) => sum + foodCost(f, 'fat', kind, seed, pools, day, week, adapt) * 0.4, 0) +
              sides.reduce((sum, s) => sum + foodCost(s, s.category === 'Frutta' ? 'fruit' : 'veg', kind, seed, pools, day, week, adapt) * 0.5, 0);
            const proteinShort = Math.max(target.protein - solved.total.protein, 0);
            const name = recipeNameFor(cand.r.dish, { base: bf ?? undefined, protein: pf ?? undefined, sides, fat: fats[0], spread: spreadPick ?? undefined });
            const repeats =
              (adapt?.simplify && !isMain ? 0 : repeatPenalty(used(week.slot, `${slotId}|name|${name}`), 70, 600)) +
              (pf ? repeatPenalty(used(week.slot, `${slotId}|food|${pf.id}`), 10, 300) : 0) +
              (bf ? repeatPenalty(used(week.slot, `${slotId}|food|${bf.id}`), 0, 40) : 0);
            const score = solved.error / 6 + variety + kcalOff * 500 + proteinShort * 8 + repeats;
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

  const sub = (v: { food: FitLabFood; grams: number; role: Role }) => substitutesFor(v, kind, pools, kcalTarget, adapt);
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
    if (v.role === 'protein' && (kind === 'lunch' || kind === 'dinner')) week.food.set(`cat|${proteinCategory(v.food)}`, used(week.food, `cat|${proteinCategory(v.food)}`) + 1);
    if (v.food.name === 'Uova intere') day.eggGrams += v.grams;
    if (v.food.sub === 'Legumi') day.families.add('legumes');
    if (isCured(v.food)) week.food.set(CURED_KEY, used(week.food, CURED_KEY) + 1);
  }
  for (const f of chosen.fixed) if (f.kind === 'veg') week.food.set(f.food.id, used(week.food, f.food.id) + 1);

  const flavorings = dish.aromas.filter((a) => pools.allowed(foodByName(a)));
  void total;
  return { items, recipe: { name: recipeName, flavorings, portable: dish.portable, dishId: dish.id } };
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
