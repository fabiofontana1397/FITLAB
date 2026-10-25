import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
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
import { currentWeekDates, daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
import { sessionKcal as plannedSessionKcal, sessionMinutes as plannedSessionMinutes } from '@/domain/energy';
import { OnBrand } from '@/constants/theme';
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
  const [sessionOpen, setSessionOpen] = useState(false);

  const today = daysAgoISO(0);
  const [selectedDate, setSelectedDate] = useState(today);

  const viewedWeekDates = useMemo(() => currentWeekDates(new Date(today)), [today]);

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
    <ScreenScroll reveal contentContainerStyle={styles.page}>
      <TabHeader title="Allenamento" />

      <TrainingWeekCard
        weekDates={viewedWeekDates}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        isDayComplete={isDayComplete}
        onToggleDayComplete={toggleDayComplete}
        dayType={(date) => (trainingPlan ? weeklySplit[isoMondayIndex(date)]?.type : undefined)}
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
          onStart={() => setSessionOpen(true)}
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

      <LoggedActivitiesCard date={selectedDate} />

      {selectedDay?.type === 'workout' ? (
        <WorkoutSessionModal
          visible={sessionOpen}
          onClose={() => setSessionOpen(false)}
          title={selectedDay.title}
          exercises={selectedDay.exercises ?? []}
          // a future day trained early counts for today
          date={selectedDate > today ? today : selectedDate}
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
  sectionTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.3,
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
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 17,
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
