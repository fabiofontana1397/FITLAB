import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { Layout } from '@/constants/theme';
import { TimingFill } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';

export type PastWorkoutExercise = { id: string; name: string; done: boolean };

export type PastWorkoutCardProps = {
  exercises: PastWorkoutExercise[];
  /** Every exercise ticked. */
  completed: boolean;
  /** Starts the session on the day it was missed (shown only when not completed). */
  onRecover?: () => void;
};

/**
 * A past day's workout at a glance: a big seal (green check = done, red cross =
 * not done), "x / y esercizi" with a progress bar, and each exercise with its
 * own tick or cross. A missed one offers "Recupera".
 */
export function PastWorkoutCard({ exercises, completed, onRecover }: PastWorkoutCardProps) {
  const theme = useTheme();
  const doneCount = exercises.filter((e) => e.done).length;
  const ratio = exercises.length > 0 ? doneCount / exercises.length : 0;
  const color = completed ? theme.brandGreen : theme.danger;

  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(ratio, TimingFill);
  }, [ratio, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <FlatCard radius={20} style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.seal, { backgroundColor: color + '24' }]}>
          <View style={[styles.sealInner, { backgroundColor: color }]}>
            <Icon name={completed ? 'check' : 'close'} size={26} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.headText}>
          <ThemedText style={[styles.status, { color }]} accessibilityRole="header">
            {completed ? 'Allenamento completato' : doneCount > 0 ? 'Completato in parte' : 'Non completato'}
          </ThemedText>
          <ThemedText style={styles.count} themeColor="textSecondary">
            {doneCount} / {exercises.length} esercizi
          </ThemedText>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
      </View>

      {exercises.map((exercise, i) => (
        <View key={exercise.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
          <View style={[styles.dot, exercise.done ? { backgroundColor: theme.brandGreen } : { borderWidth: 1.5, borderColor: theme.textTertiary }]}>
            {exercise.done ? <Icon name="check" size={13} color="#FFFFFF" /> : null}
          </View>
          <ThemedText style={[styles.name, !exercise.done && { opacity: 0.55 }]} numberOfLines={1}>
            {exercise.name}
          </ThemedText>
        </View>
      ))}

      {!completed && onRecover ? (
        <PressableScale
          onPress={onRecover}
          haptic="press"
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel="Recupera questo allenamento"
          style={[styles.recover, { backgroundColor: theme.accentSoft }]}>
          <Icon name="play" size={13} color={theme.accent} />
          <ThemedText style={[styles.recoverLabel, { color: theme.accent }]}>Recupera</ThemedText>
        </PressableScale>
      ) : null}
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Layout.cardPadding,
    gap: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  seal: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  status: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  count: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 40,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  recover: {
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  recoverLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
});
