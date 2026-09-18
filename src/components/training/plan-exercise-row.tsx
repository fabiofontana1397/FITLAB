import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { ExerciseInfoModal } from '@/components/training/exercise-info-modal';
import { NewLoadModal } from '@/components/training/new-load-modal';
import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { TrendChart } from '@/components/ui/trend-chart';
import { SpringSnappy } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getExerciseMedia } from '@/lib/exercise-media/exercise-media';
import type { TrainingExerciseEntry } from '@/lib/planning/types';

const TEMPO_PHASE_LABELS = ['negativa', 'isometria', 'spinta'];

/** "3-0-1" -> "3s negativa · 0s isometria · 1s spinta" — the standard
 * eccentric/isometric/concentric cadence notation used in the plan. */
function describeTempo(tempo: string): string | null {
  const parts = tempo.split('-');
  if (parts.length !== 3) return null;
  return parts.map((seconds, i) => `${seconds}s ${TEMPO_PHASE_LABELS[i]}`).join(' · ');
}

export type PlanExerciseRowProps = {
  exercise: TrainingExerciseEntry;
  history: { date: string; weightKg: number }[];
  latestWeightKg: number | null;
  loggedTodayKg: number | null;
  completed: boolean;
  onToggleCompleted: () => void;
  onAddLoad: (reps: number, weightKg: number, rir?: number) => void;
  /** Scoped progression-engine suggestion (lib/planning/progression.ts) —
   * only has a `note` once the user has logged at least one RIR value for
   * this exercise, otherwise undefined and nothing extra is shown. */
  progressionNote?: string | null;
};

export function PlanExerciseRow({
  exercise,
  history,
  latestWeightKg,
  loggedTodayKg,
  completed,
  onToggleCompleted,
  onAddLoad,
  progressionNote,
}: PlanExerciseRowProps) {
  const theme = useTheme();
  const [infoOpen, setInfoOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const media = getExerciseMedia(exercise.id);
  const startingReps = (exercise.reps.match(/\d+/) ?? ['8'])[0];

  const isBodyweight = exercise.suggestedKg == null && latestWeightKg == null;
  const isFirstTime = latestWeightKg == null;
  const referenceKg = latestWeightKg ?? exercise.suggestedKg;
  const restLabel = exercise.restSec < 60 ? `${exercise.restSec}s` : `${Math.round(exercise.restSec / 60)} min`;
  const tempoDescription = describeTempo(exercise.tempo);

  return (
    <GlassSurface level="card" radius={Radius.large} style={[styles.card, completed ? { opacity: 0.72 } : undefined]}>
      <View style={styles.header}>
        <CompletionToggle completed={completed} onToggle={onToggleCompleted} />

        <ThemedText
          type="smallBold"
          numberOfLines={1}
          style={[styles.nameText, completed ? { textDecorationLine: 'line-through' } : undefined]}>
          {exercise.name}
        </ThemedText>

        {media ? (
          <Image source={{ uri: media.gifUrl }} style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
        )}

        <View style={styles.headerSpacer} />

        <Pressable onPress={() => setInfoOpen(true)} hitSlop={8} style={styles.iconButton}>
          <Icon name="info" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.splitRow}>
        <View style={styles.leftCol}>
          <View style={[styles.targetChip, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="subtitle">
              {exercise.sets}×{exercise.reps}
            </ThemedText>
          </View>
          {!isBodyweight && referenceKg != null ? (
            <ThemedText type="smallBold">
              {isFirstTime ? 'Consigliato' : 'Ultimo carico'} {referenceKg}kg
            </ThemedText>
          ) : null}
          {progressionNote ? (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.progressionNote}>
              {progressionNote}
            </ThemedText>
          ) : null}
          <ThemedText type="caption" themeColor="textSecondary">
            Recupero {restLabel}
          </ThemedText>
          {tempoDescription ? (
            <View style={styles.tempoBlock}>
              <ThemedText type="label" themeColor="textSecondary">
                Tempo {exercise.tempo}
              </ThemedText>
              <ThemedText type="caption" themeColor="textTertiary">
                {tempoDescription}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.rightCol}>
          {history.length >= 2 ? (
            <TrendChart data={history.map((h) => h.weightKg)} width={128} height={44} color={theme.accent} />
          ) : (
            <ThemedText type="caption" themeColor="textTertiary" style={styles.chartHint}>
              {isBodyweight
                ? 'Aggiungi un carico se appesantisci l’esercizio.'
                : 'Aggiungi un carico per iniziare a monitorare i progressi.'}
            </ThemedText>
          )}
          {loggedTodayKg != null ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Aggiornato oggi: {loggedTodayKg}kg
            </ThemedText>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={() => setLoadModalOpen(true)}
        style={[styles.newLoadButton, { backgroundColor: theme.accent }]}>
        <Icon name="addCircle" size={13} color={theme.onAccent} />
        <ThemedText type="caption" style={{ color: theme.onAccent, fontWeight: '700' }}>
          Nuovo carico
        </ThemedText>
      </Pressable>

      <ExerciseInfoModal
        visible={infoOpen}
        exerciseName={exercise.name}
        media={media}
        onClose={() => setInfoOpen(false)}
      />

      <NewLoadModal
        visible={loadModalOpen}
        exerciseName={exercise.name}
        defaultReps={startingReps}
        defaultWeightKg={referenceKg != null ? String(referenceKg) : ''}
        onClose={() => setLoadModalOpen(false)}
        onSave={onAddLoad}
      />
    </GlassSurface>
  );
}

function CompletionToggle({ completed, onToggle }: { completed: boolean; onToggle: () => void }) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(withTiming(0.72, { duration: 90 }), withSpring(1, SpringSnappy));
    // Only animate in response to the completed flag actually flipping, not the initial mount value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable onPress={onToggle} hitSlop={8}>
      <Animated.View
        style={[
          styles.checkCircle,
          {
            backgroundColor: completed ? theme.accent : 'transparent',
            borderColor: completed ? theme.accent : theme.borderStrong,
          },
          animatedStyle,
        ]}>
        {completed ? <Icon name="check" size={18} color={theme.onAccent} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: {
    flexShrink: 1,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.medium,
  },
  headerSpacer: {
    flex: 1,
  },
  iconButton: {
    padding: 4,
  },
  splitRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  leftCol: {
    flex: 1,
    gap: 6,
    alignItems: 'flex-start',
    // Anchor to the bottom like rightCol below, so whichever column has
    // less content (e.g. a bodyweight exercise with no carico/tempo lines)
    // doesn't leave empty space above the row's bottom edge.
    justifyContent: 'flex-end',
  },
  targetChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Radius.small,
  },
  tempoBlock: {
    marginTop: 4,
    gap: 2,
  },
  progressionNote: {
    maxWidth: 160,
  },
  rightCol: {
    width: 132,
    alignItems: 'center',
    // The left column (target/load/recupero/tempo) is usually taller than
    // this one's chart+hint, which otherwise left them stranded near the
    // top with empty space below — anchor to the bottom so they sit level
    // with the "Nuovo carico" button right underneath instead.
    justifyContent: 'flex-end',
    gap: 6,
  },
  chartHint: {
    textAlign: 'center',
  },
  newLoadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
});
