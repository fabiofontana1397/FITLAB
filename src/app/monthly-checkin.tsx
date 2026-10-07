import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { RecalibrationResult, Verdict } from '@/domain/recalibration';
import { GlassSurface } from '@/components/glass/glass-surface';
import { QuestionBlock } from '@/components/onboarding/question-block';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserContext } from '@/hooks/use-user-context';
import { daysAgoISO } from '@/lib/mock/dates';
import { goBackOr } from '@/lib/navigation/go-back';
import { checkinSignals, computeMonthAdherence, monthWindow, weightsInMonth } from '@/lib/planning/month-adherence';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { MONTHLY_CHECKIN_QUESTIONS } from '@/lib/questionnaire/monthly-checkin-schema';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useBodyStore } from '@/store/body-store';
import { useMonthlyCheckinStore } from '@/store/monthly-checkin-store';
import { useNutritionStore } from '@/store/nutrition-store';
import type { AnswerValue } from '@/store/onboarding-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

function isAnswered(value: AnswerValue): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== '';
}

const VERDICT_TITLE: Record<Verdict, string> = {
  on_track: 'Stai andando come previsto',
  too_slow: 'Progressi più lenti del previsto',
  plateau: 'Il peso è fermo',
  wrong_direction: 'Il peso va nella direzione opposta',
  too_fast: 'Progressi troppo rapidi',
  low_adherence: 'Il piano è stato seguito solo in parte',
  insufficient_data: 'Dati insufficienti per valutare i progressi',
};

/**
 * The monthly check-in: at the end of each plan month (the first one included)
 * the person answers a few questions, and the recalibration engine
 * (domain/recalibration.ts) compares what REALLY happened — weight trend,
 * sessions done, meals tracked, how they felt — with what the plan expected,
 * then reworks BOTH plans from the next month on. Months already lived are never
 * touched.
 */
export default function MonthlyCheckinScreen() {
  const theme = useTheme();
  const ctx = useUserContext();
  const onboardingAnswers = useOnboardingStore((s) => s.answers);
  const bodyEntries = useBodyStore((s) => s.entries);
  const nutritionEntries = useNutritionStore((s) => s.entries);
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const activityLog = useActivityLogStore((s) => s.entries);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const recalibrateMonth = usePlanStore((s) => s.recalibrateMonth);
  const submitCheckin = useMonthlyCheckinStore((s) => s.submitCheckin);
  const completedMonths = useMonthlyCheckinStore((s) => s.completedMonths);
  const updateProfile = useUserStore((s) => s.updateProfile);

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RecalibrationResult | null>(null);

  const plan = dietPlan ?? trainingPlan;
  // The month that just ENDED: the plan's "current" month is already the next one once the 30 days have passed.
  const endedMonth = plan ? currentMonthIndex(plan) - 1 : 0;
  const alreadyDone = completedMonths.includes(endedMonth);
  const available = endedMonth >= 1 && !alreadyDone;
  const canContinue = useMemo(() => MONTHLY_CHECKIN_QUESTIONS.every((q) => q.optional || isAnswered(answers[q.id])), [answers]);

  const handleSubmit = async () => {
    if (!canContinue || submitting || !plan || !available) return;
    setSubmitting(true);
    try {
      const window = monthWindow(plan, endedMonth);
      const weights = weightsInMonth(bodyEntries, window);
      const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
      const trendKg = sorted.length >= 2 ? sorted[sorted.length - 1].kg - sorted[0].kg : null;

      const recalibration = await recalibrateMonth({
        answers: onboardingAnswers,
        monthIndex: endedMonth,
        currentWeightKg: ctx.weightKg,
        weights,
        adherence: computeMonthAdherence({
          training: trainingPlan,
          monthIndex: endedMonth,
          window,
          today: daysAgoISO(0),
          nutritionEntries,
          completedExercises,
          activityLog,
        }),
        checkin: checkinSignals(answers),
      });
      await submitCheckin(endedMonth, answers, trendKg);

      // keep the profile in step with what the plan now prescribes for the month the person is entering
      const nextMonth = usePlanStore.getState().dietPlan?.months.find((m) => m.monthIndex === endedMonth + 1);
      if (nextMonth) updateProfile({ dailyCalorieTarget: nextMonth.calorieTarget, macroTargetsG: nextMonth.macroTargetsG });
      setResult(recalibration);
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
            {result
              ? `Mese ${endedMonth} concluso`
              : available
                ? `Mese ${endedMonth} concluso — le tue risposte servono a rivedere dieta e allenamento del mese ${endedMonth + 1}`
                : 'Il check-in si apre alla fine di ogni mese del piano'}
          </ThemedText>
        </View>
        <Pressable onPress={() => goBackOr('/')} hitSlop={8}>
          <GlassSurface level="card" radius={Radius.pill} style={styles.closeButton}>
            <View style={styles.closeInner}>
              <Icon name="close" size={18} color={theme.text} />
            </View>
          </GlassSurface>
        </Pressable>
      </View>

      {result ? (
        <>
          <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.three }}>
            <ThemedText type="subtitle">{VERDICT_TITLE[result.verdict]}</ThemedText>
            {result.weeklyRateKg != null ? (
              <ThemedText type="caption" themeColor="textSecondary">
                Variazione misurata: {result.weeklyRateKg > 0 ? '+' : ''}
                {result.weeklyRateKg.toFixed(2)} kg a settimana (previsto: {result.expectedWeeklyKg > 0 ? '+' : ''}
                {result.expectedWeeklyKg.toFixed(2)} kg).
              </ThemedText>
            ) : null}
            <ThemedText type="smallBold">Cosa cambia nel prossimo mese</ThemedText>
            {result.changes.map((c, i) => (
              <View key={i} style={styles.changeRow}>
                <Icon name={c.area === 'dieta' ? 'nutrition' : 'training'} size={18} color={theme.accent} />
                <ThemedText type="small" style={{ flex: 1 }}>
                  {c.text}
                </ThemedText>
              </View>
            ))}
          </GlassSurface>
          <PrimaryButton label="Fatto" onPress={() => goBackOr('/')} />
        </>
      ) : !available ? (
        <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.two }}>
          <ThemedText type="smallBold">{alreadyDone ? 'Check-in già completato' : 'Non ancora disponibile'}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {alreadyDone
              ? 'Hai già fatto il check-in di questo mese: dieta e allenamento sono stati rivisti.'
              : 'Il primo check-in è disponibile alla fine del primo mese del piano: peserai, risponderai a poche domande e l’agente rivedrà dieta e allenamento in base ai tuoi progressi.'}
          </ThemedText>
        </GlassSurface>
      ) : (
        <>
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
          <PrimaryButton label={submitting ? 'Elaboro il piano…' : 'Conferma e aggiorna il piano'} onPress={handleSubmit} disabled={!canContinue || submitting} />
        </>
      )}
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
  changeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
});
