import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { CountUpText } from '@/components/energy-guide/count-up-text';
import { usePlayValue } from '@/components/energy-guide/use-play-value';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { BAD_DAY_INDEX, WEEKDAY_LETTERS, type WeeklyExample } from '@/lib/energy-guide/weekly-example';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';

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
export function WeekBarsChart({ example, play, compact, highlight, showGoalLine = true, showSides = true }: WeekBarsChartProps) {
  const theme = useTheme();
  const barMax = compact ? 52 : 74;
  const half = barMax + LABEL_ROOM;
  const maxAbs = Math.max(...example.days.map(Math.abs), Math.abs(example.dailyGoalKcal), 1);
  const goalSign = Math.sign(example.dailyGoalKcal);
  const good = theme.balanceGoalScale[2];
  const goalPx = (Math.abs(example.dailyGoalKcal) / maxAbs) * barMax;
  const goalY = goalSign < 0 ? half + goalPx : half - goalPx;

  return (
    <View
      accessible
      accessibilityLabel={`Esempio di settimana: ${example.days.map((d, i) => `${WEEKDAY_LETTERS[i]} ${formatSignedKcal(d)} kcal`).join(', ')}.`}
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
          {example.days.map((kcal, i) => {
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
      <DayLetters highlight={highlight} values={example.days} wrong={example.days.map((d, i) => (Math.sign(d) !== goalSign ? i : -1)).filter((i) => i >= 0)} />
      {showGoalLine ? (
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
 * Page 3: the running total of the week, day after day, against the weekly
 * goal. A wrong day makes the total fall back; the days after it bring it up
 * again, and what counts is where it ends.
 */
export function WeekTotalChart({ example, play, compact }: { example: WeeklyExample; play: boolean; compact: boolean }) {
  const theme = useTheme();
  const barMax = compact ? 76 : 112;
  const goalSign = Math.sign(example.weeklyGoalKcal) || 1;
  // The total is drawn as "how far towards the goal": positive when it is on the goal's side.
  const progress = example.cumulative.map((c) => c * goalSign);
  const goalMag = Math.abs(example.weeklyGoalKcal);
  const maxAbs = Math.max(...progress.map(Math.abs), goalMag, 1);
  const goalPx = (goalMag / maxAbs) * barMax;
  const good = theme.balanceGoalScale[2];
  const last = example.cumulative.length - 1;

  return (
    <View
      accessible
      accessibilityLabel={`Totale della settimana giorno dopo giorno: ${example.cumulative.map((c, i) => `${WEEKDAY_LETTERS[i]} ${formatSignedKcal(c)}`).join(', ')}. Obiettivo ${formatSignedKcal(example.weeklyGoalKcal)} kcal.`}
      style={styles.root}>
      <View style={styles.totalHead}>
        <ThemedText style={styles.totalLabel} themeColor="textSecondary">
          Totale della settimana
        </ThemedText>
        <CountUpText value={example.cumulative[last]} play={play} delay={500} format={formatSignedKcal} suffix=" kcal" style={[styles.totalValue, { color: good }]} />
      </View>
      <View style={{ height: barMax + LABEL_ROOM + 6 }}>
        <DashedLine color={withAlpha(good, 0.9)} top={LABEL_ROOM + 6 + barMax - goalPx - 0.75} />
        <View style={styles.colsRow}>
          {progress.map((p, i) => {
            const isLast = i === last;
            const dip = i > 0 && p < progress[i - 1];
            const color = isLast ? good : dip ? theme.accent : withAlpha(theme.accent, 0.35);
            const px = Math.max(4, (Math.max(p, 0) / maxAbs) * barMax);
            return (
              <View key={i} style={styles.col}>
                <View style={[styles.half, { height: barMax + LABEL_ROOM + 6, justifyContent: 'flex-end' }]}>
                  <Bar px={px} color={color} play={play} delay={i * 70} up />
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <DayLetters highlight={[BAD_DAY_INDEX, last]} values={example.cumulative} wrong={example.cumulative.map((_, i) => (i > 0 && progress[i] < progress[i - 1] ? i : -1)).filter((i) => i >= 0)} />
      <View style={styles.goalRow}>
        <View style={[styles.legendBar, { backgroundColor: good }]} />
        <ThemedText style={styles.legendText} themeColor="textSecondary">
          Obiettivo della settimana: {formatSignedKcal(example.weeklyGoalKcal)} kcal
        </ThemedText>
      </View>
    </View>
  );
}

/** Page 4: the person's own weekly goal, and the three things to remember. */
export function WeekRules({ example, play, compact }: { example: WeeklyExample; play: boolean; compact: boolean }) {
  const theme = useTheme();
  const rules: { icon: IconName; title: string; text: string }[] = [
    { icon: 'target', title: 'Guarda il totale della settimana', text: 'È il numero grande nel box “Questa settimana” della Home.' },
    { icon: 'refresh', title: 'Un giorno storto si recupera', text: `Se un giorno va dalla parte opposta, riequilibra nei giorni dopo, un po’ alla volta e senza saltare i pasti.` },
    { icon: 'check', title: 'Conta dove arrivi', text: 'A fine settimana l’obiettivo è raggiunto se il totale arriva vicino a quello fissato.' },
  ];
  return (
    <View style={styles.root} accessible accessibilityLabel={`Il tuo obiettivo settimanale: ${example.goalWord} di ${formatKcal(example.weeklyGoalKcal)} kcal.`}>
      <View style={[styles.goalCard, { backgroundColor: theme.accentSoft }]}>
        <ThemedText style={[styles.goalEyebrow, { color: theme.accent }]}>Il tuo obiettivo settimanale</ThemedText>
        <CountUpText value={example.weeklyGoalKcal} play={play} format={formatSignedKcal} suffix=" kcal" style={[styles.goalValue, { color: theme.text }, compact && styles.goalValueCompact]} />
        <ThemedText style={styles.goalSub} themeColor="textSecondary">
          {example.goalWord} totale, circa {formatKcal(example.dailyGoalKcal)} kcal al giorno
        </ThemedText>
      </View>
      {rules.map((r) => (
        <View key={r.title} style={styles.ruleRow}>
          <View style={[styles.ruleIcon, { backgroundColor: theme.backgroundElement }]}>
            <Icon name={r.icon} size={18} color={theme.accent} />
          </View>
          <View style={styles.ruleText}>
            <ThemedText style={styles.ruleTitle}>{r.title}</ThemedText>
            {compact ? null : (
              <ThemedText style={styles.ruleBody} themeColor="textSecondary">
                {r.text}
              </ThemedText>
            )}
          </View>
        </View>
      ))}
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
  value: { fontSize: 11, lineHeight: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  lettersBlock: { gap: 0 },
  zeroLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth * 2 },
  dashRow: { position: 'absolute', left: 0, right: 0, height: 1.5, flexDirection: 'row', justifyContent: 'space-between' },
  dash: { width: 4, height: 1.5, borderRadius: 1 },
  side: { position: 'absolute', left: 0, fontSize: 10, lineHeight: 12, fontWeight: '700', letterSpacing: 0.3 },
  lettersRow: { flexDirection: 'row' },
  letter: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  letterOn: { fontWeight: '800' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBar: { width: 14, height: 6, borderRadius: 3 },
  legendText: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  totalHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalLabel: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  totalValue: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalCard: { borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, gap: 2 },
  goalEyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  goalValue: { fontSize: 38, lineHeight: 44, fontWeight: '800', letterSpacing: -1 },
  goalValueCompact: { fontSize: 30, lineHeight: 36 },
  goalSub: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ruleIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ruleText: { flex: 1, gap: 1 },
  ruleTitle: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  ruleBody: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
});
