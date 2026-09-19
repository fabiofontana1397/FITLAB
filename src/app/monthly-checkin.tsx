import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { QuestionBlock } from '@/components/onboarding/question-block';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Goal } from '@/lib/mock/types';
import { daysAgoISO } from '@/lib/mock/dates';
import { adjustMonthlyCalorieTarget, computeMonthlyWeightTrend, scaleMacrosForTarget } from '@/lib/planning/monthly-adjustment';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { MONTHLY_CHECKIN_QUESTIONS } from '@/lib/questionnaire/monthly-checkin-schema';
import { useBodyStore } from '@/store/body-store';
import { useMonthlyCheckinStore } from '@/store/monthly-checkin-store';
import type { AnswerValue } from '@/store/onboarding-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';

function isAnswered(value: AnswerValue): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== '';
}

/**
 * The monthly plan check-in (spec §0.4, punto 2) — a first-pass, explicitly
 * refinable proposal reached from the "locked next month" card in
 * training-plan.tsx/diet-plan.tsx. Answering it unlocks the next month and
 * regenerates it (never from scratch) using the tracked weight trend +
 * these answers to nudge the calorie target, exactly like Home/Body already
 * read the same body_metrics entries this screen reads for the trend.
 */
export default function MonthlyCheckinScreen() {
  const theme = useTheme();
  const currentUser = useUserStore();
  const onboardingAnswers = useOnboardingStore((s) => s.answers);
  const bodyEntries = useBodyStore((s) => s.entries);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const regenerateFromMonth = usePlanStore((s) => s.regenerateFromMonth);
  const submitCheckin = useMonthlyCheckinStore((s) => s.submitCheckin);
  const updateProfile = useUserStore((s) => s.updateProfile);

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);

  const plan = trainingPlan ?? dietPlan;
  const monthIndex = plan ? currentMonthIndex(plan) : 1;
  const canContinue = useMemo(() => MONTHLY_CHECKIN_QUESTIONS.every((q) => q.optional || isAnswered(answers[q.id])), [answers]);

  const handleSubmit = async () => {
    if (!canContinue || submitting) return;
    setSubmitting(true);
    try {
      const today = daysAgoISO(0);
      const trend = computeMonthlyWeightTrend(bodyEntries, today);
      await submitCheckin(monthIndex, answers, trend.weightDeltaKg);

      if (dietPlan) {
        const goal = (onboardingAnswers.goal as Goal) ?? 'generalHealth';
        const nextCalorieTarget = adjustMonthlyCalorieTarget(currentUser.dailyCalorieTarget, goal, trend, answers);
        const nextMacros = scaleMacrosForTarget(currentUser.macroTargetsG, currentUser.dailyCalorieTarget, nextCalorieTarget);
        updateProfile({ dailyCalorieTarget: nextCalorieTarget, macroTargetsG: nextMacros });
        await regenerateFromMonth(monthIndex + 1, onboardingAnswers, { dailyCalorieTarget: nextCalorieTarget, macroTargetsG: nextMacros });
      } else if (trainingPlan) {
        await regenerateFromMonth(monthIndex + 1, onboardingAnswers, {
          dailyCalorieTarget: currentUser.dailyCalorieTarget,
          macroTargetsG: currentUser.macroTargetsG,
        });
      }
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="title">Check-in mensile</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Mese {monthIndex} — le tue risposte sbloccano il mese successivo e aiutano ad adattarlo
          </ThemedText>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <GlassSurface level="card" radius={Radius.pill} style={styles.closeButton}>
            <View style={styles.closeInner}>
              <Icon name="close" size={18} color={theme.text} />
            </View>
          </GlassSurface>
        </Pressable>
      </View>

      <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.four }}>
        {MONTHLY_CHECKIN_QUESTIONS.map((question) => (
          <QuestionBlock
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={(value) => setAnswers((prev) => ({ ...prev, [question.id]: value }))}
          />
        ))}
      </GlassSurface>

      <PrimaryButton label={submitting ? 'Invio…' : 'Conferma e sblocca il mese successivo'} onPress={handleSubmit} disabled={!canContinue || submitting} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  closeButton: {
    width: 36,
    height: 36,
  },
  closeInner: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
