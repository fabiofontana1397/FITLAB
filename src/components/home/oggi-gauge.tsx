import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { OnBrand, Palette } from '@/constants/theme';
import { BALANCE_SCALE, balancePosition, type BalanceReading } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─── Geometry ──────────────────────────────────────────────────────────────
// Drawn in a fixed 260-wide coordinate space and scaled to the card, so the
// two rings stay concentric and in proportion on every iPhone width.
// Angles are degrees clockwise from 12 o'clock — so on both rings the right
// side is a deficit, the left a surplus, and the top is equilibrium.
const BASE_W = 300;
const CX = BASE_W / 2;

/** Main ring: intake vs burned, open at the bottom like the original gauge. */
const MAIN_R = 72;
const MAIN_STROKE = 16;
const BOTTOM_GAP_DEG = 84;
const MAIN_HALF_SPAN = 180 - BOTTOM_GAP_DEG / 2; // ±138°
const MIN_SWEEP_DEG = 10;

/** Semi-ring: the balance against the goal, hugging the top of the main ring. */
const SEMI_STROKE = 6;
const RING_GAP = 9;
const SEMI_R = MAIN_R + MAIN_STROKE / 2 + RING_GAP + SEMI_STROKE / 2;
const SEMI_HALF_SPAN = 90;

/** The balance marker: a triangle outside the semi-ring, its tip on the track pointing at the ring's centre. */
const MARKER_TIP_R = SEMI_R + SEMI_STROKE / 2 + 1.5;
const MARKER_TRI_H = 8;
const MARKER_TRI_HALF_W = 4.6;
/** Where the "Equilibrio" label hangs: just past the triangle's base, at the top. */
const ZERO_LABEL_R = MARKER_TIP_R + MARKER_TRI_H + 7;
/** Room above the semi-ring for that label. */
const TOP_PAD = 34;
/** The semi-ring's end labels sit under its two ends, nudged outward so they clear the main ring. */
const END_LABEL_DX = 20;
const END_LABEL_DY = 16;
/** The junction knob fills the ring's thickness, leaving a hair of the stroke around it. */
const KNOB_R = MAIN_STROKE / 2 - 0.5;
/** The ring is drawn as short segments whose colour follows the distance from the knob. */
const RING_STEP_DEG = 4;
const RING_OVERLAP_DEG = 0.6;
/** Every visit to Home replays the fill like an odometer: fast at first, settling on the value. */
const ODOMETER_MS = 1500;
const ODOMETER_EASING = Easing.bezier(0.16, 1, 0.3, 1);
/** The far end of an arc never fades past this share of its full colour, and a short arc fades as if it were this long. */
const FADE_FLOOR = 0.4;
const FADE_MIN_SPAN_DEG = 90;
/** How far toward the card surface the faded colour sits. */
const FADE_TOWARD_SURFACE = 0.6;
/** The semi-ring track: green around the goal, turning amber then red the further the balance lies from it. */
const GOAL_ZONE_STEP_DEG = 1.5;
const GOAL_ZONE_MIN_CORE_DEG = 3;
const GOAL_ZONE_MAX_CORE_DEG = 6;
/** Degrees past the core at which the track has become fully red, and the share of that distance where it is amber. */
const GOAL_ZONE_RED_DEG = 110;
const GOAL_ZONE_AMBER_AT = 0.4;
const CY = TOP_PAD + SEMI_R + SEMI_STROKE / 2;
const BASE_H = CY + MAIN_R * Math.cos(((180 - MAIN_HALF_SPAN) * Math.PI) / 180) + MAIN_STROKE / 2 + 4;

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

/**
 * Colour of one piece of the main ring: the arc's own colour at full strength
 * next to the knob, fading toward the card surface the further it lies along
 * that arc. Recomputed from the shown junction, so the gradient follows the
 * curve and moves with the knob.
 */
