import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { TrendChart } from '@/components/ui/trend-chart';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getExerciseMedia } from '@/lib/exercise-media/exercise-media';
import { goBackOr } from '@/lib/navigation/go-back';
import type { TrainingExerciseEntry } from '@/lib/planning/types';
import { usePlanStore } from '@/store/plan-store';
import {
  historyForExercise,
  latestWeightForExercise,
  useTrainingProgressStore,
  type LoggedSet,
} from '@/store/training-progress-store';

export default function TrainingProgressScreen() {
  const theme = useTheme();
  const plan = usePlanStore((s) => s.trainingPlan);
  const progressSets = useTrainingProgressStore((s) => s.sets);

  const exercises = useMemo(() => {
    if (!plan) return [];
    const byId = new Map<string, TrainingExerciseEntry>();
    for (const month of plan.months) {
      for (const day of month.weeklySplit) {
        if (day.type !== 'workout') continue;
        for (const ex of day.exercises ?? []) {
          if (!byId.has(ex.id)) byId.set(ex.id, ex);
        }
      }
    }
    return [...byId.values()];
  }, [plan]);

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="title">Andamento carichi</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            La progressione di ogni esercizio, dal primo all&apos;ultimo carico registrato.
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

      {exercises.length === 0 ? (
        <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.two }}>
          <ThemedText type="smallBold">Nessun esercizio nel piano</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Genera un programma di allenamento dalla scheda Training per vedere qui i tuoi progressi.
          </ThemedText>
        </GlassSurface>
      ) : (
        <View style={{ gap: Spacing.three }}>
          {exercises.map((exercise) => (
            <ExerciseProgressCard key={exercise.id} exercise={exercise} sets={progressSets} />
          ))}
        </View>
      )}
    </ScreenScroll>
  );
}

function ExerciseProgressCard({ exercise, sets }: { exercise: TrainingExerciseEntry; sets: LoggedSet[] }) {
  const theme = useTheme();
  const media = getExerciseMedia(exercise.id);
  const history = historyForExercise(sets, exercise.id);
  const lastWeight = latestWeightForExercise(sets, exercise.id);
  const hasData = history.length >= 2;
  const isBodyweight = exercise.suggestedKg == null && lastWeight == null;
  const changeKg = hasData ? history[history.length - 1].weightKg - history[0].weightKg : 0;

  return (
    <GlassSurface level="card" radius={Radius.large} style={styles.card}>
      <View style={styles.cardHeader}>
        {media ? (
          <Image source={{ uri: media.gifUrl }} style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="smallBold">{exercise.name}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {exercise.sets}×{exercise.reps}
          </ThemedText>
        </View>
        {!isBodyweight ? (
          <View style={[styles.loadBadge, { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '700' }}>
              {lastWeight != null ? `${lastWeight}kg` : exercise.suggestedKg != null ? `~${exercise.suggestedKg}kg` : '—'}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {hasData ? (
        <View style={styles.chartRow}>
          <TrendChart data={history.map((h) => h.weightKg)} width={140} height={44} color={theme.accent} />
          <View style={{ gap: 2, alignItems: 'flex-end' }}>
            <ThemedText type="caption" themeColor="textSecondary">
              {history[0].weightKg}kg → {history[history.length - 1].weightKg}kg
            </ThemedText>
            <View style={styles.changeRow}>
              <Icon
                name={changeKg > 0 ? 'trendUp' : changeKg < 0 ? 'trendDown' : 'trendFlat'}
                size={13}
                color={changeKg > 0 ? theme.success : changeKg < 0 ? theme.danger : theme.textTertiary}
              />
              <ThemedText
                type="caption"
                style={{ color: changeKg > 0 ? theme.success : changeKg < 0 ? theme.danger : theme.textTertiary, fontWeight: '700' }}>
                {changeKg > 0 ? '+' : ''}
                {changeKg}kg
              </ThemedText>
            </View>
          </View>
        </View>
      ) : (
        <ThemedText type="caption" themeColor="textSecondary">
          Registra almeno due sessioni per questo esercizio per vedere qui il trend del carico.
        </ThemedText>
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  closeButton: {
    width: 40,
    height: 40,
  },
  closeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.medium,
  },
  loadBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
