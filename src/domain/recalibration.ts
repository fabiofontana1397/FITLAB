/**
 * Monthly recalibration — the "coach" that closes the loop.
 *
 * At the end of every plan month it reads EVERY answer of the check-in together with the weigh-ins and the
 * logged meals, works out WHY the month went the way it did, and decides the most appropriate intervention:
 * calories are only one of them (times, meal distribution, energy density, volume, foods, meals out, a simpler
 * week, a request for information or for a professional). The work is split in modules (domain/nutrition/):
 *
 *   monitoring (A) → analysis (B) → decision (C) → safety limits (D) → plan (E, buildPlans) → validation (F)
 *   → explanation (G)
 *
 * The result is a pure function of its input, so every decision is reproducible and logged (`DecisionLog`).
 *  - the app calls it at check-in time and applies the result with
 *    `buildPlans(ctx, { calibration, preserveMonthsBefore, existing })`;
 *  - an AI agent can propose (`RecalibrationProposal`, structured note facts) but `applyGuardrails` and the
 *    permanent limits in computeTargets bound whatever it answers;
 *  - the test harness simulates months of virtual bodies through it.
 *
 * Calorie coherence: the next month's target is the target FOLLOWED this month plus the decided step. The
 * energy model is only used to place that number in the plan (training-day / rest-day split, following
 * months); "calorie confermate" therefore means the same target, unless a documented reason (different
 * training in the next month, a safety limit) changes it.
 */
import { analyzeAdherence, analyzeSustainability, analyzeWeight, slopeKgWeek } from './nutrition/analysis';
import { decide } from './nutrition/decision';
import { monitor, type CheckinInput } from './nutrition/monitoring';
import { NUTRITION_PARAMS } from './nutrition/params';
import { calorieLimits, enforceCalorieLimits, supervisionReasons, updateExpenditureOffset } from './nutrition/safety';
import type { DecisionLog, DietAdaptations, SafetyCheck } from './nutrition/types';
import type { SessionLike } from './energy';
import { computeTargets, MIN_CALORIES, modelAverage, type PlanTargets } from './targets';
import type { UserContext } from './user-context';

/** Everything recalibration can change, persisted with the plans. */
export type PlanCalibration = {
  /** Extra daily kcal on top of the energy model (negative = fewer). Bounded ±MAX_TOTAL_ADJUSTMENT. */
  calorieAdjustment: number;
  /** Extra sets per exercise (−1 / 0 / +1). */
  setsDelta: number;
  /** Multiplier on suggested loads (0.9–1.1). */
  loadFactor: number;
  /** Rotates which foods are picked, so the diet stays fresh (and changes when the old one is not working). */
  mealVariant: number;
  /** First month the calibration applies to. */
  fromMonth: number;
  /** Dynamic expenditure estimate: kcal/day the real expenditure differs from the model (bounds the deficit). */
  expenditureOffset?: number;
  /** How the meal planner adapts the next months (times, distribution, density, foods, meals out…). */
  diet?: DietAdaptations;
};

export const NEUTRAL_CALIBRATION: PlanCalibration = { calorieAdjustment: 0, setsDelta: 0, loadFactor: 1, mealVariant: 0, fromMonth: 1 };

/** Largest cumulative calorie change recalibration may apply, and the largest single monthly step. */
export const MAX_TOTAL_ADJUSTMENT = NUTRITION_PARAMS.calories.maxTotalAdjustment;
export const MAX_MONTHLY_STEP = NUTRITION_PARAMS.calories.maxMonthlyStep;

export type WeightPoint = { date: string; kg: number };

export type Adherence = {
  /** Share of planned training sessions completed, 0–1; null when unknown. */
  trainingCompletion: number | null;
  /** Days with at least one meal logged, out of the days in the month. */
  mealDaysTracked: number;
  daysInMonth: number;
  /** Average kcal eaten on the tracked days (null when fewer than 10 days were tracked: not reliable). */
  avgEatenKcal: number | null;
};

/** Every check-in answer the engine reads (see monitoring.ts). */
export type CheckinSignals = CheckinInput;

