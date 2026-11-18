/**
 * Load engine.
 *
 *  1. Initial load (no history): an estimated 1RM from bodyweight, sex, level
 *     and age, converted to the load for the target reps at the target RIR with
 *     the Epley relation (load = 1RM / (1 + reps/30), where reps = target reps +
 *     reps in reserve), lowered by 10% and rounded DOWN to the equipment's real
 *     increment. It is always marked "da calibrare": the first sessions find
 *     the true working load.
 *  2. Later months (no history yet): the same estimate projected with a small,
 *     level-dependent monthly progression, never decreasing — it is anchored to
 *     the questionnaire bodyweight, so losing weight does not lower the loads.
 *  3. With history: double progression on the person's own logged sets (see
 *     doubleProgression below), never a flat percentage on the whole plan.
 */
import type { CatalogExercise } from './catalog';
import type { Level } from './profile';

const LEVEL: Record<Level, number> = { beginner: 0.6, intermediate: 1, advanced: 1.25 };
const LOWER_BODY = new Set(['squat', 'hinge', 'lunge', 'kneeExtension', 'kneeFlexion', 'hipExtension', 'hipAbduction', 'hipAdduction', 'calfRaise']);

export function estimateE1rm(e: CatalogExercise, p: { bodyweightKg: number; sex: string; level: Level; age: number }): number | null {
  if (e.e1rmRatio == null) return null;
  const lower = LOWER_BODY.has(e.pattern);
  const sex = p.sex === 'female' ? (lower ? 0.7 : 0.55) : 1;
  const age = p.age >= 60 ? 0.8 : p.age >= 50 ? 0.88 : p.age < 18 ? 0.8 : 1;
  return p.bodyweightKg * e.e1rmRatio * sex * LEVEL[p.level] * age;
}

export function roundDown(raw: number, increment: number): number {
  const step = increment > 0 ? increment : 1;
  return Math.max(0, Math.floor(raw / step + 1e-9) * step);
}

export function roundNearest(raw: number, increment: number): number {
  const step = increment > 0 ? increment : 1;
  return Math.round(raw / step) * step;
}

/** Working load for `reps` with `rir` in reserve. */
export function loadFor(e1rm: number, reps: number, rir: number): number {
  return e1rm / (1 + (reps + rir) / 30);
}

export type LoadSuggestion = { kg: number | null; status: 'calibrate' | 'estimate' | 'bodyweight'; note: string };

export function initialLoad(args: {
  e: CatalogExercise;
  profile: { bodyweightKg: number; sex: string; level: Level; age: number };
  repsMax: number;
  rir: number;
  /** Months since the start of the plan (0 = first month). */
  monthsIn: number;
  /** True in the first month: the person is still finding the load. */
  calibrating: boolean;
}): LoadSuggestion {
  const { e, profile, repsMax, rir, monthsIn, calibrating } = args;
  if (e.e1rmRatio == null) {
    return { kg: null, status: 'bodyweight', note: e.timed ? 'A corpo libero: tieni la posizione con tecnica perfetta.' : e.loadType === 'band' ? 'Scegli l’elastico con cui arrivi al range lasciando le ripetizioni in riserva indicate.' : 'A corpo libero: se il range è troppo facile, usa la variante più difficile.' };
  }
  const e1rm = estimateE1rm(e, profile)!;
  // No load is ever raised by the calendar: without logged sets the later months keep the starting estimate
  // (adjusted only to the month's rep range and RIR); the real increases come from the person's history with the
  // double progression (doubleProgression below), when the criteria are met.
  void monthsIn;
  const raw = loadFor(e1rm, repsMax, rir) * 0.9;
  const kg = roundDown(raw, e.increment);
  const unit = e.loadType === 'dumbbell' ? ' per manubrio' : '';
  if (kg < e.increment || kg <= 0) {
    return { kg: e.increment || null, status: 'calibrate', note: `Parti dal carico più leggero disponibile${unit} e sali finché arrivi a ${repsMax} ripetizioni lasciandone ${rir} in riserva.` };
  }
  if (calibrating) {
    return {
      kg,
      status: 'calibrate',
      note: `Carico iniziale stimato${unit}, da calibrare: se fai più di ${repsMax} ripetizioni con ${rir} in riserva aumenta, se non arrivi a ${Math.max(1, repsMax - 4)} riduci.${e.loadType === 'machine' || e.loadType === 'cable' ? ' Le macchine variano molto da palestra a palestra.' : ''}`,
    };
  }
  return { kg, status: 'estimate', note: `Carico di partenza${unit}, non aumentato in automatico: sale solo quando completi il range con le ripetizioni in riserva previste (doppia progressione sul tuo storico).` };
}

