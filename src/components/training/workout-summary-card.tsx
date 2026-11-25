import { Pressable, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { BodyMapGlyph, hasMappedMuscles } from '@/components/training/focus-glyph';
import { SwipeToStart } from '@/components/training/swipe-to-start';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { OnBrand } from '@/constants/theme';
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

/** A thin line barbell with no tile behind it, used on the detail page header: black on light, white on dark. */
export function WorkoutBadge({ size = 60 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { width: size, height: size }]}>
      <Icon name="barbellLine" size={size * 0.7} strokeWidth={1.5} color={theme.text} />
    </View>
  );
}

export type WorkoutSummaryCardProps = {
  title: string;
  minutes: number;
  kcal: number;
  /** Opens the session detail (the text and the chevron). */
  onOpen: () => void;
  /** Starts the session (the "Scorri per iniziare" slider at the bottom): only today's session has one. */
  onStart?: () => void;
  /** Moves this session to today and today's here (the switch button on the days ahead). */
  onSwap?: () => void;
  /** A past day: 'done' gets a small quiet tick, 'missed' only a Recupera button. No coloured frame, no tag. */
  status?: 'done' | 'missed';
  /** Starts the session on the day it was missed ("Recupera"). */
  onRecover?: () => void;
  /** A session was started and left with the X: "Riprendi" reopens it where it stopped. */
  resume?: { elapsedLabel: string; onResume: () => void };
  /** Exercises done out of the session's, shown as a bar while the session is under way. */
  progress?: { done: number; total: number };
  /** The session's muscle groups (engine keys): drawn as a small front/back body map on the left. */
  muscleGroups?: (string | undefined)[];
};

/** A day's session: its name and its duration + estimated kcal. The whole box opens the session's sheet; today's session also has the
 * "Scorri per iniziare" slider at the bottom, which starts it. */
export function WorkoutSummaryCard({ title, minutes, kcal, onOpen, onStart, onSwap, status, onRecover, resume, progress, muscleGroups }: WorkoutSummaryCardProps) {
  const theme = useTheme();
  const missed = status === 'missed';
  const finished = status === 'done';
  const showBody = muscleGroups != null && hasMappedMuscles(muscleGroups);
  return (
    <FlatCard
      radius={20}
      style={[styles.card, resume && { borderWidth: 1, borderColor: theme.accent }]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Dettagli: ${title}`} style={StyleSheet.absoluteFill} />
      <View style={styles.row} pointerEvents="box-none">
        {/* The muscles this session trains, lit on a tiny front/back figure. */}
        {showBody ? (
          <View style={[styles.body, { backgroundColor: theme.backgroundElement }]} pointerEvents="none">
            <BodyMapGlyph groups={muscleGroups} height={48} line={theme.textSecondary} accent={theme.accent} />
          </View>
        ) : null}

        <View style={styles.open} pointerEvents="none">
          <View style={styles.textCol}>
            <ThemedText style={styles.title} numberOfLines={1}>
              {title}
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
          {onSwap || finished ? null : <Icon name="chevronRight" size={18} color={theme.textTertiary} />}
        </View>
        {onSwap ? (
          <PressableScale onPress={onSwap} haptic="press" accessibilityRole="button" accessibilityLabel={`Anticipa a oggi: ${title}`}>
            <View style={[styles.play, styles.swap, styles.trailingDisc, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="swap" size={20} color={theme.text} />
            </View>
          </PressableScale>
        ) : finished ? (
          // Done: a green disc with a white tick. No frame, no label.
          <View accessibilityLabel="Fatto" style={[styles.play, styles.swap, styles.doneDisc, { backgroundColor: theme.brandGreen }]}>
            <Icon name="check" size={17} strokeWidth={2.6} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      {onStart && !resume ? (
        <SwipeToStart onStart={onStart} accessibilityLabel={`Inizia allenamento: ${title}`} testID="workout-swipe-start" />
      ) : null}
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
          style={[styles.recover, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="play" size={13} color={theme.text} />
          <ThemedText style={[styles.recoverLabel, { color: theme.text }]}>Recupera</ThemedText>
        </PressableScale>
      ) : null}
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
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
  doneDisc: { width: 30, height: 30, borderRadius: 15 },
  trailingDisc: { width: 44, height: 44, borderRadius: 22 },
  body: { width: 64, height: 64, borderRadius: 18, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
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
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statsRow: {
    marginTop: 6,
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
