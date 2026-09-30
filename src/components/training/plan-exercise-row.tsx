import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { ExerciseInfoModal } from '@/components/training/exercise-info-modal';
import { NewLoadModal } from '@/components/training/new-load-modal';
import { AiCoachTipRow } from '@/components/ui/ai-coach-tip-row';
import { FlatCard } from '@/components/ui/flat-card';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { TrendChart } from '@/components/ui/trend-chart';
import { SpringSnappy } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getExerciseMedia } from '@/lib/exercise-media/exercise-media';
import type { TrainingExerciseEntry } from '@/lib/planning/types';

export type PlanExerciseRowProps = {
  exercise: TrainingExerciseEntry;
  history: { date: string; weightKg: number }[];
  latestWeightKg: number | null;
  completed: boolean;
  onToggleCompleted: () => void;
  onAddLoad: (reps: number, weightKg: number, rir?: number) => void;
};

export function PlanExerciseRow({
  exercise,
  history,
  latestWeightKg,
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
  const recentHistory = history.slice(-4);

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

      <View style={styles.metaRow}>
        <MetaItem icon="repsHash" value={`${exercise.sets}×${exercise.reps}`} label="Serie x Rip." />
        <View style={[styles.metaDivider, { backgroundColor: theme.border }]} />
        <MetaItem icon="hourglass" value={exercise.tempo} label="Modalità di esecuzione" />
        <View style={[styles.metaDivider, { backgroundColor: theme.border }]} />
        <MetaItem icon="clockOutline" value={restLabel} label="Recupero" />
      </View>

      <View style={styles.loadRow}>
        <View style={styles.loadCol}>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {isBodyweight ? 'Carico' : isFirstTime ? 'Consigliato' : 'Ultimo carico'}
          </ThemedText>
          <ThemedText style={styles.loadValue} numberOfLines={1}>
            {referenceKg != null ? `${referenceKg} kg` : '—'}
          </ThemedText>
        </View>

        {recentHistory.length >= 2 ? (
          <TrendChart data={recentHistory.map((h) => h.weightKg)} width={48} height={32} color={theme.accent} />
        ) : (
          <View style={styles.chartPlaceholder} />
        )}

        <Pressable
          onPress={() => setLoadModalOpen(true)}
          style={[styles.newLoadButton, { backgroundColor: theme.accent }]}>
          <Icon name="addCircle" size={13} color={theme.onAccent} />
          <ThemedText style={{ color: theme.onAccent, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
            Nuovo carico
          </ThemedText>
        </Pressable>
      </View>

      <AiCoachTipRow tip={`Chiedi al coach AI consigli su tecnica e progressione per ${exercise.name}.`} />

      <ExerciseInfoModal
        visible={infoOpen}
        exerciseName={exercise.name}
        media={media}
        sets={exercise.sets}
        reps={exercise.reps}
        tempo={exercise.tempo}
        restLabel={restLabel}
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

/** One item in the serie×rip / tempo / recupero row: an icon+value on top,
 * a small gray label below — centered within its own flex share of the
 * row, so the vertical dividers between items land evenly regardless of
 * how long each value happens to be. */
function MetaItem({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.metaItem}>
      <View style={styles.metaItemTopRow}>
        <Icon name={icon} size={13} color={theme.textSecondary} />
        <ThemedText style={styles.metaValue} numberOfLines={1}>
          {value}
        </ThemedText>
      </View>
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2} style={{ textAlign: 'center' }}>
        {label}
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  metaItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  metaDivider: {
    width: 1,
    height: 22,
  },
  loadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadCol: {
    gap: 2,
  },
  loadValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  chartPlaceholder: {
    width: 48,
    height: 32,
  },
  newLoadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: Spacing.two,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
});
