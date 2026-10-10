/**
 * Questionnaire helpers shared by the onboarding flow and the Profile editor,
 * so both decide "which questions does this step show" and "is this answer
 * complete" in exactly one way.
 */
import { parseNumericAnswer } from '@/lib/questionnaire/parse-answer';
import { buildActivityQuestions, isQuestionVisible, TIME_REGEX, type OnboardingStep, type Question } from '@/lib/questionnaire/schema';

// Spec §13 point 7: a "time" question isn't just non-empty, it must actually
// parse as HH:MM — otherwise the free-text answer used to silently fall
// back to a default further downstream in meal-slots.ts, with no feedback
// to the user that what they typed was ignored.
export function isAnswered(question: Question, value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value === undefined || value === null || value === '') return false;
  if (question.type === 'time') return TIME_REGEX.test(String(value).trim());
  if (question.type === 'number' && (question.min != null || question.max != null)) {
    const n = parseNumericAnswer(value);
    if (n == null) return false;
    if (question.min != null && n < question.min) return false;
    if (question.max != null && n > question.max) return false;
  }
  return true;
}

/** The questions a step shows for these answers: the Training step adds the dynamic per-activity ones, and conditional questions are hidden when their trigger is not met. */
export function getStepQuestions(step: OnboardingStep, answers: Record<string, unknown>): Question[] {
  const questions =
    step.id === 'training'
      ? [...step.questions, ...buildActivityQuestions((answers.activitiesPracticed as string[]) ?? [])]
      : step.questions;
  return questions.filter((q) => isQuestionVisible(q, answers));
}

/** True when every mandatory question of the step is answered (optional ones may stay empty). */
export function isStepComplete(step: OnboardingStep, answers: Record<string, unknown>): boolean {
  return getStepQuestions(step, answers).every((q) => q.optional || isAnswered(q, answers[q.id]));
}
