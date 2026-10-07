/**
 * Monthly recalibration — the "coach" that closes the loop.
 *
 * At the end of every plan month (the first one included) it looks at what
 * REALLY happened — weight trend, how much of the training was done, how many
 * days of meals were logged, how the person felt — compares it with what the
 * plan expected, and decides how both plans change for the next months. Plans
 * are ALWAYS reworked, also when everything is on track (new food rotation,
 * progression) and above all when progress is missing.
 *
 * It is a pure function with typed input and output on purpose:
 *  - the app calls it at check-in time and applies the result with
 *    `buildPlans(ctx, { calibration, preserveMonthsBefore, existing })`;
 *  - an AI agent can be given the same input, produce the same output shape
 *    (a `RecalibrationProposal`), and `applyGuardrails` clamps it to safe
 *    bounds — so an agent can never push calories below the floor or jump by
 *    hundreds of kcal in a month, whatever it answers;
 *  - the test harness simulates months of virtual bodies through it.
 */
import { MIN_CALORIES, type PlanTargets } from './targets';
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
};

export const NEUTRAL_CALIBRATION: PlanCalibration = { calorieAdjustment: 0, setsDelta: 0, loadFactor: 1, mealVariant: 0, fromMonth: 1 };

/** Largest cumulative calorie change recalibration may apply, and the largest single monthly step. */
export const MAX_TOTAL_ADJUSTMENT = 500;
export const MAX_MONTHLY_STEP = 150;

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

export type CheckinSignals = {
  /** 1–5. */
  adherence?: number;
  energy?: 'veryLow' | 'low' | 'normal' | 'high' | 'veryHigh';
  hunger?: 'never' | 'rarely' | 'sometimes' | 'often' | 'always';
  difficulty?: string[];
  wantsChange?: string[];
};

export type RecalibrationInput = {
  ctx: UserContext;
  /** The month that just ended (1-based). */
  monthIndex: number;
  durationMonths: number;
  /** Targets the person followed during that month. */
  targets: PlanTargets;
  /** Weigh-ins covering that month (any order). */
  weights: WeightPoint[];
  adherence: Adherence;
  checkin: CheckinSignals;
  calibration: PlanCalibration;
};

export type Verdict =
  | 'on_track'
  | 'too_slow'
  | 'plateau'
  | 'wrong_direction'
  | 'too_fast'
  | 'low_adherence'
  | 'insufficient_data';

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
};

/** What an AI agent may propose: only these knobs, all optional. */
export type RecalibrationProposal = Partial<Pick<PlanCalibration, 'calorieAdjustment' | 'setsDelta' | 'loadFactor'>> & { note?: string };

// ----------------------------------------------------------------- helpers --

function dayNumber(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 86_400_000);
}

