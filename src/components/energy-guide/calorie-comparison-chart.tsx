import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { CountUpText } from '@/components/energy-guide/count-up-text';
import { usePlayValue } from '@/components/energy-guide/use-play-value';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { calorieBalance } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';

export type CalorieComparisonChartProps = {
  eatenKcal: number;
  burnedKcal: number;
  /** True once the page has been shown: the bars grow then, not on mount. */
  play: boolean;
};

/**
 * Page 1: intake against expenditure, as two bars on one shared scale — the
 * same two quantities, colours and icons as the two arcs of Home's gauge
 * (burned orange with the flame, intake green with the plate).
 */
export function CalorieComparisonChart({ eatenKcal, burnedKcal, play }: CalorieComparisonChartProps) {
  const theme = useTheme();
  // Both bars are read against the larger of the two, so their lengths compare directly.
  const scaleMax = Math.max(eatenKcal, burnedKcal, 1) * 1.08;
  const balance = calorieBalance(eatenKcal, burnedKcal);

  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={`Esempio: calorie assunte ${formatKcal(eatenKcal)}, calorie consumate ${formatKcal(burnedKcal)}. Differenza ${formatSignedKcal(balance)} kcal.`}>
      <BarRow icon="utensils" label="Assunte" sub="cibi e bevande" color={theme.brandGreen} kcal={eatenKcal} share={eatenKcal / scaleMax} play={play} delay={0} />
      <BarRow icon="flame" label="Consumate" sub="tutta la giornata" color={theme.accent} kcal={burnedKcal} share={burnedKcal / scaleMax} play={play} delay={140} />
      <View style={[styles.diffRow, { borderTopColor: theme.border }]}>
        <ThemedText style={styles.diffLabel} themeColor="textSecondary">
          Assunte − consumate
        </ThemedText>
        <CountUpText value={balance} play={play} delay={260} format={formatSignedKcal} suffix=" kcal" style={styles.diffValue} />
      </View>
    </View>
  );
}

function BarRow({
  icon,
  label,
  sub,
  color,
  kcal,
  share,
  play,
  delay,
}: {
  icon: IconName;
  label: string;
  sub: string;
  color: string;
  kcal: number;
  share: number;
  play: boolean;
  delay: number;
}) {
  const theme = useTheme();
  const width = usePlayValue(Math.min(Math.max(share, 0), 1), play, delay);
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Icon name={icon} size={20} color={color} />
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.label}>{label}</ThemedText>
          <ThemedText style={styles.sub} themeColor="textTertiary">
            {sub}
          </ThemedText>
        </View>
        <CountUpText value={kcal} play={play} delay={delay} suffix=" kcal" style={[styles.value, { color }]} />
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 18,
  },
  row: {
    gap: 8,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  sub: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
  value: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  track: {
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 7,
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  diffLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  diffValue: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
});
