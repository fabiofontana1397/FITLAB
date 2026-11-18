/**
 * Module F — Validation. Nutritional, mathematical, structural and variety checks of a generated diet month,
 * and coherence checks of a monthly update. Three levels:
 *
 *   BLOCKER  the plan must not be published (safety, restrictions, substantial nutritional incoherence,
 *            missing or invalid values, calories outside the safety limits)
 *   WARNING  visible, with an explanation (variety, repetitions, moderate deviations, preferences not met)
 *   INFO     non-blocking suggestions
 *
 * Energy: the plan shows label energy (catalog kcal, fibre counted at 2 kcal/g). The check derives energy from
 * the macros with the EU factors (P 4, available carbohydrate 4, fat 9, fibre 2) and compares it with the
 * declared energy at item, meal, day and week level. Thresholds are in NUTRITION_PARAMS.validation.
 */
import { FITLAB_FOODS } from '@/lib/planning/fitlab/foods';
import { buildFitLabPools, familyOf, proteinCategory as proteinCategoryOf } from '@/lib/planning/fitlab/pools';
import { slotPoolSize } from '@/lib/planning/fitlab/meal-builder';
import { SLOT_KIND } from '@/lib/planning/fitlab/catalog';
import type { DietMonthPlan, PlanMeal } from '@/lib/planning/types';

import { proteinReferenceKg } from '../targets';
import type { UserContext } from '../user-context';

import { NUTRITION_PARAMS as P } from './params';
import { calorieLimits, SEX_FLOOR } from './safety';
import type { DecisionLog, DietAdaptations } from './types';

export type ValidationLevel = 'BLOCKER' | 'WARNING' | 'INFO';
export type ValidationIssue = { level: ValidationLevel; code: string; message: string };

const FOOD = new Map(FITLAB_FOODS.map((f) => [f.id, f]));
const V = P.validation;
const pct = (x: number) => `${x > 0 ? '+' : ''}${Math.round(x * 100)}%`;
const BASE_FOODS = new Set(['Pasta', 'Riso', 'Riso basmati', 'Olio extravergine di oliva', 'Pane integrale']);

/** Protein category of a food (for rotation): see lib/planning/fitlab/pools.ts. */
export const proteinCategory = (foodId: string) => proteinCategoryOf(FOOD.get(foodId));

/** Day nutrition as the person reads it: prescribed meals from their items, free / eaten-out meals at their budget. */
export function dayNutrition(meals: PlanMeal[]): { kcal: number; prescribedKcal: number; budgetKcal: number; protein: number; carbs: number; fats: number; fiber: number; derivedKcal: number; budgetShare: number } {
  let prescribedKcal = 0, budgetKcal = 0, protein = 0, carbs = 0, fats = 0, fiber = 0;
  for (const m of meals) {
    if (m.isFreeMeal) { budgetKcal += m.totalKcal; continue; }
    for (const i of m.items) {
      const food = FOOD.get(i.foodId);
      const k = i.grams / 100;
      prescribedKcal += i.kcal;
      protein += i.protein ?? (food ? food.p * k : NaN);
      carbs += i.carbs ?? (food ? food.c * k : NaN);
      fats += i.fats ?? (food ? food.f * k : NaN);
      fiber += i.fiber ?? (food ? food.fib * k : NaN);
    }
  }
  const kcal = prescribedKcal + budgetKcal;
  return { kcal, prescribedKcal, budgetKcal, protein, carbs, fats, fiber, derivedKcal: protein * 4 + carbs * 4 + fats * 9 + fiber * 2, budgetShare: kcal ? budgetKcal / kcal : 0 };
}

