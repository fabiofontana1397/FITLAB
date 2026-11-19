import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { ExerciseInfoModal } from '@/components/training/exercise-info-modal';
import { NewLoadModal } from '@/components/training/new-load-modal';
import { FlatCard } from '@/components/ui/flat-card';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { TrendChart } from '@/components/ui/trend-chart';
import { SpringSnappy, TimingTap } from '@/constants/motion';
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
  const media = getExerciseMedia(exercise.id, exercise.name);
  const startingReps = (exercise.reps.match(/\d+/) ?? ['8'])[0];

  const isBodyweight = exercise.suggestedKg == null && latestWeightKg == null;
  const isFirstTime = latestWeightKg == null;
  // deload week: about −10% on the last load used (the plan's own suggestion already carries it)
  const deload = !!exercise.activeWeek?.deload;
  const referenceKg = latestWeightKg != null ? (deload ? Math.floor((latestWeightKg * 0.9) / (exercise.loadIncrementKg || 1)) * (exercise.loadIncrementKg || 1) : latestWeightKg) : exercise.suggestedKg;
  const restLabel = exercise.restSec < 60 ? `${exercise.restSec}s` : exercise.restSec % 60 === 0 ? `${exercise.restSec / 60} min` : `${Math.floor(exercise.restSec / 60)}:${String(exercise.restSec % 60).padStart(2, '0')} min`;
  const calibrating = isFirstTime && exercise.loadStatus === 'calibrate';
  const programming = {
    rir: exercise.rir,
    muscles: exercise.primaryMuscle ? [exercise.primaryMuscle + (exercise.primaryRegion ? ` (${exercise.primaryRegion})` : ''), ...(exercise.secondaryMuscles?.length ? [`in parte: ${exercise.secondaryMuscles.join(', ').toLowerCase()}`] : [])].join(' · ') : undefined,
    progression: exercise.progression,
    technique: exercise.technique,
    loadNote: isFirstTime ? exercise.loadNote : undefined,
    reason: exercise.orderingReason,
    cues: exercise.cues,
  };
  const recentHistory = history.slice(-4);
  // Cards read from a trainer's sheet often carry the sets in the reps ("4x10+10+max", "2x20, 10, 8"): no second count in front.
  const setsLabel = /\d\s*[x×]\s*\d/i.test(exercise.reps) ? exercise.reps.replace(/(\d)\s*x\s*(\d)/gi, '$1×$2') : `${exercise.sets}×${exercise.reps}`;

  return (
    <FlatCard radius={Radius.large} style={[styles.card, completed ? { opacity: 0.72 } : undefined]}>
      <View style={styles.header}>
        <CompletionToggle completed={completed} onToggle={onToggleCompleted} />

        {/* The name takes the free width and wraps onto more lines: the card grows instead of cutting it. */}
        <ThemedText style={[styles.nameText, completed ? { textDecorationLine: 'line-through' } : undefined]}>
          {exercise.name}
        </ThemedText>

        {media ? (
          <Image source={{ uri: media.gifUrl }} style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
        )}

        <Pressable onPress={() => setInfoOpen(true)} hitSlop={8} style={[styles.iconButton, { borderColor: theme.boxEdge }]}>
          <Icon name="info" size={15} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <MetaItem icon="repsHash" value={setsLabel} label="Serie x Rip." />
        {exercise.rir != null ? (
          <>
            <View style={[styles.metaDivider, { backgroundColor: theme.border }]} />
            <MetaItem icon="barChart" value={`RIR ${exercise.rir}`} label="In riserva" />
          </>
        ) : null}
        <View style={[styles.metaDivider, { backgroundColor: theme.border }]} />
        <MetaItem icon="hourglass" value={exercise.tempo} label="Tempo" />
        <View style={[styles.metaDivider, { backgroundColor: theme.border }]} />
        <MetaItem icon="clockOutline" value={restLabel} label="Recupero" />
      </View>

      {deload ? (
        <ThemedText type="caption" themeColor="textSecondary">
          Settimana di scarico: meno serie, più ripetizioni in riserva e carico circa −10%.
        </ThemedText>
      ) : null}
      {exercise.supersetWith || exercise.technique ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {exercise.technique?.label}
        </ThemedText>
      ) : null}

      <View style={styles.loadRow}>
        <View style={styles.loadCol}>
          <ThemedText type="caption" themeColor="textSecondary">
            {isBodyweight ? 'Carico' : deload ? 'Carico di scarico' : calibrating ? 'Da calibrare' : isFirstTime ? 'Stima' : 'Ultimo carico'}
          </ThemedText>
          <ThemedText style={styles.loadValue}>
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
          <ThemedText style={{ color: theme.onAccent, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
            Nuovo carico
          </ThemedText>
        </Pressable>
      </View>

      <ExerciseInfoModal
        visible={infoOpen}
        exerciseName={exercise.name}
        media={media}
        sets={exercise.sets}
        reps={exercise.reps}
        tempo={exercise.tempo}
        restLabel={restLabel}
        programming={programming}
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
 * a small gray label below — centered within its own equal share of the
 * row. A value longer than its share ("4×10+10+max") wraps onto more lines
 * inside it, so the row (and the card) grows instead of overlapping the
 * next item. */
function MetaItem({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.metaItem}>
      <View style={styles.metaItemTopRow}>
        <View style={{ marginTop: 2 }}>
          <Icon name={icon} size={13} color={theme.textSecondary} />
        </View>
        <ThemedText style={styles.metaValue}>{value}</ThemedText>
      </View>
      <ThemedText type="caption" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {label}
      </ThemedText>
    </View>
  );
}

function CompletionToggle({ completed, onToggle }: { completed: boolean; onToggle: () => void }) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(withTiming(0.72, TimingTap), withSpring(1, SpringSnappy));
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
    minHeight: 40,
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
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
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
    alignItems: 'stretch',
    marginTop: 2,
  },
  metaItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
  },
  metaItemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  metaValue: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  metaDivider: {
    width: 1,
    alignSelf: 'center',
    height: 22,
  },
  loadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadCol: {
    flexShrink: 1,
    minWidth: 0,
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
    flexShrink: 0,
    marginLeft: 'auto',
    paddingHorizontal: Spacing.two,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
});
