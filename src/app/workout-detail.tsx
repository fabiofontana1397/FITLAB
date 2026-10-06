import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { PlanExerciseRow } from '@/components/training/plan-exercise-row';
import { difficultyLabel, WorkoutBadge } from '@/components/training/workout-summary-card';
import { useTheme } from '@/hooks/use-theme';
import { latestSnapshot } from '@/lib/mock/body';
import { daysAgoISO, mondayIndex } from '@/lib/mock/dates';
import { goBackOr } from '@/lib/navigation/go-back';
import { estimateTrainingContributionKcal, sessionDurationMinutes } from '@/lib/nutrition/targets';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { useBodyStore } from '@/store/body-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import {
  historyForExercise,
  isExerciseCompleted,
  latestWeightForExercise,
  useTrainingProgressStore,
} from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

/** The Figma "Dettaglio allenamento": back chevron + title, the session
 * summary card (name, day + duration, kcal / minutes / difficulty) and the
 * exercise list with the same check-off and load logging as before. */
export default function WorkoutDetailScreen() {
  const theme = useTheme();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const date = dateParam ?? daysAgoISO(0);

  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const onboardingAnswers = useOnboardingStore((s) => s.answers);
  const currentUser = useUserStore();
  const bodyEntries = useBodyStore((s) => s.entries);
  const progressSets = useTrainingProgressStore((s) => s.sets);
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const logSet = useTrainingProgressStore((s) => s.logSet);
  const toggleCompleted = useTrainingProgressStore((s) => s.toggleCompleted);

  const month = trainingPlan?.months.find((m) => m.monthIndex === currentMonthIndex(trainingPlan));
  const day = month?.weeklySplit[mondayIndex(new Date(date))];
  const exercises = day?.type === 'workout' ? (day.exercises ?? []) : [];

  const sessionBucket = onboardingAnswers.sessionDuration as string | undefined;
  const minutes = sessionDurationMinutes(sessionBucket);
  const kcal = estimateTrainingContributionKcal({
    sex: currentUser.sex,
    age: currentUser.age,
    heightCm: currentUser.heightCm,
    weightKg: latestSnapshot(bodyEntries).weightKg,
    sessionDurationBucket: sessionBucket,
    completionFraction: 1,
  });

  const dayLabel =
    date === daysAgoISO(0) ? 'Oggi' : new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScreenScroll contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={() => goBackOr('/training')} hitSlop={10} accessibilityLabel="Indietro">
          <Icon name="arrowBack" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.title}>Dettaglio allenamento</ThemedText>
      </View>

      <FlatCard radius={20} style={styles.sessionCard}>
        <View style={styles.sessionTop}>
          <WorkoutBadge />
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText style={styles.sessionTitle} numberOfLines={1}>
              {day?.title ?? 'Allenamento'}
            </ThemedText>
            <ThemedText style={styles.sessionSub} themeColor="textTertiary">
              {dayLabel}, {minutes} min
            </ThemedText>
          </View>
        </View>
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
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 20,
    gap: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sessionCard: {
    padding: 16,
    gap: 16,
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sessionTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '700',
  },
  sessionSub: {
    marginTop: 3,
    fontSize: 12.5,
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
    marginTop: 24,
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
