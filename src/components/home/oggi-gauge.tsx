import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Easing, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { OnBrand, Palette } from '@/constants/theme';
import { type BalanceReading } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';

// ─── Geometry ──────────────────────────────────────────────────────────────
// Drawn in a fixed 340-wide coordinate space and scaled to the card, so the
// arc, the knob and the texts stay in proportion on every iPhone width.
// Angles are degrees clockwise from 12 o'clock: -90 is 9 o'clock (the left
// end, burned), +90 is 3 o'clock (the right end, intake).
const BASE_W = 250;
const CX = BASE_W / 2;
const ARC_HALF_SPAN = 90;
const STROKE = 22;
const OUTER_R = BASE_W / 2 - 2;
const R = OUTER_R - STROKE / 2;
const INNER_R = R - STROKE / 2;
/** The arc's flat end, where its two round caps sit. */
const CY = OUTER_R + 2;
const BASE_H = CY + STROKE / 2 + 2;
/** The junction knob: a white ring around a coloured disc, with a chevron. */
const KNOB_RING_R = 15;
const KNOB_R = 11.5;
/** The knob never gets closer than this share of the arc to either end. */
const KNOB_MIN_SHARE = 0.08;
/** The gradient is drawn in short pieces (butt-ended, slightly overlapping). */
const SEGMENTS = 60;
const SEGMENT_DEG = (ARC_HALF_SPAN * 2) / SEGMENTS;
/** Every visit to Home replays the fill like an odometer: fast at first, settling on the value. */
const ODOMETER_MS = 1100;
const ODOMETER_BEZIER = Easing.bezier(0.16, 1, 0.3, 1);
const odometerEase = ODOMETER_BEZIER.factory();
/** Soft champagne where intake and burned meet (identical in both themes: it only ever sits between two saturated colours). */
const CHAMPAGNE = '#F8DC95';

/** Height over width of the drawn gauge, for sizing it to the room there is. */
export const GAUGE_ASPECT = BASE_H / BASE_W;
/** The widest the gauge is drawn (its scale stops growing there). */
export const GAUGE_MAX_WIDTH = BASE_W;

