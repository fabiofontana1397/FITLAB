import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { OnBrand, Palette } from '@/constants/theme';
import { BALANCE_SCALE, balancePosition, type BalanceReading } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Geometry ──────────────────────────────────────────────────────────────
// Drawn in a fixed 260-wide coordinate space and scaled to the card, so the
// two rings stay concentric and in proportion on every iPhone width.
// Angles are degrees clockwise from 12 o'clock — so on both rings the right
// side is a deficit, the left a surplus, and the top is equilibrium.
const BASE_W = 330;
const CX = BASE_W / 2;

/** Main ring: intake vs burned, open at the bottom like the original gauge. */
const MAIN_R = 72;
const MAIN_STROKE = 16;
const BOTTOM_GAP_DEG = 84;
const MAIN_HALF_SPAN = 180 - BOTTOM_GAP_DEG / 2; // ±138°
const MIN_SWEEP_DEG = 10;

/** Semi-ring: the balance against the goal, around the main ring and spanning exactly the same angles (it starts and ends where the main ring does). */
const SEMI_STROKE = 6;
const RING_GAP = 9;
const SEMI_R = MAIN_R + MAIN_STROKE / 2 + RING_GAP + SEMI_STROKE / 2;
const SEMI_HALF_SPAN = MAIN_HALF_SPAN;

/** The balance marker: a bead on the track plus a triangle outside it, its tip on the bead pointing at the ring's centre. */
const BEAD_R = 6;
const MARKER_TIP_R = SEMI_R + BEAD_R + 2;
const MARKER_TRI_H = 11;
const MARKER_TRI_HALF_W = 6.5;
/** Where the "Equilibrio" label hangs: just past the triangle's base, at the top. */
const ZERO_LABEL_R = MARKER_TIP_R + MARKER_TRI_H + 6;
/** Room above the semi-ring for that label. */
const TOP_PAD = 42;
/** The Deficit / Surplus labels sit just outside the semi-ring's two ends, past the marker's path. */
const END_LABEL_R = MARKER_TIP_R + MARKER_TRI_H + 5;
const END_LABEL_W = 52;
/** The junction knob fills the ring's thickness, leaving a hair of the stroke around it. */
const KNOB_R = MAIN_STROKE / 2 - 0.5;
/** Every visit to Home replays the fill like an odometer: fast at first, settling on the value. */
const ODOMETER_MS = 1100;
const ODOMETER_BEZIER = Easing.bezier(0.16, 1, 0.3, 1);
const odometerEase = ODOMETER_BEZIER.factory();
/** One beat of the marker's halo. */
const HALO_MS = 1300;
/** The semi-ring track, by distance from the goal (as a share of the half range, past the goal's core): green on target, soft green while acceptable, soft red beyond it, red when far off. */
const GOAL_ZONE_STEP_DEG = 2;
const GOAL_ZONE_MIN_CORE_DEG = 3;
const GOAL_ZONE_MAX_CORE_DEG = 6;
const ZONE_SOFT_GREEN_AT = 0.22;
const ZONE_SOFT_RED_AT = 0.5;
const ZONE_RED_AT = 0.8;
const CY = TOP_PAD + SEMI_R + SEMI_STROKE / 2;
const END_COS = -Math.cos((SEMI_HALF_SPAN * Math.PI) / 180);
const BASE_H = CY + Math.max(MAIN_R * END_COS + MAIN_STROKE / 2 + 4, (SEMI_R + SEMI_STROKE / 2) * END_COS + 4, END_LABEL_R * END_COS + 12);

/** Height over width of the drawn gauge, for sizing it to the room there is. */
export const GAUGE_ASPECT = BASE_H / BASE_W;
/** The widest the gauge is drawn (its scale stops growing there). */
export const GAUGE_MAX_WIDTH = BASE_W * 1.15;

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
  const sc = KNOB_R / 11;
  const pt = (x: number, y: number) => `${(cx + (x * cos - y * sin) * sc).toFixed(2)} ${(cy + (x * sin + y * cos) * sc).toFixed(2)}`;
  return [
    `M ${pt(-4.6, -2.7)} L ${pt(4.6, -2.7)} M ${pt(2.4, -4.9)} L ${pt(4.6, -2.7)} L ${pt(2.4, -0.5)}`,
    `M ${pt(4.6, 2.7)} L ${pt(-4.6, 2.7)} M ${pt(-2.4, 0.5)} L ${pt(-4.6, 2.7)} L ${pt(-2.4, 4.9)}`,
  ].join(' ');
}

type Rgb = [number, number, number];

