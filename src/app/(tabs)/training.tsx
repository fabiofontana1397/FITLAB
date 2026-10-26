import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { TabHeader } from '@/components/tab-header';
import { LogActivityModal } from '@/components/training/log-activity-modal';
import { LoggedActivitiesCard } from '@/components/training/logged-activities-card';
import { TrainingWeekCard } from '@/components/training/training-week-card';
import { levelLabel, WorkoutSummaryCard } from '@/components/training/workout-summary-card';
import { WorkoutSessionModal } from '@/components/training/workout-session-modal';
import { useEnsurePlan } from '@/hooks/use-ensure-plan';
import { useUserContext } from '@/hooks/use-user-context';
import { useTheme } from '@/hooks/use-theme';
import { addDaysISO, currentWeekDates, daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
import { sessionKcal as plannedSessionKcal, sessionMinutes as plannedSessionMinutes } from '@/domain/energy';
import { OnBrand } from '@/constants/theme';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import type { Goal } from '@/lib/mock/types';
import type { TrainingDayPlan } from '@/lib/planning/types';
import { useActivityLogStore } from '@/store/activity-log-store';
import { usePlanStore } from '@/store/plan-store';
import { isExerciseCompleted, useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

/** Short label for the user's goal, shown next to the session level. */
const GOAL_SHORT_LABEL: Record<Goal, string> = {
  loseFat: 'Definizione',
  gainMuscle: 'Ipertrofia',
  maintainImprove: 'Mantenimento',
  gainStrength: 'Forza',
  improveEndurance: 'Resistenza',
  generalHealth: 'Benessere',
};

export default function TrainingScreen() {
  const theme = useTheme();
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const currentUser = useUserStore();
  const ctx = useUserContext();
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const toggleCompleted = useTrainingProgressStore((s) => s.toggleCompleted);
  const addActivityEntry = useActivityLogStore((s) => s.addEntry);
  const [isLogActivityVisible, setLogActivityVisible] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [sessionDate, setSessionDate] = useState<string | null>(null);

  const today = daysAgoISO(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);

  const viewedWeekDates = useMemo(() => currentWeekDates(new Date(addDaysISO(today, weekOffset * 7))), [today, weekOffset]);

  useEnsurePlan('training');

  const monthIndex = trainingPlan ? currentMonthIndex(trainingPlan) : 1;
  const currentMonth = trainingPlan?.months.find((m) => m.monthIndex === monthIndex);
  const weeklySplit = currentMonth?.weeklySplit ?? [];
  const dayPlanOf = (date: string): TrainingDayPlan | undefined => weeklySplit[isoMondayIndex(date)];

  const isDayComplete = (date: string): boolean => {
    const day = weeklySplit[isoMondayIndex(date)];
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
    const day = weeklySplit[isoMondayIndex(date)];
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
    const dateMonday = addDaysISO(date, -isoMondayIndex(date));
    const todayMonday = addDaysISO(today, -isoMondayIndex(today));
    setWeekOffset(Math.round((new Date(dateMonday).getTime() - new Date(todayMonday).getTime()) / (7 * 86400000)));
  };

  const weightKg = ctx.weightKg;

  // The sessions from the selected day to the end of the week, one section each,
  // in calendar order: the selected day whatever it is (a rest day says so), then
  // every later workout or cardio day. An earlier day is one tap on the week away.
  const sectionDates = trainingPlan
    ? viewedWeekDates.filter(
        (date) => date === selectedDate || (date > selectedDate && (dayPlanOf(date)?.type === 'workout' || dayPlanOf(date)?.type === 'cardio'))
      )
    : [selectedDate];

  // Picking a day starts the list at that day: back to the top, where the week is.
  const scrollRef = useRef<ScrollView>(null);
  const selectDate = (date: string) => {
    setSelectedDate(date);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const headingOf = (date: string) =>
    date === today
      ? 'Allenamento di oggi'
      : (() => {
          const label = new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
          return label.charAt(0).toUpperCase() + label.slice(1);
        })();

  const sessionDay = sessionDate ? dayPlanOf(sessionDate) : undefined;

  return (
    <>
      {/* The top bar and the week are fixed; the week's sessions scroll under them and fade out. */}
      <ScreenScroll
        ref={scrollRef}
        testID="training-list"
        header={<TabHeader title="Allenamento" onCalendarPress={() => setCalendarOpen(true)} />}>
        <TrainingWeekCard
          weekDates={viewedWeekDates}
          selectedDate={selectedDate}
          onSelectDate={selectDate}
          isDayComplete={isDayComplete}
          onToggleDayComplete={toggleDayComplete}
          dayType={(date) => (trainingPlan ? dayPlanOf(date)?.type : undefined)}
        />

        <PressableScale
          onPress={() => setLogActivityVisible(true)}
          accessibilityRole="button"
          haptic="press"
          scaleTo={0.97}
          style={[styles.registerButton, { backgroundColor: theme.accent }]}>
          <View style={styles.registerPlus}>
            <Icon name="plus" size={18} color={theme.accent} />
          </View>
          <ThemedText style={styles.registerLabel}>Registra allenamento</ThemedText>
          <Icon name="chevronRight" size={16} color={OnBrand.text} />
        </PressableScale>

        {sectionDates.map((date) => {
          const day = dayPlanOf(date);
          const done = isDayComplete(date);
          const statusLabel = done ? 'Completato' : date < today ? 'Non completato' : 'In programma';
          const statusColor = done ? theme.brandGreen : date < today ? theme.textTertiary : theme.accent;
          return (
            <View key={date} testID={`training-day-${date}`} style={styles.daySection}>
              <View style={styles.dayHeadingRow}>
                <ThemedText style={styles.sectionTitle} accessibilityRole="header">
                  {headingOf(date)}
                </ThemedText>
                {day?.type === 'workout' ? (
                  <View style={[styles.statusPill, { backgroundColor: statusColor + '1F' }]}>
                    <ThemedText style={[styles.statusText, { color: statusColor }]}>{statusLabel}</ThemedText>
                  </View>
                ) : null}
              </View>

              {/* What was logged that day sits in the day's own section: before the planned session while that is still to do, after it once it is done. */}
              <View style={styles.dayBody}>
              {done ? null : <LoggedActivitiesCard date={date} inline />}
              {!trainingPlan ? (
                <FlatCard radius={20} style={styles.messageCard}>
                  <ThemedText style={styles.cardTitle}>{ctx.mode === 'diet' ? 'Programma di allenamento non richiesto' : 'Nessun programma generato'}</ThemedText>
                  <ThemedText style={styles.cardBody} themeColor="textSecondary">
                    {ctx.mode === 'diet'
                      ? 'Hai scelto un piano solo alimentare. Per aggiungere l’allenamento rifai il questionario dal Profilo.'
                      : 'Rifai il questionario scegliendo sala pesi o corsa tra le attività per generarne uno.'}
                  </ThemedText>
                </FlatCard>
              ) : day?.type === 'workout' ? (
                <WorkoutSummaryCard
                  title={day.title}
                  subtitle={GOAL_SHORT_LABEL[currentUser.goal] + ' - ' + levelLabel(currentMonth?.phase)}
                  minutes={plannedSessionMinutes(day, ctx)}
                  kcal={plannedSessionKcal(day, ctx)}
                  onOpen={() => router.push({ pathname: '/workout-detail', params: { date } })}
                  onStart={() => setSessionDate(date)}
                />
              ) : day?.type === 'cardio' ? (
                <PressableScale
                  onPress={() => router.push({ pathname: '/workout-detail', params: { date } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Dettagli: ${day.title}`}
                  scaleTo={0.98}>
                  <FlatCard radius={20} style={styles.messageCard}>
                    <View style={[styles.dayIcon, { backgroundColor: theme.accentSoft }]}>
                      <Icon name="running" size={26} color={theme.accent} />
                    </View>
                    <ThemedText style={styles.cardTitle}>{day.title}</ThemedText>
                    <ThemedText style={styles.cardBody} themeColor="textSecondary">
                      {day.note}
                    </ThemedText>
                  </FlatCard>
                </PressableScale>
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
              {done ? <LoggedActivitiesCard date={date} inline /> : null}
              </View>
            </View>
          );
        })}

      </ScreenScroll>

      <DayCalendarModal
        visible={calendarOpen}
        selectedDate={selectedDate}
        isDayMarked={isDayComplete}
        onSelectDate={selectDateFromCalendar}
        onClose={() => setCalendarOpen(false)}
      />

      {sessionDate && sessionDay?.type === 'workout' ? (
        <WorkoutSessionModal
          visible
          onClose={() => setSessionDate(null)}
          title={sessionDay.title}
          exercises={sessionDay.exercises ?? []}
          // a future day trained early counts for today
          date={sessionDate > today ? today : sessionDate}
        />
      ) : null}

      <LogActivityModal
        visible={isLogActivityVisible}
        weightKg={weightKg}
        onClose={() => setLogActivityVisible(false)}
        // logged on the day picked in the strip (today if it is still to come)
        onSave={(activityType, intensity, durationMinutes) =>
          addActivityEntry(activityType, intensity, durationMinutes, weightKg, selectedDate > today ? today : selectedDate)
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  daySection: {
    marginBottom: 6,
  },
  dayBody: {
    gap: 12,
  },
  dayHeadingRow: {
    marginTop: 6,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  // Type scale shared with the training plan: page title > section title > card title.
  pageTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  sectionRow: {
    marginTop: 24,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // iOS "headline": 17 pt semibold, one step under the page title and above the 15 pt card titles.
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  registerButton: {
    marginTop: 12,
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  registerPlus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: OnBrand.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerLabel: {
    flex: 1,
    color: OnBrand.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
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
    fontSize: 12,
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
});
