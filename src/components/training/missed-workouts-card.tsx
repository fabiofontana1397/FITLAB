import { Pressable, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type MissedWorkout = {
  date: string;
  title: string;
  minutes: number;
  kcal: number;
};

export type MissedWorkoutsCardProps = {
  workouts: MissedWorkout[];
  /** Starts the session for that missed day. */
  onRecover: (date: string) => void;
  /** Opens the session's sheet. */
  onOpen: (date: string) => void;
};

/** "Sab 24", short and capitalised. */
function dayLabel(date: string): string {
  const label = new Date(date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * "Da recuperare": the planned workouts of the last days that were not done,
 * newest first, each with a "Recupera" button that starts the session on the
 * day it was missed — finishing it marks that day done. A missed workout used
 * to be reachable only by finding its day in the week; this puts it in front
 * of the user, quietly, so today's workout stays the main thing on the page.
 * Renders nothing when there is nothing to catch up on.
 */
export function MissedWorkoutsCard({ workouts, onRecover, onOpen }: MissedWorkoutsCardProps) {
  const theme = useTheme();
  if (workouts.length === 0) return null;

  return (
    <FlatCard radius={20} style={styles.card}>
      <View style={styles.head}>
        <Icon name="refresh" size={15} color={theme.accent} />
        <ThemedText style={[styles.headLabel, { color: theme.accent }]} accessibilityRole="header">
          Da recuperare
        </ThemedText>
      </View>

      {workouts.map((workout, i) => (
        <View key={workout.date} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
          <Pressable
            onPress={() => onOpen(workout.date)}
            accessibilityRole="button"
            accessibilityLabel={`Dettagli: ${workout.title}, ${dayLabel(workout.date)}`}
            style={({ pressed }) => [styles.open, pressed && styles.pressed]}>
            <View style={styles.dayCol}>
              <ThemedText style={styles.day} themeColor="textSecondary">
                {dayLabel(workout.date)}
              </ThemedText>
            </View>
            <View style={styles.textCol}>
              <ThemedText style={styles.title} numberOfLines={1}>
                {workout.title}
              </ThemedText>
              <ThemedText style={styles.meta} themeColor="textSecondary">
                {workout.minutes} min · {workout.kcal} kcal
              </ThemedText>
            </View>
          </Pressable>

          <PressableScale
            onPress={() => onRecover(workout.date)}
            haptic="press"
            scaleTo={0.95}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`Recupera ${workout.title} di ${dayLabel(workout.date)}`}
            style={[styles.recover, { backgroundColor: theme.accentSoft }]}>
            <Icon name="play" size={13} color={theme.accent} />
            <ThemedText style={[styles.recoverLabel, { color: theme.accent }]}>Recupera</ThemedText>
          </PressableScale>
        </View>
      ))}
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Layout.cardPadding,
    paddingTop: 12,
    paddingBottom: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
  },
  headLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  open: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  dayCol: {
    width: 52,
  },
  day: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  recover: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  recoverLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
});
