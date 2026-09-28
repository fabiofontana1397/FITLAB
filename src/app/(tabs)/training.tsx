import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { FlatCard } from '@/components/ui/flat-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ProgressRing } from '@/components/ui/progress-ring';
import { LogActivityModal } from '@/components/training/log-activity-modal';
import { PlanExerciseRow } from '@/components/training/plan-exercise-row';
import { WeekDayStrip } from '@/components/training/week-day-strip';
import { WeekTimeline } from '@/components/training/week-timeline';
import { Radius, Spacing } from '@/constants/theme';
import { useStoreHydrated } from '@/hooks/use-store-hydrated';
import { useTheme } from '@/hooks/use-theme';
import { latestSnapshot } from '@/lib/mock/body';
import type { Goal } from '@/lib/mock/types';
import { addDaysISO, currentWeekDates, daysAgoISO, mondayIndex } from '@/lib/mock/dates';
import { currentMonthIndex, currentMonthWeeks } from '@/lib/planning/plan-progress';
import type { TrainingDayPlan } from '@/lib/planning/types';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useBodyStore } from '@/store/body-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { isValidTrainingPlan, usePlanStore } from '@/store/plan-store';
import {
  historyForExercise,
  isExerciseCompleted,
  latestWeightForExercise,
  setsForExerciseOnDate,
  useTrainingProgressStore,
} from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

/** The standard muscle groups a given split label trains — a fixed,
 * universally-true convention (not per-user data, which the plan doesn't
 * track), matching the real `SplitLabel`s the generator produces
 * (training-planner.ts's VALID_SPLIT_LABELS). */
const SPLIT_MUSCLE_GROUPS: Record<string, string[]> = {
  Push: ['petto', 'spalle', 'tricipiti'],
  Pull: ['schiena', 'bicipiti'],
  Legs: ['quadricipiti', 'femorali', 'glutei'],
  Upper: ['petto', 'schiena', 'spalle', 'braccia'],
  Lower: ['quadricipiti', 'femorali', 'glutei', 'polpacci'],
  'Full Body': ['corpo intero'],
};

/** "Push, petto, spalle e tricipiti" — the split title folded into a
 * natural-reading Italian list of what it trains, for the "Allenamento
 * di oggi" heading. Falls back to just the title for any split label
 * (custom AI-suggested titles included) not in the fixed map above. */
function splitHeadingSuffix(title: string): string {
  const groups = SPLIT_MUSCLE_GROUPS[title];
  if (!groups || groups.length === 0) return title;
  const list = groups.length === 1 ? groups[0] : `${groups.slice(0, -1).join(', ')} e ${groups[groups.length - 1]}`;
  return `${title}, ${list}`;
}

/** Short, bodybuilding-shorthand label for the user's goal, matching the
 * "Cut" / "Bulk"-style copy the reference plan card uses next to the
 * current month's real phase title. */
