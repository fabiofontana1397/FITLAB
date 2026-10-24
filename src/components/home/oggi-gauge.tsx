import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { balanceTone } from '@/components/home/balance-tone';
import { ThemedText } from '@/components/themed-text';
import { TimingFill } from '@/constants/motion';
import { OnBrand, Palette } from '@/constants/theme';
import { balancePosition, type BalanceReading } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Geometry ──────────────────────────────────────────────────────────────
// Drawn in a fixed 260-wide coordinate space and scaled to the card, so the
// two rings stay concentric and in proportion on every iPhone width.
// Angles are degrees clockwise from 12 o'clock — so on both rings the right
// side is a deficit, the left a surplus, and the top is equilibrium.
const BASE_W = 260;
const CX = BASE_W / 2;

/** Main ring: intake vs burned, open at the bottom like the original gauge. */
const MAIN_R = 72;
const MAIN_STROKE = 13;
const BOTTOM_GAP_DEG = 84;
const MAIN_HALF_SPAN = 180 - BOTTOM_GAP_DEG / 2; // ±138°
const MIN_SWEEP_DEG = 10;

/** Semi-ring: the balance against the goal, hugging the top of the main ring. */
const SEMI_STROKE = 6;
const RING_GAP = 9;
const SEMI_R = MAIN_R + MAIN_STROKE / 2 + RING_GAP + SEMI_STROKE / 2;
const SEMI_HALF_SPAN = 90;

/** Where the "obiettivo" label hangs: just past the goal notch's outer end. */
const GOAL_LABEL_R = SEMI_R + SEMI_STROKE / 2 + 8;
/** Room above the semi-ring for that label. */
const TOP_PAD = 20;
const CY = TOP_PAD + SEMI_R + SEMI_STROKE / 2;
const BASE_H = CY + MAIN_R * Math.cos(((180 - MAIN_HALF_SPAN) * Math.PI) / 180) + MAIN_STROKE / 2 + 4;

function px(r: number, deg: number) {
  'worklet';
  return CX + r * Math.sin((deg * Math.PI) / 180);
}
function py(r: number, deg: number) {
  'worklet';
  return CY - r * Math.cos((deg * Math.PI) / 180);
}

/** An arc between two angles, drawn clockwise whichever order they come in. */
function arc(r: number, fromDeg: number, toDeg: number): string {
  'worklet';
  const a = Math.min(fromDeg, toDeg);
  const b = Math.max(fromDeg, toDeg);
  const large = b - a > 180 ? 1 : 0;
  return `M ${px(r, a)} ${py(r, a)} A ${r} ${r} 0 ${large} 1 ${px(r, b)} ${py(r, b)}`;
}

/** Where intake meets burned on the main ring: each arc is sized by its share of the two together. */
function junctionDeg(burnedKcal: number, eatenKcal: number): number {
  const total = burnedKcal + eatenKcal;
  const span = MAIN_HALF_SPAN * 2;
  const burnedSweep = total > 0 ? span * (burnedKcal / total) : span / 2;
  return -MAIN_HALF_SPAN + Math.min(Math.max(burnedSweep, MIN_SWEEP_DEG), span - MIN_SWEEP_DEG);
}

export type OggiGaugeProps = {
  burnedKcal: number;
  eatenKcal: number;
  burnedColor: string;
  eatenColor: string;
  /** The day's balance read against its goal (domain/calorie-balance.ts). */
  reading: BalanceReading;
  /** The balance as displayed in the centre, already formatted. */
  value: string;
  caption: string;
};

/**
 * "Calorie di oggi": two coordinated indicators read from one balance.
 *
 * 1. The main ring compares burned (orange, growing clockwise from the left
 *    end) with intake (green, from the right end), each arc proportional to
 *    its share of the two. Where they meet is the day's balance: at the top
 *    when they are equal, right of it in a deficit, left in a surplus.
 * 2. The semi-ring above reads that same balance against the goal, on a
 *    symmetric kcal range: equilibrium at the top, deficit to the right,
 *    surplus to the left, with a notch where the goal sits.
 *
 * Both markers are the same knob in the same colour (balanceTone), sitting on
 * the same side of the top, so they read as one value at two scales — the
 * main ring's coarse split, and the semi-ring's reading against the goal.
 */
