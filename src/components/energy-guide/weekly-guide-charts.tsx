import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { CountUpText } from '@/components/energy-guide/count-up-text';
import { usePlayValue } from '@/components/energy-guide/use-play-value';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { WEEKDAY_LETTERS, type WeeklyExample } from '@/lib/energy-guide/weekly-example';
import { formatSignedKcal } from '@/lib/format-kcal';

const DASH_COUNT = 34;
const LABEL_ROOM = 6;

function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

/** A horizontal dashed line (a row of short dashes: dashed borders draw differently on each platform). */
function DashedLine({ color, top }: { color: string; top: number }) {
  return (
    <View pointerEvents="none" style={[styles.dashRow, { top }]}>
      {Array.from({ length: DASH_COUNT }, (_, i) => (
        <View key={i} style={[styles.dash, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

/** The day letters, and under them each day's figure (the wrong day's in orange). */
function DayLetters({ highlight, values, wrong }: { highlight?: number[]; values: number[]; wrong?: number[] }) {
  const theme = useTheme();
  return (
    <View style={styles.lettersBlock}>
      <View style={styles.lettersRow}>
        {WEEKDAY_LETTERS.map((letter, i) => (
          <View key={i} style={styles.col}>
            <ThemedText style={[styles.letter, { color: highlight?.includes(i) ? theme.text : theme.textTertiary }, highlight?.includes(i) && styles.letterOn]}>{letter}</ThemedText>
          </View>
        ))}
      </View>
      <View style={styles.lettersRow}>
        {values.map((v, i) => (
          <View key={i} style={styles.col}>
            <ThemedText style={[styles.value, { color: wrong?.includes(i) ? theme.accent : theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatSignedKcal(v)}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function Bar({ px, color, play, delay, up }: { px: number; color: string; play: boolean; delay: number; up: boolean }) {
  const h = usePlayValue(px, play, delay);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.bar, up ? styles.barUp : styles.barDown, { backgroundColor: color }, style]} />;
}

export type WeekBarsChartProps = {
  example: WeeklyExample;
  /** The balance of each of the seven days (kcal): the calm week or the rough one. */
  days: number[];
  play: boolean;
  compact: boolean;
  /** Days drawn at full strength; the others fade back. */
  highlight?: number[];
  /** Draw the daily goal as a dashed line. */
  showGoalLine?: boolean;
  /** Name the two sides of the zero line ("Surplus" above, "Deficit" below). */
  showSides?: boolean;
};

/**
 * Pages 1 and 2: the week, one column per day, around a zero line — surplus
 * above it, deficit below — with the day's goal as a dashed line. A day on the
 * goal's side is green, a day that went the other way is orange.
 */
export function WeekBarsChart({ example, days, play, compact, highlight, showGoalLine = true, showSides = true }: WeekBarsChartProps) {
  const theme = useTheme();
  const barMax = compact ? 34 : 74;
  const half = barMax + LABEL_ROOM;
  // A little headroom, so the tallest bar (and the goal line) stay clear of the 'Surplus' / 'Deficit' captions.
  const maxAbs = Math.max(...days.map(Math.abs), Math.abs(example.dailyGoalKcal), 1) * 1.3;
  const goalSign = Math.sign(example.dailyGoalKcal);
  const good = theme.balanceGoalScale[2];
  const goalPx = (Math.abs(example.dailyGoalKcal) / maxAbs) * barMax;
  const goalY = goalSign < 0 ? half + goalPx : half - goalPx;

  return (
    <View
      accessible
      accessibilityLabel={`Esempio di settimana: ${days.map((d, i) => `${WEEKDAY_LETTERS[i]} ${formatSignedKcal(d)} kcal`).join(', ')}.`}
      style={styles.root}>
      <View style={{ height: half * 2 }}>
        {showSides ? (
          <>
            <ThemedText style={[styles.side, { top: 0, color: theme.textTertiary }]}>Surplus ↑</ThemedText>
            <ThemedText style={[styles.side, { bottom: 0, color: theme.textTertiary }]}>Deficit ↓</ThemedText>
          </>
        ) : null}
        <View pointerEvents="none" style={[styles.zeroLine, { top: half, backgroundColor: theme.border }]} />
        {showGoalLine ? <DashedLine color={withAlpha(good, 0.9)} top={goalY - 0.75} /> : null}
        <View style={styles.colsRow}>
          {days.map((kcal, i) => {
            const up = kcal > 0;
            const wrongSide = Math.sign(kcal) !== goalSign;
            const color = wrongSide ? theme.accent : good;
            const dim = highlight != null && !highlight.includes(i);
            const px = Math.max(4, (Math.abs(kcal) / maxAbs) * barMax);
            return (
              <View key={i} style={[styles.col, dim && styles.dim]}>
                <View style={[styles.half, { height: half, justifyContent: 'flex-end' }]}>
                  {up ? <Bar px={px} color={color} play={play} delay={i * 60} up /> : null}
                </View>
                <View style={[styles.half, { height: half, justifyContent: 'flex-start' }]}>
                  {!up ? <Bar px={px} color={color} play={play} delay={i * 60} up={false} /> : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <DayLetters highlight={highlight} values={days} wrong={days.map((d, i) => (Math.sign(d) !== goalSign ? i : -1)).filter((i) => i >= 0)} />
      {showGoalLine && !compact ? (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: good }]} />
            <ThemedText style={styles.legendText} themeColor="textSecondary">
              nella direzione dell’obiettivo
            </ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: theme.accent }]} />
            <ThemedText style={styles.legendText} themeColor="textSecondary">
              dalla parte opposta
            </ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The week's total against its goal: the seven days added up, as a bar that
 * fills to the goal. This is the number that counts — a day far off the mark
 * is only a part of it.
 */
export function WeekTotalBar({ days, goalKcal, play, compact = false }: { days: number[]; goalKcal: number; play: boolean; compact?: boolean }) {
  const theme = useTheme();
  const total = days.reduce((a, b) => a + b, 0);
  const good = theme.balanceGoalScale[2];
  const fraction = goalKcal !== 0 ? Math.min(Math.max(total / goalKcal, 0), 1) : 0;
  const fill = usePlayValue(fraction, play, 500);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const reached = Math.abs(total - goalKcal) < 1;
  return (
    <View style={[styles.totalBox, { backgroundColor: withAlpha(good, 0.12) }]} accessible accessibilityLabel={`Totale della settimana ${formatSignedKcal(total)} kcal, obiettivo ${formatSignedKcal(goalKcal)} kcal.`}>
      <View style={styles.totalHead}>
        <ThemedText style={styles.totalLabel} themeColor="textSecondary">
          {compact ? `Totale (obiettivo ${formatSignedKcal(goalKcal)})` : 'Totale della settimana'}
        </ThemedText>
        <View style={styles.totalValueRow}>
          <CountUpText value={total} play={play} delay={500} format={formatSignedKcal} suffix=" kcal" style={[styles.totalValue, { color: good }]} />
          {reached ? (
            <View style={[styles.totalCheck, { backgroundColor: good }]}>
              <Icon name="check" size={12} color="#FFFFFF" />
            </View>
          ) : null}
        </View>
      </View>
      <View style={[styles.totalTrack, { backgroundColor: withAlpha(good, 0.2) }]}>
        <Animated.View style={[styles.totalFill, { backgroundColor: good }, fillStyle]} />
      </View>
      {compact ? null : (
        <ThemedText style={styles.totalGoal} themeColor="textSecondary">
          Obiettivo: {formatSignedKcal(goalKcal)} kcal
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  colsRow: { flexDirection: 'row' },
  col: { flex: 1, alignItems: 'center' },
  half: { width: '100%', alignItems: 'center' },
  dim: { opacity: 0.3 },
  bar: { width: '62%', maxWidth: 30 },
  barUp: { borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  barDown: { borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  value: { fontSize: 12, lineHeight: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  lettersBlock: { gap: 0 },
  totalBox: { borderRadius: 16, padding: 12, gap: 8 },
  totalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  totalValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  totalValue: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  totalCheck: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  totalTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  totalFill: { height: '100%', borderRadius: 5 },
  totalGoal: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  zeroLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth * 2 },
  dashRow: { position: 'absolute', left: 0, right: 0, height: 1.5, flexDirection: 'row', justifyContent: 'space-between' },
  dash: { width: 4, height: 1.5, borderRadius: 1 },
  side: { position: 'absolute', left: 0, fontSize: 11, lineHeight: 12, fontWeight: '700', letterSpacing: 0.3 },
  lettersRow: { flexDirection: 'row' },
  letter: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  letterOn: { fontWeight: '800' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBar: { width: 14, height: 6, borderRadius: 3 },
  legendText: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
});
