import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { AiCoachCard } from '@/components/ui/ai-coach-card';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { Icon } from '@/components/ui/icon';
import { FlatCard } from '@/components/ui/flat-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ProgressRing } from '@/components/ui/progress-ring';
import { LogActivityModal } from '@/components/training/log-activity-modal';
import { PlanExerciseRow } from '@/components/training/plan-exercise-row';
import { WeekDayStrip } from '@/components/training/week-day-strip';
import { PeriodTimeline, type TimelinePeriod } from '@/components/training/period-timeline';
import { Radius, Spacing } from '@/constants/theme';
import { useStoreHydrated } from '@/hooks/use-store-hydrated';
import { useTheme } from '@/hooks/use-theme';
import { latestSnapshot } from '@/lib/mock/body';
import type { Goal } from '@/lib/mock/types';
import { addDaysISO, currentWeekDates, daysAgoISO, mondayIndex } from '@/lib/mock/dates';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import type { TrainingDayPlan } from '@/lib/planning/types';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useBodyStore } from '@/store/body-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { isValidTrainingPlan, usePlanStore } from '@/store/plan-store';
import {
  historyForExercise,
  isExerciseCompleted,
  latestWeightForExercise,
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
  const [calendarOpen, setCalendarOpen] = useState(false);

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
  // day was already fully done — instead of requiring each exercise to
  // be checked off individually. No-op for non-workout days (nothing to
  // check off) and for days still in the future (can't have trained yet).
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

  // The plan card now shows the whole current MONTH (a fixed 30-day block
  // starting at generatedAt — see plan-progress.ts — not a real calendar
  // month), both for the month-strip timeline and for this ring: "days
  // trained" counts any already-elapsed day in that block whose plan slot
  // wasn't rest and is done; "days programmed" counts every non-rest slot
  // across the whole block, elapsed or not — same convention the old
  // weekly version used, just over ~30 days instead of 7.
  const planStartDate = trainingPlan ? trainingPlan.generatedAt.slice(0, 10) : today;
  const monthWindowStart = addDaysISO(planStartDate, (monthIndex - 1) * 30);
  const monthDates = useMemo(() => Array.from({ length: 30 }, (_, i) => addDaysISO(monthWindowStart, i)), [monthWindowStart]);
  const monthSessionsTotal = monthDates.filter((date) => weeklySplit[mondayIndex(new Date(date))]?.type !== 'rest').length;
  const monthSessionsDone = monthDates.filter((date) => {
    const day = weeklySplit[mondayIndex(new Date(date))];
    if (!day || day.type === 'rest' || date > today) return false;
    return day.type === 'workout' ? isDayComplete(date) : activityLogEntries.some((e) => e.date === date);
  }).length;
  const monthCompletionFraction = monthSessionsTotal > 0 ? monthSessionsDone / monthSessionsTotal : 0;

  const monthPeriods: TimelinePeriod[] = trainingPlan
    ? Array.from({ length: trainingPlan.durationMonths }, (_, i) => ({
        number: i + 1,
        startISO: addDaysISO(planStartDate, i * 30),
        endISO: addDaysISO(planStartDate, i * 30 + 29),
        isCurrent: i + 1 === monthIndex,
      }))
    : [];

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

  const selectedDayHeading =
    selectedDate === today ? 'Allenamento di oggi' : `Allenamento del ${new Date(selectedDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;

  return (
    <ScreenScroll>
      <ScreenHeader title="Allenamento" icon="training" iconColor={theme.accent} onIconPress={() => router.push('/training-plan')} />

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
                    {trainingPlan.durationMonths} mesi • {GOAL_SHORT_LABEL[currentUser.goal]} → {currentMonth.title}
                  </ThemedText>
                ) : null}
              </View>
              <Icon name="chevronRight" size={18} color={theme.textTertiary} />
            </Pressable>

            <PeriodTimeline label="Mese" periods={monthPeriods} />

            <View style={styles.completionRow}>
              <ProgressRing size={48} strokeWidth={5} progress={monthCompletionFraction} color={theme.accent} trackColor={theme.backgroundElement}>
                <ThemedText type="caption" style={{ fontWeight: '800', color: theme.text }}>
                  {monthSessionsDone}/{monthSessionsTotal}
                </ThemedText>
              </ProgressRing>
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
                  Completamento allenamenti del mese
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
                onToggleDayComplete={toggleDayComplete}
                monthYearLabel={monthYearLabel}
                onOpenCalendar={() => setCalendarOpen(true)}
              />
            </View>

            <PrimaryButton label="Registra allenamento" icon="plus" dense onPress={() => setLogActivityVisible(true)} />
          </View>

          <View style={{ gap: 2 }}>
            <View style={styles.dayHeadingRow}>
              <ThemedText type="subtitle" style={{ flex: 1 }}>
                {selectedDayHeading}
              </ThemedText>
              <Pressable
                onPress={() => router.push('/training-progress')}
                hitSlop={8}
                style={[styles.trendButton, { borderColor: theme.border }]}>
                <Icon name="trendUp" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>
            {selectedDay?.type === 'workout' ? (
              <ThemedText type="caption" themeColor="textSecondary">
                {splitHeadingSuffix(selectedDay.title)}
              </ThemedText>
            ) : null}
          </View>

          {selectedDay?.type === 'workout' ? (
            <View style={{ gap: Spacing.three }}>
              {(selectedDay.exercises ?? []).map((exercise) => {
                return (
                  <PlanExerciseRow
                    key={exercise.id}
                    exercise={exercise}
                    history={historyForExercise(progressSets, exercise.id)}
                    latestWeightKg={latestWeightForExercise(progressSets, exercise.id)}
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

      <AiCoachCard
        headline="Un dubbio sull'allenamento?"
        body="Chiedi al coach AI consigli su tecnica, carichi e progressione per il tuo piano."
      />

      <DayCalendarModal
        visible={calendarOpen}
        selectedDate={selectedDate}
        isDayMarked={isDayComplete}
        onSelectDate={selectDateFromCalendar}
        onClose={() => setCalendarOpen(false)}
      />

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
  dayHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  trendButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
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
