/**
 * Closed-loop simulation: a virtual body follows the plan for several months,
 * the monthly recalibration looks at the (noisy) weigh-ins and adherence and
 * reworks both plans, and we check the loop actually steers the weight toward
 * the goal — also when the person's real metabolism is off from the model, and
 * when they follow the plan only halfway.
 *
 * The virtual body: weight changes by (eaten − truly burned) / 7700 kcal per
 * kg every day; "truly burned" is the energy model's expenditure times a hidden
 * metabolic bias (the model is an estimate, real people differ by ±10%).
 */
import { dayEnergy } from '@/domain/energy';
import { buildPlans, type PlanBundle } from '@/domain/plan-engine';
import { MAX_TOTAL_ADJUSTMENT, NEUTRAL_CALIBRATION, recalibrate, type PlanCalibration, type RecalibrationResult } from '@/domain/recalibration';
import { MIN_CALORIES } from '@/domain/targets';
import { buildUserContext } from '@/domain/user-context';

import type { Finding } from './checks';
import type { Persona } from './personas';

export type Scenario = {
  id: string;
  label: string;
  /** Hidden multiplier error of the energy model (−0.1 = the person burns 10% less than estimated). */
  bias: number;
  /** Share of the planned calories actually eaten (1 = exactly the plan). */
  dietAdherence: number;
  trainingAdherence: number;
};

export const SCENARIOS: Scenario[] = [
  { id: 'accurate', label: 'Modello accurato, piano seguito', bias: 0, dietAdherence: 1, trainingAdherence: 0.9 },
  { id: 'slow-metabolism', label: 'Metabolismo più lento del 10%', bias: -0.1, dietAdherence: 1, trainingAdherence: 0.9 },
  { id: 'fast-metabolism', label: 'Metabolismo più veloce del 10%', bias: 0.1, dietAdherence: 1, trainingAdherence: 0.9 },
  { id: 'half-adherent', label: 'Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti)', bias: 0, dietAdherence: 1.2, trainingAdherence: 0.4 },
];

export type MonthLog = {
  month: number;
  startKg: number;
  endKg: number;
  rateKgPerWeek: number;
  target: number;
  verdict: RecalibrationResult['verdict'];
  adjustment: number;
  changes: string[];
};

