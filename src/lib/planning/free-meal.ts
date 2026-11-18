/**
 * Free meal engine. A free (or eaten-out) meal is planned with a calorie budget only: its macros are NOT known
 * and are never shown or counted as zero. When the person logs what they ate, the meal gets a value whose
 * origin is always stated:
 *
 *   measured       foods and grams → catalog values (the only "measured" case)
 *   estimated      foods named in a description, without quantities → standard portions of those foods,
 *                  scaled to the stated calories when given (method written in the log)
 *   calories_only  calories stated, foods not recognised in the catalog → calories known, macros unavailable
 *
 * A description with neither recognised foods nor calories is not enough: the meal stays unlogged (the day is
 * "partially observed"). No food outside the catalog is ever given invented values.
 */
import { foodsNamedIn } from '@/domain/nutrition/monitoring';

import { UNITS } from './fitlab/catalog';
import { fitlabById, type FitLabFood } from './fitlab/foods';
import { toItem } from './fitlab/meal-builder';
import { portionBounds } from './fitlab/solver';
import type { DietPlan, PlanMeal, PlanMealItem } from './types';

export type FreeMealLogInput = {
  /** Calories the person states (e.g. from a label or a menu). */
  kcal?: number;
  /** What they ate, in words ("pasta al pomodoro e una mela"). */
  description?: string;
  /** Foods and grams, when known (from the food search). */
  items?: { foodId: string; grams: number }[];
};

export type FreeMealLog = NonNullable<PlanMeal['freeMealLog']>;

const ROLE_OF: Record<FitLabFood['category'], NonNullable<PlanMealItem['role']>> = {
  Proteine: 'protein',
  Carboidrati: 'carb',
  Grassi: 'fat',
  Verdure: 'veg',
  Frutta: 'fruit',
  'Condimenti e aromi': 'extra',
};

/** A standard portion of a food: one unit for counted foods, otherwise the middle of its usual portion range. */
export function standardPortion(food: FitLabFood): number {
  const unit = UNITS[food.name];
  if (unit) return unit.grams;
  const role = ROLE_OF[food.category];
  if (role === 'veg') return 150;
  if (role === 'extra') return 10;
  const b = portionBounds(food, role === 'fruit' ? 'fruit' : role);
  return Math.max(b.step, Math.round((b.min + b.max) / 2 / b.step) * b.step);
}

const sum = (items: PlanMealItem[]) =>
  items.reduce((a, i) => ({ protein: a.protein + (i.protein ?? 0), carbs: a.carbs + (i.carbs ?? 0), fats: a.fats + (i.fats ?? 0), fiber: a.fiber + (i.fiber ?? 0), kcal: a.kcal + i.kcal }), { protein: 0, carbs: 0, fats: 0, fiber: 0, kcal: 0 });
const r1 = (x: number) => Math.round(x * 10) / 10;

/** Builds the log of a free meal from what the person reports, or explains why it cannot. */
export function buildFreeMealLog(input: FreeMealLogInput): { ok: true; log: FreeMealLog } | { ok: false; reason: string } {
  const statedKcal = input.kcal != null && Number.isFinite(input.kcal) && input.kcal > 0 ? Math.round(input.kcal) : undefined;
  // 1) foods and grams: measured
  const measured = (input.items ?? []).filter((x) => x.grams > 0).map((x) => ({ food: fitlabById(x.foodId), grams: x.grams }));
  if (measured.length > 0) {
    if (measured.some((x) => !x.food)) return { ok: false, reason: 'uno o più alimenti non sono nel catalogo: registra le calorie o scegli un alimento del catalogo' };
    const items = measured.map((x) => toItem(x.food!, x.grams, ROLE_OF[x.food!.category]));
    const t = sum(items);
    const note = statedKcal && Math.abs(statedKcal / t.kcal - 1) > 0.15 ? ` Le calorie dichiarate (${statedKcal}) differiscono da quelle calcolate (${t.kcal}): vale il calcolo sugli alimenti.` : '';
    return {
      ok: true,
      log: { status: 'measured', kcal: t.kcal, macros: { protein: r1(t.protein), carbs: r1(t.carbs), fats: r1(t.fats), fiber: r1(t.fiber) }, items, description: input.description, method: `Calcolato sui valori del catalogo per alimenti e grammi registrati.${note}` },
    };
  }
  // 2) a description: catalog foods named in it, at standard portions
  const named = [...foodsNamedIn((input.description ?? '').toLowerCase())].map((id) => fitlabById(id)).filter((f): f is FitLabFood => !!f);
  if (named.length > 0) {
    let items = named.map((f) => toItem(f, standardPortion(f), ROLE_OF[f.category]));
    const base = sum(items);
    let method = `Stima: porzioni standard di ${named.map((f) => f.name.toLowerCase()).join(', ')} (alimenti riconosciuti nella descrizione).`;
    if (statedKcal && base.kcal > 0) {
      const k = statedKcal / base.kcal;
      items = named.map((f) => toItem(f, Math.max(5, Math.round((standardPortion(f) * k) / 5) * 5), ROLE_OF[f.category]));
      method = `Stima: porzioni standard di ${named.map((f) => f.name.toLowerCase()).join(', ')}, scalate alle ${statedKcal} kcal dichiarate (le proporzioni tra gli alimenti sono ipotizzate).`;
    }
    const t = sum(items);
    return { ok: true, log: { status: 'estimated', kcal: statedKcal ?? t.kcal, macros: { protein: r1(t.protein), carbs: r1(t.carbs), fats: r1(t.fats), fiber: r1(t.fiber) }, items, description: input.description, method } };
  }
  // 3) calories only: known energy, unknown macros
  if (statedKcal) {
    return {
      ok: true,
      log: { status: 'calories_only', kcal: statedKcal, description: input.description, method: input.description ? 'Calorie dichiarate; gli alimenti descritti non sono nel catalogo: macro non disponibili.' : 'Calorie dichiarate; macro non disponibili.' },
    };
  }
  return { ok: false, reason: 'servono le calorie o almeno un alimento riconoscibile: senza, il pasto resta non registrato e la giornata parzialmente osservata' };
}

/** Records the log on the plan's free meal of that day (immutable update). */
export function logFreeMeal(plan: DietPlan, at: { monthIndex: number; dayIndex: number; slotId: string }, input: FreeMealLogInput): { ok: true; plan: DietPlan; log: FreeMealLog } | { ok: false; reason: string } {
  const month = plan.months.find((m) => m.monthIndex === at.monthIndex);
  const day = month?.weeklySplit[at.dayIndex];
  const mealIdx = day?.meals.findIndex((m) => m.slotId === at.slotId) ?? -1;
  if (!month || !day || mealIdx < 0) return { ok: false, reason: 'pasto non trovato' };
  if (!day.meals[mealIdx].isFreeMeal) return { ok: false, reason: 'non è un pasto libero o fuori casa' };
  const built = buildFreeMealLog(input);
  if (!built.ok) return built;
  const meals = day.meals.map((m, i) => (i === mealIdx ? { ...m, freeMealLog: built.log } : m));
  const weeklySplit = month.weeklySplit.map((d, i) => (i === at.dayIndex ? { ...d, meals } : d));
  return { ok: true, log: built.log, plan: { ...plan, months: plan.months.map((m) => (m === month ? { ...month, weeklySplit } : m)) } };
}
