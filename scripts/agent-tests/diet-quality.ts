/**
 * Does the diet follow the Fit Lab framework (src/lib/planning/fitlab)? Where checks.ts verifies the
 * numbers (calories, macros, portions), these verify the structure: snacks need no cooking, main meals have
 * vegetables, every meal is a named dish, the same protein does not repeat within a day, the week is varied
 * (no meal more than 3 times), and substitutions are nutritionally sound. They are written independently of
 * the planner (they only read the produced plan and the catalog).
 */
import { SLOT_KIND, type SlotKind } from '@/lib/planning/fitlab/catalog';
import { DISHES } from '@/lib/planning/fitlab/dishes';
import { fitlabById, FITLAB_FOODS, type FitLabFood } from '@/lib/planning/fitlab/foods';
import { familyOf } from '@/lib/planning/fitlab/pools';
import type { DietPlan } from '@/lib/planning/types';

import type { Finding } from './checks';
import type { Persona } from './personas';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const DAIRY_DRINKS = new Set(['Yogurt greco 0%', 'Yogurt greco 2%', 'Yogurt magro', 'Yogurt proteico', 'Skyr', 'Kefir', 'Budino proteico', 'Barretta proteica', 'Bevanda proteica', 'Latte vaccino', 'Latte senza lattosio']);
// a snack is assembled, not cooked: no raw meat/fish, no pasta, rice, potatoes, polenta or couscous to boil
const COOKED_SUBS = new Set(['Carni bianche', 'Carni rosse', 'Carni suine', 'Preparazioni di carne', 'Preparazioni di pesce', 'Pesce', 'Crostacei', 'Pasta e derivati', 'Cereali', 'Pseudocereali', 'Tuberi']);
const COOKED_NAMES = new Set(['Polenta', 'Cous cous']);
const NO_COOK_OK = new Set(['Tonno al naturale']);
const needsCooking = (f: FitLabFood) => (COOKED_SUBS.has(f.sub) || COOKED_NAMES.has(f.name)) && !NO_COOK_OK.has(f.name);

/** Static check of the recipe library itself (run once). */
export function checkDishLibrary(): Finding[] {
  const f: Finding[] = [];
  const fail = (message: string) => f.push({ level: 'FAIL', area: 'dieta', code: 'Q0', message });
  const ids = new Set<string>();
  for (const dish of DISHES) {
    if (ids.has(dish.id)) fail(`Piatto duplicato: ${dish.id}`);
    ids.add(dish.id);
    const foods = (names?: string[]) => (names ?? []).map((n) => FITLAB_FOODS.find((x) => x.name === n)).filter((x): x is FitLabFood => !!x);
    if (dish.kinds.includes('snack')) {
      const cooked = [...foods(dish.base), ...foods(dish.protein)].filter(needsCooking);
      if (cooked.length > 0) fail(`Lo spuntino "${dish.id}" (${dish.name}) richiede cottura: ${cooked.map((x) => x.name).join(', ')}`);
    }
    if (dish.kinds.some((k) => k === 'lunch' || k === 'dinner')) {
      if ((dish.sides ?? []).length === 0) fail(`Il piatto "${dish.id}" (${dish.name}) non ha verdure di contorno`);
      const dairy = foods(dish.protein).filter((x) => DAIRY_DRINKS.has(x.name));
      if (dairy.length > 0) fail(`Il piatto "${dish.id}" usa a pranzo/cena: ${dairy.map((x) => x.name).join(', ')}`);
    }
  }
  const nutritionMissing = FITLAB_FOODS.filter((x) => !(x.kcal > 0) && x.f + x.p + x.c < 0.1 && x.name !== 'Aceto');
  if (nutritionMissing.length > 0) fail(`Alimenti senza valori nutrizionali: ${nutritionMissing.map((x) => x.name).join(', ')}`);
  return f;
}

