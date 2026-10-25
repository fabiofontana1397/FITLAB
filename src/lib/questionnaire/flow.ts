/**
 * The onboarding flow: the same questions as ever (schema.ts), laid out one
 * per screen instead of one step per screen.
 *
 * Nothing here decides *which* questions exist — `stepsForMode` and
 * `getStepQuestions` still do, so conditional questions (a snack time that
 * only appears once that meal is selected, the home-equipment list, the
 * per-activity frequency/focus questions) appear and disappear exactly as
 * before. This module only flattens them into an ordered list of screens
 * and gives each screen a stable id, so the flow can be rebuilt from the
 * current answers after every change without losing the user's place.
 */
import { getStepQuestions, isAnswered } from '@/lib/questionnaire/step-questions';
import { stepsForMode, type OnboardingMode, type OnboardingStep, type Question } from '@/lib/questionnaire/schema';

export const INTRO_SCREEN_ID = '__intro';
export const SUMMARY_SCREEN_ID = '__summary';

export type FlowScreen =
  | { id: typeof INTRO_SCREEN_ID; kind: 'intro' }
  | {
      id: string;
      kind: 'question';
      question: Question;
      step: OnboardingStep;
      /** First question of its step: the one screen that carries the step's subtitle/banner. */
      isStepOpener: boolean;
      /** 1-based position of the step inside the chosen mode, for the "Profilo fisico · 1/8" kicker. */
      stepNumber: number;
      stepCount: number;
    }
  | { id: typeof SUMMARY_SCREEN_ID; kind: 'summary' };

/**
 * Builds the screen list for the chosen mode and the answers given so far.
 * Call it on every render: it is cheap, and rebuilding is what keeps the
 * conditional questions honest (answering "mi alleno a casa" inserts the
 * equipment screen right after the current one, un-answering removes it).
 */
export function buildFlow(mode: OnboardingMode | null, answers: Record<string, unknown>): FlowScreen[] {
  const screens: FlowScreen[] = [{ id: INTRO_SCREEN_ID, kind: 'intro' }];
  if (!mode) return screens;

  const steps = stepsForMode(mode);
  steps.forEach((step, index) => {
    getStepQuestions(step, answers).forEach((question, questionIndex) => {
      screens.push({
        id: question.id,
        kind: 'question',
        question,
        step,
        isStepOpener: questionIndex === 0,
        stepNumber: index + 1,
        stepCount: steps.length,
      });
    });
  });

  screens.push({ id: SUMMARY_SCREEN_ID, kind: 'summary' });
  return screens;
}

/**
 * Where to open the questionnaire for answers saved earlier: the first
 * mandatory question still unanswered, or the intro when there is nothing to
 * resume. Answers are saved one by one (onboarding-store), so an app killed
 * mid-flow — or a second device — comes back with part of the questionnaire
 * filled in; with one question per screen, starting from the top again would
 * mean tapping Continua through two dozen answered screens. A questionnaire
 * that is already complete opens at the intro: there is nothing to resume,
 * and the person is there to review it.
 */
export function resumeIndex(flow: FlowScreen[], answers: Record<string, unknown>): number {
  const firstOpen = flow.findIndex(
    (screen) => screen.kind === 'question' && !screen.question.optional && !isAnswered(screen.question, answers[screen.question.id])
  );
  return firstOpen === -1 ? 0 : firstOpen;
}

/**
 * Progress along the path actually being walked. Conditional questions make
 * the total move as answers change, so this is deliberately the share of the
 * *current* flow that is behind you rather than a fixed "step 3 of 8" that
 * would promise a length the questionnaire never had.
 */
export function flowProgress(index: number, total: number): number {
  if (total <= 1) return 0;
  return Math.min(1, Math.max(0, index / (total - 1)));
}
