import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, Polygon, Text as SvgText, TextPath } from 'react-native-svg';

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

/** The goal marker: a triangle outside the semi-ring, its tip on the track pointing at the ring's centre. */
const GOAL_TIP_R = SEMI_R + SEMI_STROKE / 2 + 1.5;
const GOAL_TRI_H = 8;
const GOAL_TRI_HALF_W = 4.6;
/** Where the "obiettivo" label hangs: just past the triangle's base. */
const GOAL_LABEL_R = GOAL_TIP_R + GOAL_TRI_H + 7;
/** "Surplus" / "Deficit" continue the semi-ring's curve just past its two ends (outside the marker knob), on this baseline radius. */
const END_LABEL_R = SEMI_R + 11;
const END_LABEL_FROM_DEG = 96;
const END_LABEL_SPAN_DEG = 40;
/** Room above the semi-ring for the goal label. */
const TOP_PAD = 30;
/** The junction knob on the main ring: white disc with two opposite arrows. */
const KNOB_R = 11;
const CY = TOP_PAD + SEMI_R + SEMI_STROKE / 2;
const BASE_H = CY + MAIN_R * Math.cos(((180 - MAIN_HALF_SPAN) * Math.PI) / 180) + KNOB_R + 4;

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

/**
 * The knob's two arrows as one path, drawn around (cx, cy) and turned to lie
 * along the ring's tangent at `deg` (never upside down). Plain maths, so it
 * runs inside the animation worklet with the knob.
 */
function arrowsPath(cx: number, cy: number, deg: number): string {
  'worklet';
  const turn = deg > 90 ? deg - 180 : deg < -90 ? deg + 180 : deg;
  const a = (turn * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const pt = (x: number, y: number) => `${(cx + x * cos - y * sin).toFixed(2)} ${(cy + x * sin + y * cos).toFixed(2)}`;
  return [
    `M ${pt(-4.6, -2.7)} L ${pt(4.6, -2.7)} M ${pt(2.4, -4.9)} L ${pt(4.6, -2.7)} L ${pt(2.4, -0.5)}`,
    `M ${pt(4.6, 2.7)} L ${pt(-4.6, 2.7)} M ${pt(-2.4, 0.5)} L ${pt(-4.6, 2.7)} L ${pt(-2.4, 4.9)}`,
  ].join(' ');
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
  // The goal triangle, from the same arc geometry: tip on the track, base further out along the radius.
  const goalBase = { x: px(GOAL_TIP_R + GOAL_TRI_H, goalDeg), y: py(GOAL_TIP_R + GOAL_TRI_H, goalDeg) };
  const goalRad = (goalDeg * Math.PI) / 180;
  const goalTriangle = [
    `${px(GOAL_TIP_R, goalDeg)},${py(GOAL_TIP_R, goalDeg)}`,
    `${goalBase.x - Math.cos(goalRad) * GOAL_TRI_HALF_W},${goalBase.y - Math.sin(goalRad) * GOAL_TRI_HALF_W}`,
    `${goalBase.x + Math.cos(goalRad) * GOAL_TRI_HALF_W},${goalBase.y + Math.sin(goalRad) * GOAL_TRI_HALF_W}`,
  ].join(' ');

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

  const junctionArrows = useAnimatedProps(() => ({ d: arrowsPath(px(MAIN_R, junction.value), py(MAIN_R, junction.value), junction.value) }));
  const semiKnob = SEMI_STROKE / 2 + 3.5;
  // The equilibrium notch is dropped when the goal notch would sit on top of it (a maintenance goal).
  const showZeroNotch = Math.abs(goalDeg) > 5;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const label = (fontSize: number) => ({ fontSize: Math.max(11, fontSize * k), lineHeight: Math.max(14, (fontSize + 3) * k) });

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={{ width: BASE_W * k, height: BASE_H * k, marginBottom: 0 }}>
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
          <Polygon points={goalTriangle} fill={theme.text} stroke={theme.text} strokeWidth={1.2} strokeLinejoin="round" />

          {/* "Surplus" and "Deficit" run along the semi-ring, each ending near its end of the arc. */}
          <Defs>
            <Path id="oggi-surplus" d={arc(END_LABEL_R, -END_LABEL_FROM_DEG - END_LABEL_SPAN_DEG, -END_LABEL_FROM_DEG)} />
            <Path id="oggi-deficit" d={arc(END_LABEL_R, END_LABEL_FROM_DEG, END_LABEL_FROM_DEG + END_LABEL_SPAN_DEG)} />
          </Defs>
          <SvgText fill={theme.textTertiary} fontSize={11} fontWeight="600" letterSpacing={0.2} textAnchor="end">
            <TextPath href="#oggi-surplus" startOffset="100%">
              Surplus
            </TextPath>
          </SvgText>
          <SvgText fill={theme.textTertiary} fontSize={11} fontWeight="600" letterSpacing={0.2}>
            <TextPath href="#oggi-deficit" startOffset="0">
              Deficit
            </TextPath>
          </SvgText>

          {/* Main ring: burned from the left end, intake from the right, meeting at the junction. */}
          <AnimatedPath animatedProps={burnedArc} stroke={empty ? theme.backgroundElement : burnedColor} strokeWidth={MAIN_STROKE} strokeLinecap="round" fill="none" />
          <AnimatedPath animatedProps={eatenArc} stroke={empty ? theme.backgroundElement : eatenColor} strokeWidth={MAIN_STROKE} strokeLinecap="round" fill="none" />

          {/* The two markers: one knob design, one colour — the same balance at two scales. */}
          {empty ? null : (
            <>
              <AnimatedCircle animatedProps={junctionShadow} r={KNOB_R + 0.8} fill={Palette.neutral[950]} opacity={0.14} />
              <AnimatedCircle animatedProps={junctionAt} r={KNOB_R} fill={OnBrand.text} stroke={Palette.neutral[950]} strokeOpacity={0.1} strokeWidth={0.75} />
              <AnimatedPath animatedProps={junctionArrows} stroke={Palette.neutral[800]} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
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

        {/* Anchored past the triangle's base and grown away from the ring, so it
            never sits on the track or on the marker when the day is on target. */}
        <ThemedText
          themeColor="textSecondary"
          style={[
            styles.goalText,
            label(11),
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
          <ThemedText style={[styles.unit, { fontSize: 12 * k, lineHeight: 16 * k }]}>kcal</ThemedText>
          <ThemedText style={[styles.caption, { fontSize: 12 * k, lineHeight: 16 * k, color: missing ? theme.textTertiary : theme.textSecondary }]}>{caption}</ThemedText>
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