export type SimulationResult = { persona: Persona; scenario: Scenario; months: MonthLog[]; findings: Finding[] };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const addDays = (iso: string, n: number) => new Date(new Date(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);

export function simulate(persona: Persona, scenario: Scenario, months = 6): SimulationResult {
  const rand = rng(persona.id.length * 977 + scenario.id.length * 131);
  const ctx0 = buildUserContext(persona.answers);
  let calibration: PlanCalibration = { ...NEUTRAL_CALIBRATION };
  let bundle: PlanBundle = buildPlans(ctx0);
  let trueKg = ctx0.weightKg;
  const startDate = '2026-01-05'; // a Monday
  const logs: MonthLog[] = [];
  const findings: Finding[] = [];
  const horizon = Math.min(months, bundle.durationMonths);

  for (let m = 1; m <= horizon; m++) {
    const monthStartKg = trueKg;
    const weights: { date: string; kg: number }[] = [];
    const targets = bundle.monthTargets[m - 1];
    const trainingWeek = bundle.training?.months[m - 1]?.weeklySplit ?? null;
    let eatenSum = 0;
    let eatenDays = 0;
    let sessionsPlanned = 0;
    let sessionsDone = 0;

    for (let d = 0; d < 30; d++) {
      const date = addDays(startDate, (m - 1) * 30 + d);
      const wd = (d + (m - 1) * 30) % 7;
      const day = trainingWeek?.[wd] ?? null;
      const dayTarget = targets.perWeekday[wd].calories;
      // day-to-day noise on intake (±10%)
      const eaten = dayTarget * scenario.dietAdherence * (0.92 + rand() * 0.16);
      let completion = 1;
      if (day && day.type !== 'rest') {
        sessionsPlanned++;
        const did = rand() < scenario.trainingAdherence;
        if (did) sessionsDone++;
        completion = did ? 1 : 0;
      }
      const burned = dayEnergy({ ...ctx0, weightKg: trueKg }, day, completion).total * (1 + scenario.bias);
      trueKg += (eaten - burned) / 7700;
      if (d % 3 === 0) weights.push({ date, kg: Math.round((trueKg + (rand() - 0.5) * 0.6) * 10) / 10 });
      if (rand() < 0.75) {
        eatenSum += eaten;
        eatenDays++;
      }
    }

    const ctxNow = { ...ctx0, weightKg: Math.round(trueKg * 10) / 10 };
    const result = recalibrate({
      ctx: ctxNow,
      monthIndex: m,
      durationMonths: bundle.durationMonths,
      targets,
      weights,
      adherence: {
        trainingCompletion: sessionsPlanned > 0 ? sessionsDone / sessionsPlanned : null,
        mealDaysTracked: eatenDays,
        daysInMonth: 30,
        avgEatenKcal: eatenDays >= 10 ? eatenSum / eatenDays : null,
      },
      checkin: {
        adherence: scenario.dietAdherence > 1.1 || scenario.trainingAdherence < 0.5 ? 2 : 4,
        energy: 'normal',
        hunger: scenario.dietAdherence > 1.1 ? 'never' : 'sometimes',
      },
      calibration,
    });

    logs.push({
      month: m,
      startKg: Math.round(monthStartKg * 10) / 10,
      endKg: Math.round(trueKg * 10) / 10,
      rateKgPerWeek: Math.round(((trueKg - monthStartKg) / (30 / 7)) * 100) / 100,
      target: targets.calories,
      verdict: result.verdict,
      adjustment: result.calibration.calorieAdjustment,
      changes: result.changes.map((c) => c.text),
    });

    const before = bundle;
    calibration = result.calibration;
    bundle = buildPlans(ctxNow, { calibration, preserveMonthsBefore: m + 1, existing: { diet: bundle.diet, training: bundle.training } });

    // --- invariants -------------------------------------------------------
    if (calibration.calorieAdjustment > MAX_TOTAL_ADJUSTMENT || calibration.calorieAdjustment < -MAX_TOTAL_ADJUSTMENT) findings.push({ level: 'FAIL', area: 'coerenza', code: 'M1', message: `Mese ${m}: ricalibrazione fuori limite (${calibration.calorieAdjustment} kcal)` });
    const next = bundle.monthTargets[m];
    if (next && next.calories < MIN_CALORIES[ctx0.sex]) findings.push({ level: 'FAIL', area: 'coerenza', code: 'M2', message: `Mese ${m + 1}: ${next.calories} kcal sotto la soglia di sicurezza` });
    if (ctx0.isMinor && ctx0.goal === 'loseFat' && next && next.pace.dailyBalanceKcal + calibration.calorieAdjustment < 0) findings.push({ level: 'FAIL', area: 'coerenza', code: 'M3', message: 'Minorenne con deficit dopo la ricalibrazione' });
    if (bundle.diet && before.diet && m < bundle.durationMonths) {
      const sig = (b: PlanBundle) => JSON.stringify(b.diet?.months[m]?.weeklySplit.map((d) => d.meals.map((x) => x.items.map((i) => [i.foodId, i.grams]))));
      if (sig(bundle) === sig(before)) findings.push({ level: 'WARN', area: 'dieta', code: 'M4', message: `Mese ${m + 1}: la dieta non è stata rielaborata dopo la ricalibrazione` });
      const month = bundle.diet.months[m - 1];
      const prev = before.diet.months[m - 1];
      if (JSON.stringify(month) !== JSON.stringify(prev)) findings.push({ level: 'FAIL', area: 'dieta', code: 'M5', message: `Mese ${m}: un mese già vissuto è stato modificato dalla ricalibrazione` });
    }
  }

  // --- outcome ----------------------------------------------------------------
  const expected = bundle.monthTargets[0].pace.weeklyKg;
  const laterRates = logs.slice(Math.min(2, logs.length - 1)).map((l) => l.rateKgPerWeek);
  const lateRate = laterRates.length ? laterRates.reduce((a, b) => a + b, 0) / laterRates.length : 0;
  const stable = persona.answers.goal === 'maintainImprove' || persona.answers.goal === 'generalHealth' || persona.answers.goal === 'improveEndurance' || (ctx0.isMinor && ctx0.goal === 'loseFat');
  if (scenario.id !== 'half-adherent' && logs.length >= 3) {
    if (stable) {
      if (Math.abs(lateRate) > 0.3) findings.push({ level: 'FAIL', area: 'coerenza', code: 'M6', message: `[${scenario.label}] obiettivo di mantenimento ma dopo la ricalibrazione il peso varia di ${lateRate.toFixed(2)} kg/sett.` });
    } else if (expected !== 0) {
      const ratio = lateRate / expected;
      if (ratio < 0.5 || ratio > 1.6) findings.push({ level: 'FAIL', area: 'coerenza', code: 'M6', message: `[${scenario.label}] dal 3° mese il ritmo è ${lateRate.toFixed(2)} kg/sett. contro ${expected.toFixed(2)} previsti (${Math.round(ratio * 100)}%): la ricalibrazione non porta il peso verso l'obiettivo` });
    }
  }
  if (scenario.id === 'half-adherent' && logs.length >= 2 && !logs.slice(0, 2).some((l) => l.verdict === 'low_adherence')) {
    findings.push({ level: 'FAIL', area: 'coerenza', code: 'M7', message: `[${scenario.label}] la bassa aderenza non è stata riconosciuta` });
  }
  if (scenario.id === 'half-adherent' && logs.some((l) => Math.abs(l.adjustment) > 150)) {
    findings.push({ level: 'WARN', area: 'coerenza', code: 'M7', message: `[${scenario.label}] con bassa aderenza le calorie sono state spostate di oltre 150 kcal: il piano non andrebbe corretto sui numeri` });
  }
  return { persona, scenario, months: logs, findings };
}