function px(r: number, deg: number) {
  return CX + r * Math.sin((deg * Math.PI) / 180);
}
function py(r: number, deg: number) {
  return CY - r * Math.cos((deg * Math.PI) / 180);
}
function arc(r: number, fromDeg: number, toDeg: number): string {
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${px(r, fromDeg)} ${py(r, fromDeg)} A ${r} ${r} 0 ${large} 1 ${px(r, toDeg)} ${py(r, toDeg)}`;
}

/** The arc's pieces, computed once: the geometry never changes, only the colours do. */
const SEGMENT_PATHS = Array.from({ length: SEGMENTS }, (_, i) => {
  const from = -ARC_HALF_SPAN + i * SEGMENT_DEG;
  return { d: arc(R, from, Math.min(ARC_HALF_SPAN, from + SEGMENT_DEG + 0.6)), t: (i + 0.5) / SEGMENTS };
});

type Rgb = [number, number, number];

function rgbOf(color: string): Rgb | null {
  const hex = /^#([0-9a-f]{6})/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(color);
  return rgba ? [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])] : null;
}
function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function css(c: Rgb): string {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

/**
 * The arc's colour at `t` (0 = left end, 1 = right end) given where intake
 * meets burned (`j`, 0..1): burned's colour from the left end, fading through
 * a lighter tint into champagne at the junction, then warming into intake's
 * colour at the right end. The colours therefore follow the data, not the
 * decoration: more burned stretches the green, more intake stretches the orange.
 */
function colorAt(t: number, j: number, burned: Rgb, eaten: Rgb): Rgb {
  const champagne = rgbOf(CHAMPAGNE) as Rgb;
  const light = mixRgb(burned, champagne, 0.55);
  const warm = mixRgb(champagne, eaten, 0.5);
  const stops: [number, Rgb][] = [
    [0, burned],
    [j * 0.55, light],
    [j, champagne],
    [j + (1 - j) * 0.45, warm],
    [1, eaten],
  ];
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i];
    const [p0, c0] = stops[i - 1];
    if (t <= p1) return mixRgb(c0, c1, p1 === p0 ? 1 : (t - p0) / (p1 - p0));
  }
  return eaten;
}

export type OggiGaugeBadge = { label: string; tone: 'good' | 'warn' | 'neutral' };

export type OggiGaugeProps = {
  burnedKcal: number;
  eatenKcal: number;
  /** Left half of the arc and the flame (burned). */
  burnedColor: string;
  /** Right half of the arc and the fork (intake). */
  eatenColor: string;
  /** The day's balance read against its goal (domain/calorie-balance.ts); the gauge itself only needs to know whether there is anything to read. */
  reading?: BalanceReading;
  /** The balance as displayed in the centre, already formatted. */
  value: string;
  /** The daily goal, already formatted. Not drawn any more (the goal lives in the KPI row and the bar), kept for callers. */
  goalLabel?: string;
  /** Grey word under the goal, shown only when there is no `badge`. */
  caption?: string;
  /** The status chip at the bottom of the arc ("In range"). */
  badge?: OggiGaugeBadge;
  /** Kept for callers that tune the tolerance (the guide's carousel); the arc no longer draws a goal zone. */
  toleranceKcal?: number;
  /** A day with nothing to show (not yet started): the whole gauge stays plain grey. */
  inactive?: boolean;
};

/**
 * "Calorie di oggi": a thick 180° arc comparing burned (left) with intake
 * (right). Each side takes its share of the two together; where they meet
 * sits the round knob. Inside the arc: burned on the left, intake on the
 * right, the day's balance in the middle with its goal under it, and a status
 * pill at the bottom.
 */
export function OggiGauge({ burnedKcal, eatenKcal, burnedColor, eatenColor, value, caption, badge, inactive = false }: OggiGaugeProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(BASE_W);
  const k = Math.min(1, width / BASE_W);

  const total = burnedKcal + eatenKcal;
  const empty = total <= 0;
  const burnedShare = empty ? 0.5 : Math.min(1 - KNOB_MIN_SHARE, Math.max(KNOB_MIN_SHARE, burnedKcal / total));

  // Each time Home comes into view the knob runs out from the arc's start (zero) to its
  // place while the colours stretch with it; state is reset when Home loses
  // focus so the next visit starts over. Under Reduce Motion it is just there.
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
  const j = KNOB_MIN_SHARE + (burnedShare - KNOB_MIN_SHARE) * sweep;
  const knobDeg = -ARC_HALF_SPAN + j * ARC_HALF_SPAN * 2;

  const burnedRgb = rgbOf(burnedColor);
  const eatenRgb = rgbOf(eatenColor);
  const segmentColors = useMemo(() => {
    if (inactive || !burnedRgb || !eatenRgb) return null;
    return SEGMENT_PATHS.map((s) => css(colorAt(s.t, j, burnedRgb, eatenRgb)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inactive, burnedColor, eatenColor, j]);
  const capLeft = segmentColors ? segmentColors[0] : theme.backgroundElement;
  const capRight = segmentColors ? segmentColors[SEGMENTS - 1] : theme.backgroundElement;
  const dim = inactive;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const knobX = px(R, knobDeg);
  const knobY = py(R, knobDeg);
  const toneColor = badge?.tone === 'good' ? theme.balanceGoalScale[3] : badge?.tone === 'warn' ? theme.accent : theme.textSecondary;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <View style={{ width: BASE_W * k, height: BASE_H * k }}>
        <Svg width={BASE_W * k} height={BASE_H * k} viewBox={`0 0 ${BASE_W} ${BASE_H}`} style={StyleSheet.absoluteFill}>
          {/* Round caps at the two ends, then the gradient between them. */}
          <Circle cx={px(R, -ARC_HALF_SPAN)} cy={py(R, -ARC_HALF_SPAN)} r={STROKE / 2} fill={capLeft} />
          <Circle cx={px(R, ARC_HALF_SPAN)} cy={py(R, ARC_HALF_SPAN)} r={STROKE / 2} fill={capRight} />
          {SEGMENT_PATHS.map((s, i) => (
            <Path key={i} d={s.d} stroke={segmentColors ? segmentColors[i] : theme.backgroundElement} strokeWidth={STROKE} strokeLinecap="butt" fill="none" />
          ))}
          {/* A soft inner glow under the content, so the arc reads as lit from inside. */}
          <Path d={arc(INNER_R - 1, -ARC_HALF_SPAN, ARC_HALF_SPAN)} stroke={OnBrand.text} strokeOpacity={0.35} strokeWidth={2} fill="none" />

          {/* The junction knob: where burned and intake meet. */}
          {empty || dim ? null : (
            <>
              <Circle cx={knobX} cy={knobY + 2.5} r={KNOB_RING_R + 2} fill={Palette.neutral[950]} opacity={0.08} />
              <Circle cx={knobX} cy={knobY + 1.5} r={KNOB_RING_R + 0.5} fill={Palette.neutral[950]} opacity={0.14} />
              <Circle cx={knobX} cy={knobY} r={KNOB_RING_R} fill={OnBrand.text} />
              <Circle cx={knobX} cy={knobY} r={KNOB_R} fill={eatenColor} />
              <Path d={`M ${knobX - 2} ${knobY - 4.5} L ${knobX + 2.5} ${knobY} L ${knobX - 2} ${knobY + 4.5}`} stroke={OnBrand.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          )}
        </Svg>

        {/* The day's balance: the one number the arc is about. */}
        <View pointerEvents="none" style={[styles.centre, { top: (CY - 80) * k }]}>
          <ThemedText style={[styles.value, { fontSize: (value.length > 6 ? 28 : 34) * k, lineHeight: 38 * k }]} numberOfLines={1}>
            {value}
          </ThemedText>
          <ThemedText style={[styles.unit, { fontSize: 12 * k, lineHeight: 16 * k }]} themeColor="textSecondary">
            kcal di bilancio
          </ThemedText>
        </View>

        {/* The status chip, over the arc's flat end. */}
        <View pointerEvents="none" style={[styles.badgeRow, { top: (CY - 22) * k, height: 24 * k }]}>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: tint(toneColor, 0.14), paddingHorizontal: 10 * k, height: 22 * k, borderRadius: 11 * k }]}>
              <View style={[styles.dot, { backgroundColor: toneColor }]} />
              <ThemedText style={[styles.badgeText, { color: toneColor, fontSize: 12 * k, lineHeight: 16 * k }]} numberOfLines={1}>
                {badge.label}
              </ThemedText>
            </View>
          ) : caption ? (
            <ThemedText style={{ color: theme.textTertiary, fontSize: 12 * k, lineHeight: 16 * k, fontWeight: '600' }}>{caption}</ThemedText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** `rgba` of a `#rrggbb` / `rgb()` colour. */
function tint(color: string, alpha: number): string {
  const c = rgbOf(color);
  return c ? `rgba(${c[0]},${c[1]},${c[2]},${alpha})` : color;
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  centre: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  value: {
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  unit: {
    fontWeight: '500',
  },
  badgeRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontWeight: '700',
  },
});