/** Weight trend in kg/week by least squares over the weigh-ins (needs ≥3 points over ≥14 days, or 2 points ≥10 days apart). */
export function weightTrendKgPerWeek(weights: WeightPoint[]): number | null {
  const pts = [...weights].filter((w) => w.kg > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 2) return null;
  const x0 = dayNumber(pts[0].date);
  const span = dayNumber(pts[pts.length - 1].date) - x0;
  if (span < 10 || (pts.length < 3 && span < 14)) return null;
  const n = pts.length;
  const xs = pts.map((p) => dayNumber(p.date) - x0);
  const ys = pts.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (den === 0) return null;
  return (num / den) * 7;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Clamps any proposal (from the engine or an AI agent) to safe bounds. */
export function applyGuardrails(
  ctx: Pick<UserContext, 'sex' | 'isMinor' | 'goal'>,
  targets: Pick<PlanTargets, 'calories'>,
  previous: PlanCalibration,
  proposal: RecalibrationProposal
): PlanCalibration {
  let adjustment = proposal.calorieAdjustment ?? previous.calorieAdjustment;
  // one month never moves calories by more than MAX_MONTHLY_STEP, and the total stays within ±MAX_TOTAL_ADJUSTMENT
  adjustment = clamp(adjustment, previous.calorieAdjustment - MAX_MONTHLY_STEP, previous.calorieAdjustment + MAX_MONTHLY_STEP);
  adjustment = clamp(adjustment, -MAX_TOTAL_ADJUSTMENT, MAX_TOTAL_ADJUSTMENT);
  // never below the safety floor
  const floor = MIN_CALORIES[ctx.sex];
  const withoutOld = targets.calories - previous.calorieAdjustment;
  if (withoutOld + adjustment < floor) adjustment = floor - withoutOld;
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

/**
 * Decides the next calibration. Rules (kept simple on purpose, each one a
 * defensible coaching rule):
 *
 *  1. Not enough weigh-ins → keep calories (never guess), still rotate foods and progress training.
 *  2. Low adherence (checked-in ≤2/5, or fewer than 40% of days tracked, or under
 *     half of the sessions done) → the problem is following the plan, not the
 *     numbers: calories stay, the plan gets EASIER (one set less) and foods rotate.
 *  3. Measured rate vs expected rate (adequate adherence):
 *       - wrong direction / plateau on a loss or gain goal → ±150 (cap) toward the goal;
 *       - too slow (<60% of the expected rate) → ±100;
 *       - on track (60%–150%) → keep;
 *       - too fast (>150%, or beyond 1% bodyweight per week when losing) → ∓100.
 *     Maintenance goals: drift beyond ±0.25 kg/week → ∓100.
 *  4. Hunger "often/always" while losing → +50; "never" while gaining → −50 (small, after rule 3).
 *  5. Energy "low/veryLow" or soreness → one set less; "high/veryHigh" with good adherence and progress → +3% load.
 */
export function recalibrate(input: RecalibrationInput): RecalibrationResult {
  const { ctx, targets, weights, adherence, checkin, calibration } = input;
  const reasons: string[] = [];
  const changes: PlanChange[] = [];
  const expectedWeeklyKg = targets.pace.weeklyKg;
  const rate = weightTrendKgPerWeek(weights);
  const goalDirection = Math.sign(expectedWeeklyKg); // −1 loss, +1 gain, 0 maintenance

  // Adherence: the person says so, completed fewer than half of the planned sessions, or — when meals were
  // tracked reliably — ate far from the target (then the weight reflects what was eaten, not the plan).
  const intakeOff = adherence.avgEatenKcal != null && Math.abs(adherence.avgEatenKcal / targets.calories - 1) > 0.2;
  const lowAdherence =
    (checkin.adherence != null && checkin.adherence <= 2) ||
    (adherence.trainingCompletion != null && adherence.trainingCompletion < 0.5) ||
    intakeOff;

  let verdict: Verdict;
  let calorieStep = 0;
  let setsDelta = 0;
  let loadFactor = 1;
  const mealVariant = calibration.mealVariant + 1; // foods always rotate: the plan is reworked every month

  if (lowAdherence) {
    verdict = 'low_adherence';
    reasons.push(intakeOff ? 'Le calorie mangiate si discostano di oltre il 20% dal target: il peso riflette ciò che è stato mangiato, non il piano.' : 'Poca aderenza al piano: il problema è seguirlo, non i numeri.');
    setsDelta = -1;
    changes.push({ area: 'allenamento', text: 'Allenamenti più leggeri (una serie in meno per esercizio) per rendere il piano più facile da seguire.' });
    changes.push({ area: 'dieta', text: 'Nuovi alimenti e abbinamenti per i pasti, mantenendo le stesse calorie.' });
  } else if (rate == null) {
    verdict = 'insufficient_data';
    reasons.push('Poche pesate nel mese: le calorie restano invariate finché non ci sono dati affidabili.');
    changes.push({ area: 'dieta', text: 'Calorie invariate (servono più pesate per valutare i progressi). Nuova rotazione degli alimenti.' });
    setsDelta = 0;
  } else if (goalDirection === 0) {
    const drift = rate;
    if (Math.abs(drift) > 0.25) {
      verdict = drift > 0 ? 'too_fast' : 'too_slow';
      calorieStep = drift > 0 ? -100 : 100;
      reasons.push(`Obiettivo di mantenimento ma il peso varia di ${drift.toFixed(2)} kg a settimana.`);
    } else {
      verdict = 'on_track';
      reasons.push('Peso stabile come previsto.');
    }
  } else {
    const ratio = rate / expectedWeeklyKg; // positive when moving the right way
    if (ratio < 0) {
      verdict = 'wrong_direction';
      calorieStep = goalDirection < 0 ? -150 : 150; // lose: −150, gain: +150
      reasons.push(`Il peso si muove nella direzione opposta all'obiettivo (${rate.toFixed(2)} kg/sett. invece di ${expectedWeeklyKg.toFixed(2)}).`);
    } else if (ratio < 0.25) {
      verdict = 'plateau';
      calorieStep = goalDirection < 0 ? -150 : 150;
      reasons.push('Il peso è fermo: il piano va stimolato.');
    } else if (ratio < 0.6) {
      verdict = 'too_slow';
      calorieStep = goalDirection < 0 ? -100 : 100;
      reasons.push(`Progressi più lenti del previsto (${rate.toFixed(2)} kg/sett. contro ${expectedWeeklyKg.toFixed(2)}).`);
    } else if (ratio > 1.5 || (goalDirection < 0 && Math.abs(rate) > ctx.weightKg * 0.01)) {
      verdict = 'too_fast';
      calorieStep = goalDirection < 0 ? 100 : -100;
      reasons.push('Progressi troppo rapidi per essere sostenibili: si rialzano le calorie.');
    } else {
      verdict = 'on_track';
      reasons.push('Progressi in linea con il piano.');
    }
  }

  // hunger / energy nudges
  if (checkin.hunger && (checkin.hunger === 'always' || checkin.hunger === 'often') && goalDirection <= 0 && calorieStep >= 0 && verdict !== 'low_adherence') {
    calorieStep += 50;
    reasons.push('Fame frequente: +50 kcal.');
  } else if (checkin.hunger === 'never' && goalDirection > 0 && calorieStep <= 0 && verdict !== 'low_adherence') {
    calorieStep -= 50;
    reasons.push('Nessuna fame in fase di surplus: −50 kcal.');
  }
  const sore = checkin.difficulty?.includes('soreness') ?? false;
  if (verdict !== 'low_adherence') {
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
  }
  if (verdict !== 'low_adherence' && setsDelta === 0 && loadFactor === 1) {
    changes.push({ area: 'allenamento', text: 'Progressione normale: carichi in salita graduale e rotazione degli esercizi di supporto.' });
  }

  // build the proposal and clamp it
  const proposal: RecalibrationProposal = {
    calorieAdjustment: calibration.calorieAdjustment + calorieStep,
    setsDelta,
    loadFactor: loadFactor === 1 ? 1 : loadFactor,
  };
  const next = applyGuardrails(ctx, targets, calibration, proposal);
  next.mealVariant = mealVariant;
  next.fromMonth = input.monthIndex + 1;

  const realStep = next.calorieAdjustment - calibration.calorieAdjustment;
  if (realStep !== 0) {
    changes.unshift({ area: 'dieta', text: `Calorie ${realStep > 0 ? '+' : ''}${realStep} kcal al giorno (da ${targets.calories} a ${targets.calories + realStep}) per riportare il peso verso l'obiettivo.` });
  } else if (verdict === 'on_track') {
    changes.unshift({ area: 'dieta', text: 'Calorie confermate: stai andando come previsto. Nuova rotazione degli alimenti.' });
  }
  if (calorieStep !== 0 && realStep === 0) reasons.push('Il limite di sicurezza ha impedito di cambiare le calorie.');

  return { verdict, weeklyRateKg: rate, expectedWeeklyKg, calibration: next, changes, reasons };
}