export function OggiGauge({ burnedKcal, eatenKcal, burnedColor, eatenColor, reading, value, caption }: OggiGaugeProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(BASE_W);
  const k = Math.min(1.15, width / BASE_W);

  const empty = burnedKcal + eatenKcal <= 0;
  const missing = reading.status === 'missing';
  const tone = balanceTone(reading, theme);

  const targetJunction = junctionDeg(burnedKcal, eatenKcal);
  const { position } = balancePosition(reading.balanceKcal, reading.halfRangeKcal);
  const targetSemi = missing ? 0 : position * SEMI_HALF_SPAN;
  const goalDeg = balancePosition(reading.goalKcal, reading.halfRangeKcal).position * SEMI_HALF_SPAN;

  // Both markers glide to new values together; under Reduce Motion
  // Reanimated jumps straight to the end value on its own.
  const junction = useSharedValue(0);
  const semi = useSharedValue(0);
  useEffect(() => {
    junction.value = withTiming(targetJunction, TimingFill);
    semi.value = withTiming(targetSemi, TimingFill);
  }, [targetJunction, targetSemi, junction, semi]);

  const burnedArc = useAnimatedProps(() => ({ d: arc(MAIN_R, -MAIN_HALF_SPAN, junction.value) }));
  const eatenArc = useAnimatedProps(() => ({ d: arc(MAIN_R, junction.value, MAIN_HALF_SPAN) }));
  const semiFill = useAnimatedProps(() => ({
    d: arc(SEMI_R, 0, semi.value),
    strokeOpacity: Math.abs(semi.value) < 1 ? 0 : 1,
  }));
  const junctionShadow = useAnimatedProps(() => ({ cx: px(MAIN_R, junction.value), cy: py(MAIN_R, junction.value) + 0.9 }));
  const junctionAt = useAnimatedProps(() => ({ cx: px(MAIN_R, junction.value), cy: py(MAIN_R, junction.value) }));
  const semiShadow = useAnimatedProps(() => ({ cx: px(SEMI_R, semi.value), cy: py(SEMI_R, semi.value) + 0.9 }));
  const semiAt = useAnimatedProps(() => ({ cx: px(SEMI_R, semi.value), cy: py(SEMI_R, semi.value) }));

  const junctionKnob = MAIN_STROKE / 2 + 1.5;
  const semiKnob = SEMI_STROKE / 2 + 3.5;
  // The equilibrium notch is dropped when the goal notch would sit on top of it (a maintenance goal).
  const showZeroNotch = Math.abs(goalDeg) > 5;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const label = (fontSize: number) => ({ fontSize: Math.max(8.5, fontSize * k), lineHeight: Math.max(11, (fontSize + 3) * k) });

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={{ width: BASE_W * k, height: BASE_H * k, marginBottom: -22 * k }}>
        <Svg width={BASE_W * k} height={BASE_H * k} viewBox={`0 0 ${BASE_W} ${BASE_H}`} style={StyleSheet.absoluteFill}>
          {/* Semi-ring: track, the balance's fill from equilibrium, notches. */}
          <Path d={arc(SEMI_R, -SEMI_HALF_SPAN, SEMI_HALF_SPAN)} stroke={theme.backgroundElement} strokeWidth={SEMI_STROKE} strokeLinecap="round" fill="none" />
          {missing ? null : <AnimatedPath animatedProps={semiFill} stroke={tone} strokeWidth={SEMI_STROKE} strokeLinecap="round" fill="none" />}
          {showZeroNotch ? (
            <Line
              x1={px(SEMI_R - SEMI_STROKE / 2 - 2, 0)}
              y1={py(SEMI_R - SEMI_STROKE / 2 - 2, 0)}
              x2={px(SEMI_R + SEMI_STROKE / 2 + 2, 0)}
              y2={py(SEMI_R + SEMI_STROKE / 2 + 2, 0)}
              stroke={theme.textTertiary}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          ) : null}
          <Line
            x1={px(SEMI_R - SEMI_STROKE / 2 - 2, goalDeg)}
            y1={py(SEMI_R - SEMI_STROKE / 2 - 2, goalDeg)}
            x2={px(SEMI_R + SEMI_STROKE / 2 + 5, goalDeg)}
            y2={py(SEMI_R + SEMI_STROKE / 2 + 5, goalDeg)}
            stroke={theme.text}
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Main ring: burned from the left end, intake from the right, meeting at the junction. */}
          <AnimatedPath animatedProps={burnedArc} stroke={empty ? theme.backgroundElement : burnedColor} strokeWidth={MAIN_STROKE} strokeLinecap="round" fill="none" />
          <AnimatedPath animatedProps={eatenArc} stroke={empty ? theme.backgroundElement : eatenColor} strokeWidth={MAIN_STROKE} strokeLinecap="round" fill="none" />

          {/* The two markers: one knob design, one colour — the same balance at two scales. */}
          {empty ? null : (
            <>
              <AnimatedCircle animatedProps={junctionShadow} r={junctionKnob + 0.5} fill={Palette.neutral[950]} opacity={0.18} />
              <AnimatedCircle animatedProps={junctionAt} r={junctionKnob} fill={OnBrand.text} />
              <AnimatedCircle animatedProps={junctionAt} r={junctionKnob * 0.45} fill={tone} />
            </>
          )}
          {missing ? null : (
            <>
              <AnimatedCircle animatedProps={semiShadow} r={semiKnob + 0.5} fill={Palette.neutral[950]} opacity={0.18} />
              <AnimatedCircle animatedProps={semiAt} r={semiKnob} fill={OnBrand.text} />
              <AnimatedCircle animatedProps={semiAt} r={semiKnob * 0.45} fill={tone} />
            </>
          )}
        </Svg>

        {/* Short, quiet labels for the semi-ring: its two directions and the goal. */}
        <ThemedText
          themeColor="textTertiary"
          style={[styles.end, label(9.5), { right: (CX + 80) * k, top: (CY + 7) * k, textAlign: 'right' }]}>
          Surplus
        </ThemedText>
        <ThemedText themeColor="textTertiary" style={[styles.end, label(9.5), { left: (CX + 80) * k, top: (CY + 7) * k }]}>
          Deficit
        </ThemedText>
        {/* Anchored on the notch's outer end and grown away from the ring, so it
            never sits on the track or on the marker when the day is on target. */}
        <ThemedText
          themeColor="textSecondary"
          style={[
            styles.goalText,
            label(9),
            { top: (py(GOAL_LABEL_R, goalDeg) - 14) * k },
            goalDeg > 8
              ? { left: px(GOAL_LABEL_R, goalDeg) * k }
              : goalDeg < -8
                ? { right: (BASE_W - px(GOAL_LABEL_R, goalDeg)) * k, textAlign: 'right' }
                : { left: 0, right: 0, textAlign: 'center' },
          ]}>
          obiettivo
        </ThemedText>

        {/* The number: the balance itself, inside the main ring. */}
        <View pointerEvents="none" style={[styles.centre, { top: (CY - 38) * k, height: 76 * k }]}>
          <ThemedText style={[styles.value, { fontSize: 28 * k, lineHeight: 32 * k }]}>{value}</ThemedText>
          <ThemedText style={[styles.unit, { fontSize: 11 * k, lineHeight: 14 * k }]}>kcal</ThemedText>
          <ThemedText style={[styles.caption, { fontSize: 10 * k, lineHeight: 13 * k, color: missing ? theme.textTertiary : theme.textSecondary }]}>{caption}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  end: {
    position: 'absolute',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  goalText: {
    position: 'absolute',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  centre: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unit: {
    fontWeight: '500',
  },
  caption: {
    fontWeight: '600',
  },
});
