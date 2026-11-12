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

/** The button that starts the session: an orange play triangle in an orange ring,
 * with no fill. 56 pt, comfortably over the HIG's 44 pt touch target. */
const PLAY_SIZE = 56;

export type WorkoutSummaryCardProps = {
  title: string;
  subtitle: string;
  minutes: number;
  kcal: number;
  /** Opens the session detail (the text and the chevron). */
  onOpen: () => void;
  /** Starts the session (the play button): only today's session has one. */
  onStart?: () => void;
  /** Moves this session to today and today's here (the switch button on the days ahead). */
  onSwap?: () => void;
  /** A past day: 'done' gets a green tick, 'missed' is highlighted in red. */
  status?: 'done' | 'missed';
  /** Starts the session on the day it was missed ("Recupera"). */
  onRecover?: () => void;
  /** A session was started and left with the X: "Riprendi" reopens it where it stopped. */
  resume?: { elapsedLabel: string; onResume: () => void };
  /** Exercises done out of the session's, shown as a bar while the session is under way. */
  progress?: { done: number; total: number };
};

/** A day's session: the play button that starts it, its name, "Forza - Livello base"
 * and its duration + estimated kcal. The whole box opens the session's sheet,
 * except the play button, which starts it. */
export function WorkoutSummaryCard({ title, subtitle, minutes, kcal, onOpen, onStart, onSwap, status, onRecover, resume, progress }: WorkoutSummaryCardProps) {
  const theme = useTheme();
  const missed = status === 'missed';
  const finished = status === 'done';
  return (
    <FlatCard
      radius={20}
      style={[
        styles.card,
        missed && { borderWidth: 1.5, borderColor: theme.danger, backgroundColor: theme.danger + '14' },
        finished && { borderWidth: 1.5, borderColor: theme.brandGreen, backgroundColor: theme.brandGreen + '12' },
        resume && { borderWidth: 1.5, borderColor: theme.accent, backgroundColor: theme.accentSoft },
      ]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Dettagli: ${title}`} style={StyleSheet.absoluteFill} />
      <View style={styles.row} pointerEvents="box-none">
        {onStart ? (
          <PressableScale onPress={onStart} haptic="press" accessibilityRole="button" accessibilityLabel={`Inizia allenamento: ${title}`}>
            <View style={[styles.play, { width: PLAY_SIZE, height: PLAY_SIZE, borderRadius: PLAY_SIZE / 2, borderColor: theme.accent }]}>
              <Icon name="play" size={24} color={theme.accent} />
            </View>
          </PressableScale>
        ) : onSwap ? (
          <PressableScale onPress={onSwap} haptic="press" accessibilityRole="button" accessibilityLabel={`Anticipa a oggi: ${title}`}>
            <View style={[styles.play, styles.swap, { width: PLAY_SIZE, height: PLAY_SIZE, borderRadius: PLAY_SIZE / 2, backgroundColor: theme.accentSoft }]}>
              <Icon name="swap" size={26} color={theme.accent} />
            </View>
          </PressableScale>
        ) : status ? (
          <View
            accessibilityLabel={missed ? 'Non completato' : 'Completato'}
            style={[styles.play, styles.swap, { width: PLAY_SIZE, height: PLAY_SIZE, borderRadius: PLAY_SIZE / 2, backgroundColor: missed ? theme.danger : theme.brandGreen }]}>
            <Icon name={missed ? 'close' : 'check'} size={28} color="#FFFFFF" />
          </View>
        ) : null}

        <View style={styles.open} pointerEvents="none">
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
            {progress && progress.total > 0 && (resume || progress.done > 0) && !finished ? (
              <View style={styles.progressRow}>
                <View style={[styles.progressTrack, { backgroundColor: theme.backgroundElement }]}>
                  <View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${Math.min(progress.done / progress.total, 1) * 100}%` }]} />
                </View>
                <ThemedText style={styles.statText} themeColor="textSecondary">
                  {progress.done}/{progress.total} esercizi
                </ThemedText>
              </View>
            ) : null}
          </View>
          <Icon name="chevronRight" size={18} color={theme.textTertiary} />
        </View>
      </View>
      {resume ? (
        <PressableScale
          onPress={resume.onResume}
          haptic="press"
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={`Riprendi ${title}, ${resume.elapsedLabel} di allenamento`}
          style={[styles.recover, { backgroundColor: theme.accent }]}>
          <Icon name="play" size={13} color={OnBrand.text} />
          <ThemedText style={[styles.recoverLabel, { color: OnBrand.text }]}>Riprendi · {resume.elapsedLabel}</ThemedText>
        </PressableScale>
      ) : null}
      {missed && onRecover ? (
        <PressableScale
          onPress={onRecover}
          haptic="press"
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={`Recupera ${title}`}
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
    borderWidth: 2,
    // The triangle's weight sits to its left: nudge it so it reads as centred.
    paddingLeft: 3,
  },
  // The switch button is a soft orange disc, no ring, and centred as is.
  swap: { borderWidth: 0, paddingLeft: 0 },
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
    lineHeight: 22,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 17,
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
  recover: {
    marginTop: 12,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  recoverLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  progressRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  statText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
});
