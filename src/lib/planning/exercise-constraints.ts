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

/** Takes up to `count` candidates from `pool` (already in priority order)
 * that don't conflict with the user's stated pain/injury/exercise
 * limitations — later candidates in the same split act as substitutes for
 * an excluded one, so this only falls back to the universally-safe
 * bodyweight exercise if every candidate for that split got excluded.
 * Never repeats an exercise within the same session just to hit `count`:
 * a shorter, non-redundant workout is better than the same lift 3 times. */
export function selectExercises(pool: ExerciseDef[], count: number, exclusions: ExerciseExclusions): ExerciseDef[] {
  const allowed = pool.filter((e) => !isExcluded(e, exclusions));
  const source = allowed.length > 0 ? allowed : [SAFE_FALLBACK_EXERCISE];
  return source.slice(0, Math.min(count, source.length));
}