export type RecalibrationInput = {
  ctx: UserContext;
  /** The month that just ended (1-based). */
  monthIndex: number;
  durationMonths: number;
  /** Targets the person followed during that month (calories and macros as stored in the plan). */
  targets: PlanTargets;
  /** Weigh-ins covering that month (any order). */
  weights: WeightPoint[];
  adherence: Adherence;
  checkin: CheckinSignals;
  calibration: PlanCalibration;
  /** Planned training week of the month that ended and of the next one (null in diet-only mode). */
  weeks?: { current: (SessionLike | null | undefined)[] | null; next: (SessionLike | null | undefined)[] | null };
  /** Earlier check-ins, oldest first: their steps and expected outcomes. */
  history?: RecalibrationRecord[];
  /** Meal slots of the plan (ids). */
  slots?: string[];
};

export type Verdict =
  | 'on_track'
  | 'too_slow'
  | 'plateau'
  | 'wrong_direction'
  | 'too_fast'
  | 'weight_up'
  | 'weight_down'
  | 'temporary_variation'
  | 'low_adherence'
  | 'insufficient_data'
  | 'professional_review';

export type PlanChange = { area: 'dieta' | 'allenamento'; text: string };

export type RecalibrationResult = {
  verdict: Verdict;
  /** Measured change in kg per week over the month (null when not measurable). */
  weeklyRateKg: number | null;
  /** What the plan expected, kg per week. */
  expectedWeeklyKg: number;
  calibration: PlanCalibration;
  /** What changed, in plain Italian, for the person. */
  changes: PlanChange[];
  /** Why, for logs / the agent / debugging. */
  reasons: string[];
  /** Questions for the person: what the engine could not interpret and did not guess. */
  clarifications: string[];
  /** The full, reproducible record of the decision. */
  decision: DecisionLog;
  /** What really happened after the previous decision (to store on the previous record). */
  previousOutcome?: string;
};

/** One entry of the recalibration history stored with the plans. */
export type RecalibrationRecord = {
  monthIndex: number;
  date: string;
  verdict: Verdict;
  weeklyRateKg: number | null;
  expectedWeeklyKg: number;
  changes: PlanChange[];
  calibration: PlanCalibration;
  decision?: DecisionLog;
};

/** What an AI agent may propose: only these knobs, all optional. */
export type RecalibrationProposal = Partial<Pick<PlanCalibration, 'calorieAdjustment' | 'setsDelta' | 'loadFactor'>> & { note?: string };

// ----------------------------------------------------------------- helpers --