// ------------------------------------------------------------------ history --

export type LoggedSetPoint = { date: string; weightKg: number; reps: number; rir?: number };

export type ProgressionDecision = {
  kg: number;
  action: 'increase' | 'hold' | 'reduce' | 'calibrate';
  note: string;
};

/**
 * Double progression on the last session's sets of one exercise.
 *  - every set at the top of the range with RIR ≥ target → add the smallest increment
 *    (two increments if the sets were far easier than planned: RIR ≥ target + 3);
 *  - reps inside the range → same load, aim for more reps;
 *  - below the bottom of the range for two sessions in a row at the same load → −5–10%;
 *  - below the bottom once → hold.
 * The RIR is a self-estimate: without it, the decision uses reps alone.
 */
export function doubleProgression(history: LoggedSetPoint[], target: { repsMin: number; repsMax: number; rir: number; increment: number }, fallbackKg: number | null): ProgressionDecision {
  const dated = [...history].filter((h) => h.weightKg > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (dated.length === 0) return { kg: fallbackKg ?? 0, action: 'calibrate', note: 'Nessun dato ancora: usa il carico iniziale e calibralo nelle prime sedute.' };
  const lastDate = dated[dated.length - 1].date;
  const session = dated.filter((h) => h.date === lastDate);
  const kg = Math.max(...session.map((s) => s.weightKg));
  const working = session.filter((s) => s.weightKg === kg);
  const allTop = working.every((s) => s.reps >= target.repsMax);
  const anyBelow = working.some((s) => s.reps < target.repsMin);
  const rirs = working.map((s) => s.rir).filter((r): r is number => r != null);
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null;
  const inc = target.increment > 0 ? target.increment : 2.5;

  if (anyBelow) {
    const prevDate = [...new Set(dated.map((d) => d.date))].filter((d) => d < lastDate).pop();
    const prev = prevDate ? dated.filter((d) => d.date === prevDate) : [];
    const prevKg = prev.length ? Math.max(...prev.map((s) => s.weightKg)) : null;
    const prevBelow = prevKg === kg && prev.filter((s) => s.weightKg === kg).some((s) => s.reps < target.repsMin);
    if (prevBelow) return { kg: roundDown(kg * 0.92, inc), action: 'reduce', note: 'Due sedute di fila sotto il range: riduci il carico di circa l’8% e ricostruisci le ripetizioni.' };
    return { kg, action: 'hold', note: 'Sotto il range minimo: tieni lo stesso carico e cura la tecnica.' };
  }
  if (allTop && (avgRir == null || avgRir >= target.rir)) {
    const jumps = avgRir != null && avgRir >= target.rir + 3 ? 2 : 1;
    return { kg: kg + inc * jumps, action: 'increase', note: jumps === 2 ? 'Serie molto più facili del previsto: aumenta di due incrementi.' : `Range completato: aumenta di ${String(inc).replace('.', ',')} kg e riparti dalla parte bassa del range.` };
  }
  if (allTop && avgRir != null && avgRir < target.rir) return { kg, action: 'hold', note: 'Range completato ma vicino al cedimento: ripeti il carico finché resta qualche ripetizione in riserva.' };
  return { kg, action: 'hold', note: 'Dentro il range: stesso carico, punta a una ripetizione in più per serie.' };
}

/** Best Epley 1RM of a session's sets. */
export function sessionE1rm(sets: { weightKg: number; reps: number; rir?: number }[]): number {
  return Math.max(0, ...sets.map((s) => s.weightKg * (1 + (s.reps + (s.rir ?? 0)) / 30)));
}
