import type { Goal } from '@/lib/mock/types';
import { parseNumericAnswer } from '@/lib/questionnaire/parse-answer';

// Safe, sustainable rate of body-weight change per week, by goal — sports-
// nutrition ballpark figures (≈0.5-1%/week for fat loss, much slower for
// natural muscle gain), not derived from the questionnaire's calorie target
// itself: using a fixed calorie-implied deficit/surplus would make the plan
// length swing wildly with GOAL_CALORIE_FACTOR's arbitrary multiplier
// instead of reflecting an actually-recommended pace. Goals with no natural
// "kg to change" target (maintenance/endurance/general health) aren't in
// this map — they fall through to DEFAULT_DURATION_MONTHS below.
const KG_PER_WEEK_BY_GOAL: Partial<Record<Goal, number>> = {
  loseFat: 0.5,
  gainMuscle: 0.25,
  gainStrength: 0.25,
};

const MIN_DURATION_MONTHS = 2;
const MAX_DURATION_MONTHS = 12;
// Used whenever there's no valid weight-change target to size a duration on
// (goal without a kg/week rate above, missing/zero current or target
// weight, or a target on the wrong side of current for the stated goal) —
// long enough for a real adattamento → progressione → consolidamento arc.
const DEFAULT_DURATION_MONTHS = 4;
const WEEKS_PER_MONTH = 4.345;
// Below this, treat the stated target as "no real change requested" rather
// than compute a near-zero, oddly-specific duration off a rounding error.
const MIN_MEANINGFUL_KG_DELTA = 0.5;

/**
 * How many months the generated plan should span, so diet and training
 * share one coherent timeline (spec §0.4/§13 point 8: previously a fixed 6
 * regardless of goal or answers). Deterministic, not AI-driven: kg-to-change
 * (currentWeightKg vs targetWeightKg, direction depending on goal) divided
 * by a safe weekly rate of change gives weeks needed, rounded up to whole
 * months and clamped to a sane range.
 */
export function computePlanDurationMonths(answers: Record<string, unknown>): number {
  const goal = answers.goal as Goal | undefined;
  const weeklyRateKg = goal ? KG_PER_WEEK_BY_GOAL[goal] : undefined;
  const currentWeightKg = parseNumericAnswer(answers.currentWeightKg) ?? 0;
  const targetWeightKg = parseNumericAnswer(answers.targetWeightKg) ?? 0;
  if (!weeklyRateKg || currentWeightKg <= 0 || targetWeightKg <= 0) return DEFAULT_DURATION_MONTHS;

  const kgDelta = goal === 'loseFat' ? currentWeightKg - targetWeightKg : targetWeightKg - currentWeightKg;
  if (kgDelta < MIN_MEANINGFUL_KG_DELTA) return DEFAULT_DURATION_MONTHS;

  const weeksNeeded = kgDelta / weeklyRateKg;
  const monthsNeeded = Math.ceil(weeksNeeded / WEEKS_PER_MONTH);
  return Math.min(Math.max(monthsNeeded, MIN_DURATION_MONTHS), MAX_DURATION_MONTHS);
}
