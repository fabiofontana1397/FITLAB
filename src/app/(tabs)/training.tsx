import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HeaderIconButton } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { AiCoachCard } from '@/components/ui/ai-coach-card';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { LogActivityModal } from '@/components/training/log-activity-modal';
import { TrainingHeroCard } from '@/components/training/training-hero-card';
import { TrainingWeekCard } from '@/components/training/training-week-card';
import { difficultyLabel, WorkoutSummaryCard } from '@/components/training/workout-summary-card';
import { useStoreHydrated } from '@/hooks/use-store-hydrated';
import { useTheme } from '@/hooks/use-theme';
import { latestSnapshot } from '@/lib/mock/body';
import { addDaysISO, currentWeekDates, daysAgoISO, mondayIndex } from '@/lib/mock/dates';
import { estimateTrainingContributionKcal, sessionDurationMinutes } from '@/lib/nutrition/targets';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import type { TrainingDayPlan } from '@/lib/planning/types';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useBodyStore } from '@/store/body-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { isValidTrainingPlan, usePlanStore } from '@/store/plan-store';
import { isExerciseCompleted, useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

const SCREEN_PADDING = 20;

function capitalized(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function TrainingScreen() {
  const theme = useTheme();
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const generatePlans = usePlanStore((s) => s.generatePlans);
  const onboardingAnswers = useOnboardingStore((s) => s.answers);
  const currentUser = useUserStore();
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const toggleCompleted = useTrainingProgressStore((s) => s.toggleCompleted);
  const bodyEntries = useBodyStore((s) => s.entries);
  const addActivityEntry = useActivityLogStore((s) => s.addEntry);
  const [isLogActivityVisible, setLogActivityVisible] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const today = daysAgoISO(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);

  const viewedWeekDates = useMemo(() => currentWeekDates(new Date(addDaysISO(today, weekOffset * 7))), [today, weekOffset]);
  const monthLabel = capitalized(new Date(viewedWeekDates[3]).toLocaleDateString('it-IT', { month: 'long' }));

  const planStoreHydrated = useStoreHydrated(usePlanStore);
  const onboardingHydrated = useStoreHydrated(useOnboardingStore);
  const userStoreHydrated = useStoreHydrated(useUserStore);

  useEffect(() => {
    // Persisted stores rehydrate from AsyncStorage asynchronously. Without
    // this gate, a returning user's plan/onboarding answers/profile could
    // still be at their in-memory defaults on first render, generating (and
    // permanently caching) a plan from empty/default data — the trainingPlan
    // dependency below would then never change to retrigger it.
    if (!planStoreHydrated || !onboardingHydrated || !userStoreHydrated) return;
    if (isValidTrainingPlan(trainingPlan) || onboardingAnswers.mode === 'diet') return;
    generatePlans(onboardingAnswers, {
      dailyCalorieTarget: currentUser.dailyCalorieTarget,
      macroTargetsG: currentUser.macroTargetsG,
    });
    // Only needs to run once per missing/invalid-plan case, not on every keystroke of onboardingAnswers/currentUser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingPlan, planStoreHydrated, onboardingHydrated, userStoreHydrated]);

  const monthIndex = trainingPlan ? currentMonthIndex(trainingPlan) : 1;
  const currentMonth = trainingPlan?.months.find((m) => m.monthIndex === monthIndex);
  const weeklySplit = currentMonth?.weeklySplit ?? [];
  const selectedDay: TrainingDayPlan | undefined = weeklySplit[mondayIndex(new Date(selectedDate))];

  const isDayComplete = (date: string): boolean => {
    const day = weeklySplit[mondayIndex(new Date(date))];
    if (day?.type !== 'workout') return false;
    const exercises = day.exercises ?? [];
    if (exercises.length === 0) return false;
    return exercises.every((exercise) => isExerciseCompleted(completedExercises, exercise.id, date));
  };

  // Tapping a calendar day's circle directly marks every exercise
  // scheduled that day as done in one go — or undoes all of them if the
  // day was already fully done. No-op for non-workout days and for days
  // still in the future (can't have trained yet).
  const toggleDayComplete = (date: string) => {
    if (date > today) return;
    const day = weeklySplit[mondayIndex(new Date(date))];
    if (day?.type !== 'workout') return;
    const exercises = day.exercises ?? [];
    if (exercises.length === 0) return;
    const allDone = isDayComplete(date);
    exercises.forEach((exercise) => {
      const done = isExerciseCompleted(completedExercises, exercise.id, date);
      if (allDone || !done) toggleCompleted(exercise.id, date);
    });
  };

  // Whole Monday-to-Monday weeks between the picked date and today — a
  // plain (date-today)/7 day-diff rounds wrong whenever the two dates
  // fall on different weekdays, landing the strip on a week that doesn't
  // even contain the picked date.
  const selectDateFromCalendar = (date: string) => {
    setSelectedDate(date);
    const dateMonday = addDaysISO(date, -mondayIndex(new Date(date)));
    const todayMonday = addDaysISO(today, -mondayIndex(new Date(today)));
    setWeekOffset(Math.round((new Date(dateMonday).getTime() - new Date(todayMonday).getTime()) / (7 * 86400000)));
  };

  const weightKg = latestSnapshot(bodyEntries).weightKg;
  const sessionBucket = onboardingAnswers.sessionDuration as string | undefined;
  const sessionKcal = estimateTrainingContributionKcal({
    sex: currentUser.sex,
    age: currentUser.age,
    heightCm: currentUser.heightCm,
    weightKg,
    sessionDurationBucket: sessionBucket,
    completionFraction: 1,
  });

  const dayHeading =
    selectedDate === today ? 'Allenamento di oggi' : `Allenamento del ${new Date(selectedDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;

  return (
    <ScreenScroll contentContainerStyle={styles.page}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.pageTitle}>Allenamento</ThemedText>
        <HeaderIconButton
          icon="training"
          color={theme.accent}
          accessibilityLabel="Piano di allenamento"
          onPress={() => router.push('/training-plan')}
        />
      </View>

      <TrainingHeroCard onRegister={() => setLogActivityVisible(true)} />

      <View style={styles.sectionRow}>
        <ThemedText style={styles.sectionTitle}>{monthLabel}</ThemedText>
        <Pressable onPress={() => setCalendarOpen(true)} hitSlop={10} accessibilityLabel="Apri calendario">
          <Icon name="calendar" size={22} color={theme.text} />
        </Pressable>
      </View>

      <TrainingWeekCard
        weekDates={viewedWeekDates}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        isDayComplete={isDayComplete}
        onToggleDayComplete={toggleDayComplete}
      />

      <View style={styles.sectionRow}>
        <ThemedText style={styles.sectionTitle}>{dayHeading}</ThemedText>
        <Pressable
          onPress={() => router.push('/training-progress')}
          hitSlop={8}
          accessibilityLabel="Andamento carichi"
          style={[styles.trendButton, { borderColor: theme.border }]}>
          <Icon name="trendUp" size={16} color={theme.textSecondary} />
        </Pressable>
      </View>

      {!trainingPlan ? (
        <FlatCard radius={20} style={styles.messageCard}>
          <ThemedText style={styles.cardTitle}>Nessun programma generato</ThemedText>
          <ThemedText style={styles.cardBody} themeColor="textSecondary">
            Rifai il questionario scegliendo sala pesi o corsa tra le attività per generarne uno.
          </ThemedText>
        </FlatCard>
      ) : selectedDay?.type === 'workout' ? (
        <WorkoutSummaryCard
          title={selectedDay.title}
          difficulty={difficultyLabel(currentMonth?.phase)}
          minutes={sessionDurationMinutes(sessionBucket)}
          kcal={sessionKcal}
          onPress={() => router.push({ pathname: '/workout-detail', params: { date: selectedDate } })}
        />
      ) : selectedDay?.type === 'cardio' ? (
        <FlatCard radius={20} style={styles.messageCard}>
          <View style={[styles.dayIcon, { backgroundColor: theme.accentSoft }]}>
            <Icon name="running" size={26} color={theme.accent} />
          </View>
          <ThemedText style={styles.cardTitle}>{selectedDay.title}</ThemedText>
          <ThemedText style={styles.cardBody} themeColor="textSecondary">
            {selectedDay.note}
          </ThemedText>
        </FlatCard>
      ) : (
        <FlatCard radius={20} style={styles.messageCard}>
          <View style={[styles.dayIcon, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="moon" size={26} color={theme.textSecondary} />
          </View>
          <ThemedText style={styles.cardTitle}>Giorno di riposo</ThemedText>
          <ThemedText style={[styles.cardBody, { textAlign: 'center' }]} themeColor="textSecondary">
            Il recupero fa parte del piano: dormi bene e resta idratato.
          </ThemedText>
        </FlatCard>
      )}

      <View style={styles.coachWrap}>
        <AiCoachCard
          headline="Un dubbio sull'allenamento?"
          body="Chiedi al coach AI consigli su tecnica, carichi e progressione per il tuo piano."
        />
      </View>

      <DayCalendarModal
        visible={calendarOpen}
        selectedDate={selectedDate}
        isDayMarked={isDayComplete}
        onSelectDate={selectDateFromCalendar}
        onClose={() => setCalendarOpen(false)}
      />

      <LogActivityModal
        visible={isLogActivityVisible}
        weightKg={weightKg}
        onClose={() => setLogActivityVisible(false)}
        onSave={(activityType, intensity, durationMinutes) => addActivityEntry(activityType, intensity, durationMinutes, weightKg)}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionRow: {
    marginTop: 24,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  trendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageCard: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  cardBody: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  dayIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachWrap: {
    marginTop: 24,
  },
});
