/**
 * Module D (safety side) — individual calorie limits, cases that need a professional, and the dynamic
 * expenditure estimate. These limits are applied by `computeTargets` to EVERY month of EVERY plan version,
 * the first one and each recalibrated one, so a monthly adjustment can never carry a plan past them.
 */
import { bmr } from '../energy';
import type { UserContext } from '../user-context';

import { NUTRITION_PARAMS as P } from './params';
import type { MonitoringData, SafetyCheck, SpecialCondition } from './types';

/** Sex floors kept from the original engine (also the per-day floor). */
export const SEX_FLOOR = { female: 1200, male: 1500, unspecified: 1350 } as const;

/** The lowest average daily target for this person: never under the sex floor nor under 90% of their resting expenditure. */
export function individualFloor(ctx: Pick<UserContext, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  return Math.round(Math.max(SEX_FLOOR[ctx.sex], bmr(ctx) * P.safety.bmrFloorShare));
}

export type CalorieLimits = { min: number; max: number; floor: number; expenditure: number };

/** Allowed range of the average daily target for an expenditure estimate. */
export function calorieLimits(ctx: Pick<UserContext, 'sex' | 'age' | 'heightCm' | 'weightKg'>, expenditure: number): CalorieLimits {
  const floor = individualFloor(ctx);
  const min = Math.max(floor, Math.round(expenditure * (1 - P.safety.maxDeficitShare)));
  const max = Math.round(Math.min(expenditure * (1 + P.safety.maxSurplusShare), expenditure + P.safety.maxSurplusKcal));
  return { min, max: Math.max(max, min), floor, expenditure: Math.round(expenditure) };
}

const CONDITION_LABEL: Record<SpecialCondition, string> = {
  pregnancy: 'gravidanza',
  breastfeeding: 'allattamento',
  medical: 'condizione medica o terapia in corso',
  eatingDisorder: 'storia di disturbi del comportamento alimentare',
};

const CONDITIONS = Object.keys(CONDITION_LABEL) as SpecialCondition[];

/**
 * Safety engine: situations where no nutrition plan, calorie target or automatic adjustment is produced without a
 * professional. Read from the questionnaire (age, `specialConditions`) and from a check-in. Every builder calls it
 * first (computeTargets, buildPlans, recalibrate).
 */
export function supervisionReasons(ctx: Pick<UserContext, 'isMinor'> & { answers?: Record<string, unknown> }, m?: Pick<MonitoringData, 'specialConditions'> | null): string[] {
  const out: string[] = [];
  if (ctx.isMinor) out.push('età inferiore a 18 anni');
  const fromQuestionnaire = Array.isArray(ctx.answers?.specialConditions) ? (ctx.answers!.specialConditions as string[]) : [];
  for (const c of new Set([...fromQuestionnaire.filter((x): x is SpecialCondition => CONDITIONS.includes(x as SpecialCondition)), ...(m?.specialConditions ?? [])])) out.push(CONDITION_LABEL[c]);
  return out;
}

/** General guidance shown instead of a plan while a professional has to set it (no numbers, no targets). */
export const SUPERVISION_GUIDANCE = [
  'Il piano alimentare automatico è sospeso: in questa situazione obiettivi, calorie e quantità vanno definiti con un medico o un nutrizionista.',
  'Nel frattempo valgono le indicazioni generali di una alimentazione varia ed equilibrata: pasti regolari, verdura e frutta ogni giorno, cereali preferibilmente integrali, legumi, acqua a sufficienza.',
  'Porta al professionista lo storico del piano e dei check-in: lo trovi nell’app e puoi esportarlo in PDF.',
];

/**
 * Observed expenditure from what was eaten and how the weight moved: intake − change in stored energy.
 * Taken into account only with reliable data (enough logged days, a representative weight trend, high
 * adherence, no change of activity and no temporary event), half of the gap per month, bounded around the model.
 */
