import { StyleSheet, View } from 'react-native';

import { FlatCard } from '@/components/ui/flat-card';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The standard muscle groups a given split label trains — a fixed,
 * universally-true convention (not per-user data, which the plan doesn't
 * track), matching the real `SplitLabel`s the generator produces
 * (training-planner.ts's VALID_SPLIT_LABELS). */
const SPLIT_MUSCLE_GROUPS: Record<string, string> = {
  Push: 'Petto · Spalle · Tricipiti',
  Pull: 'Schiena · Bicipiti',
  Legs: 'Quadricipiti · Femorali · Glutei',
  Upper: 'Petto · Schiena · Spalle · Braccia',
  Lower: 'Quadricipiti · Femorali · Glutei · Polpacci',
  'Full Body': 'Corpo intero',
};

export type SplitSummaryCardProps = {
  icon: IconName;
  title: string;
  durationMinutes: number;
  completedCount: number;
  totalCount: number;
};

/** The "Allenamento di oggi" split-overview card: icon + split title +
 * standard muscle-group caption on the left, estimated duration and
 * exercise count in the middle, and a completion ring on the right. */
export function SplitSummaryCard({ icon, title, durationMinutes, completedCount, totalCount }: SplitSummaryCardProps) {
  const theme = useTheme();
  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const durationLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <FlatCard tint={theme.accentSoft} radius={Radius.large} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.leftCol}>
          <View style={[styles.icon, { backgroundColor: theme.backgroundElevated }]}>
            <Icon name={icon} size={22} color={theme.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText type="subtitle" numberOfLines={1}>
              {title}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
              {SPLIT_MUSCLE_GROUPS[title] ?? 'Allenamento'}
            </ThemedText>
          </View>
        </View>

        <ProgressRing size={48} strokeWidth={5} progress={progress} color={theme.accent} trackColor={theme.backgroundElevated}>
          <ThemedText type="caption" style={{ fontWeight: '800', color: theme.accent }}>
            {Math.round(progress * 100)}%
          </ThemedText>
        </ProgressRing>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Icon name="clockOutline" size={16} color={theme.textSecondary} />
          <ThemedText type="caption" themeColor="textSecondary">
            Durata stimata
          </ThemedText>
          <ThemedText type="smallBold">{durationLabel}</ThemedText>
        </View>

        <View style={styles.statCol}>
          <Icon name="crossedArrows" size={16} color={theme.textSecondary} />
          <ThemedText type="caption" themeColor="textSecondary">
            Esercizi
          </ThemedText>
          <ThemedText type="smallBold">
            {completedCount}/{totalCount}
          </ThemedText>
        </View>
      </View>
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
    minWidth: 0,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCol: {
    alignItems: 'center',
    gap: 2,
  },
});
