import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EnergyBars } from '@/components/home/energy-bars';
import { goalBandCopy } from '@/components/home/goal-band-copy';
import { GOAL_RING_ASPECT, GOAL_RING_WIDTH, GoalRing } from '@/components/home/goal-ring';
import { ThemedText } from '@/components/themed-text';
import { balanceCaption, goalBand } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';
import type { DemoDay } from '@/lib/energy-guide/demo-example';
import { explain, type ExplainTone } from '@/lib/energy-guide/explain';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';

export type FitLabChartDemoProps = {
  day: DemoDay;
  play: boolean;
  /** Short screens: the two Home bars are left out (the notes say the same). */
  compact?: boolean;
  /** How many px the page is taller than the room it has (0 when it fits): the ring shrinks by what that takes, so every note stays in view. */
  overflowPx?: number;
};

/** The ring is never drawn smaller than this wide. */
const MIN_RING_WIDTH = 190;

/**
 * Last page: Home's own "Calorie di oggi" card (GoalRing and EnergyBars,
 * unchanged) fed with the example's numbers, plus a running explanation of
 * what the strips, the green zone and the bars are saying right now.
 *
 * Until the page is first shown the ring and bars are empty, so their own
 * entrance — the one they do on Home — starts when it comes into view.
 */
export function FitLabChartDemo({ day, play, compact = false, overflowPx = 0 }: FitLabChartDemoProps) {
  const theme = useTheme();
  // Shrinking is cumulative: the overflow is what is left after the last shrink, so it settles in a pass or two.
  const [available, setAvailable] = useState(0);
  const [cap, setCap] = useState<number | null>(null);
  const [seenOverflow, setSeenOverflow] = useState(0);
  if (overflowPx !== seenOverflow) {
    // Adjusting state while rendering, from a changed prop: the way React asks for it.
    setSeenOverflow(overflowPx);
    if (overflowPx > 1 && available > 0) {
      const drawn = Math.min(cap ?? Infinity, available, GOAL_RING_WIDTH);
      setCap(Math.max(MIN_RING_WIDTH, drawn - overflowPx / GOAL_RING_ASPECT - 1));
    }
  }

  // The same reading Home builds: the balance against the goal, and the gap split into intake and burned.
  const band = useMemo(
    () => goalBand({ reading: day.reading, eatenKcal: day.eatenKcal, burnedKcal: day.burnedKcal, plannedEatenKcal: day.plannedEatenKcal, dayComplete: true }),
    [day]
  );
  const copy = goalBandCopy(band, { hasMeals: true, future: false });
  const { resting, everyday, exercise } = day.energy;
  const basalKcal = resting + everyday;

  return (
    <View style={styles.root}>
      <View
        style={cap != null ? { width: '100%', maxWidth: cap, alignSelf: 'center' } : undefined}
        onLayout={(e) => setAvailable(e.nativeEvent.layout.width)}>
        <GoalRing
          band={band}
          copy={copy}
          inactive={!play}
          value={formatSignedKcal(day.balanceKcal)}
          goalText={`${formatSignedKcal(day.goalKcal)} kcal`}
          accessibilityLabel={`Esempio del grafico di FitLab: bilancio ${formatSignedKcal(day.balanceKcal)} kcal, ${balanceCaption(day.reading)}. Obiettivo ${formatSignedKcal(day.goalKcal)} kcal. Bruciate ${formatKcal(day.burnedKcal)}, assunte ${formatKcal(day.eatenKcal)} kcal.`}
        />
      </View>

      {compact ? null : (
        <EnergyBars
          eatenKcal={day.eatenKcal}
          eatenTargetKcal={day.plannedEatenKcal}
          basalKcal={basalKcal}
          basalDayKcal={basalKcal}
          exerciseKcal={exercise}
          exerciseDayKcal={exercise}
          inactive={!play}
        />
      )}

      <View style={styles.notes}>
        {explain(day)
          .filter((line) => !compact || line.key !== 'bars')
          .map((line) => (
            <View key={line.key} style={styles.note}>
              <View style={[styles.bullet, { backgroundColor: toneColor(line.tone, theme) }]} />
              <ThemedText style={styles.noteText} themeColor="textSecondary">
                {line.text}
              </ThemedText>
            </View>
          ))}
      </View>
    </View>
  );
}

function toneColor(tone: ExplainTone, theme: ReturnType<typeof useTheme>): string {
  switch (tone) {
    case 'burned':
      return theme.brandGreen;
    case 'goal':
      return theme.balanceGoalScale[2];
    case 'surplus':
      return theme.calorieSurplus;
    case 'deficit':
      return theme.calorieDeficit;
    default:
      return theme.text;
  }
}

const styles = StyleSheet.create({
  root: {
    gap: 14,
  },
  notes: {
    gap: 8,
  },
  note: {
    flexDirection: 'row',
    gap: 8,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