/** `#rrggbb`, or `rgba()` laid over `under` (the card surface is translucent). */
function rgbOf(color: string, under?: Rgb | null): Rgb | null {
  const hex = /^#([0-9a-f]{6})/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/.exec(color);
  if (!rgba) return null;
  const top: Rgb = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
  const alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
  return alpha >= 1 || !under ? top : mixRgb(under, top, alpha);
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** The marker triangle at `deg` on the semi-ring, as one path (runs inside the animation worklet). */
function markerPath(deg: number): string {
  'worklet';
  const rad = (deg * Math.PI) / 180;
  const bx = px(MARKER_TIP_R + MARKER_TRI_H, deg);
  const by = py(MARKER_TIP_R + MARKER_TRI_H, deg);
  const dx = Math.cos(rad) * MARKER_TRI_HALF_W;
  const dy = Math.sin(rad) * MARKER_TRI_HALF_W;
  return `M ${px(MARKER_TIP_R, deg)} ${py(MARKER_TIP_R, deg)} L ${bx - dx} ${by - dy} L ${bx + dx} ${by + dy} Z`;
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
  /** The daily goal under it, already formatted ("/-300 kcal"). */
  goalLabel: string;
  /** What the balance is, in grey under the goal ("deficit", "surplus", "equilibrio"). */
  caption: string;
  /** Within this many kcal of the goal counts as "on it" (the full-green core of the goal zone). */
  toleranceKcal?: number;
  /** A day with nothing to show (not yet started): the whole gauge stays plain grey, goal zone included. */
  inactive?: boolean;
};

/**
 * "Calorie di oggi": two coordinated indicators read from one balance.
 *
 * 1. The main ring compares burned (orange, growing clockwise from the left
 *    end) with intake (green, from the right end), each arc proportional to
 *    its share of the two. Where they meet (the round knob) is the day's
 *    balance: at the top when they are equal, right of it in a deficit, left
 *    in a surplus.
 * 2. The semi-ring around it, over the same angles, reads that same balance on
 *    a symmetric kcal range: equilibrium at the top, deficit to the right,
 *    surplus to the left. The bead and triangle are the balance; the track
 *    runs green on the goal, soft green while acceptable, then red.
 */
export function OggiGauge({ burnedKcal, eatenKcal, burnedColor, eatenColor, reading, value, goalLabel, caption, toleranceKcal = BALANCE_SCALE.toleranceKcal, inactive = false }: OggiGaugeProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(BASE_W);
  const k = Math.min(1.15, width / BASE_W);

  const empty = burnedKcal + eatenKcal <= 0;
  const missing = reading.status === 'missing';

  const targetJunction = junctionDeg(burnedKcal, eatenKcal);
  const { position } = balancePosition(reading.balanceKcal, reading.halfRangeKcal);
  const targetSemi = missing ? 0 : position * SEMI_HALF_SPAN;
  const goalDeg = balancePosition(reading.goalKcal, reading.halfRangeKcal).position * SEMI_HALF_SPAN;
  // Each time Home comes into view the rings refill from empty, like an
  // odometer: `sweep` (0..1) grows the burned arc from the ring's bottom-left
  // end and the intake arc from its bottom-right end until they meet at the
  // knob, while the marker glides out from equilibrium. State is reset when
  // Home loses focus so the next visit starts from zero. Under Reduce Motion
  // everything is simply there.
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const [sweep, setSweep] = useState(0);
  useEffect(() => {
    if (!focused) {
      setSweep(0);
      return;
    }
    if (reduceMotion) {
      setSweep(1);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / ODOMETER_MS);
      setSweep(odometerEase(t));
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [focused, reduceMotion]);
  const junction = targetJunction;
  // Where each arc's leading edge has got to on its way to the junction.
  const burnedTo = -MAIN_HALF_SPAN + sweep * (junction + MAIN_HALF_SPAN);
  const eatenFrom = MAIN_HALF_SPAN - sweep * (MAIN_HALF_SPAN - junction);

  const semi = useSharedValue(0);
  useEffect(() => {
    if (!focused) {
      semi.value = 0;
      return;
    }
    semi.value = reduceMotion ? targetSemi : withTiming(targetSemi, { duration: ODOMETER_MS, easing: ODOMETER_BEZIER });
  }, [focused, reduceMotion, targetSemi, semi]);

  const marker = useAnimatedProps(() => ({ d: markerPath(semi.value) }));

  // A halo breathing around the marker's bead keeps it in view.
  const halo = useSharedValue(0);
  useEffect(() => {
    if (!focused || reduceMotion) {
      halo.value = 0;
      return;
    }
    halo.value = withRepeat(withTiming(1, { duration: HALO_MS, easing: Easing.out(Easing.quad) }), -1, false);
  }, [focused, reduceMotion, halo]);
  const bead = useAnimatedProps(() => ({ cx: px(SEMI_R, semi.value), cy: py(SEMI_R, semi.value) }));
  const haloProps = useAnimatedProps(() => ({
    cx: px(SEMI_R, semi.value),
    cy: py(SEMI_R, semi.value),
    r: BEAD_R + halo.value * 9,
    opacity: 0.45 * (1 - halo.value),
  }));

  // The semi-ring's track, in short pieces: green on the goal, soft green while acceptable, soft red beyond it, red when far off.
  const goalZone = useMemo(() => {
    const surface = rgbOf(theme.backgroundElevated, rgbOf(theme.background));
    const track = rgbOf(theme.backgroundElement, surface);
    const green = rgbOf(theme.balanceGoalScale[2]);
    const softGreen = green && surface ? mixRgb(green, surface, 0.45) : null;
    const red = rgbOf(theme.danger);
    const softRed = red && surface ? mixRgb(red, surface, 0.4) : null;
    const count = Math.ceil((SEMI_HALF_SPAN * 2) / GOAL_ZONE_STEP_DEG);
    const core = Math.min(GOAL_ZONE_MAX_CORE_DEG, Math.max(GOAL_ZONE_MIN_CORE_DEG, ((toleranceKcal / reading.halfRangeKcal) * SEMI_HALF_SPAN) * 0.5));
    const smooth = (t: number) => t * t * (3 - 2 * t);
    return Array.from({ length: count }, (_, i) => {
      const from = -SEMI_HALF_SPAN + i * GOAL_ZONE_STEP_DEG;
      const to = Math.min(SEMI_HALF_SPAN, from + GOAL_ZONE_STEP_DEG + 0.3);
      const f = Math.max(0, Math.abs((from + to) / 2 - goalDeg) - core) / SEMI_HALF_SPAN;
      let c: Rgb | null;
      if (inactive || !green || !softGreen || !red || !softRed) c = track;
      else if (f <= 0) c = green;
      else if (f < ZONE_SOFT_GREEN_AT) c = mixRgb(green, softGreen, smooth(f / ZONE_SOFT_GREEN_AT));
      else if (f < ZONE_SOFT_RED_AT) c = mixRgb(softGreen, softRed, smooth((f - ZONE_SOFT_GREEN_AT) / (ZONE_SOFT_RED_AT - ZONE_SOFT_GREEN_AT)));
      else if (f < ZONE_RED_AT) c = mixRgb(softRed, red, smooth((f - ZONE_SOFT_RED_AT) / (ZONE_RED_AT - ZONE_SOFT_RED_AT)));
      else c = red;
      return { d: arc(SEMI_R, from, to), color: c ? `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})` : theme.backgroundElement };
    });
  }, [theme.background, theme.backgroundElevated, theme.backgroundElement, theme.balanceGoalScale, theme.danger, goalDeg, toleranceKcal, reading.halfRangeKcal, inactive]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const label = (fontSize: number) => ({ fontSize: Math.max(11, fontSize * k), lineHeight: Math.max(14, (fontSize + 3) * k) });

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={{ width: BASE_W * k, height: BASE_H * k, marginBottom: 0 }}>
        <Svg width={BASE_W * k} height={BASE_H * k} viewBox={`0 0 ${BASE_W} ${BASE_H}`} style={StyleSheet.absoluteFill}>
          {/* Semi-ring: the track with its goal zone, and the equilibrium notch. */}
          {goalZone.map((seg, i) => (
            <Path key={i} d={seg.d} stroke={seg.color} strokeWidth={SEMI_STROKE} strokeLinecap={i === 0 || i === goalZone.length - 1 ? 'round' : 'butt'} fill="none" />
          ))}
          <Line
            x1={px(SEMI_R - SEMI_STROKE / 2 - 2, 0)}
            y1={py(SEMI_R - SEMI_STROKE / 2 - 2, 0)}
            x2={px(SEMI_R + SEMI_STROKE / 2 + 2, 0)}
            y2={py(SEMI_R + SEMI_STROKE / 2 + 2, 0)}
            stroke={theme.textTertiary}
            strokeWidth={1.5}
            strokeLinecap="round"
          />

          {/* Main ring: its track, then burned growing from the bottom-left end and intake from the bottom-right end, in solid colour, until they meet at the junction. */}
          <Path d={arc(MAIN_R, -MAIN_HALF_SPAN, MAIN_HALF_SPAN)} stroke={theme.backgroundElement} strokeWidth={MAIN_STROKE} strokeLinecap="round" fill="none" />
          {empty ? null : (
            <>
              {burnedTo > -MAIN_HALF_SPAN + 0.05 ? <Path d={arc(MAIN_R, -MAIN_HALF_SPAN, burnedTo)} stroke={burnedColor} strokeWidth={MAIN_STROKE} strokeLinecap="round" fill="none" /> : null}
              {eatenFrom < MAIN_HALF_SPAN - 0.05 ? <Path d={arc(MAIN_R, eatenFrom, MAIN_HALF_SPAN)} stroke={eatenColor} strokeWidth={MAIN_STROKE} strokeLinecap="round" fill="none" /> : null}
            </>
          )}

          {/* The junction knob, filling the ring's thickness, with a soft shadow under it. */}
          {empty || sweep < 0.97 ? null : (
            <>
              <Circle cx={px(MAIN_R, junction)} cy={py(MAIN_R, junction) + 1.6} r={KNOB_R + 2.2} fill={Palette.neutral[950]} opacity={0.07} />
              <Circle cx={px(MAIN_R, junction)} cy={py(MAIN_R, junction) + 1.4} r={KNOB_R + 1.2} fill={Palette.neutral[950]} opacity={0.12} />
              <Circle cx={px(MAIN_R, junction)} cy={py(MAIN_R, junction) + 1} r={KNOB_R + 0.2} fill={Palette.neutral[950]} opacity={0.22} />
              <Circle cx={px(MAIN_R, junction)} cy={py(MAIN_R, junction)} r={KNOB_R} fill={OnBrand.text} stroke={Palette.neutral[950]} strokeOpacity={0.12} strokeWidth={0.8} />
              <Path d={arrowsPath(px(MAIN_R, junction), py(MAIN_R, junction), junction)} stroke={Palette.neutral[800]} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          )}
          {/* The balance on the semi-ring: a bead on the track, a pulsing halo and the triangle pointing at it, always shown (at equilibrium when there is no reading). */}
          <AnimatedCircle animatedProps={haloProps} fill={theme.text} />
          <AnimatedCircle animatedProps={bead} r={BEAD_R} fill={theme.text} stroke={theme.backgroundElevated} strokeWidth={2.5} />
          <AnimatedPath animatedProps={marker} fill={theme.text} stroke={theme.backgroundElevated} strokeWidth={1.8} strokeLinejoin="round" />
        </Svg>

        {/* The scale's three labels: equilibrium at the top, the two ends under the semi-ring's ends. */}
        <ThemedText
          themeColor="textSecondary"
          style={[styles.zeroText, label(11), { top: (py(ZERO_LABEL_R, 0) - 14) * k, left: 0, right: 0 }]}>
          Equilibrio
        </ThemedText>
        <EndLabel name="Deficit" side="right" x={px(END_LABEL_R, SEMI_HALF_SPAN) * k} y={py(END_LABEL_R, SEMI_HALF_SPAN) * k} size={label(11)} />
        <EndLabel name="Surplus" side="left" x={px(END_LABEL_R, -SEMI_HALF_SPAN) * k} y={py(END_LABEL_R, -SEMI_HALF_SPAN) * k} size={label(11)} />

        {/* The number: the balance itself, inside the main ring. */}
        <View pointerEvents="none" style={[styles.centre, { top: (CY - 38) * k, height: 76 * k }]}>
          <ThemedText style={[styles.value, { fontSize: 28 * k, lineHeight: 32 * k }]}>{value}</ThemedText>
          <ThemedText style={[styles.unit, { fontSize: 12 * k, lineHeight: 16 * k }]}>{goalLabel}</ThemedText>
          <ThemedText style={[styles.caption, { fontSize: 12 * k, lineHeight: 16 * k, color: theme.textTertiary }]}>{caption}</ThemedText>
        </View>
      </View>
    </View>
  );
}

/** One end of the semi-ring's scale: its name beside the ring's end, its inner edge at x. */
function EndLabel({ name, side, x, y, size }: { name: string; side: 'left' | 'right'; x: number; y: number; size: { fontSize: number; lineHeight: number } }) {
  const w = END_LABEL_W * (size.fontSize / 11);
  return (
    <View pointerEvents="none" style={[styles.end, { top: y - size.lineHeight / 2, width: w, left: side === 'right' ? x : x - w }]}>
      <ThemedText themeColor="textSecondary" style={[styles.endName, size, { textAlign: side === 'right' ? 'left' : 'right' }]} numberOfLines={1}>
        {name}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  zeroText: {
    position: 'absolute',
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  end: {
    position: 'absolute',
  },
  endName: {
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
