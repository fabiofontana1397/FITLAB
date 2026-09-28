import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { ExerciseInfoModal } from '@/components/training/exercise-info-modal';
import { NewLoadModal } from '@/components/training/new-load-modal';
import { FlatCard } from '@/components/ui/flat-card';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { SpringSnappy } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getExerciseMedia } from '@/lib/exercise-media/exercise-media';
import type { TrainingExerciseEntry } from '@/lib/planning/types';

export type PlanExerciseRowProps = {
  exercise: TrainingExerciseEntry;
  latestWeightKg: number | null;
  loggedTodayKg: number | null;
  completed: boolean;
  onToggleCompleted: () => void;
  onAddLoad: (reps: number, weightKg: number, rir?: number) => void;
};

export function PlanExerciseRow({
  exercise,
  latestWeightKg,
  loggedTodayKg,
  completed,
  onToggleCompleted,
  onAddLoad,
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

  return (
    <FlatCard radius={Radius.large} style={[styles.card, completed ? { opacity: 0.72 } : undefined]}>
      <View style={styles.header}>
        <CompletionToggle completed={completed} onToggle={onToggleCompleted} />

        <ThemedText
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

        <Pressable onPress={() => setInfoOpen(true)} hitSlop={8} style={[styles.iconButton, { borderColor: theme.border }]}>
          <Icon name="info" size={15} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatCol icon="repsHash" topText={`${exercise.sets}×${exercise.reps}`} topBold bottomText="Serie x Rip." />
        {!isBodyweight && referenceKg != null ? (
          <StatCol icon="weightKg" topText={isFirstTime ? 'Consigliato' : 'Ultimo carico'} bottomText={`${referenceKg} kg`} />
        ) : null}
        <StatCol icon="clockOutline" topText="Recupero" bottomText={restLabel} />
        <StatCol icon="hourglass" topText="Tempo" bottomText={exercise.tempo} />
      </View>

      <Pressable
        onPress={() => setLoadModalOpen(true)}
        style={[styles.newLoadButton, { backgroundColor: theme.accent }]}>
        <Icon name="addCircle" size={13} color={theme.onAccent} />
        <ThemedText style={{ color: theme.onAccent, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
          Nuovo carico
        </ThemedText>
      </Pressable>

      {loggedTodayKg != null ? (
        <ThemedText type="caption" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          Aggiornato oggi: {loggedTodayKg}kg
        </ThemedText>
      ) : null}

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
    </FlatCard>
  );
}

/** One stat column: an icon beside the top line, a second line below it —
 * `topBold` swaps which line is the bold value vs. the gray label (col 1
 * leads with the bold "4×8-10" value then the "Serie x Rip." label below;
 * every other column leads with the gray label then the bold value). */
function StatCol({
  icon,
  topText,
  topBold = false,
  bottomText,
}: {
  icon: IconName;
  topText: string;
  topBold?: boolean;
  bottomText: string;
}) {
  const theme = useTheme();
  const boldStyle = { fontSize: 13, fontWeight: '800' as const };
  const labelStyle = { fontSize: 11, fontWeight: '500' as const };
  return (
    <View style={styles.statCol}>
      <View style={styles.statColTopRow}>
        <Icon name={icon} size={13} color={theme.textSecondary} />
        <ThemedText style={topBold ? boldStyle : labelStyle} themeColor={topBold ? undefined : 'textSecondary'} numberOfLines={1}>
          {topText}
        </ThemedText>
      </View>
      <ThemedText style={topBold ? labelStyle : boldStyle} themeColor={topBold ? 'textSecondary' : undefined} numberOfLines={1}>
        {bottomText}
      </ThemedText>
    </View>
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
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
  },
  headerSpacer: {
    flex: 1,
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCol: {
    alignItems: 'flex-start',
    gap: 3,
  },
  statColTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newLoadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
});
