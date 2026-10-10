import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { LogActivityModal } from '@/components/training/log-activity-modal';
import { TrainingHeroCard } from '@/components/training/training-hero-card';
import { TrainingWeekCard } from '@/components/training/training-week-card';
import { levelLabel, WorkoutSummaryCard } from '@/components/training/workout-summary-card';
import { useEnsurePlan } from '@/hooks/use-ensure-plan';
import { useUserContext } from '@/hooks/use-user-context';
import { useTheme } from '@/hooks/use-theme';
import { addDaysISO, currentWeekDates, daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
import { sessionKcal as plannedSessionKcal, sessionMinutes as plannedSessionMinutes } from '@/domain/energy';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import type { Goal } from '@/lib/mock/types';
import type { TrainingDayPlan } from '@/lib/planning/types';
import { useActivityLogStore } from '@/store/activity-log-store';
import { usePlanStore } from '@/store/plan-store';
import { isExerciseCompleted, useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

const SCREEN_PADDING = 20;

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

  const today = daysAgoISO(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);

  const viewedWeekDates = useMemo(() => currentWeekDates(new Date(addDaysISO(today, weekOffset * 7))), [today, weekOffset]);

  useEnsurePlan('training');

  const monthIndex = trainingPlan ? currentMonthIndex(trainingPlan) : 1;
  const currentMonth = trainingPlan?.months.find((m) => m.monthIndex === monthIndex);
  const weeklySplit = currentMonth?.weeklySplit ?? [];
  const selectedDay: TrainingDayPlan | undefined = weeklySplit[isoMondayIndex(selectedDate)];

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
  // What the day's planned session takes and burns — the same model the diet's calorie targets use.
  const sessionKcal = plannedSessionKcal(selectedDay, ctx);
  const sessionMinutes = plannedSessionMinutes(selectedDay, ctx);

  const selectedDone = isDayComplete(selectedDate);
  const statusLabel = selectedDone ? 'Completato' : selectedDate < today ? 'Non completato' : 'In programma';
  const statusColor = selectedDone ? theme.brandGreen : selectedDate < today ? theme.textTertiary : theme.accent;

  const dayHeading =
    selectedDate === today ? 'Allenamento di oggi' : `Allenamento del ${new Date(selectedDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;

  return (
    <ScreenScroll contentContainerStyle={styles.page}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.pageTitle}>Allenamento</ThemedText>
        <View style={styles.headerIcons}>
          <Pressable
            onPress={() => router.push('/training-plan')}
            hitSlop={8}
            accessibilityLabel="Piano di allenamento"
            style={[styles.circleButton, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
            <Icon name="calendar" size={19} color={theme.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/profile')} hitSlop={8} style={[styles.circleButton, { backgroundColor: theme.text }]}>
            <Icon name="personFilled" size={21} color={theme.background} />
          </Pressable>
        </View>
      </View>

      <TrainingHeroCard onRegister={() => setLogActivityVisible(true)} />

      <View style={styles.sectionRow}>
        <ThemedText style={styles.sectionTitle}>La tua settimana</ThemedText>
        <Pressable onPress={() => setCalendarOpen(true)} hitSlop={8} accessibilityLabel="Apri calendario">
          <ThemedText style={[styles.link, { color: theme.accent }]}>Vedi calendario ›</ThemedText>
        </Pressable>
      </View>

      <TrainingWeekCard
        weekDates={viewedWeekDates}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        isDayComplete={isDayComplete}
        onToggleDayComplete={toggleDayComplete}
        dayType={(date) => (trainingPlan ? weeklySplit[isoMondayIndex(date)]?.type : undefined)}
      />

      <View style={styles.sectionRow}>
        <ThemedText style={styles.sectionTitle}>{dayHeading}</ThemedText>
        {selectedDay?.type === 'workout' ? (
          <View style={[styles.statusPill, { backgroundColor: statusColor + '1F' }]}>
            <ThemedText style={[styles.statusText, { color: statusColor }]}>{statusLabel}</ThemedText>
          </View>
        ) : null}
      </View>

      {!trainingPlan ? (
        <FlatCard radius={20} style={styles.messageCard}>
          <ThemedText style={styles.cardTitle}>{ctx.mode === 'diet' ? 'Programma di allenamento non richiesto' : 'Nessun programma generato'}</ThemedText>
          <ThemedText style={styles.cardBody} themeColor="textSecondary">
            {ctx.mode === 'diet'
              ? 'Hai scelto un piano solo alimentare. Per aggiungere l’allenamento rifai il questionario dal Profilo.'
              : 'Rifai il questionario scegliendo sala pesi o corsa tra le attività per generarne uno.'}
          </ThemedText>
        </FlatCard>
      ) : selectedDay?.type === 'workout' ? (
        <WorkoutSummaryCard
          title={selectedDay.title}
          subtitle={GOAL_SHORT_LABEL[currentUser.goal] + ' - ' + levelLabel(currentMonth?.phase)}
          minutes={sessionMinutes}
          kcal={sessionKcal}
          onOpen={() => router.push({ pathname: '/workout-detail', params: { date: selectedDate } })}
          onStart={() => router.push({ pathname: '/workout-detail', params: { date: selectedDate } })}
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
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 11.5,
    lineHeight: 15,
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
});