function ringColor(mid: number, junction: number, burned: Rgb, eaten: Rgb, fadedBurned: Rgb, fadedEaten: Rgb): string {
  const isBurned = mid < junction;
  const len = isBurned ? junction + MAIN_HALF_SPAN : MAIN_HALF_SPAN - junction;
  const x = Math.min(1, Math.abs(mid - junction) / Math.max(len, FADE_MIN_SPAN_DEG));
  const ease = x * x * (3 - 2 * x);
  const keep = 1 - (1 - FADE_FLOOR) * ease;
  const c = isBurned ? mixRgb(fadedBurned, burned, keep) : mixRgb(fadedEaten, eaten, keep);
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
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
 * 2. The semi-ring above reads that same balance on a symmetric kcal range:
 *    equilibrium at the top, deficit to the right, surplus to the left. The
 *    triangle outside it is the balance; the green stretch of the track is
 *    the goal — full green where it is met, fading to grey away from it.
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
  // odometer: `sweep` (0..1) paints the main ring clockwise from its left end,
  // the knob appears as the sweep reaches it, and the triangle glides out from
  // equilibrium. State is reset when Home loses focus so the next visit starts
  // from zero. Under Reduce Motion everything is simply there.
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
      setSweep(ODOMETER_EASING(t));
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [focused, reduceMotion]);
  const junction = targetJunction;
  // How far (in degrees from the ring's left end) the sweep has got.
  const front = -MAIN_HALF_SPAN + sweep * MAIN_HALF_SPAN * 2;

  const semi = useSharedValue(0);
  useEffect(() => {
    if (!focused) {
      semi.value = 0;
      return;
    }
    semi.value = reduceMotion ? targetSemi : withTiming(targetSemi, { duration: ODOMETER_MS, easing: ODOMETER_EASING });
  }, [focused, reduceMotion, targetSemi, semi]);

  const marker = useAnimatedProps(() => ({ d: markerPath(semi.value) }));

  const ringColors = useMemo(() => {
    const surface = rgbOf(theme.backgroundElevated, rgbOf(theme.background));
    const burned = rgbOf(burnedColor);
    const eaten = rgbOf(eatenColor);
    if (!surface || !burned || !eaten) return null;
    return { burned, eaten, fadedBurned: mixRgb(burned, surface, FADE_TOWARD_SURFACE), fadedEaten: mixRgb(eaten, surface, FADE_TOWARD_SURFACE) };
  }, [theme.background, theme.backgroundElevated, burnedColor, eatenColor]);
  const ringSegments = useMemo(() => {
    const count = Math.ceil((MAIN_HALF_SPAN * 2) / RING_STEP_DEG);
    return Array.from({ length: count }, (_, i) => {
      const from = -MAIN_HALF_SPAN + i * RING_STEP_DEG;
      const to = Math.min(MAIN_HALF_SPAN, from + RING_STEP_DEG + RING_OVERLAP_DEG);
      return { from, to, d: arc(MAIN_R, from, to) };
    });
  }, []);
  // The semi-ring's track, in short pieces: green around the goal, then amber, then red the further away.
  const goalZone = useMemo(() => {
    const surface = rgbOf(theme.backgroundElevated, rgbOf(theme.background));
    const track = rgbOf(theme.backgroundElement, surface);
    const green = rgbOf(theme.balanceGoalScale[2]);
    const amber = rgbOf(theme.warning);
    const red = rgbOf(theme.danger);
    const count = Math.ceil((SEMI_HALF_SPAN * 2) / GOAL_ZONE_STEP_DEG);
    const core = Math.min(GOAL_ZONE_MAX_CORE_DEG, Math.max(GOAL_ZONE_MIN_CORE_DEG, ((toleranceKcal / reading.halfRangeKcal) * SEMI_HALF_SPAN) * 0.5));
    return Array.from({ length: count }, (_, i) => {
      const from = -SEMI_HALF_SPAN + i * GOAL_ZONE_STEP_DEG;
      const to = Math.min(SEMI_HALF_SPAN, from + GOAL_ZONE_STEP_DEG + 0.3);
      const x = Math.min(1, Math.max(0, (Math.abs((from + to) / 2 - goalDeg) - core) / GOAL_ZONE_RED_DEG));
      let c: Rgb | null;
      if (inactive || !green || !amber || !red) c = track;
      else {
        const e = x * x * (3 - 2 * x);
        c = e < GOAL_ZONE_AMBER_AT ? mixRgb(green, amber, e / GOAL_ZONE_AMBER_AT) : mixRgb(amber, red, (e - GOAL_ZONE_AMBER_AT) / (1 - GOAL_ZONE_AMBER_AT));
      }
      return { d: arc(SEMI_R, from, to), color: c ? `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})` : theme.backgroundElement };
    });
  }, [theme.background, theme.backgroundElevated, theme.backgroundElement, theme.balanceGoalScale, theme.warning, theme.danger, goalDeg, toleranceKcal, reading.halfRangeKcal, inactive]);

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

          {/* Main ring: burned from the left end, intake from the right, meeting at the junction. */}
          {empty || !ringColors ? (
            <Path d={arc(MAIN_R, -MAIN_HALF_SPAN, MAIN_HALF_SPAN)} stroke={theme.backgroundElement} strokeWidth={MAIN_STROKE} strokeLinecap="round" fill="none" />
          ) : (
            ringSegments.map((seg, i) => (
              <Path
                key={i}
                d={seg.d}
                stroke={(seg.from + seg.to) / 2 <= front ? ringColor((seg.from + seg.to) / 2, junction, ringColors.burned, ringColors.eaten, ringColors.fadedBurned, ringColors.fadedEaten) : theme.backgroundElement}
                strokeWidth={MAIN_STROKE}
                strokeLinecap={i === 0 || i === ringSegments.length - 1 ? 'round' : 'butt'}
                fill="none"
              />
            ))
          )}

          {/* The junction knob, filling the ring's thickness, with a soft shadow under it. */}
          {empty || front < junction ? null : (
            <>
              <Circle cx={px(MAIN_R, junction)} cy={py(MAIN_R, junction) + 1.6} r={KNOB_R + 2.2} fill={Palette.neutral[950]} opacity={0.07} />
              <Circle cx={px(MAIN_R, junction)} cy={py(MAIN_R, junction) + 1.4} r={KNOB_R + 1.2} fill={Palette.neutral[950]} opacity={0.12} />
              <Circle cx={px(MAIN_R, junction)} cy={py(MAIN_R, junction) + 1} r={KNOB_R + 0.2} fill={Palette.neutral[950]} opacity={0.22} />
              <Circle cx={px(MAIN_R, junction)} cy={py(MAIN_R, junction)} r={KNOB_R} fill={OnBrand.text} stroke={Palette.neutral[950]} strokeOpacity={0.12} strokeWidth={0.8} />
              <Path d={arrowsPath(px(MAIN_R, junction), py(MAIN_R, junction), junction)} stroke={Palette.neutral[800]} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          )}
          {/* The balance on the semi-ring: the triangle. */}
          {missing ? null : <AnimatedPath animatedProps={marker} fill={theme.text} stroke={theme.text} strokeWidth={1.2} strokeLinejoin="round" />}
        </Svg>

        {/* The scale's three labels: equilibrium at the top, the two ends under the semi-ring's ends. */}
        <ThemedText
          themeColor="textSecondary"
          style={[styles.zeroText, label(11), { top: (py(ZERO_LABEL_R, 0) - 14) * k, left: 0, right: 0 }]}>
          Equilibrio · 0 kcal
        </ThemedText>
        <EndLabel name="Deficit" x={(CX + SEMI_R + END_LABEL_DX) * k} y={(CY + END_LABEL_DY) * k} size={label(11)} />
        <EndLabel name="Surplus" x={(CX - SEMI_R - END_LABEL_DX) * k} y={(CY + END_LABEL_DY) * k} size={label(11)} />

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

/** One end of the semi-ring's scale: its name, centred on x. */
function EndLabel({ name, x, y, size }: { name: string; x: number; y: number; size: { fontSize: number; lineHeight: number } }) {
  return (
    <View pointerEvents="none" style={[styles.end, { top: y, width: 80, left: x - 40 }]}>
      <ThemedText themeColor="textSecondary" style={[styles.endName, size]}>
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
    alignItems: 'center',
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
