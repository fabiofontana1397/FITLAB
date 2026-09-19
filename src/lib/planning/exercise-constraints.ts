import type { BodyArea, ExerciseDef } from './exercise-library';
import { SAFE_FALLBACK_EXERCISE } from './exercise-library';

// Free-text (Italian) → body area, matched against painDetails/
// cannotDoDetails/recentInjuriesDetails so "mi fa male il ginocchio"
// excludes every knee-loading exercise even though the user never named
// one specifically.
const AREA_KEYWORDS: Record<BodyArea, string[]> = {
  knee: ['ginocchio', 'ginocchia'],
  shoulder: ['spalla', 'spalle', 'cuffia dei rotatori', 'cuffia'],
  lowerBack: ['schiena', 'lombare', 'lombari', 'lombo'],
  wrist: ['polso', 'polsi'],
  hip: ['anca', 'anche', 'bacino'],
};

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Pulls the free-text limitation fields the questionnaire actually
 * collects (schema.ts's "limitations" section) into one lowercased blob —
 * only when the corresponding yes/no flag is actually "sì"/"yes", so a
 * leftover detail string from a flag the user later flipped back to "no"
 * doesn't still exclude exercises. */
function limitationText(answers: Record<string, unknown>): string {
  const isYes = (v: unknown) => v === 'yes' || v === 'sì' || v === 'si' || v === true;
  const parts: string[] = [];
  if (isYes(answers.hasPain) && typeof answers.painDetails === 'string') parts.push(answers.painDetails);
  if (isYes(answers.cannotDoExercises) && typeof answers.cannotDoDetails === 'string') parts.push(answers.cannotDoDetails);
  if (isYes(answers.recentInjuries) && typeof answers.recentInjuriesDetails === 'string') parts.push(answers.recentInjuriesDetails);
  return normalize(parts.join(' . '));
}

export type ExerciseExclusions = { areas: Set<BodyArea>; text: string };

export function deriveExerciseExclusions(answers: Record<string, unknown>): ExerciseExclusions {
  const text = limitationText(answers);
  const areas = new Set<BodyArea>();
  for (const [area, keywords] of Object.entries(AREA_KEYWORDS) as [BodyArea, string[]][]) {
    if (keywords.some((k) => text.includes(k))) areas.add(area);
  }
  return { areas, text };
}

function isExcluded(exercise: ExerciseDef, exclusions: ExerciseExclusions): boolean {
  if (exercise.areas.some((a) => exclusions.areas.has(a))) return true;
  if (exclusions.text.length > 0 && exercise.keywords.some((k) => exclusions.text.includes(normalize(k)))) return true;
  return false;
}

/** Home-only equipment filter (see ExerciseDef.equipment): an exercise
 * with no equipment requirement always passes; one that requires equipment
 * passes only if the user declared owning at least one item it needs.
 * Never returns an empty pool — if every candidate would need equipment
 * the user doesn't have, the unfiltered pool is returned instead of
 * leaving the split with zero options (safer than an empty session, and
 * matches this file's other exclusion fallbacks). `equipment` is undefined
 * for GYM_EXERCISES entries and for any `trainingLocation` other than
 * `home` — callers should skip this filter in that case. */
export function filterByEquipment(pool: ExerciseDef[], ownedEquipment: unknown): ExerciseDef[] {
  const owned = Array.isArray(ownedEquipment) ? (ownedEquipment as string[]) : null;
  if (!owned || owned.length === 0) return pool;
  const filtered = pool.filter((e) => !e.equipment || e.equipment.length === 0 || e.equipment.some((eq) => owned.includes(eq)));
  return filtered.length > 0 ? filtered : pool;
}

export type ExerciseSelection = {
  exercises: ExerciseDef[];
  /** True when neither this split nor the wider catalog had any compatible
   * exercise, so the universally-safe bodyweight exercise was substituted
   * in — spec §4.3's "nessun esercizio compatibile" edge case should never
   * be silently presented as an ordinary recommendation to the caller. */
  usedSafeFallback: boolean;
};

/** Takes up to `count` candidates from `pool` (already in priority order)
 * that don't conflict with the user's stated pain/injury/exercise
 * limitations — later candidates in the same split act as substitutes for
 * an excluded one. If every candidate for that split got excluded,
 * `widerCatalog` (when supplied — e.g. every split's exercises combined)
 * is searched next before falling back to the universally-safe bodyweight
 * exercise, so a knee injury that wipes out an entire "Legs" split can
 * still pull a compatible exercise from "Lower"/"Full Body" instead of
 * immediately landing on Plank. Never repeats an exercise within the same
 * session just to hit `count`: a shorter, non-redundant workout is better
 * than the same lift 3 times. */
export function selectExercises(
  pool: ExerciseDef[],
  count: number,
  exclusions: ExerciseExclusions,
  widerCatalog?: ExerciseDef[]
): ExerciseSelection {
  const allowed = pool.filter((e) => !isExcluded(e, exclusions));
  if (allowed.length > 0) return { exercises: allowed.slice(0, Math.min(count, allowed.length)), usedSafeFallback: false };

  if (widerCatalog) {
    const seen = new Set(pool.map((e) => e.id));
    const fromWiderCatalog = widerCatalog.filter((e) => !seen.has(e.id) && !isExcluded(e, exclusions));
    const deduped = [...new Map(fromWiderCatalog.map((e) => [e.id, e])).values()];
    if (deduped.length > 0) return { exercises: deduped.slice(0, Math.min(count, deduped.length)), usedSafeFallback: false };
  }

  return { exercises: [SAFE_FALLBACK_EXERCISE], usedSafeFallback: true };
}
