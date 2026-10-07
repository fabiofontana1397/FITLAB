/**
 * Does the diet follow the Fit Lab framework (src/lib/planning/fitlab)? Where checks.ts verifies the
 * numbers (calories, macros, portions), these verify the structure: foods belong to the slot's
 * catalog, snacks need no cooking, main meals have vegetables, every meal is a named dish, the same
 * protein does not repeat within a day, the week is varied, and substitutions are nutritionally sound.
 * They are written independently of the planner (they only read the produced plan and the catalog).
 */
import { findFood } from '@/lib/mock/food-database';
import { CATALOG, FALLBACK, SLOT_KIND, type SlotKind } from '@/lib/planning/fitlab/catalog';
import { DISHES } from '@/lib/planning/fitlab/dishes';
import { familyOf } from '@/lib/planning/fitlab/pools';
import type { DietPlan } from '@/lib/planning/types';

import type { Finding } from './checks';
import type { Persona } from './personas';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const DAIRY_OR_SUPPLEMENT = new Set(['greek-yogurt-0', 'skyr', 'yogurt-protein', 'kefir', 'whey-protein', 'protein-pudding', 'protein-bar', 'protein-drink', 'milk-lactose-free']);
const NO_COOK_SNACK_FORBIDDEN = new Set(['chicken-breast', 'turkey-breast', 'beef-lean', 'salmon', 'cod', 'sea-bream', 'shrimp', 'eggs', 'pasta', 'rice-basmati', 'potato', 'polenta-cooked']);
const VEG_IDS = new Set(['zucchini', 'broccoli', 'spinach', 'carrot', 'cherry-tomato', 'tomato', 'bell-pepper-red', 'eggplant', 'mixed-salad', 'cauliflower', 'green-beans']);

const catalogOf = (kind: SlotKind) => new Set([...Object.values(CATALOG[kind]).flat(), ...Object.values(FALLBACK[kind]).flat()]);

/** Static check of the recipe library itself (run once). */
export function checkDishLibrary(): Finding[] {
  const f: Finding[] = [];
  for (const dish of DISHES) {
    for (const kind of dish.kinds) {
      const catalog = catalogOf(kind);
      const ids = [...dish.protein, ...(dish.meatlessProtein ?? []), ...dish.carb, ...(dish.fat ?? []), ...(dish.veg ?? []), ...(dish.fruit ?? [])];
      const outside = ids.filter((id) => !catalog.has(id));
      if (outside.length > 0) f.push({ level: 'FAIL', area: 'dieta', code: 'Q0', message: `Piatto "${dish.id}" (${kind}) usa alimenti fuori dal catalogo Fit Lab: ${outside.join(', ')}` });
      const missing = ids.filter((id) => !findFood(id));
      if (missing.length > 0) f.push({ level: 'FAIL', area: 'dieta', code: 'Q0', message: `Piatto "${dish.id}" usa alimenti non presenti nel database: ${missing.join(', ')}` });
    }
    if (dish.kinds.includes('snack') && [...dish.protein, ...dish.carb].some((id) => NO_COOK_SNACK_FORBIDDEN.has(id))) {
      f.push({ level: 'FAIL', area: 'dieta', code: 'Q0', message: `Lo spuntino "${dish.id}" richiede cottura` });
    }
  }
  return f;
}