/** Weight trend in kg/week by least squares over the weigh-ins (needs ≥3 points over ≥14 days, or 2 points ≥10 days apart). */
export function weightTrendKgPerWeek(weights: WeightPoint[]): number | null {
  const pts = [...weights].filter((w) => w.kg > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return null;
  const span = (new Date(pts[pts.length - 1].date).getTime() - new Date(pts[0].date).getTime()) / 86_400_000;
  if (span < 10 || (pts.length < 3 && span < 14)) return null;
  return slopeKgWeek(pts);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Clamps any proposal (from the engine or an AI agent) to safe bounds. */
export function applyGuardrails(
  ctx: Pick<UserContext, 'sex' | 'isMinor' | 'goal' | 'age' | 'heightCm' | 'weightKg'>,
  targets: Pick<PlanTargets, 'calories' | 'averageExpenditure'>,
  previous: PlanCalibration,
  proposal: RecalibrationProposal
): PlanCalibration {
  let adjustment = proposal.calorieAdjustment ?? previous.calorieAdjustment;
  // one month never moves calories by more than MAX_MONTHLY_STEP, and the total stays within ±MAX_TOTAL_ADJUSTMENT
  adjustment = clamp(adjustment, previous.calorieAdjustment - MAX_MONTHLY_STEP, previous.calorieAdjustment + MAX_MONTHLY_STEP);
  adjustment = clamp(adjustment, -MAX_TOTAL_ADJUSTMENT, MAX_TOTAL_ADJUSTMENT);
  // never past the individual limits (deficit / surplus on the best expenditure estimate, individual floor)
  const limits = calorieLimits(ctx, targets.averageExpenditure + (previous.expenditureOffset ?? 0));
  const withoutOld = targets.calories - previous.calorieAdjustment;
  if (withoutOld + adjustment < Math.max(limits.min, MIN_CALORIES[ctx.sex])) adjustment = Math.max(limits.min, MIN_CALORIES[ctx.sex]) - withoutOld;
  if (withoutOld + adjustment > limits.max) adjustment = limits.max - withoutOld;
  // minors never get a deficit on top of maintenance
  if (ctx.isMinor && ctx.goal === 'loseFat') adjustment = Math.max(adjustment, 0);
  return {
    ...previous,
    calorieAdjustment: Math.round(adjustment),
    setsDelta: clamp(Math.round(proposal.setsDelta ?? previous.setsDelta), -1, 1),
    loadFactor: Math.round(clamp(proposal.loadFactor ?? previous.loadFactor, 0.9, 1.1) * 100) / 100,
  };
}

// ------------------------------------------------------------------ engine --

/** Training side, unchanged in spirit: fewer sets when recovery or adherence suffer, a bit more load when everything goes well. */
function trainingTuning(input: RecalibrationInput, verdict: Verdict, lowAdherence: boolean): { setsDelta: number; loadFactor: number; changes: PlanChange[]; reasons: string[] } {
  const { checkin, adherence } = input;
  const changes: PlanChange[] = [];
  const reasons: string[] = [];
  let setsDelta = 0;
  let loadFactor = 1;
  if (input.ctx.mode === 'diet') return { setsDelta, loadFactor, changes, reasons };
  if (lowAdherence) {
    setsDelta = -1;
    changes.push({ area: 'allenamento', text: 'Allenamenti più leggeri (una serie in meno per esercizio) per rendere il piano più facile da seguire.' });
    return { setsDelta, loadFactor, changes, reasons };
  }
  const sore = checkin.difficulty?.includes('soreness') ?? false;
  if (checkin.energy === 'low' || checkin.energy === 'veryLow' || sore) {
    setsDelta = -1;
    reasons.push('Energia bassa o recupero difficile: una serie in meno.');
    changes.push({ area: 'allenamento', text: 'Allenamenti più leggeri per recuperare meglio (una serie in meno per esercizio).' });
  } else if ((checkin.energy === 'high' || checkin.energy === 'veryHigh') && (adherence.trainingCompletion ?? 0) >= 0.8 && (verdict === 'on_track' || verdict === 'too_slow')) {
    loadFactor = 1.03;
    reasons.push('Energia alta e allenamenti completati: carichi +3%.');
  }
  if (checkin.wantsChange?.includes('trainingIntensity') && setsDelta === 0 && loadFactor === 1) {
    loadFactor = checkin.energy === 'low' || checkin.energy === 'veryLow' ? 0.97 : 1.03;
    reasons.push('Richiesta di cambiare l’intensità degli allenamenti.');
  }
  if (setsDelta === 0 && loadFactor === 1) changes.push({ area: 'allenamento', text: 'Progressione normale: carichi in salita graduale e rotazione degli esercizi di supporto.' });
  return { setsDelta, loadFactor, changes, reasons };
}

export function recalibrate(input: RecalibrationInput): RecalibrationResult {
  const { ctx, targets, adherence, calibration } = input;
  const P = NUTRITION_PARAMS;
  const expectedWeeklyKg = targets.pace.weeklyKg;
  const direction = Math.sign(Math.round(expectedWeeklyKg * 1000)); // −1 loss, +1 gain, 0 maintenance

  // A — monitoring
  const m = monitor(input.checkin);
  // B — analysis
  const weight = analyzeWeight({ weights: input.weights, currentKg: ctx.weightKg, expectedKgWeek: expectedWeeklyKg, direction, temporaryEvents: m.events });
  const adh = analyzeAdherence(m, { avgEatenKcal: adherence.avgEatenKcal, mealDaysTracked: adherence.mealDaysTracked, targetKcal: targets.calories, trainingCompletion: adherence.trainingCompletion });
  const sus = analyzeSustainability(m);
  const supervision = supervisionReasons(ctx, m);
  // C — decision
  const history = input.history ?? [];
  const decision = decide({
    goalDirection: direction,
    mode: ctx.mode,
    monitoring: m,
    weight,
    adherence: adh,
    sustainability: sus,
    supervision,
    previousSteps: history.map((r) => r.decision?.calorieStep ?? 0),
    previousAdaptations: calibration.diet,
    slots: input.slots ?? ['colazione', 'pranzo', 'cena'],
  });

  // D — calories: next target = followed target + step, within the permanent limits
  const weeks = input.weeks ?? { current: null, next: null };
  const model = modelAverage(ctx, weeks.current);
  const tdee = updateExpenditureOffset({
    modelExpenditure: model.expenditure,
    previousOffset: calibration.expenditureOffset ?? 0,
    avgEatenKcal: adherence.avgEatenKcal,
    mealDaysTracked: adherence.mealDaysTracked,
    rateKgWeek: weight.rateKgWeek,
    weightQuality: weight.quality,
    adherenceLevel: adh.level,
    activityChanged: m.activityChange === 'more' || m.activityChange === 'less',
    temporaryEvents: m.events.length,
  });
  const limits = calorieLimits(ctx, model.expenditure + tdee.offset);
  const enforced = enforceCalorieLimits(targets.calories, decision.calorieStep, limits, limits.expenditure * P.safety.driftToleranceShare);
  const safety: SafetyCheck[] = [...enforced.checks];
  let adjustment = enforced.value - Math.round(model.base);
  if (Math.abs(adjustment) > MAX_TOTAL_ADJUSTMENT) {
    safety.push({ id: 'total', ok: false, blocked: true, message: `Correzione totale sul modello limitata a ±${MAX_TOTAL_ADJUSTMENT} kcal.` });
    adjustment = clamp(adjustment, -MAX_TOTAL_ADJUSTMENT, MAX_TOTAL_ADJUSTMENT);
  }
  if (supervision.length > 0) safety.push({ id: 'supervision', ok: false, blocked: true, message: `Aggiustamenti automatici sospesi: ${supervision.join(', ')}.` });

  const effectiveStep = Math.round(model.base) + adjustment - targets.calories;
  // the interventions follow the step really applied (a safety limit may have changed it)
  if (effectiveStep !== decision.calorieStep) {
    const blocked = safety.filter((c) => c.blocked).map((c) => c.message).join(' ');
    decision.interventions = decision.interventions.filter((i) => i.kind !== 'increase_calories' && i.kind !== 'decrease_calories' && i.kind !== 'confirm_calories');
    const kind = effectiveStep > 0 ? 'increase_calories' : effectiveStep < 0 ? 'decrease_calories' : 'confirm_calories';
    const text = effectiveStep === 0 ? `Calorie confermate: ${blocked}` : `Calorie ${effectiveStep > 0 ? '+' : ''}${effectiveStep} kcal al giorno. ${blocked}`;
    decision.interventions.unshift({ kind, text, rule: 'R20 limite di sicurezza' });
    decision.rules.push('R20 limite di sicurezza');
  }
  const lowAdherence = adh.level === 'low';
  const verdict: Verdict = supervision.length > 0 ? 'professional_review' : lowAdherence && weight.classification !== 'insufficient_data' ? 'low_adherence' : weight.classification;
  const training = trainingTuning(input, verdict, lowAdherence);

  const next: PlanCalibration = {
    ...calibration,
    calorieAdjustment: Math.round(adjustment),
    setsDelta: training.setsDelta,
    loadFactor: training.loadFactor,
    mealVariant: calibration.mealVariant + 1, // foods always rotate: the plan is reworked every month
    fromMonth: input.monthIndex + 1,
    expenditureOffset: tdee.offset,
    diet: decision.adaptations,
  };
  if (ctx.isMinor && ctx.goal === 'loseFat') next.calorieAdjustment = Math.max(next.calorieAdjustment, 0);

  // preview of the next month with the new calibration (what buildPlans will produce)
  const nextTargets = computeTargets(ctx, weeks.next ?? weeks.current, next);
  const otherChanges: string[] = [];
  const trainingDiff = nextTargets.calories - (targets.calories + effectiveStep);
  if (Math.abs(trainingDiff) >= 5) otherChanges.push(`${trainingDiff > 0 ? '+' : ''}${trainingDiff} kcal perché l'allenamento del mese prossimo ha un dispendio diverso (${nextTargets.adjustments.length ? nextTargets.adjustments.join(' ') : 'giorni di allenamento e riposo'}).`);
  if (effectiveStep !== decision.calorieStep) otherChanges.push(`Passo deciso ${decision.calorieStep} kcal, applicato ${effectiveStep} kcal per i limiti di sicurezza.`);
  if (!ctx.isMinor || ctx.goal !== 'loseFat') safety.push({ id: 'floor', ok: nextTargets.calories >= limits.floor, message: `Target del mese successivo ${nextTargets.calories} kcal, soglia individuale ${limits.floor} kcal.` });
  const balancePct = Math.round((nextTargets.calories / (nextTargets.averageExpenditure + tdee.offset) - 1) * 100);

  // G — explanation
  const changes: PlanChange[] = [];
  const stepShown = nextTargets.calories - targets.calories;
  if (supervision.length > 0) changes.push({ area: 'dieta', text: `Calorie invariate: con ${supervision.join(', ')} il piano va rivisto da un professionista prima di qualsiasi modifica.` });
  else if (effectiveStep !== 0) changes.push({ area: 'dieta', text: `Calorie ${effectiveStep > 0 ? '+' : ''}${effectiveStep} kcal al giorno (da ${targets.calories} a ${targets.calories + effectiveStep}).` });
  else changes.push({ area: 'dieta', text: `Calorie confermate a ${targets.calories} kcal${Math.abs(stepShown) >= 5 ? ` (${nextTargets.calories} nel mese prossimo per il diverso allenamento)` : ''}.` });
  for (const i of decision.interventions) {
    if (i.kind === 'confirm_calories' || i.kind === 'increase_calories' || i.kind === 'decrease_calories' || i.kind === 'request_info' || i.kind === 'professional_review') continue;
    changes.push({ area: i.kind === 'training_signal' ? 'allenamento' : 'dieta', text: i.text });
  }
  changes.push({ area: 'dieta', text: 'Nuova rotazione delle ricette del mese.' });
  changes.push(...training.changes);

  const reasons = [
    weight.explanation,
    adh.explanation,
    sus.signals.length ? `Sostenibilità: ${sus.signals.join(', ')}.` : 'Sostenibilità: nessun segnale di difficoltà.',
    ...decision.rules.map((r) => `Regola ${r}.`),
    ...decision.excluded.map((e) => `Alternativa esclusa — ${e}`),
    ...safety.filter((c) => !c.ok).map((c) => c.message),
    tdee.reason,
    ...training.reasons,
  ];
  const clarifications = decision.interventions.filter((i) => i.kind === 'request_info').map((i) => i.text);

  // the outcome of the previous decision, measured now
  const prevRecord = history[history.length - 1];
  const previousOutcome = prevRecord?.decision
    ? `Atteso: ${prevRecord.decision.expectedOutcome} Ottenuto: ${weight.rateKgWeek == null ? 'non misurabile (pesate insufficienti)' : `${weight.rateKgWeek > 0 ? '+' : ''}${weight.rateKgWeek.toFixed(2)} kg/sett.`}, aderenza ${adh.level}.`
    : undefined;

  const decisionLog: DecisionLog = {
    monthIndex: input.monthIndex,
    previousTarget: targets.calories,
    newTarget: nextTargets.calories,
    calorieStep: effectiveStep,
    otherChanges,
    tdeeModel: Math.round(nextTargets.averageExpenditure),
    tdeeEstimate: Math.round(nextTargets.averageExpenditure + tdee.offset),
    balancePct,
    previousMacros: targets.macros,
    newMacros: nextTargets.macros,
    weight: {
      count: weight.count,
      spanDays: weight.spanDays,
      quality: weight.quality,
      rateKgWeek: weight.rateKgWeek,
      recentRateKgWeek: weight.recentRateKgWeek,
      pctBodyWeightPerWeek: weight.pctBodyWeightPerWeek,
      classification: weight.classification,
      anomalies: weight.anomalies,
    },
    adherence: { score: adh.score, level: adh.level, causes: adh.causes },
    sustainability: sus,
    feedbackUsed: m.used,
    interventions: decision.interventions,
    rulesApplied: decision.rules,
    excludedAlternatives: decision.excluded,
    safety,
    clarifications,
    supervision: decision.supervision,
    expectedOutcome: decision.expectedOutcome,
  };

  return { verdict, weeklyRateKg: weight.rateKgWeek, expectedWeeklyKg, calibration: next, changes, reasons, clarifications, decision: decisionLog, previousOutcome };
}
