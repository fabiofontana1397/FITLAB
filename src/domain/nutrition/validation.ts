/**
 * Module F — Validation. Nutritional, mathematical and structural checks of a generated diet month, and
 * coherence checks of a monthly update (target before / after, declared step, macros, expenditure, decision
 * vs motivation). Pure: used by the test harness and available to the app for logging.
 */
import { buildFitLabPools } from '@/lib/planning/fitlab/pools';
import { FITLAB_FOODS } from '@/lib/planning/fitlab/foods';
import { familyOf } from '@/lib/planning/fitlab/pools';
import type { DietMonthPlan } from '@/lib/planning/types';

import { proteinReferenceKg } from '../targets';
import type { UserContext } from '../user-context';

import { NUTRITION_PARAMS as P } from './params';
import { calorieLimits } from './safety';
import type { DecisionLog, DietAdaptations } from './types';

export type ValidationIssue = { level: 'FAIL' | 'WARN'; code: string; message: string };

const FOOD = new Map(FITLAB_FOODS.map((f) => [f.id, f]));

export function validateDietMonth(
  month: DietMonthPlan,
  ctx: UserContext,
  opts: { expenditure?: number; previous?: DietMonthPlan; adapt?: DietAdaptations } = {}
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const M = `Mese ${month.monthIndex}`;
  const days = month.weeklySplit;

  // V1 macro arithmetic of each day's target
  for (const d of days) {
    const t = d.macroTargetsG;
    if (!t || d.calorieTarget == null) continue;
    const kcal = t.protein * 4 + t.carbs * 4 + t.fats * 9;
    if (Math.abs(kcal - d.calorieTarget) > Math.max(15, d.calorieTarget * 0.015))
      out.push({ level: 'FAIL', code: 'V1', message: `${M}, ${d.weekday}: P×4 + C×4 + G×9 = ${kcal} kcal contro ${d.calorieTarget} di target.` });
  }
  // V2 the week's day targets average to the month target
  const dayTargets = days.map((d) => d.calorieTarget ?? month.calorieTarget);
  const avg = dayTargets.reduce((a, b) => a + b, 0) / dayTargets.length;
  if (Math.abs(avg - month.calorieTarget) > 10) out.push({ level: 'FAIL', code: 'V2', message: `${M}: media dei target giornalieri ${Math.round(avg)} kcal contro ${month.calorieTarget} dichiarate.` });
  // V3 meals vs the day's target (a free or eaten-out meal counts with its budget)
  for (const d of days) {
    const target = d.calorieTarget ?? month.calorieTarget;
    const kcal = d.meals.reduce((s, m) => s + m.totalKcal, 0);
    const dev = kcal / target - 1;
    if (Math.abs(dev) > 0.1) out.push({ level: 'FAIL', code: 'V3', message: `${M}, ${d.weekday}: pasti ${kcal} kcal contro ${target} (${dev > 0 ? '+' : ''}${Math.round(dev * 100)}%).` });
    else if (Math.abs(dev) > 0.06) out.push({ level: 'WARN', code: 'V3', message: `${M}, ${d.weekday}: pasti ${kcal} kcal contro ${target} (${dev > 0 ? '+' : ''}${Math.round(dev * 100)}%).` });
  }
  // V4–V5 limits
  if (opts.expenditure) {
    const lim = calorieLimits(ctx, opts.expenditure);
    const tol = opts.expenditure * P.safety.driftToleranceShare;
    if (month.calorieTarget < lim.min - tol - 2) out.push({ level: 'FAIL', code: 'V4', message: `${M}: ${month.calorieTarget} kcal sotto il minimo consentito (${lim.min}: deficit massimo ${Math.round(P.safety.maxDeficitShare * 100)}% su ${lim.expenditure}, soglia individuale ${lim.floor}).` });
    if (month.calorieTarget > lim.max + tol + 2) out.push({ level: 'FAIL', code: 'V4', message: `${M}: ${month.calorieTarget} kcal sopra il massimo consentito (${lim.max}).` });
  }
  // V6 macro adequacy
  const ref = proteinReferenceKg(ctx);
  const t = month.macroTargetsG;
  if (t.fats < Math.min(ctx.weightKg * P.safety.minFatPerKg, (month.calorieTarget * P.safety.minFatShare) / 9) - 1) out.push({ level: 'FAIL', code: 'V6', message: `${M}: grassi ${t.fats} g sotto il minimo di adeguatezza.` });
  if (t.protein < ref * P.safety.minProteinPerKg - 1) out.push({ level: 'WARN', code: 'V6', message: `${M}: proteine ${t.protein} g, sotto ${P.safety.minProteinPerKg} g/kg (${Math.round(ref * P.safety.minProteinPerKg)} g).` });
  if (t.protein > ref * P.safety.maxProteinPerKg + 1) out.push({ level: 'WARN', code: 'V6', message: `${M}: proteine ${t.protein} g, oltre ${P.safety.maxProteinPerKg} g/kg.` });
  if (t.carbs < P.safety.minCarbsG) out.push({ level: 'WARN', code: 'V6', message: `${M}: carboidrati ${t.carbs} g, sotto ${P.safety.minCarbsG} g.` });

  // V7 forbidden foods (regime, allergies, exclusions, foods the person asked to remove)
  const pools = buildFitLabPools(ctx.answers, opts.adapt);
  const bad = new Set<string>();
  for (const d of days) for (const m of d.meals) for (const i of m.items) {
    const f = FOOD.get(i.foodId);
    if (f && !pools.allowed(f)) bad.add(f.name);
  }
  if (bad.size) out.push({ level: 'FAIL', code: 'V7', message: `${M}: alimenti non ammessi: ${[...bad].join(', ')}.` });
  if (opts.adapt?.dislikedFoodIds?.length) {
    const back = days.flatMap((d) => d.meals.flatMap((m) => m.items)).filter((i) => opts.adapt!.dislikedFoodIds!.includes(i.foodId));
    if (back.length) out.push({ level: 'FAIL', code: 'V13', message: `${M}: tornano alimenti che l'utente ha chiesto di togliere (${[...new Set(back.map((i) => i.name))].join(', ')}).` });
  }

  // V8–V9 variety of proteins
  const mainProteins = new Map<string, number>();
  for (const d of days) {
    const fam = (slot: string) => {
      const p = d.meals.find((m) => m.slotId === slot)?.items.find((i) => i.role === 'protein');
      const f = p ? FOOD.get(p.foodId) : undefined;
      return f ? familyOf(f) : null;
    };
    const l = fam('pranzo');
    const c = fam('cena');
    if (l && c && l === c) out.push({ level: 'WARN', code: 'V8', message: `${M}, ${d.weekday}: stessa fonte proteica a pranzo e cena (${l}).` });
    for (const m of d.meals.filter((x) => x.slotId === 'pranzo' || x.slotId === 'cena'))
      for (const i of m.items.filter((x) => x.role === 'protein')) mainProteins.set(i.name, (mainProteins.get(i.name) ?? 0) + 1);
  }
  const tuna = days.reduce((s, d) => s + d.meals.filter((m) => m.items.some((i) => i.name === 'Tonno al naturale')).length, 0);
  if (tuna > P.planning.maxTunaPerWeek) out.push({ level: 'FAIL', code: 'V9', message: `${M}: tonno ${tuna} volte a settimana (massimo ${P.planning.maxTunaPerWeek}).` });
  for (const [name, n] of mainProteins) {
    if (name === 'Tonno al naturale') continue;
    if (n > P.planning.maxSameProteinPerWeek) out.push({ level: 'WARN', code: 'V9', message: `${M}: ${name} ${n} volte tra pranzi e cene (massimo ${P.planning.maxSameProteinPerWeek}).` });
  }
  // V10 rotation between months
  if (opts.previous) {
    const prev = new Set(opts.previous.weeklySplit.flatMap((d) => d.meals.map((m) => m.recipe?.dishId).filter(Boolean)));
    const now = days.flatMap((d) => d.meals.map((m) => m.recipe?.dishId).filter(Boolean));
    const share = now.filter((x) => prev.has(x)).length / Math.max(1, now.length);
    const limit = opts.adapt?.strongVariety ? 0.3 : P.planning.maxRepeatedDishShare;
    if (share > limit) out.push({ level: 'WARN', code: 'V10', message: `${M}: il ${Math.round(share * 100)}% dei pasti ripete piatti del mese precedente (limite ${Math.round(limit * 100)}%).` });
  }
  // V11–V12 adaptations really applied
  for (const [slot, time] of Object.entries(opts.adapt?.mealTimes ?? {})) {
    const wrong = days.some((d) => d.meals.some((m) => m.slotId === slot && m.time !== time));
    if (wrong) out.push({ level: 'FAIL', code: 'V11', message: `${M}: l'orario richiesto per ${slot} (${time}) non è applicato.` });
  }
  if (opts.adapt?.timeWindowMin && days.some((d) => d.meals.some((m) => !m.timeWindow))) out.push({ level: 'FAIL', code: 'V11', message: `${M}: orari flessibili richiesti ma non applicati.` });
  if (opts.adapt?.eatOut) {
    const n = days.filter((d) => d.meals.some((m) => m.slotId === opts.adapt!.eatOut!.slot && m.eatOut)).length;
    if (n !== Math.min(opts.adapt.eatOut.perWeek, 5)) out.push({ level: 'FAIL', code: 'V12', message: `${M}: ${n} pasti fuori casa nel piano contro ${opts.adapt.eatOut.perWeek} indicati.` });
  }
  return out;
}

