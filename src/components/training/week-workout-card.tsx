import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WorkoutBadge } from '@/components/training/workout-summary-card';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

export type WeekWorkoutStatus = 'done' | 'missed' | 'planned';

const STATUS_LABEL: Record<WeekWorkoutStatus, string> = { done: 'Completato', missed: 'Non completato', planned: 'In programma' };

export type WeekWorkoutCardProps = {
  /** "Lunedì 19" — the day this session belongs to. */
  dayLabel: string;
  title: string;
  minutes: number;
  kcal: number;
  status: WeekWorkoutStatus;
  /** Opens the session detail. Omit for a day that has none (a run): the box is then not a button. */
  onOpen?: () => void;
};

/** One box per session of the current week, below the selected day's card:
 * the day, the session's name, its length and kcal, and where it stands. */
export function WeekWorkoutCard({ dayLabel, title, minutes, kcal, status, onOpen }: WeekWorkoutCardProps) {
  const theme = useTheme();
  const statusColor = status === 'done' ? theme.brandGreen : status === 'missed' ? theme.textTertiary : theme.accent;
  const content = (
    <>
      <View style={styles.header}>
        <ThemedText style={[styles.day, { color: theme.accent }]} numberOfLines={1}>
          {dayLabel}
        </ThemedText>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '1F' }]}>
          <ThemedText style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
            {STATUS_LABEL[status]}
          </ThemedText>
        </View>
      </View>
      <View style={styles.main}>
        <WorkoutBadge size={52} />
        <View style={styles.textCol}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Icon name="clock" size={14} color={theme.textTertiary} />
              <ThemedText style={styles.statText}>{minutes} min</ThemedText>
            </View>
            <View style={styles.stat}>
              <Icon name="flame" size={14} color={theme.accent} />
              <ThemedText style={styles.statText}>{kcal} kcal</ThemedText>
            </View>
          </View>
        </View>
        {onOpen ? <Icon name="chevronRight" size={16} color={theme.textTertiary} /> : null}
      </View>
    </>
  );

  return (
    <FlatCard radius={20} style={styles.card}>
      {onOpen ? (
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${dayLabel}: ${title}`} style={styles.row}>
          {content}
        </Pressable>
      ) : (
        <View style={styles.row}>{content}</View>
      )}
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
  },
  row: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  day: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  statsRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
});
