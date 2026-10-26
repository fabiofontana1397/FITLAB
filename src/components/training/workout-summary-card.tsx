import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { Brand, OnBrand } from '@/constants/theme';
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

/** The rounded orange square with a dumbbell, used on the detail page header. */
export function WorkoutBadge({ size = 60 }: { size?: number }) {
  return (
    <LinearGradient
      colors={Brand.badgeGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.badge, { width: size, height: size, borderRadius: size * 0.22 }]}>
      <Icon name="barbell" size={size / 2} color={OnBrand.text} />
    </LinearGradient>
  );
}

/** The orange rounded square that starts the session: the box's leading image,
 * a play glyph where the dumbbell used to be. 56 pt, comfortably over the
 * HIG's 44 pt touch target. */
const PLAY_SIZE = 56;

export type WorkoutSummaryCardProps = {
  title: string;
  subtitle: string;
  minutes: number;
  kcal: number;
  /** Opens the session detail (the text and the chevron). */
  onOpen: () => void;
  /** Starts the session (the play button). */
  onStart: () => void;
};

/** A day's session: the play button that starts it, its name, "Forza - Livello base"
 * and its duration + estimated kcal; the rest of the box opens the detail. */
export function WorkoutSummaryCard({ title, subtitle, minutes, kcal, onOpen, onStart }: WorkoutSummaryCardProps) {
  const theme = useTheme();
  return (
    <FlatCard radius={20} style={styles.card}>
      <View style={styles.row}>
        <PressableScale onPress={onStart} haptic="press" accessibilityRole="button" accessibilityLabel={`Inizia allenamento: ${title}`}>
          <LinearGradient
            colors={Brand.badgeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.play, { width: PLAY_SIZE, height: PLAY_SIZE, borderRadius: PLAY_SIZE * 0.26 }]}>
            <Icon name="play" size={24} color={OnBrand.text} />
          </LinearGradient>
        </PressableScale>

        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Dettagli: ${title}`} style={styles.open}>
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
      </View>
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    alignItems: 'center',
    justifyContent: 'center',
    // The triangle's weight sits to its left: nudge it so it reads as centred.
    paddingLeft: 3,
  },
  open: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    fontSize: 12,
    lineHeight: 16,
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
    lineHeight: 16,
    fontWeight: '500',
  },
});
