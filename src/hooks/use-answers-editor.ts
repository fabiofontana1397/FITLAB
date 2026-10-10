import { useCallback } from 'react';

import { analyzeAnswersImpact, type AnswersImpact } from '@/domain/answers-impact';
import { initialTargets } from '@/domain/plan-engine';
import { profileFromContext } from '@/domain/profile';
import { buildUserContext, cleanAnswersForMode } from '@/domain/user-context';
import { latestSnapshot } from '@/lib/mock/body';
import { parseNumericAnswer } from '@/lib/questionnaire/parse-answer';
import { allGroupQuestions, groupQuestions, type ProfileGroup } from '@/lib/questionnaire/profile-sections';
import { useBodyStore } from '@/store/body-store';
import { useOnboardingStore, type AnswerValue } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';

export type SaveOutcome = AnswersImpact & { message: string };

function outcomeMessage(impact: AnswersImpact): string {
  if (impact.created) return 'Piani creati dalle tue risposte.';
  if (impact.restart) return 'Nuovo obiettivo: i tuoi piani ripartono dal mese 1.';
  const from = impact.fromMonth > 1 ? ` dal mese ${impact.fromMonth}` : '';
  if (impact.diet && impact.training) return `Piano alimentare e allenamento aggiornati${from}.`;
  if (impact.diet) return `Piano alimentare aggiornato${from}.`;
  if (impact.training) return `Allenamento aggiornato${from}.`;
  if (impact.targets) return 'Obiettivi nutrizionali aggiornati.';
  return 'Dati salvati: i tuoi piani restano invariati.';
}

/**
 * Saves answers edited from Profilo and decides on its own what has to follow:
 * profile fields, calorie targets, the starting weight and — only when they
 * would really come out different (domain/answers-impact.ts) — the diet and/or
 * training plan, rebuilt from the current month so lived months stay as they were.
 */
export function useAnswersEditor() {
  const replaceAnswers = useOnboardingStore((s) => s.replaceAnswers);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const resetStartingWeight = useBodyStore((s) => s.resetStartingWeight);
  const generatePlans = usePlanStore((s) => s.generatePlans);

  return useCallback(
    (group: ProfileGroup, draft: Record<string, AnswerValue>): SaveOutcome => {
      const prev = useOnboardingStore.getState().answers;
      const merged: Record<string, AnswerValue> = { ...prev, ...draft };
      // Answers to questions that are no longer shown (a removed activity, home equipment after moving to the gym) are dropped.
      const visible = new Set(groupQuestions(group, merged).map((q) => q.id));
      for (const q of allGroupQuestions(group)) if (!visible.has(q.id)) merged[q.id] = undefined;
      const next = cleanAnswersForMode(merged) as Record<string, AnswerValue>;

      // The starting weight is the baseline body entry: correcting it here corrects that entry.
      const entries = useBodyStore.getState().entries;
      const baseline = entries.find((e) => e.isBaseline);
      const newStart = parseNumericAnswer(next.currentWeightKg);
      const startChanged = newStart != null && newStart !== parseNumericAnswer(prev.currentWeightKg);
      const latest = latestSnapshot(entries);
      const baselineIsLatest = baseline != null && baseline.date === latest.date;
      const weightKg = startChanged && (baselineIsLatest || entries.length === 0) ? newStart : latest.weightKg > 0 ? latest.weightKg : undefined;

      const { dietPlan, trainingPlan } = usePlanStore.getState();
      const impact = analyzeAnswersImpact({ prev, next, weightKg, existing: { diet: dietPlan, training: trainingPlan } });

      replaceAnswers(next);
      if (startChanged && baseline) resetStartingWeight(newStart, baseline.date);

      const ctx = buildUserContext(next);
      const calibration = impact.restart ? undefined : (dietPlan?.calibration ?? trainingPlan?.calibration);
      const profile = profileFromContext(weightKg ? { ...ctx, weightKg } : ctx, initialTargets(weightKg ? { ...ctx, weightKg } : ctx, calibration));
      // Targets the monthly check-in may have tuned are only overwritten when the edit really moves them.
      const { goal, sports, sex, age, heightCm, targetWeightKg } = profile;
      updateProfile(impact.targets ? profile : { goal, sports, sex, age, heightCm, targetWeightKg });

      if (impact.restart) {
        void generatePlans(next, { skipAi: true, currentWeightKg: weightKg });
      } else if (impact.diet || impact.training) {
        const only = impact.diet && impact.training ? undefined : impact.diet ? 'diet' : 'training';
        void generatePlans(next, { only, skipAi: true, keepProgress: true, fromMonth: impact.fromMonth, currentWeightKg: weightKg });
      }
      return { ...impact, message: outcomeMessage(impact) };
    },
    [replaceAnswers, updateProfile, resetStartingWeight, generatePlans]
  );
}
