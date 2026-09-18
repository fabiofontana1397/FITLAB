/**
 * Scoped "progression engine" (spec §7 ter): a real load-progression rule
 * based on the user's own logged performance (reps achieved + RIR — reps
 * in reserve, how many more reps they could have done) instead of the flat
 * `suggestedKg = bodyweight × multiplier` estimate training-planner.ts uses
 * for a brand-new exercise. Deliberately scoped to load progression only —
 * the fuller mesocycle/microcycle restructuring documented in the spec as
 * "§7 bis" is a larger, separate UI project not attempted here.
 *
 * RIR is optional (see NewLoadModal) — a user who never logs it keeps
 * getting exactly today's behavior (last logged weight, unchanged), this
 * only activates once there's something to reason about.
 */
import { roundLoad } from './exercise-library';

export type ProgressionSetPoint = { date: string; weightKg: number; reps?: number; rir?: number };

export type ProgressionSuggestion = {
  suggestedKg: number;
  /** Short user-facing explanation, or null when there's nothing more to say than "same as last time". */
  note: string | null;
};

/** Parses the plan's target rep range string (e.g. "8-12", "15", "AMRAP")
 * into a numeric [min, max] — falls back to a generous default range when
 * unparseable, since this only gates how aggressively the suggestion
 * reacts, not whether it can run at all. */
function parseRepRange(reps: string): [number, number] {
  const match = reps.match(/(\d+)(?:\s*-\s*(\d+))?/);
  if (!match) return [6, 12];
  const min = Number(match[1]);
  const max = match[2] ? Number(match[2]) : min;
  return [min, max];
}

/**
 * `history` should be every logged set for this exercise, any order — only
 * the most recent (by date) with an `rir` value is used. Everything else
 * (weeks of history, trend analysis) is a further refinement; this is the
 * single-last-session rule real programs commonly start with (add load
 * when reps were easy, hold/deload when they weren't).
 */
export function suggestNextLoad(history: ProgressionSetPoint[], targetReps: string, fallbackKg: number | null): ProgressionSuggestion {
  const withRir = history.filter((h) => h.rir != null).sort((a, b) => a.date.localeCompare(b.date));
  const last = withRir[withRir.length - 1];

  if (!last || last.weightKg <= 0) {
    return { suggestedKg: fallbackKg ?? 0, note: null };
  }

  const [repMin, repMax] = parseRepRange(targetReps);
  const rir = last.rir!;
  const reps = last.reps ?? repMin;
  const metTarget = reps >= repMax;
  const missedTarget = reps < repMin;

  // Missed the rep target outright (regardless of RIR) — hold, don't add load.
  if (missedTarget) {
    return { suggestedKg: last.weightKg, note: 'Ripetizioni sotto il target: mantieni lo stesso carico.' };
  }

  // Very easy (high RIR) and hit the top of the range — a clear signal to jump.
  if (rir >= 4 && metTarget) {
    return { suggestedKg: roundLoad(last.weightKg * 1.075), note: 'Ultima sessione facile: prova ad aumentare il carico.' };
  }

  // Close to failure (low RIR) and still hit the top of the range — the
  // classic "ready to progress" signal, a smaller step than the easy case.
  if (rir <= 1 && metTarget) {
    return { suggestedKg: roundLoad(last.weightKg * 1.025), note: 'Vicino al cedimento con reps piene: piccolo aumento di carico.' };
  }

  // Anything else (mid-range RIR, or reps within range but not at the top) —
  // right where the plan wants it, hold and let reps climb first.
  return { suggestedKg: last.weightKg, note: 'In linea con il target: mantieni il carico e punta a più ripetizioni.' };
}
