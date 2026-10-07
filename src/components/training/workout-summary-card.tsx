import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

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

/** The same difficulty, worded as a training level. */
export function levelLabel(phase: PlanPhaseKind | undefined): string {
  const d = difficultyLabel(phase);
  return d === 'Alta' ? 'Livello avanzato' : d === 'Media' ? 'Livello intermedio' : 'Livello base';
}

/** The rounded orange square with a dumbbell, used on the session card and
 * on the detail page header. */
export function WorkoutBadge({ size = 60 }: { size?: number }) {
  return (
    <LinearGradient
      colors={['#FF8F2A', '#FF6A13']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.badge, { width: size, height: size, borderRadius: size * 0.22 }]}>
      <Icon name="barbell" size={size / 2} color="#FFFFFF" />
    </LinearGradient>
  );
}

export type WorkoutSummaryCardProps = {
  title: string;
  subtitle: string;
  minutes: number;
  kcal: number;
  /** Opens the session detail (the chevron and the card). */
  onOpen: () => void;
  /** The green "Inizia allenamento" button. */
  onStart: () => void;
};

/** "Allenamento di oggi": session thumbnail, name, "Forza - Livello base",
 * duration + estimated kcal, and a full-width green start button. */
export function WorkoutSummaryCard({ title, subtitle, minutes, kcal, onOpen, onStart }: WorkoutSummaryCardProps) {
  const theme = useTheme();
  return (
    <FlatCard radius={20} style={styles.card}>
      <Pressable onPress={onOpen} style={styles.top}>
        <WorkoutBadge size={82} />
        <View style={styles.textCol}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          <ThemedText style={styles.subtitle} themeColor="textTertiary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Icon name="clock" size={15} color={theme.textTertiary} />
              <ThemedText style={styles.statText}>{minutes} min</ThemedText>
            </View>
            <View style={styles.stat}>
              <Icon name="flame" size={15} color={theme.accent} />
              <ThemedText style={styles.statText}>{kcal} kcal</ThemedText>
            </View>
          </View>
        </View>
        <Icon name="chevronRight" size={18} color={theme.textTertiary} />
      </Pressable>

      <Pressable
        onPress={onStart}
        style={[
          styles.startButton,
          { backgroundColor: theme.brandGreen },
          Platform.select({
            web: { boxShadow: '0px 6px 14px rgba(34,179,94,0.28)' },
            default: { shadowColor: '#22B35E', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
          }),
        ]}>
        <View style={styles.playCircle}>
          <Icon name="play" size={14} color={theme.brandGreen} />
        </View>
        <ThemedText style={styles.startLabel}>Inizia allenamento</ThemedText>
        <Icon name="chevronRight" size={16} color="#FFFFFF" />
      </Pressable>
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    gap: 12,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  statsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 14,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  startButton: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  startLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
});
