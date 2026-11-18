/**
 * Module B — Analysis. Reads what happened in the month: the weight trend (smoothed, with anomalies removed and a
 * persistence check), how well the plan was followed and why not, and how sustainable it felt.
 * Pure functions: no decision is taken here.
 */
import { NUTRITION_PARAMS as P } from './params';
import type { AdherenceAnalysis, MonitoringData, SustainabilityAnalysis, WeightAnalysis, WeightClass } from './types';

export type WeighIn = { date: string; kg: number };

const day = (iso: string) => Math.floor(new Date(iso).getTime() / 86_400_000);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Least-squares slope in kg/week (null with fewer than 2 points or no spread). */
export function slopeKgWeek(points: WeighIn[]): number | null {
  if (points.length < 2) return null;
  const x0 = day(points[0].date);
  const xs = points.map((p) => day(p.date) - x0);
  const ys = points.map((p) => p.kg);
  const mx = mean(xs);
  const my = mean(ys);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (den === 0) return null;
  return (xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den) * 7;
}

export function analyzeWeight(input: {
  weights: WeighIn[];
  currentKg: number;
  expectedKgWeek: number;
  /** −1 losing, +1 gaining, 0 maintaining. */
  direction: number;
  temporaryEvents: string[];
}): WeightAnalysis {
  const { currentKg, expectedKgWeek, direction, temporaryEvents } = input;
  const W = P.weight;
  const sorted = [...input.weights].filter((w) => w.kg > 0).sort((a, b) => a.date.localeCompare(b.date));

  // anomalies: far from the median of the weigh-ins within ±4 days
  const anomalies: WeighIn[] = [];
  const clean = sorted.filter((p) => {
    const near = sorted.filter((q) => q !== p && Math.abs(day(q.date) - day(p.date)) <= 4).map((q) => q.kg);
    if (near.length < 2) return true;
    const off = Math.abs(p.kg - median(near)) > Math.max(W.anomalyKg, currentKg * W.anomalyShare);
    if (off) anomalies.push(p);
    return !off;
  });

  const count = clean.length;
  const spanDays = count >= 2 ? day(clean[count - 1].date) - day(clean[0].date) : 0;
  const quality: WeightAnalysis['quality'] =
    count >= W.goodMinCount && spanDays >= W.goodMinSpanDays ? 'good' : count >= W.limitedMinCount && spanDays >= W.limitedMinSpanDays ? 'limited' : 'none';

  const movingAverage = clean.map((p) => ({ date: p.date, kg: Math.round(mean(clean.filter((q) => day(q.date) <= day(p.date) && day(q.date) > day(p.date) - 7).map((q) => q.kg)) * 100) / 100 }));
  const weeks = new Map<number, number[]>();
  for (const p of clean) {
    const w = Math.floor((day(p.date) - day(clean[0].date)) / 7);
    weeks.set(w, [...(weeks.get(w) ?? []), p.kg]);
  }
  const weekKeys = [...weeks.keys()].sort((a, b) => a - b);
  const weeklyMeans = weekKeys.map((k) => Math.round(mean(weeks.get(k)!) * 100) / 100);
  const weeklyMeansRate = weekKeys.length >= 2 ? (weeklyMeans[weeklyMeans.length - 1] - weeklyMeans[0]) / (weekKeys[weekKeys.length - 1] - weekKeys[0]) : null;

  const rate = quality === 'none' ? null : slopeKgWeek(clean);
  const half = count >= 2 ? day(clean[0].date) + spanDays / 2 : 0;
  const recentPts = clean.filter((p) => day(p.date) >= half);
  const recentRate = recentPts.length >= 3 ? slopeKgWeek(recentPts) : null;
  const pct = rate == null ? null : (rate / currentKg) * 100;
  const still = currentKg * W.stillShare;
  const sameSign = (a: number | null, b: number | null) => a == null || b == null || Math.sign(a) === Math.sign(b) || Math.abs(b) <= still;
  const persistent = rate != null && sameSign(rate, recentRate) && sameSign(rate, weeklyMeansRate);

  let classification: WeightClass;
  let explanation: string;
  const fmt = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)} kg/sett.`;
  if (rate == null) {
    classification = 'insufficient_data';
    explanation = `Pesate insufficienti: ${count} valide in ${spanDays} giorni (ne servono almeno ${W.limitedMinCount} in ${W.limitedMinSpanDays} giorni, e ${W.goodMinCount} in ${W.goodMinSpanDays} per valutare uno stallo).`;
  } else if (direction === 0) {
    const band = Math.max(W.maintenanceBandKg, currentKg * W.maintenanceBandShare);
    if (Math.abs(rate) <= band) {
      classification = 'on_track';
      explanation = `Peso stabile (${fmt(rate)}, entro ±${band.toFixed(2)}).`;
    } else {
      classification = rate > 0 ? 'weight_up' : 'weight_down';
      explanation = `Obiettivo di mantenimento ma il peso ${rate > 0 ? 'sale' : 'scende'} di ${fmt(rate)} (oltre ±${band.toFixed(2)}).`;
    }
  } else {
    const ratio = rate / expectedKgWeek;
    if (direction * rate < -still) {
      classification = 'wrong_direction';
      explanation = `Il peso va nella direzione opposta all'obiettivo (${fmt(rate)} invece di ${fmt(expectedKgWeek)}).`;
    } else if (ratio < W.plateauRatio || Math.abs(rate) <= still) {
      classification = 'plateau';
      explanation = `Peso fermo (${fmt(rate)} contro ${fmt(expectedKgWeek)} previsti).`;
    } else if (ratio < W.slowRatio) {
      classification = 'too_slow';
      explanation = `Progressi più lenti del previsto (${fmt(rate)} contro ${fmt(expectedKgWeek)}).`;
    } else if ((direction < 0 && (ratio > W.fastRatio || Math.abs(rate) > currentKg * W.maxLossShare)) || (direction > 0 && ratio > W.fastRatio && rate > currentKg * W.gainFastShare)) {
      classification = 'too_fast';
      explanation = `Variazione troppo rapida (${fmt(rate)}, ${Math.abs(pct!).toFixed(2)}% del peso a settimana, contro ${fmt(expectedKgWeek)}).`;
    } else {
      classification = 'on_track';
      explanation = `Progressi in linea (${fmt(rate)} contro ${fmt(expectedKgWeek)}).`;
    }
  }
  // a deviation with a known temporary cause that is not constant over the month, or that comes from the last
  // week alone (water, glycogen, sodium), is not read as a change in body fat
  const lastDay = count > 0 ? day(clean[count - 1].date) : 0;
  const beforeLastWeek = clean.filter((p) => day(p.date) <= lastDay - 7);
  const rateBefore = beforeLastWeek.length >= 4 ? slopeKgWeek(beforeLastWeek) : null;
  const lastWeekEffect = rate != null && rateBefore != null && Math.abs(rate - rateBefore) > 0.15;
  if (classification !== 'on_track' && classification !== 'insufficient_data' && (!persistent || lastWeekEffect) && temporaryEvents.length > 0) {
    explanation += ` La variazione non è costante nel mese e coincide con ${temporaryEvents.length > 1 ? 'eventi temporanei' : 'un evento temporaneo'}: la tratto come oscillazione, non come cambiamento reale.`;
    classification = 'temporary_variation';
  }
  if (anomalies.length > 0) explanation += ` Escluse ${anomalies.length} pesate anomale.`;

  return {
    count,
    spanDays,
    quality,
    anomalies,
    rateKgWeek: rate == null ? null : Math.round(rate * 1000) / 1000,
    recentRateKgWeek: recentRate == null ? null : Math.round(recentRate * 1000) / 1000,
    weeklyMeansRate: weeklyMeansRate == null ? null : Math.round(weeklyMeansRate * 1000) / 1000,
    movingAverage,
    weeklyMeans,
    pctBodyWeightPerWeek: pct == null ? null : Math.round(pct * 100) / 100,
    persistent,
    expectedKgWeek,
    classification,
    explanation,
  };
}

