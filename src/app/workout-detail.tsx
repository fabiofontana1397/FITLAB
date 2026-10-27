import { useLocalSearchParams } from 'expo-router';
import { planIndexFor, useTrainingSwapStore } from '@/store/training-swap-store';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { PlanExerciseRow } from '@/components/training/plan-exercise-row';
import { difficultyLabel, WorkoutBadge } from '@/components/training/workout-summary-card';
import { useTheme } from '@/hooks/use-theme';
import { daysAgoISO } from '@/lib/mock/dates';
import { sessionKcal, sessionMinutes } from '@/domain/energy';
import { useUserContext } from '@/hooks/use-user-context';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { usePlanStore } from '@/store/plan-store';
import {
  historyForExercise,
  isExerciseCompleted,
  latestWeightForExercise,
  useTrainingProgressStore,
} from '@/store/training-progress-store';

/** A planned session, opened from its box on the Allenamento page: a bottom
 * sheet like Profilo and Promemoria, with the session's name and day as its
 * title, kcal / minutes / difficulty, and the exercise list with the same
 * check-off and load logging as before. A cardio day shows its note. */
export default function WorkoutDetailScreen() {
  const theme = useTheme();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date = dateParam ?? daysAgoISO(0);

  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const progressSets = useTrainingProgressStore((s) => s.sets);
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const logSet = useTrainingProgressStore((s) => s.logSet);
  const toggleCompleted = useTrainingProgressStore((s) => s.toggleCompleted);

  const month = trainingPlan?.months.find((m) => m.monthIndex === currentMonthIndex(trainingPlan));
  const swaps = useTrainingSwapStore((s) => s.swaps);
  const day = month?.weeklySplit[planIndexFor(date, swaps)];
  const exercises = day?.type === 'workout' ? (day.exercises ?? []) : [];

  const ctx = useUserContext();
  const minutes = sessionMinutes(day, ctx);
  const kcal = sessionKcal(day, ctx);

  const dayLabel =
    date === daysAgoISO(0) ? 'Oggi' : new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <SheetScreen
      title={day?.title ?? 'Allenamento'}
      eyebrow={day?.type === 'workout' ? `${dayLabel} · ${minutes} min` : dayLabel}
      fallbackHref="/training"
      leading={day?.type === 'workout' ? <WorkoutBadge size={64} /> : undefined}>
      {day?.type === 'cardio' ? (
        <FlatCard radius={24} style={styles.sessionCard}>
          <ThemedText style={styles.sessionTitle}>Sessione di cardio</ThemedText>
          <ThemedText style={styles.sessionSub} themeColor="textSecondary">
            {day.note}
          </ThemedText>
        </FlatCard>
      ) : (
        <>
          <FlatCard radius={24} style={styles.sessionCard}>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Icon name="flame" size={17} color={theme.accent} />
                <ThemedText style={styles.statText}>{kcal} kcal</ThemedText>
              </View>
              <View style={styles.stat}>
                <Icon name="clock" size={17} color={theme.textTertiary} />
                <ThemedText style={styles.statText}>{minutes} min</ThemedText>
              </View>
              <View style={styles.stat}>
                <Icon name="barChart" size={17} color={theme.textTertiary} />
                <View>
                  <ThemedText style={styles.statLabel} themeColor="textTertiary">
                    Difficoltà
                  </ThemedText>
                  <ThemedText style={styles.statText}>{difficultyLabel(month?.phase)}</ThemedText>
                </View>
              </View>
            </View>
          </FlatCard>

          <View>
            <View style={styles.listHeader}>
              <ThemedText style={styles.listTitle}>Esercizi</ThemedText>
              <ThemedText style={styles.listCount} themeColor="textTertiary">
                {exercises.length} esercizi
              </ThemedText>
            </View>

            <View style={styles.list}>
              {exercises.map((exercise) => (
                <PlanExerciseRow
                  key={exercise.id}
                  exercise={exercise}
                  history={historyForExercise(progressSets, exercise.id)}
                  latestWeightKg={latestWeightForExercise(progressSets, exercise.id)}
                  completed={isExerciseCompleted(completedExercises, exercise.id, date)}
                  onToggleCompleted={() => toggleCompleted(exercise.id, date)}
                  onAddLoad={(reps, weightKg, rir) => logSet(exercise.id, exercise.name, reps, weightKg, date, rir)}
                />
              ))}
            </View>
          </View>
        </>
      )}
    </SheetScreen>
  );
}

const styles = StyleSheet.create({
  sessionCard: {
    padding: 16,
    gap: 8,
  },
  sessionTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '700',
  },
  sessionSub: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
  listHeader: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  listTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  listCount: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
  list: {
    gap: 12,
  },
});