const GOAL_SHORT_LABEL: Record<Goal, string> = {
  loseFat: 'Cut',
  gainMuscle: 'Bulk',
  maintainImprove: 'Mantenimento',
  gainStrength: 'Forza',
  improveEndurance: 'Endurance',
  generalHealth: 'Benessere',
};

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
  const bodyEntries = useBodyStore((s) => s.entries);
  const activityLogEntries = useActivityLogStore((s) => s.entries);
  const addActivityEntry = useActivityLogStore((s) => s.addEntry);
  const [isLogActivityVisible, setLogActivityVisible] = useState(false);

  const today = daysAgoISO(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);

  const viewedWeekDates = useMemo(() => currentWeekDates(new Date(addDaysISO(today, weekOffset * 7))), [today, weekOffset]);
  const monthYearLabel = useMemo(() => {
    const label = new Date(viewedWeekDates[3]).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [viewedWeekDates]);

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
  const weeks = trainingPlan ? currentMonthWeeks(trainingPlan) : [];
  const weeklySplit = currentMonth?.weeklySplit ?? [];
  const selectedDay: TrainingDayPlan | undefined = weeklySplit[mondayIndex(new Date(selectedDate))];

  const isDayComplete = (date: string): boolean => {
    const day = weeklySplit[mondayIndex(new Date(date))];
    if (day?.type !== 'workout') return false;
    const exercises = day.exercises ?? [];
    if (exercises.length === 0) return false;
    return exercises.every((exercise) => isExerciseCompleted(completedExercises, exercise.id, date));
  };

  // Always the REAL current calendar week, independent of whatever week the
  // strip below is currently browsing — this ring/progress always answers
  // "how is this week actually going", not "how did the browsed week go".
  const realCurrentWeekDates = useMemo(() => currentWeekDates(new Date(today)), [today]);
  const weekSessionsTotal = weeklySplit.filter((d) => d.type !== 'rest').length;
  const weekSessionsDone = realCurrentWeekDates.filter((date, i) => {
    const day = weeklySplit[i];
    if (!day || day.type === 'rest' || date > today) return false;
    return day.type === 'workout' ? isDayComplete(date) : activityLogEntries.some((e) => e.date === date);
  }).length;
  const weekCompletionFraction = weekSessionsTotal > 0 ? weekSessionsDone / weekSessionsTotal : 0;

  const goToAdjacentWeek = (delta: number) => {
    const newOffset = weekOffset + delta;
    const newWeekDates = currentWeekDates(new Date(addDaysISO(today, newOffset * 7)));
    setWeekOffset(newOffset);
    setSelectedDate(newWeekDates[mondayIndex(new Date(selectedDate))]);
  };

  const selectedDayHeading =
    selectedDate === today ? 'Allenamento di oggi' : `Allenamento del ${new Date(selectedDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;

  return (
    <ScreenScroll>
      <View style={styles.headerRow}>
        <Image source={require('@/assets/images/logo-wordmark.png')} style={styles.logo} resizeMode="contain" />
        <Pressable onPress={() => router.push('/profile')} hitSlop={8} style={[styles.avatar, { backgroundColor: theme.backgroundElevated }]}>
          <Icon name="profile" size={22} color={theme.text} />
        </Pressable>
      </View>
      <View style={{ gap: 4 }}>
        <ThemedText type="display">Training</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Il tuo percorso, un obiettivo alla volta.
        </ThemedText>
      </View>

      {!trainingPlan ? (
        <FlatCard radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.two }}>
          <ThemedText type="smallBold">Nessun programma generato</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Rifai il questionario scegliendo sala pesi o corsa tra le attività per generarne uno.
          </ThemedText>
        </FlatCard>
      ) : (
        <>
          <FlatCard radius={Radius.large} style={{ padding: Spacing.three, gap: Spacing.three }}>
            <Pressable onPress={() => router.push('/training-plan')} style={styles.planHeaderRow}>
              <View style={[styles.planIcon, { backgroundColor: theme.accentSoft }]}>
                <Icon name="calendar" size={18} color={theme.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  Piano di allenamento di {currentUser.name}
                </ThemedText>
                {currentMonth ? (
                  <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
                    {weeks.length} settimane • {GOAL_SHORT_LABEL[currentUser.goal]} → {currentMonth.title}
                  </ThemedText>
                ) : null}
              </View>
              <Icon name="chevronRight" size={18} color={theme.textTertiary} />
            </Pressable>

            <WeekTimeline weeks={weeks} />

            <View style={styles.completionRow}>
              <ProgressRing size={48} strokeWidth={5} progress={weekCompletionFraction} color={theme.accent} trackColor={theme.backgroundElement}>
                <ThemedText type="caption" style={{ fontWeight: '800', color: theme.text }}>
                  {weekSessionsDone}/{weekSessionsTotal}
                </ThemedText>
              </ProgressRing>
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
                  Completamento settimana
                </ThemedText>
              </View>
              <PrimaryButton
                label="Mostra piano"
                icon="calendar"
                trailingIcon="chevronRight"
                dense
                onPress={() => router.push('/training-plan')}
                style={styles.showPlanButton}
              />
            </View>
          </FlatCard>

          <View style={{ gap: Spacing.two }}>
            <View style={{ gap: Spacing.three }}>
              <WeekDayStrip
                weekDates={viewedWeekDates}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                isDayComplete={isDayComplete}
                monthYearLabel={monthYearLabel}
                onPrevWeek={() => goToAdjacentWeek(-1)}
                onNextWeek={() => goToAdjacentWeek(1)}
              />
            </View>

            <PrimaryButton label="Aggiungi allenamento" icon="plus" dense onPress={() => setLogActivityVisible(true)} />
          </View>

          <View style={{ gap: 2 }}>
            <ThemedText type="subtitle">{selectedDayHeading}</ThemedText>
            {selectedDay?.type === 'workout' ? (
              <ThemedText type="caption" themeColor="textSecondary">
                {splitHeadingSuffix(selectedDay.title)}
              </ThemedText>
            ) : null}
          </View>

          {selectedDay?.type === 'workout' ? (
            <View style={{ gap: Spacing.three }}>
              {(selectedDay.exercises ?? []).map((exercise) => {
                const setsToday = setsForExerciseOnDate(progressSets, exercise.id, selectedDate);
                const loggedTodayKg = setsToday.length ? Math.max(...setsToday.map((s) => s.weightKg)) : null;
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
                  />
                );
              })}
            </View>
          ) : selectedDay?.type === 'cardio' ? (
            <FlatCard radius={Radius.large} style={styles.dayCard}>
              <View style={[styles.dayIcon, { backgroundColor: theme.accentSoft }]}>
                <Icon name="running" size={26} color={theme.accent} />
              </View>
              <ThemedText type="subtitle">{selectedDay.title}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {selectedDay.note}
              </ThemedText>
            </FlatCard>
          ) : (
            <FlatCard radius={Radius.large} style={styles.dayCard}>
              <View style={[styles.dayIcon, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="moon" size={26} color={theme.textSecondary} />
              </View>
              <ThemedText type="subtitle">Giorno di riposo</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Il recupero fa parte del piano: dormi bene e resta idratato.
              </ThemedText>
            </FlatCard>
          )}
        </>
      )}

      <LogActivityModal
        visible={isLogActivityVisible}
        weightKg={latestSnapshot(bodyEntries).weightKg}
        onClose={() => setLogActivityVisible(false)}
        onSave={(activityType, intensity, durationMinutes) => addActivityEntry(activityType, intensity, durationMinutes, latestSnapshot(bodyEntries).weightKg)}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 110,
    height: 27,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  showPlanButton: {
    flexShrink: 0,
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
