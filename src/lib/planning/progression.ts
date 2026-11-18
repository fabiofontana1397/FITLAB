/**
 * Next-load suggestion for one exercise, from the person's own logged sets.
 *
 * Double progression (training/loads.ts → doubleProgression): the load stays
 * until every working set reaches the top of the rep range with the planned
 * reps in reserve, then it rises by the exercise's smallest real increment and
 * the reps start again from the bottom of the range. Two sessions in a row below
 * the range at the same load → a small reduction. RIR is optional: without it
 * the rule works on reps alone. No flat percentage is ever applied.
 */
import { doubleProgression } from './training/loads';

export type ProgressionSetPoint = { date: string; weightKg: number; reps?: number; rir?: number };

export type ProgressionSuggestion = {
  suggestedKg: number;
  /** Short user-facing explanation, or null when there's nothing more to say than "same as last time". */
  note: string | null;
};

/** Parses a rep range ("8-12", "15", "30-45 s") into [min, max]; a generous default when unparseable. */
export function parseRepRange(reps: string): [number, number] {
  const match = reps.match(/(\d+)(?:\s*-\s*(\d+))?/);
  if (!match) return [6, 12];
  const min = Number(match[1]);
  const max = match[2] ? Number(match[2]) : min;
  return [min, max];
}

export function suggestNextLoad(history: ProgressionSetPoint[], targetReps: string, fallbackKg: number | null, opts?: { rir?: number; incrementKg?: number }): ProgressionSuggestion {
  const [repsMin, repsMax] = parseRepRange(targetReps);
  const points = history.filter((h) => h.weightKg > 0).map((h) => ({ date: h.date, weightKg: h.weightKg, reps: h.reps ?? repsMin, rir: h.rir }));
  if (points.length === 0) return { suggestedKg: fallbackKg ?? 0, note: null };
  const d = doubleProgression(points, { repsMin, repsMax, rir: opts?.rir ?? 2, increment: opts?.incrementKg ?? 2.5 }, fallbackKg);
  return { suggestedKg: d.kg, note: d.action === 'calibrate' ? null : d.note };
}