export function checkDietQuality(persona: Persona, diet: DietPlan): Finding[] {
  const f: Finding[] = [];
  const fail = (code: string, message: string, level: Finding['level'] = 'FAIL') => f.push({ level, area: 'dieta', code, message });
  void persona;

  for (const month of diet.months) {
    const slotRecipes = new Map<string, Map<string, number>>();
    const slotDishes = new Map<string, Map<string, number>>();
    const slotFoods = new Map<string, Map<string, number>>();
    for (const [dayIdx, day] of month.weeklySplit.entries()) {
      const families = new Map<string, number>();
      const mainFamilies = new Map<string, number>();
      for (const meal of day.meals) {
        if (meal.isFreeMeal) continue;
        const kind: SlotKind = SLOT_KIND[meal.slotId as keyof typeof SLOT_KIND];
        const where = `mese ${month.monthIndex}, ${WEEKDAYS[dayIdx]} ${meal.label}`;
        if (!meal.recipe?.name) fail('Q1', `Nessun nome di piatto (${where})`);
        const foods = meal.items.map((i) => ({ item: i, food: fitlabById(i.foodId) }));
        for (const { item, food } of foods) {
          if (!food) {
            fail('Q2', `${item.name} non è un alimento del catalogo Fit Lab (${where})`);
            continue;
          }
          if ((kind === 'lunch' || kind === 'dinner') && DAIRY_DRINKS.has(food.name)) fail('Q3', `${food.name} a ${meal.label.toLowerCase()} (${where})`);
          if (kind === 'snack' && needsCooking(food)) fail('Q4', `Spuntino che richiede cottura: ${food.name} (${where})`);
        }
        if (kind === 'lunch' || kind === 'dinner') {
          if (!foods.some(({ food }) => food?.category === 'Verdure')) fail('Q5', `Manca la verdura (${where})`);
          if (!foods.some(({ food }) => food?.category === 'Carboidrati' || food?.sub === 'Legumi')) fail('Q5', `Manca il carboidrato (${where})`);
        }
        // the main protein source of the meal counts once for the day's "same protein" rule
        const main = foods.find(({ food }) => food?.category === 'Proteine')?.food;
        if (main) {
          families.set(familyOf(main), (families.get(familyOf(main)) ?? 0) + 1);
          if (kind === 'lunch' || kind === 'dinner') mainFamilies.set(familyOf(main), (mainFamilies.get(familyOf(main)) ?? 0) + 1);
        }

        const name = meal.recipe?.name ?? '?';
        const byRecipe = slotRecipes.get(meal.slotId) ?? new Map<string, number>();
        byRecipe.set(name, (byRecipe.get(name) ?? 0) + 1);
        slotRecipes.set(meal.slotId, byRecipe);
        const dishKey = meal.recipe?.dishId ?? '?';
        const byDish = slotDishes.get(meal.slotId) ?? new Map<string, number>();
        byDish.set(dishKey, (byDish.get(dishKey) ?? 0) + 1);
        slotDishes.set(meal.slotId, byDish);
        if (main) {
          const byFood = slotFoods.get(meal.slotId) ?? new Map<string, number>();
          byFood.set(main.name, (byFood.get(main.name) ?? 0) + 1);
          slotFoods.set(meal.slotId, byFood);
        }

        // substitutions must deliver about the same of the nutrient the item is there for
        for (const { item, food } of foods) {
          if (!food || !item.substitutes) continue;
          const nutrient = item.role === 'carb' || item.role === 'fruit' ? 'c' : item.role === 'fat' ? 'f' : 'p';
          const original = (food[nutrient] * item.grams) / 100;
          for (const s of item.substitutes) {
            const sf = fitlabById(s.foodId);
            if (!sf || original < 4) continue;
            const got = (sf[nutrient] * s.grams) / 100;
            if (Math.abs(got / original - 1) > 0.3) fail('Q8', `Sostituzione ${item.name} → ${s.name}: ${got.toFixed(0)} contro ${original.toFixed(0)} del nutriente (${where})`, 'WARN');
          }
        }
      }
      // lunch and dinner must not share a protein; snacks and breakfast share families only when the catalog leaves no choice (a note)
      const mainRepeated = [...mainFamilies.entries()].filter(([, n]) => n > 1);
      if (mainRepeated.length > 0) fail('Q6', `${WEEKDAYS[dayIdx]} (mese ${month.monthIndex}): stessa fonte proteica a pranzo e cena (${mainRepeated.map(([k]) => fitlabById(k)?.name ?? k).join(', ')})`, 'WARN');
      else if ([...families.values()].some((n) => n > 2)) fail('Q6', `${WEEKDAYS[dayIdx]} (mese ${month.monthIndex}): una fonte proteica compare tre volte nel giorno`, 'INFO');
    }
    // weekly variety, slot by slot: the same dish or the same meal must not come back more than 3 times in a week
    for (const [slot, recipes] of slotRecipes) {
      const total = [...recipes.values()].reduce((x, y) => x + y, 0);
      const top = [...recipes.entries()].sort((x, y) => y[1] - x[1])[0];
      const where = `${slot} (mese ${month.monthIndex})`;
      if (top && top[1] > 3) fail('Q7', `${where}: "${top[0]}" compare ${top[1]} volte in una settimana`);
      else if (top && top[1] > 2 && total >= 5) fail('Q7', `${where}: "${top[0]}" compare 3 volte in una settimana`, 'INFO');
      if (total >= 5 && recipes.size < 4) fail('Q7', `${where}: solo ${recipes.size} pasti diversi in ${total} giorni`, 'WARN');
    }
    for (const [slot, dishes] of slotDishes) {
      const total = [...dishes.values()].reduce((x, y) => x + y, 0);
      const top = [...dishes.entries()].sort((x, y) => y[1] - x[1])[0];
      if (top && top[1] > 3 && total >= 5) fail('Q9', `${slot} (mese ${month.monthIndex}): la stessa preparazione (${top[0]}) torna ${top[1]} volte in una settimana`);
    }
    for (const [slot, foods] of slotFoods) {
      const top = [...foods.entries()].sort((x, y) => y[1] - x[1])[0];
      if (top && top[1] > 3) fail('Q9', `${slot} (mese ${month.monthIndex}): la stessa proteina (${top[0]}) torna ${top[1]} volte in una settimana`, 'WARN');
    }
  }
  return f;
}