/** Variety metrics of a month (and against the previous month). Base foods (pasta, rice, oil…) are not counted as repetition. */
export function varietyMetrics(month: DietMonthPlan, previous?: DietMonthPlan) {
  const meals = month.weeklySplit.flatMap((d, di) => d.meals.map((m) => ({ ...m, di })));
  const dishCount = new Map<string, number>();
  let consecutiveSameRecipe = 0;
  for (const m of meals) if (m.recipe?.dishId) dishCount.set(`${m.slotId}|${m.recipe.dishId}`, (dishCount.get(`${m.slotId}|${m.recipe.dishId}`) ?? 0) + 1);
  for (let d = 1; d < month.weeklySplit.length; d++) {
    const today = month.weeklySplit[d].meals;
    const yesterday = new Set(month.weeklySplit[d - 1].meals.map((m) => `${m.slotId}|${m.recipe?.dishId}`));
    consecutiveSameRecipe += today.filter((m) => m.recipe?.dishId && yesterday.has(`${m.slotId}|${m.recipe.dishId}`) && (m.slotId === 'pranzo' || m.slotId === 'cena')).length;
  }
  const mainFood = new Map<string, number>();
  const proteinSources = new Map<string, number>();
  const categories = new Map<string, number>();
  for (const m of meals) {
    for (const i of m.items) {
      if ((i.role === 'protein' || i.role === 'carb') && !BASE_FOODS.has(i.name) && (m.slotId === 'pranzo' || m.slotId === 'cena')) mainFood.set(i.name, (mainFood.get(i.name) ?? 0) + 1);
      if (i.role === 'protein') {
        proteinSources.set(i.name, (proteinSources.get(i.name) ?? 0) + 1);
        const c = proteinCategory(i.foodId);
        categories.set(c, (categories.get(c) ?? 0) + 1);
      }
    }
  }
  const recipes = meals.filter((m) => m.recipe?.dishId).length;
  const distinctRecipes = new Set(meals.map((m) => m.recipe?.dishId).filter(Boolean)).size;
  let repeatedVsPrevious: number | null = null;
  if (previous) {
    const prev = new Set(previous.weeklySplit.flatMap((d) => d.meals.map((m) => `${m.slotId}|${m.recipe?.dishId}`)));
    const now = meals.filter((m) => m.recipe?.dishId);
    repeatedVsPrevious = now.filter((m) => prev.has(`${m.slotId}|${m.recipe!.dishId}`)).length / Math.max(1, now.length);
  }
  return {
    recipes,
    distinctRecipes,
    /** Meals whose recipe already appeared earlier in the week in the same slot. */
    repeatedMeals: recipes - dishCount.size,
    maxSameRecipe: Math.max(0, ...dishCount.values()),
    consecutiveSameRecipe,
    topMainFoods: [...mainFood.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    topProteins: [...proteinSources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
    proteinCategories: Object.fromEntries(categories),
    repeatedVsPrevious,
  };
}

export function validateDietMonth(
  month: DietMonthPlan,
  ctx: UserContext,
  opts: { expenditure?: number; previous?: DietMonthPlan; adapt?: DietAdaptations } = {}
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const M = `Mese ${month.monthIndex}`;
  const days = month.weeklySplit;
  const pools = buildFitLabPools(ctx.answers, opts.adapt);

  // ------------------------------------------------ values, single source of truth (item → meal)
  for (const d of days) {
    for (const m of d.meals) {
      if (m.isFreeMeal) {
        if (!(m.totalKcal > 0)) out.push({ level: 'BLOCKER', code: 'V0', message: `${M}, ${d.weekday}: ${m.label} senza budget calorico.` });
        continue;
      }
      if (m.items.length === 0) out.push({ level: 'BLOCKER', code: 'V0', message: `${M}, ${d.weekday}: ${m.label} senza alimenti.` });
      for (const i of m.items) {
        const food = FOOD.get(i.foodId);
        const values = [i.grams, i.kcal, i.protein, i.carbs, i.fats, i.fiber];
        if (!food || values.some((v) => v == null || !Number.isFinite(v) || v < 0) || i.grams <= 0) {
          out.push({ level: 'BLOCKER', code: 'V0', message: `${M}, ${d.weekday}, ${m.label}: ${i.name} con valori nutrizionali mancanti o non validi.` });
          continue;
        }
        const k = i.grams / 100;
        if (Math.abs(i.kcal - food.kcal * k) > 1.5 || Math.abs(i.protein! - food.p * k) > 0.2 || Math.abs(i.carbs! - food.c * k) > 0.2 || Math.abs(i.fats! - food.f * k) > 0.2)
          out.push({ level: 'BLOCKER', code: 'V5', message: `${M}, ${d.weekday}, ${m.label}: ${i.name} ${i.grams} g ha valori diversi dal catalogo (${i.kcal} kcal invece di ${Math.round(food.kcal * k)}).` });
        if (!pools.allowed(food)) out.push({ level: 'BLOCKER', code: 'V7', message: `${M}, ${d.weekday}, ${m.label}: ${i.name} non è ammesso (regime, allergie, intolleranze o esclusioni).` });
        if (opts.adapt?.dislikedFoodIds?.includes(food.id)) out.push({ level: 'BLOCKER', code: 'V13', message: `${M}, ${d.weekday}: ${i.name} è tra gli alimenti che l'utente ha chiesto di togliere.` });
        for (const s of i.substitutes ?? []) {
          const sf = FOOD.get(s.foodId);
          if (!sf || !pools.allowed(sf)) { out.push({ level: 'BLOCKER', code: 'V7', message: `${M}, ${d.weekday}: sostituto non ammesso (${s.name}) per ${i.name}.` }); continue; }
          const off = (sf.kcal * s.grams) / 100 / Math.max(i.kcal, 1) - 1;
          // side vegetables swap by portion: a difference of a few dozen kcal is not a change of the meal
          if (i.role !== 'veg' && Math.abs(off) > V.substituteKcalShare && Math.abs((sf.kcal * s.grams) / 100 - i.kcal) > 40)
            out.push({ level: 'WARNING', code: 'V14', message: `${M}, ${d.weekday}: il sostituto ${s.name} ${s.quantityLabel} cambia le calorie di ${i.name} del ${pct(off)}.` });
        }
      }
      const n = m.items.reduce((acc, i) => ({ kcal: acc.kcal + i.kcal, p: acc.p + (i.protein ?? 0), c: acc.c + (i.carbs ?? 0), f: acc.f + (i.fats ?? 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
      if (m.totalKcal !== n.kcal) out.push({ level: 'BLOCKER', code: 'V5', message: `${M}, ${d.weekday}, ${m.label}: calorie del pasto ${m.totalKcal} diverse dalla somma degli alimenti (${n.kcal}).` });
      if (m.macros && (Math.abs(m.macros.protein - n.p) > 1 || Math.abs(m.macros.carbs - n.c) > 1 || Math.abs(m.macros.fats - n.f) > 1))
        out.push({ level: 'BLOCKER', code: 'V5', message: `${M}, ${d.weekday}, ${m.label}: macro del pasto diversi dalla somma degli alimenti.` });
    }
  }

  // ------------------------------------------------ day targets and day energy
  const tKcal: number[] = [];
  const actual: number[] = [];
  for (const d of days) {
    const target = d.calorieTarget ?? month.calorieTarget;
    tKcal.push(target);
    const t = d.macroTargetsG ?? month.macroTargetsG;
    const tk = t.protein * 4 + t.carbs * 4 + t.fats * 9;
    if (Math.abs(tk - target) > Math.max(15, target * 0.015)) out.push({ level: 'BLOCKER', code: 'V1', message: `${M}, ${d.weekday}: i macro del target (P×4 + C×4 + G×9 = ${tk}) non tornano con ${target} kcal.` });
    const n = dayNutrition(d.meals);
    actual.push(n.kcal);
    if (![n.protein, n.carbs, n.fats, n.fiber].every(Number.isFinite)) continue;
    const dev = n.kcal / target - 1;
    if (Math.abs(dev) > V.dayBlockShare) out.push({ level: 'BLOCKER', code: 'V3', message: `${M}, ${d.weekday}: ${n.kcal} kcal contro ${target} di target (${pct(dev)}, limite ±${Math.round(V.dayBlockShare * 100)}%).` });
    else if (Math.abs(dev) > V.dayWarnShare) out.push({ level: 'WARNING', code: 'V3', message: `${M}, ${d.weekday}: ${n.kcal} kcal contro ${target} di target (${pct(dev)}): oltre la tolleranza del ±${Math.round(V.dayWarnShare * 100)}%, ma entro il limite.` });
    if (n.kcal < SEX_FLOOR[ctx.sex] && n.budgetKcal === 0) out.push({ level: 'BLOCKER', code: 'V3', message: `${M}, ${d.weekday}: ${n.kcal} kcal, sotto la soglia minima giornaliera di ${SEX_FLOOR[ctx.sex]}.` });
    // declared (label) energy vs energy derived from the macros of the prescribed meals
    if (n.prescribedKcal > 0) {
      const macroOff = n.prescribedKcal / n.derivedKcal - 1;
      if (Math.abs(macroOff) > V.macroBlockShare) out.push({ level: 'BLOCKER', code: 'V15', message: `${M}, ${d.weekday}: energia dichiarata ${n.prescribedKcal} kcal contro ${Math.round(n.derivedKcal)} ricavate dai macro (${pct(macroOff)}).` });
      else if (Math.abs(macroOff) > V.macroWarnShare) out.push({ level: 'WARNING', code: 'V15', message: `${M}, ${d.weekday}: energia dichiarata ${n.prescribedKcal} kcal contro ${Math.round(n.derivedKcal)} ricavate dai macro (${pct(macroOff)}).` });
      // macros vs the day's targets, on the share of the day that is prescribed
      const share = 1 - n.budgetShare;
      const checks: [string, number, number, number][] = [
        ['proteine', n.protein, t.protein * share, V.proteinWarnShare],
        ['carboidrati', n.carbs + n.fiber / 2, t.carbs * share, V.carbsWarnShare],
        ['grassi', n.fats, t.fats * share, V.fatsWarnShare],
      ];
      for (const [label, got, want, tol] of checks) {
        const off = got / want - 1;
        if (Math.abs(off) > tol) out.push({ level: 'WARNING', code: 'V16', message: `${M}, ${d.weekday}: ${label} ${Math.round(got)} g contro ${Math.round(want)} g di target (${pct(off)}).` });
      }
    }
  }
  const avgTarget = tKcal.reduce((a, b) => a + b, 0) / tKcal.length;
  if (Math.abs(avgTarget - month.calorieTarget) > 10) out.push({ level: 'BLOCKER', code: 'V2', message: `${M}: media dei target giornalieri ${Math.round(avgTarget)} kcal contro ${month.calorieTarget} dichiarate.` });
  const avgActual = actual.reduce((a, b) => a + b, 0) / actual.length;
  const weekDev = avgActual / month.calorieTarget - 1;
  if (Math.abs(weekDev) > V.weekBlockShare) out.push({ level: 'BLOCKER', code: 'V2', message: `${M}: media settimanale ${Math.round(avgActual)} kcal contro ${month.calorieTarget} (${pct(weekDev)}).` });
  else if (Math.abs(weekDev) > V.weekWarnShare) out.push({ level: 'WARNING', code: 'V2', message: `${M}: media settimanale ${Math.round(avgActual)} kcal contro ${month.calorieTarget} (${pct(weekDev)}).` });

  // ------------------------------------------------ limits and adequacy
  if (opts.expenditure) {
    const lim = calorieLimits(ctx, opts.expenditure);
    const tol = opts.expenditure * P.safety.driftToleranceShare;
    if (month.calorieTarget < lim.min - tol - 2) out.push({ level: 'BLOCKER', code: 'V4', message: `${M}: ${month.calorieTarget} kcal sotto il minimo consentito (${lim.min}: deficit massimo ${Math.round(P.safety.maxDeficitShare * 100)}% su ${lim.expenditure}, soglia individuale ${lim.floor}).` });
    if (month.calorieTarget > lim.max + tol + 2) out.push({ level: 'BLOCKER', code: 'V4', message: `${M}: ${month.calorieTarget} kcal sopra il massimo consentito (${lim.max}).` });
  }
  const ref = proteinReferenceKg(ctx);
  const t = month.macroTargetsG;
  if (t.fats < Math.min(ctx.weightKg * P.safety.minFatPerKg, (month.calorieTarget * P.safety.minFatShare) / 9) - 1) out.push({ level: 'BLOCKER', code: 'V6', message: `${M}: grassi ${t.fats} g sotto il minimo di adeguatezza.` });
  if (t.protein < ref * P.safety.minProteinPerKg - 1) out.push({ level: 'WARNING', code: 'V6', message: `${M}: proteine ${t.protein} g, sotto ${P.safety.minProteinPerKg} g/kg (${Math.round(ref * P.safety.minProteinPerKg)} g).` });
  if (t.protein > ref * P.safety.maxProteinPerKg + 1) out.push({ level: 'WARNING', code: 'V6', message: `${M}: proteine ${t.protein} g, oltre ${P.safety.maxProteinPerKg} g/kg.` });
  if (t.carbs < P.safety.minCarbsG) out.push({ level: 'WARNING', code: 'V6', message: `${M}: carboidrati ${t.carbs} g, sotto ${P.safety.minCarbsG} g.` });

  // ------------------------------------------------ variety
  const vm = varietyMetrics(month, opts.previous);
  for (const d of days) {
    const fam = (slot: string) => {
      const p = d.meals.find((m) => m.slotId === slot)?.items.find((i) => i.role === 'protein');
      const f = p ? FOOD.get(p.foodId) : undefined;
      return f ? familyOf(f) : null;
    };
    const l = fam('pranzo');
    const c = fam('cena');
    if (l && c && l === c) out.push({ level: 'WARNING', code: 'V8', message: `${M}, ${d.weekday}: stessa fonte proteica a pranzo e cena (${l}).` });
  }
  const tuna = days.reduce((s, d) => s + d.meals.filter((m) => m.items.some((i) => i.name === 'Tonno al naturale')).length, 0);
  if (tuna > P.planning.maxTunaPerWeek) out.push({ level: 'WARNING', code: 'V9', message: `${M}: tonno ${tuna} volte a settimana (massimo ${P.planning.maxTunaPerWeek}).` });
  for (const [name, n] of vm.topProteins) {
    if (name !== 'Tonno al naturale' && n > P.planning.maxSameProteinPerWeek + 2) out.push({ level: 'WARNING', code: 'V9', message: `${M}: ${name} ${n} volte nella settimana come fonte proteica.` });
  }
  if (vm.consecutiveSameRecipe > 0) out.push({ level: 'WARNING', code: 'V17', message: `${M}: ${vm.consecutiveSameRecipe} volte lo stesso pranzo o cena in due giorni consecutivi.` });
  if (vm.maxSameRecipe > 2) out.push({ level: 'WARNING', code: 'V18', message: `${M}: una ricetta torna ${vm.maxSameRecipe} volte nella settimana nello stesso pasto.` });
  if (vm.repeatedVsPrevious != null && opts.previous) {
    // Repetition between months is judged against what the catalog allows this person: with regime, allergies
    // and exclusions a slot may have fewer recipes than a week needs, and then some repetition is forced.
    let repeated = 0, forced = 0, total = 0;
    const pools2 = pools;
    const details: string[] = [];
    for (const slot of [...new Set(days.flatMap((d) => d.meals.map((m) => m.slotId)))]) {
      const now = days.flatMap((d) => d.meals.filter((m) => m.slotId === slot && m.recipe?.dishId).map((m) => m.recipe!.dishId!));
      const prev = new Set(opts.previous.weeklySplit.flatMap((d) => d.meals.filter((m) => m.slotId === slot && m.recipe?.dishId).map((m) => m.recipe!.dishId!)));
      if (now.length === 0) continue;
      const pool = slotPoolSize(SLOT_KIND[slot as keyof typeof SLOT_KIND], slot, pools2);
      const distinctNow = new Set(now).size;
      const fresh = Math.max(0, pool - prev.size);
      const r = now.filter((id) => prev.has(id)).length;
      const minR = distinctNow > fresh ? Math.round((now.length * (distinctNow - fresh)) / distinctNow) : 0;
      repeated += r; forced += Math.min(minR, r); total += now.length;
      details.push(`${slot} ${r}/${now.length} (ricette compatibili ${pool})`);
    }
    const avoidable = (repeated - forced) / Math.max(1, total);
    const limit = opts.adapt?.strongVariety ? 0.15 : 0.25;
    if (avoidable > limit)
      out.push({ level: 'WARNING', code: 'V10', message: `${M}: il ${Math.round((repeated / total) * 100)}% dei pasti ripete il mese precedente, ${Math.round(avoidable * 100)}% evitabile con le ricette compatibili (${details.join(', ')}).` });
    else if (repeated / Math.max(1, total) > P.planning.maxRepeatedDishShare)
      out.push({ level: 'INFO', code: 'V10', message: `${M}: il ${Math.round((repeated / total) * 100)}% dei pasti ripete il mese precedente, quasi tutto inevitabile: le ricette compatibili con regime, allergie ed esclusioni sono poche (${details.join(', ')}).` });
  }
  const cats = Object.keys(vm.proteinCategories).filter((c) => c !== 'altro');
  if (cats.length <= 2) out.push({ level: 'INFO', code: 'V19', message: `${M}: fonti proteiche da ${cats.length} categorie (${cats.join(', ')}): compatibilmente con il regime si può alternare di più.` });

  // ------------------------------------------------ adaptations really applied
  for (const [slot, time] of Object.entries(opts.adapt?.mealTimes ?? {})) {
    if (days.some((d) => d.meals.some((m) => m.slotId === slot && m.time !== time))) out.push({ level: 'WARNING', code: 'V11', message: `${M}: l'orario richiesto per ${slot} (${time}) non è applicato.` });
  }
  if (opts.adapt?.timeWindowMin && days.some((d) => d.meals.some((m) => !m.timeWindow))) out.push({ level: 'WARNING', code: 'V11', message: `${M}: orari flessibili richiesti ma non applicati.` });
  if (opts.adapt?.eatOut) {
    const n = days.filter((d) => d.meals.some((m) => m.slotId === opts.adapt!.eatOut!.slot && m.eatOut)).length;
    if (n !== Math.min(opts.adapt.eatOut.perWeek, 5)) out.push({ level: 'WARNING', code: 'V12', message: `${M}: ${n} pasti fuori casa nel piano contro ${opts.adapt.eatOut.perWeek} indicati.` });
  }
  return out;
}

/** Coherence of a monthly update: target before/after, declared vs applied step, macros, expenditure vs balance, decision vs motivation. */
export function validateUpdate(decision: DecisionLog, followed: DietMonthPlan, next: DietMonthPlan): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const M = `Check-in ${decision.monthIndex}`;
  if (decision.previousTarget !== followed.calorieTarget) out.push({ level: 'BLOCKER', code: 'U1', message: `${M}: target precedente registrato ${decision.previousTarget} diverso da quello seguito (${followed.calorieTarget}).` });
  if (decision.newTarget !== next.calorieTarget) out.push({ level: 'BLOCKER', code: 'U2', message: `${M}: target dichiarato ${decision.newTarget} diverso da quello del piano generato (${next.calorieTarget}).` });
  const unexplained = next.calorieTarget - followed.calorieTarget - decision.calorieStep;
  if (Math.abs(unexplained) >= 5 && decision.otherChanges.length === 0)
    out.push({ level: 'BLOCKER', code: 'U3', message: `${M}: il target cambia di ${next.calorieTarget - followed.calorieTarget} kcal ma il passo dichiarato è ${decision.calorieStep} e non c'è un motivo documentato.` });
  if (decision.newMacros.protein !== next.macroTargetsG.protein || decision.newMacros.fats !== next.macroTargetsG.fats || Math.abs(decision.newMacros.carbs - next.macroTargetsG.carbs) > 1)
    out.push({ level: 'BLOCKER', code: 'U4', message: `${M}: macro dichiarati diversi da quelli del piano generato.` });
  const balance = Math.round((decision.newTarget / decision.tdeeEstimate - 1) * 100);
  if (Math.abs(balance - decision.balancePct) > 1) out.push({ level: 'BLOCKER', code: 'U5', message: `${M}: bilancio dichiarato ${decision.balancePct}% ma ${decision.newTarget} su ${decision.tdeeEstimate} dà ${balance}%.` });
  const kinds = decision.interventions.map((i) => i.kind);
  const coherent =
    decision.calorieStep > 0 ? kinds.includes('increase_calories') : decision.calorieStep < 0 ? kinds.includes('decrease_calories') : !kinds.includes('increase_calories') && !kinds.includes('decrease_calories');
  if (!coherent) out.push({ level: 'BLOCKER', code: 'U6', message: `${M}: la decisione (${decision.calorieStep} kcal) non corrisponde agli interventi motivati.` });
  if (decision.calorieStep !== 0 && decision.rulesApplied.length === 0) out.push({ level: 'BLOCKER', code: 'U6', message: `${M}: modifica calorica senza regola che la motivi.` });
  if (decision.balancePct < -Math.round((P.safety.maxDeficitShare + P.safety.driftToleranceShare) * 100) - 1) out.push({ level: 'BLOCKER', code: 'U7', message: `${M}: deficit del ${-decision.balancePct}% oltre il limite.` });
  return out;
}

/** True when nothing blocks the publication of these months. */
export const publishable = (issues: ValidationIssue[]) => !issues.some((i) => i.level === 'BLOCKER');