export function updateExpenditureOffset(input: {
  modelExpenditure: number;
  previousOffset: number;
  avgEatenKcal: number | null;
  mealDaysTracked: number;
  rateKgWeek: number | null;
  weightQuality: 'none' | 'limited' | 'good';
  adherenceLevel: string;
  activityChanged: boolean;
  temporaryEvents: number;
}): { offset: number; observed: number | null; used: boolean; reason: string } {
  const { modelExpenditure, previousOffset } = input;
  const reliable =
    input.avgEatenKcal != null &&
    input.mealDaysTracked >= P.tdee.minTrackedDays &&
    input.rateKgWeek != null &&
    input.weightQuality === 'good' &&
    input.adherenceLevel === 'high' &&
    !input.activityChanged &&
    input.temporaryEvents === 0;
  if (!reliable) {
    return { offset: previousOffset, observed: null, used: false, reason: 'Stima del dispendio invariata: servono almeno 20 giorni di pasti registrati, pesate rappresentative, aderenza alta e nessun cambio di attività o evento temporaneo.' };
  }
  const observed = input.avgEatenKcal! - (input.rateKgWeek! * P.tdee.kcalPerKg) / 7;
  const current = modelExpenditure + previousOffset;
  const bound = modelExpenditure * P.tdee.maxOffsetShare;
  const maxStep = modelExpenditure * P.tdee.maxOffsetStepShare;
  const move = Math.min(Math.max(P.tdee.blend * (observed - current), -maxStep), maxStep);
  const offset = Math.round(Math.min(Math.max(previousOffset + move, -bound), bound));
  return { offset, observed: Math.round(observed), used: true, reason: `Dispendio osservato ${Math.round(observed)} kcal (mangiato ${Math.round(input.avgEatenKcal!)} kcal, peso ${input.rateKgWeek! > 0 ? '+' : ''}${input.rateKgWeek!.toFixed(2)} kg/sett.): la stima passa da ${Math.round(current)} a ${Math.round(modelExpenditure + offset)} kcal.` };
}

/**
 * Applies the limits to a decision: the followed target plus the decided step. A cut never goes past the
 * minimum and an increase never past the maximum. A target already within the drift tolerance of a limit
 * (because the model moved) is left as it is; beyond the tolerance it is brought back to the limit.
 */
export function enforceCalorieLimits(followed: number, step: number, limits: CalorieLimits, tolerance = 0): { value: number; checks: SafetyCheck[] } {
  const checks: SafetyCheck[] = [];
  const proposed = followed + step;
  let value = proposed;
  if (step < 0 && value < limits.min) value = Math.max(value, Math.min(followed, limits.min));
  if (step > 0 && value > limits.max) value = Math.min(value, Math.max(followed, limits.max));
  if (value < limits.min - tolerance) value = limits.min;
  if (value > limits.max + tolerance) value = limits.max;
  const why = limits.min === limits.floor ? `soglia individuale di ${limits.floor} kcal` : `deficit massimo del ${Math.round(P.safety.maxDeficitShare * 100)}% su un dispendio stimato di ${limits.expenditure} kcal`;
  if (value > proposed) {
    checks.push({
      id: 'deficit',
      ok: false,
      blocked: true,
      message: step < 0 ? `Riduzione di ${-step} kcal ${value === followed ? 'bloccata' : `limitata a ${followed - value} kcal`}: oltre il limite (${why}).` : `Target portato a ${value} kcal per rientrare nel limite (${why}).`,
    });
  } else checks.push({ id: 'deficit', ok: true, message: `Deficit entro il limite (minimo ${limits.min} kcal: ${why}).` });
  if (value < proposed) {
    checks.push({ id: 'surplus', ok: false, blocked: true, message: step > 0 ? `Aumento di ${step} kcal ${value === followed ? 'bloccato' : `limitato a ${value - followed} kcal`}: oltre il surplus massimo (${limits.max} kcal).` : `Target riportato a ${value} kcal per rientrare nel surplus massimo.` });
  } else checks.push({ id: 'surplus', ok: true, message: `Surplus entro il limite (massimo ${limits.max} kcal).` });
  return { value, checks };
}
