import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import type { PlanPhaseKind } from '@/lib/planning/types';

/** Perceived difficulty of a plan month, from its phase. */
export function difficultyLabel(phase: PlanPhaseKind | undefined): 'Bassa' | 'Media' | 'Alta' {
  if (phase === 'consolidamento') return 'Alta';
  if (phase === 'progressione') return 'Media';
  return 'Bassa';
}

/** The rounded orange-tinted square with a dumbbell, used on the session
 * card and on the detail page header. */
export function WorkoutBadge({ size = 60 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: theme.accent }]}>
      <Icon name="barbell" size={size / 2} color="#FFFFFF" />
    </View>
  );
}

export type WorkoutSummaryCardProps = {
  title: string;
  difficulty: string;
  minutes: number;
  kcal: number;
  onPress: () => void;
};

/** "Allenamento di oggi" card from the Figma Training screen: badge, session
 * name, difficulty, duration + estimated kcal, chevron to the detail page. */
export function WorkoutSummaryCard({ title, difficulty, minutes, kcal, onPress }: WorkoutSummaryCardProps) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      <FlatCard radius={20} style={styles.card}>
        <WorkoutBadge />
        <View style={styles.textCol}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          <ThemedText style={styles.difficulty} themeColor="textTertiary">
            Difficoltà {difficulty}
          </ThemedText>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Icon name="clock" size={15} color={theme.textTertiary} />
              <ThemedText style={styles.statText} themeColor="textSecondary">
                {minutes} min
              </ThemedText>
            </View>
            <View style={styles.stat}>
              <Icon name="flame" size={15} color={theme.accent} />
              <ThemedText style={styles.statText} themeColor="textSecondary">
                {kcal} kcal
              </ThemedText>
            </View>
          </View>
        </View>
        <Icon name="chevronRight" size={18} color={theme.textTertiary} />
      </FlatCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 10,
    paddingVertical: 12,
    paddingRight: 16,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  difficulty: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
  statsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 14,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
});