const SKIPPED_SCORE: Record<string, number> = { none: 1, '1-2': 0.8, '3-5': 0.5, gt5: 0.2 };

export function analyzeAdherence(m: MonitoringData, input: { avgEatenKcal: number | null; mealDaysTracked: number; targetKcal: number; trainingCompletion: number | null }): AdherenceAnalysis {
  const parts: { w: number; v: number }[] = [];
  if (m.adherenceSelf != null) parts.push({ w: 0.5, v: (m.adherenceSelf - 1) / 4 });
  const intakeRatio = input.avgEatenKcal != null && input.mealDaysTracked >= P.adherence.minTrackedDays ? input.avgEatenKcal / input.targetKcal : null;
  if (intakeRatio != null) parts.push({ w: 0.3, v: 1 - Math.min(Math.abs(intakeRatio - 1) / 0.3, 1) });
  if (m.skippedMeals) parts.push({ w: 0.2, v: SKIPPED_SCORE[m.skippedMeals] });
  const score = parts.length ? parts.reduce((s, p) => s + p.w * p.v, 0) / parts.reduce((s, p) => s + p.w, 0) : null;

  const causes: string[] = [];
  if ((m.eatingOutPerWeek ?? 0) >= 1 || m.notesFacts.eatingOut) causes.push(`pasti fuori casa${m.eatingOutPerWeek ? ` (${m.eatingOutPerWeek} a settimana)` : ''}`);
  if (m.skippedMeals === '3-5' || m.skippedMeals === 'gt5') causes.push('pasti saltati');
  if (m.difficulties.includes('mealTimes')) causes.push('orari dei pasti');
  if (m.difficulties.includes('preparation') || m.difficulties.includes('organization')) causes.push('preparazione e organizzazione');
  if (m.events.includes('stress')) causes.push('periodo di stress');
  if (m.events.includes('travel')) causes.push('viaggi');

  const intakeOff = intakeRatio != null && Math.abs(intakeRatio - 1) > P.adherence.intakeOffShare;
  let level: AdherenceAnalysis['level'];
  if (score == null) level = 'unknown';
  else if ((m.adherenceSelf != null && m.adherenceSelf <= 2) || intakeOff || score < P.adherence.low) level = 'low';
  else if (score >= P.adherence.high) level = 'high';
  else level = 'medium';

  const explanation =
    level === 'unknown'
      ? 'Aderenza non valutabile: nessuna risposta né registrazione dei pasti.'
      : `Aderenza ${level === 'high' ? 'alta' : level === 'medium' ? 'parziale' : 'bassa'} (${Math.round(score! * 100)}/100${m.adherenceSelf != null ? `, autovalutazione ${m.adherenceSelf}/5` : ''}${intakeRatio != null ? `, mangiato ${Math.round(intakeRatio * 100)}% del target nei giorni registrati` : ''}).${causes.length ? ` Cause indicate: ${causes.join(', ')}.` : ''}`;
  return { score: score == null ? null : Math.round(score * 100) / 100, level, intakeRatio, causes, explanation };
}

export function analyzeSustainability(m: MonitoringData): SustainabilityAnalysis {
  const signals: string[] = [];
  if (m.hunger === 'often') signals.push('fame frequente');
  if (m.hunger === 'always') signals.push('fame costante');
  if (m.energy === 'low') signals.push('energia bassa');
  if (m.energy === 'veryLow') signals.push('energia molto bassa');
  if (m.difficulties.includes('soreness')) signals.push('recupero difficile');
  if (m.quantity?.direction === 'tooLittle') signals.push('porzioni percepite scarse');
  if (m.quantity?.direction === 'tooMuch') signals.push('porzioni percepite eccessive');
  const critical = m.energy === 'veryLow' || (m.hunger === 'always' && m.energy === 'low');
  return { level: critical ? 'critical' : signals.length > 0 ? 'strained' : 'ok', signals };
}
