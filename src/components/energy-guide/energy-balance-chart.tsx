import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { CountUpText } from '@/components/energy-guide/count-up-text';
import { usePlayValue } from '@/components/energy-guide/use-play-value';
import { ThemedText } from '@/components/themed-text';
import { OnBrand, Palette } from '@/constants/theme';
import { balancePosition, balanceSide, type BalanceStatus } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';

export type EnergyBalanceChartProps = {
  /** Intake minus expenditure (calorieBalance): negative = deficit. */
  balanceKcal: number;
  /** The scale runs ±this many kcal around equilibrium (balanceHalfRange, as on Home). */
  halfRangeKcal: number;
  /** Within ±this the balance reads "in equilibrio": a reading convention, configurable. */
  toleranceKcal: number;
  play: boolean;
};

const KNOB = 26;

/** −1 surplus, 0 equilibrium, +1 deficit: the same left/right sides as Home's semi-ring. */
const ZONE_INDEX: Record<Exclude<BalanceStatus, 'missing'>, number> = { surplus: -1, even: 0, deficit: 1 };
export const ZONE_LABEL: Record<Exclude<BalanceStatus, 'missing'>, string> = { surplus: 'Surplus', even: 'Equilibrio', deficit: 'Deficit' };

/**
 * Page 3: the balance on a horizontal scale with three zones. Laid out like
 * the semi-ring above Home's gauge, unrolled: surplus on the left, deficit
 * on the right, equilibrium in the middle. The marker, its colour, the label
 * and the number all move together; the colour fades between zones instead
 * of switching.
 */
export function EnergyBalanceChart({ balanceKcal, halfRangeKcal, toleranceKcal, play }: EnergyBalanceChartProps) {
  const theme = useTheme();
  const side = balanceSide(balanceKcal, toleranceKcal);
  const { position, clamped } = balancePosition(balanceKcal, halfRangeKcal);
  const evenHalfWidth = Math.min(toleranceKcal / halfRangeKcal, 1) / 2;

  const at = usePlayValue(0.5 + position / 2, play, 120);
  const tone = usePlayValue(ZONE_INDEX[side], play, 120);
  const surplusColor = theme.calorieSurplus;
  const evenColor = Palette.neutral[500];
  const deficitColor = theme.calorieDeficit;

  const markerStyle = useAnimatedStyle(() => ({ left: `${at.value * 100}%` }));
  const dotStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tone.value, [-1, 0, 1], [surplusColor, evenColor, deficitColor]),
  }));
  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tone.value, [-1, 0, 1], [surplusColor, evenColor, deficitColor]),
  }));

  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={`Esempio: bilancio ${formatSignedKcal(balanceKcal)} kcal, zona ${ZONE_LABEL[side].toLowerCase()}. Equilibrio entro ±${formatKcal(toleranceKcal)} kcal.`}>
      <View style={styles.readout}>
        <Animated.View style={[styles.pill, pillStyle]}>
          <ThemedText style={styles.pillText}>{ZONE_LABEL[side]}</ThemedText>
        </Animated.View>
        <CountUpText value={balanceKcal} play={play} delay={120} format={formatSignedKcal} suffix=" kcal" style={styles.value} />
      </View>

      <View style={styles.scale}>
        <View style={styles.track}>
          <View style={[styles.zone, { flex: 0.5 - evenHalfWidth, backgroundColor: theme.balanceSurplusScale[0] }]} />
          <View style={[styles.zone, { flex: evenHalfWidth * 2, backgroundColor: theme.backgroundElement }]} />
          <View style={[styles.zone, { flex: 0.5 - evenHalfWidth, backgroundColor: theme.balanceDeficitScale[0] }]} />
        </View>
        <View testID="energy-balance-zero" style={[styles.zeroTick, { backgroundColor: theme.textTertiary }]} />
        <Animated.View testID="energy-balance-marker" style={[styles.marker, markerStyle]}>
          <View style={styles.knobShadow} />
          <View style={styles.knob}>
            <Animated.View style={[styles.knobDot, dotStyle]} />
          </View>
        </Animated.View>
      </View>

      <View style={styles.labels}>
        <View style={styles.labelCol}>
          <ThemedText style={[styles.zoneLabel, { color: surplusColor }]}>Surplus</ThemedText>
          <ThemedText style={styles.zoneSub} themeColor="textTertiary">
            assunte {'>'} consumate
          </ThemedText>
        </View>
        <View style={[styles.labelCol, { alignItems: 'center' }]}>
          <ThemedText style={styles.zoneLabel} themeColor="textSecondary">
            Equilibrio
          </ThemedText>
          <ThemedText style={styles.zoneSub} themeColor="textTertiary">
            ±{formatKcal(toleranceKcal)} kcal
          </ThemedText>
        </View>
        <View style={[styles.labelCol, { alignItems: 'flex-end' }]}>
          <ThemedText style={[styles.zoneLabel, { color: deficitColor }]}>Deficit</ThemedText>
          <ThemedText style={styles.zoneSub} themeColor="textTertiary">
            consumate {'>'} assunte
          </ThemedText>
        </View>
      </View>

      <View style={styles.ends}>
        <ThemedText style={styles.endText} themeColor="textTertiary">
          {formatSignedKcal(halfRangeKcal)}
        </ThemedText>
        <ThemedText style={styles.endText} themeColor="textTertiary">
          0
        </ThemedText>
        <ThemedText style={styles.endText} themeColor="textTertiary">
          {formatSignedKcal(-halfRangeKcal)}
        </ThemedText>
      </View>
      {clamped ? (
        <ThemedText style={styles.note} themeColor="textTertiary">
          Il valore è oltre la fine della scala: il marker resta sul bordo, il numero mostra il valore reale.
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: {
    color: OnBrand.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  value: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  scale: {
    height: KNOB + 6,
    justifyContent: 'center',
    marginHorizontal: KNOB / 2,
  },
  track: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  zone: {
    height: '100%',
  },
  zeroTick: {
    position: 'absolute',
    left: '50%',
    width: 2,
    height: 20,
    marginLeft: -1,
    borderRadius: 1,
  },
  marker: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    marginLeft: -KNOB / 2,
  },
  knobShadow: {
    ...StyleSheet.absoluteFill,
    top: 1,
    borderRadius: KNOB / 2,
    backgroundColor: Palette.neutral[950],
    opacity: 0.18,
  },
  knob: {
    ...StyleSheet.absoluteFill,
    borderRadius: KNOB / 2,
    backgroundColor: OnBrand.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobDot: {
    width: KNOB * 0.45,
    height: KNOB * 0.45,
    borderRadius: KNOB * 0.225,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelCol: {
    flex: 1,
    gap: 1,
  },
  zoneLabel: {
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  zoneSub: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
  ends: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 2,
  },
  endText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
});