export function checkDietQuality(persona: Persona, diet: DietPlan): Finding[] {
  const f: Finding[] = [];
  const fail = (code: string, message: string, level: Finding['level'] = 'FAIL') => f.push({ level, area: 'dieta', code, message });
  void persona;

  for (const month of diet.months) {
    const slotRecipes = new Map<string, Map<string, number>>();
    for (const [dayIdx, day] of month.weeklySplit.entries()) {
      const families = new Map<string, number>();
      const mainFamilies = new Map<string, number>();
      for (const meal of day.meals) {
        if (meal.isFreeMeal) continue;
        const kind = SLOT_KIND[meal.slotId as keyof typeof SLOT_KIND];
        const where = `mese ${month.monthIndex}, ${WEEKDAYS[dayIdx]} ${meal.label}`;
        if (!meal.recipe?.name) fail('Q1', `Nessun nome di piatto (${where})`);
        const catalog = catalogOf(kind);
        for (const item of meal.items) {
          if (!catalog.has(item.foodId)) fail('Q2', `${item.name} non fa parte del catalogo del pasto (${where})`);
          if ((kind === 'lunch' || kind === 'dinner') && DAIRY_OR_SUPPLEMENT.has(item.foodId)) fail('Q3', `${item.name} a ${meal.label.toLowerCase()} (${where})`);
          if (kind === 'snack' && NO_COOK_SNACK_FORBIDDEN.has(item.foodId)) fail('Q4', `Spuntino che richiede cottura: ${item.name} (${where})`);
        }
        if (kind === 'lunch' || kind === 'dinner') {
          if (!meal.items.some((i) => VEG_IDS.has(i.foodId))) fail('Q5', `Manca la verdura (${where})`);
          if (!meal.items.some((i) => findFood(i.foodId)?.category === 'carboidrati' || findFood(i.foodId)?.category === 'legumi')) fail('Q5', `Manca il carboidrato (${where})`);
        }
        // the main protein source of the meal counts once for the day's "same protein" rule
        const main = meal.items.find((i) => ['proteine', 'latticini', 'legumi'].includes(findFood(i.foodId)?.category ?? ''));
        if (main) {
          families.set(familyOf(main.foodId), (families.get(familyOf(main.foodId)) ?? 0) + 1);
          if (kind === 'lunch' || kind === 'dinner') mainFamilies.set(familyOf(main.foodId), (mainFamilies.get(familyOf(main.foodId)) ?? 0) + 1);
        }

        const byRecipe = slotRecipes.get(meal.slotId) ?? new Map<string, number>();
        byRecipe.set(meal.recipe?.name ?? '?', (byRecipe.get(meal.recipe?.name ?? '?') ?? 0) + 1);
        slotRecipes.set(meal.slotId, byRecipe);

        // substitutions must deliver about the same of the nutrient the item is there for
        for (const item of meal.items) {
          const food = findFood(item.foodId);
          if (!food || !item.substitutes) continue;
          const role = food.category === 'legumi' ? 'kcal100' : food.category === 'carboidrati' || food.category === 'frutta' ? 'carbs100' : food.category === 'grassi' ? 'fats100' : 'protein100';
          const original = (food[role] * item.grams) / 100;
          for (const s of item.substitutes) {
            const sf = findFood(s.foodId);
            if (!sf || original < 4) continue;
            const got = (sf[role] * s.grams) / 100;
            if (Math.abs(got / original - 1) > 0.3) fail('Q8', `Sostituzione ${item.name} → ${s.name}: ${got.toFixed(0)} g contro ${original.toFixed(0)} g del nutriente (${where})`, 'WARN');
          }
        }
      }
      // lunch and dinner must not share a protein; snacks and breakfast share families only when the catalog leaves no choice (a note)
      const mainRepeated = [...mainFamilies.entries()].filter(([, n]) => n > 1);
      if (mainRepeated.length > 0) fail('Q6', `${WEEKDAYS[dayIdx]} (mese ${month.monthIndex}): stessa fonte proteica a pranzo e cena (${mainRepeated.map(([k]) => k).join(', ')})`, 'WARN');
      else if ([...families.values()].some((n) => n > 2)) fail('Q6', `${WEEKDAYS[dayIdx]} (mese ${month.monthIndex}): una fonte proteica compare tre volte nel giorno`, 'INFO');
    }
    for (const [slot, recipes] of slotRecipes) {
      const total = [...recipes.values()].reduce((a, b) => a + b, 0);
      const top = Math.max(...recipes.values());
      if ((slot === 'pranzo' || slot === 'cena') && total >= 5 && (recipes.size < 4 || top > 2)) fail('Q7', `${slot} (mese ${month.monthIndex}): solo ${recipes.size} piatti diversi in ${total} giorni (il più ripetuto ${top} volte)`, 'WARN');
    }
  }
  return f;
}
