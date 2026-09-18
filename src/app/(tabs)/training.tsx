import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { MonthProgressBar } from '@/components/ui/month-progress-bar';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { DayWheel } from '@/components/training/day-wheel';
import { PlanExerciseRow } from '@/components/training/plan-exercise-row';
import { PlanTimeline } from '@/components/training/plan-timeline';
import { Radius, Spacing } from '@/constants/theme';
import { useStoreHydrated } from '@/hooks/use-store-hydrated';
import { useTheme } from '@/hooks/use-theme';
import { daysAgoISO, mondayIndex } from '@/lib/mock/dates';
import { currentMonthIndex, currentMonthProgress } from '@/lib/planning/plan-progress';
import type { TrainingDayPlan } from '@/lib/planning/types';
import { useOnboardingStore } from '@/store/onboarding-store';
import { isValidTrainingPlan, usePlanStore } from '@/store/plan-store';
import {
  historyForExercise,
  isExerciseCompleted,
  latestWeightForExercise,
  setsForExerciseOnDate,
  suggestedNextLoadForExercise,
  useTrainingProgressStore,
} from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

export default function TrainingScreen() {
  const theme = useTheme();
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const generatePlans = usePlanStore((s) => s.generatePlans);
  const onboardingAnswers = useOnboardingStore((s) => s.answers);
  const currentUser = useUserStore();
  const progressSets = useTrainingProgressStore((s) => s.sets);
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const logSet = useTrainingProgressStore((s) => s.logSet);
  const toggleCompleted = useTrainingProgressStore((s) => s.toggleCompleted);

  const [selectedDate, setSelectedDate] = useState(daysAgoISO(0));
  // Tracks the day currently centered under the wheel while dragging, so the
  // month/year label can follow the scroll live instead of jumping only once
  // it settles on `selectedDate`.
  const [visibleDate, setVisibleDate] = useState(selectedDate);
  const monthYearLabel = useMemo(() => {
    const label = new Date(visibleDate).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [visibleDate]);

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
  const monthProgress = trainingPlan ? currentMonthProgress(trainingPlan) : null;
  const weeklySplit = currentMonth?.weeklySplit ?? [];
  const selectedDay: TrainingDayPlan | undefined = weeklySplit[mondayIndex(new Date(selectedDate))];

  const dayTypeForDate = (date: string) => weeklySplit[mondayIndex(new Date(date))]?.type;

  const selectedDayHeading =
    selectedDate === daysAgoISO(0)
      ? 'Allenamento di oggi'
      : `Allenamento del ${new Date(selectedDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;

  const isDayComplete = (date: string): boolean => {
    const day = weeklySplit[mondayIndex(new Date(date))];
    if (day?.type !== 'workout') return false;
    const exercises = day.exercises ?? [];
    if (exercises.length === 0) return false;
    return exercises.every((exercise) => isExerciseCompleted(completedExercises, exercise.id, date));
  };

  return (
    <ScreenScroll>
      <ScreenHeader eyebrow="Il tuo programma" title="Training" />

      {!trainingPlan ? (
        <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.two }}>
          <ThemedText type="smallBold">Nessun programma generato</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Rifai il questionario scegliendo sala pesi o corsa tra le attività per generarne uno.
          </ThemedText>
        </GlassSurface>
      ) : (
        <>
          <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.five, gap: Spacing.four }}>
            <View style={{ gap: 2 }}>
              <ThemedText type="subtitle">Piano di allenamento di {currentUser.name}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Durata piano totale: {trainingPlan.durationMonths} mesi
              </ThemedText>
            </View>

            <PlanTimeline
              totalMonths={trainingPlan.durationMonths}
              currentMonth={monthIndex}
              selectedMonth={monthIndex}
              onSelectMonth={() => router.push('/training-plan')}
            />

            {currentMonth && monthProgress ? (
              <View style={{ gap: Spacing.two }}>
                <ThemedText type="smallBold">{currentMonth.title}</ThemedText>
                <MonthProgressBar fraction={monthProgress.fraction} />
                <ThemedText type="caption" themeColor="textSecondary">
                  Giorno {monthProgress.dayInMonth} di 30
                </ThemedText>
              </View>
            ) : null}

            <PrimaryButton
              variant="ghost"
              label="Mostra piano"
              icon="chevronRight"
              onPress={() => router.push('/training-plan')}
            />
          </GlassSurface>

          <View style={{ gap: Spacing.three }}>
            <SectionHeader title="Calendario" />
            <ThemedText type="smallBold" style={styles.monthYearLabel}>
              {monthYearLabel}
            </ThemedText>
            <DayWheel
              selectedDate={selectedDate}
              dayTypeForDate={dayTypeForDate}
              onSelect={setSelectedDate}
              onCenterChange={setVisibleDate}
              isDayComplete={isDayComplete}
            />
          </View>

          <ThemedText type="subtitle">{selectedDayHeading}</ThemedText>

          {selectedDay?.type === 'workout' ? (
            <View>
              <SectionHeader
                title={selectedDay.title}
                icon="trendUp"
                iconLabel="Carichi"
                onIconPress={() => router.push('/training-progress')}
              />
              <View style={{ gap: Spacing.three }}>
                {(selectedDay.exercises ?? []).map((exercise) => {
                  const setsToday = setsForExerciseOnDate(progressSets, exercise.id, selectedDate);
                  const loggedTodayKg = setsToday.length ? Math.max(...setsToday.map((s) => s.weightKg)) : null;
                  const progression = suggestedNextLoadForExercise(progressSets, exercise.id, exercise.reps, exercise.suggestedKg);
                  return (
                    <PlanExerciseRow
                      key={exercise.id}
                      exercise={exercise}
                      history={historyForExercise(progressSets, exercise.id)}
                      latestWeightKg={latestWeightForExercise(progressSets, exercise.id)}
                      loggedTodayKg={loggedTodayKg}
                      completed={isExerciseCompleted(completedExercises, exercise.id, selectedDate)}
                      onToggleCompleted={() => toggleCompleted(exercise.id, selectedDate)}
                      onAddLoad={(reps, weightKg, rir) => logSet(exercise.id, exercise.name, reps, weightKg, selectedDate, rir)}
                      progressionNote={progression.note}
                    />
                  );
                })}
              </View>
            </View>
          ) : selectedDay?.type === 'cardio' ? (
            <GlassSurface level="card" radius={Radius.large} style={styles.dayCard}>
              <View style={[styles.dayIcon, { backgroundColor: theme.accentSoft }]}>
                <Icon name="running" size={26} color={theme.accent} />
              </View>
              <ThemedText type="subtitle">{selectedDay.title}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {selectedDay.note}
              </ThemedText>
            </GlassSurface>
          ) : (
            <GlassSurface level="card" radius={Radius.large} style={styles.dayCard}>
              <View style={[styles.dayIcon, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="moon" size={26} color={theme.textSecondary} />
              </View>
              <ThemedText type="subtitle">Giorno di riposo</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Il recupero fa parte del piano: dormi bene e resta idratato.
              </ThemedText>
            </GlassSurface>
          )}
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  monthYearLabel: {
    textAlign: 'center',
  },
  dayCard: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.five,
  },
  dayIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