/** Coherence of a monthly update (spec: target before/after, declared vs applied step, macros, TDEE vs balance, decision vs motivation). */
export function validateUpdate(decision: DecisionLog, followed: DietMonthPlan, next: DietMonthPlan): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const M = `Check-in ${decision.monthIndex}`;
  if (decision.previousTarget !== followed.calorieTarget) out.push({ level: 'FAIL', code: 'U1', message: `${M}: target precedente registrato ${decision.previousTarget} diverso da quello seguito (${followed.calorieTarget}).` });
  if (decision.newTarget !== next.calorieTarget) out.push({ level: 'FAIL', code: 'U2', message: `${M}: target dichiarato ${decision.newTarget} diverso da quello del piano generato (${next.calorieTarget}).` });
  const unexplained = next.calorieTarget - followed.calorieTarget - decision.calorieStep;
  if (Math.abs(unexplained) >= 5 && decision.otherChanges.length === 0)
    out.push({ level: 'FAIL', code: 'U3', message: `${M}: il target cambia di ${next.calorieTarget - followed.calorieTarget} kcal ma il passo dichiarato è ${decision.calorieStep} e non c'è un motivo documentato per la differenza.` });
  if (decision.newMacros.protein !== next.macroTargetsG.protein || decision.newMacros.fats !== next.macroTargetsG.fats || Math.abs(decision.newMacros.carbs - next.macroTargetsG.carbs) > 1)
    out.push({ level: 'FAIL', code: 'U4', message: `${M}: macro dichiarati diversi da quelli del piano generato.` });
  const balance = Math.round((decision.newTarget / decision.tdeeEstimate - 1) * 100);
  if (Math.abs(balance - decision.balancePct) > 1) out.push({ level: 'FAIL', code: 'U5', message: `${M}: bilancio dichiarato ${decision.balancePct}% ma ${decision.newTarget} su ${decision.tdeeEstimate} dà ${balance}%.` });
  const kinds = decision.interventions.map((i) => i.kind);
  const coherent = decision.calorieStep > 0 ? kinds.includes('increase_calories') || decision.safety.some((s) => s.blocked) : decision.calorieStep < 0 ? kinds.includes('decrease_calories') || decision.safety.some((s) => s.blocked) : !kinds.includes('increase_calories') && !kinds.includes('decrease_calories');
  if (!coherent) out.push({ level: 'FAIL', code: 'U6', message: `${M}: la decisione (${decision.calorieStep} kcal) non corrisponde agli interventi motivati.` });
  if (decision.calorieStep !== 0 && decision.rulesApplied.length === 0) out.push({ level: 'FAIL', code: 'U6', message: `${M}: modifica calorica senza regola che la motivi.` });
  if (decision.balancePct < -Math.round((P.safety.maxDeficitShare + P.safety.driftToleranceShare) * 100) - 1) out.push({ level: 'FAIL', code: 'U7', message: `${M}: deficit del ${-decision.balancePct}% oltre il limite.` });
  return out;
}
