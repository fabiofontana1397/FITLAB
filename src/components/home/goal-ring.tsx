import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { GoalBandCopy } from '@/components/home/goal-band-copy';
import { ThemedText } from '@/components/themed-text';
import { balancePosition, type GoalBand } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';
import { formatSignedKcal } from '@/lib/format-kcal';

// ─── Geometry ──────────────────────────────────────────────────────────────
// Drawn in a fixed 316-wide space and scaled to the card. Angles are degrees
// clockwise from 12 o'clock: -90 is 9 o'clock (surplus end), +90 is 3 o'clock
// (deficit end); the goal sits at the top, at 0.
const BASE_W = 316;
const CX = BASE_W / 2;
/** Radial strips, odd so one sits exactly on the goal. */
const STRIPS = 31;
const MID = (STRIPS - 1) / 2;
const SPAN = 90;
const R = 112;
const LEN = 20;
const STRIP_W = 7;
const R_IN = R - LEN / 2;
const R_OUT = R + LEN / 2;
/** The thin grey scale line over the ring, its dots, and the labels beyond it. */
const LINE_R = R_OUT + 9;
const LABEL_R = LINE_R + 15;
const CY = LABEL_R + 14;
const BASE_H = CY + 30;
/** The kcal scale runs this far either side of equilibrium. */
const SCALE_KCAL = 600;
/** How the marker strip grows once it reaches the real value (× the others). */
const GROW_W = 1.6;
const GROW_LEN = 2;
const CHAMPAGNE: Rgb = [248, 220, 149];

type Rgb = [number, number, number];
function rgbOf(color: string): Rgb | null {
  const hex = /^#([0-9a-f]{6})/i.exec(color);
  if (!hex) return null;
  const n = parseInt(hex[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: Rgb) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const px = (r: number, deg: number) => CX + r * Math.sin((deg * Math.PI) / 180);
const py = (r: number, deg: number) => CY - r * Math.cos((deg * Math.PI) / 180);
const arc = (r: number, from: number, to: number) => `M ${px(r, from)} ${py(r, from)} A ${r} ${r} 0 0 1 ${px(r, to)} ${py(r, to)}`;

export type GoalRingProps = {
  band: GoalBand;
  copy: GoalBandCopy;
  /** The balance in the middle, already formatted. */
  value: string;
  /** The goal in the middle, already formatted ("-1.842 kcal"). */
  goalText: string;
  /** Nothing to read (a day not yet started): grey strips, no marker. */
  inactive?: boolean;
  onPress?: () => void;
  onGoalPress?: () => void;
  accessibilityLabel: string;
};

/**
 * "Calorie di oggi": the day's balance on a half ring of radial strips, centred
 * on the goal. Surplus runs to the left, deficit to the right, the green zone
 * is the acceptable range around the goal.
 *
 * Over the ring runs a thin grey line marking equilibrium (0): solid towards
 * the surplus, dashed towards the deficit, with a dot every 100 (or 200) kcal
 * out to ±600. The marker is one of the strips, enlarged: every time Home comes
 * into view it runs along the whole arc and swells as it reaches the real
 * value. It rests on an end of the scale when the real value lies beyond it.
 */
export function GoalRing({ band, copy, value, goalText, inactive = false, onPress, onGoalPress, accessibilityLabel }: GoalRingProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const [width, setWidth] = useState(BASE_W);
  const k = Math.min(1.1, width / BASE_W);
  const noReading = inactive || band.state === 'missing';

  const colors = useMemo(() => {
    const [pale, soft, , deep] = theme.balanceGoalScale.map((c) => rgbOf(c) as Rgb);
    const orange = rgbOf(theme.accent) as Rgb;
    const track = rgbOf(theme.backgroundElement) ?? pale;
    return Array.from({ length: STRIPS }, (_, i) => {
      const d = (Math.abs(i - MID) / MID) * band.halfRangeKcal;
      if (inactive) return css(mix(track, pale, i === MID ? 0.4 : 0));
      let c: Rgb;
      if (d <= band.toleranceKcal) c = mix(deep, soft, Math.pow(d / band.toleranceKcal, 1.1) * 0.9);
      else {
        const u = (d - band.toleranceKcal) / Math.max(1, band.halfRangeKcal - band.toleranceKcal);
        c = u < 0.25 ? mix(soft, CHAMPAGNE, u / 0.25) : mix(CHAMPAGNE, orange, Math.min(1, Math.pow((u - 0.25) / 0.75, 0.9)));
      }
      return css(c);
    });
  }, [theme.balanceGoalScale, theme.accent, theme.backgroundElement, band.halfRangeKcal, band.toleranceKcal, inactive]);

  // Where a balance of `v` kcal sits on the ring, in degrees (surplus left, deficit right).
  const degOf = (v: number) => balancePosition(v - band.goalKcal, band.halfRangeKcal).position * SPAN;
  const zeroDeg = degOf(0);

  // The equilibrium scale: a dot every 100 kcal (200 where they would crowd), ±600; labels where there is room.
  const scale = useMemo(() => {
    const degPer100 = (100 / band.halfRangeKcal) * SPAN;
    const step = (degPer100 * Math.PI * LINE_R) / 180 < 5 ? 200 : 100;
    const dots: { x: number; y: number }[] = [];
    for (let v = -SCALE_KCAL; v <= SCALE_KCAL; v += step) {
      if (v === 0) continue;
      const deg = degOf(v);
      if (Math.abs(deg) < SPAN - 1.5) dots.push({ x: px(LINE_R, deg), y: py(LINE_R, deg) });
    }
    // Labels: 0 first, then the ends, then the middle ones, each only if clear of those already placed.
    const minGap = ((32 / LABEL_R) * 180) / Math.PI;
    const placed: { v: number; deg: number }[] = [];
    for (const v of [0, SCALE_KCAL, -SCALE_KCAL, SCALE_KCAL / 2, -SCALE_KCAL / 2]) {
      const deg = degOf(v);
      if (Math.abs(deg) >= SPAN - 4) continue;
      // Not over the goal's own mark at the top.
      if (v !== 0 && Math.abs(deg) < 9) continue;
      if (placed.every((p) => Math.abs(p.deg - deg) >= minGap)) placed.push({ v, deg });
    }
    return { dots, labels: placed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band.goalKcal, band.halfRangeKcal]);

  // The marker strip. Every time Home is shown it starts at the end of the scale farthest from the real value and runs along the arc to it, swelling as it gets there; afterwards it glides between values.
  const targetDeg = band.position * SPAN;
  const startDeg = band.position <= 0 ? SPAN : -SPAN;
  const ang = useSharedValue(startDeg);
  const armed = useRef(false);
  useEffect(() => {
    if (!focused || noReading) {
      ang.value = startDeg;
      armed.current = false;
      return;
    }
    if (reduceMotion) {
      ang.value = targetDeg;
      return;
    }
    if (!armed.current) {
      armed.current = true;
      ang.value = startDeg;
      // The short delay lets the start position paint first, so the run is seen from its beginning.
      ang.value = withDelay(160, withSpring(targetDeg, { damping: 15, stiffness: 28, mass: 1 }));
      return;
    }
    ang.value = withSpring(targetDeg, { damping: 18, stiffness: 90 });
  }, [focused, noReading, targetDeg, startDeg, reduceMotion, ang]);

  // `ang.value` is read right in the style (not through a helper), so the style follows it every frame.
  const markerStyle = useAnimatedStyle(() => {
    const a = (ang.value * Math.PI) / 180;
    // 0 far from the real value (an ordinary strip), 1 on it (fully enlarged).
    const near = Math.min(1, Math.max(0, 1 - Math.abs(ang.value - targetDeg) / 55));
    const g = near * near * (3 - 2 * near);
    return {
      transform: [
        { translateX: (CX + R * Math.sin(a)) * k - (STRIP_W * k) / 2 },
        { translateY: (CY - R * Math.cos(a)) * k - (LEN * k) / 2 },
        { rotate: `${ang.value}deg` },
        { scaleX: 1 + (GROW_W - 1) * g },
        { scaleY: 1 + (GROW_LEN - 1) * g },
      ],
    };
  });

  const goodText = theme.balanceGoalScale[3];
  const toneColor = copy.tone === 'good' ? goodText : copy.tone === 'warn' ? theme.accent : theme.textSecondary;
  const messageColor = copy.tone === 'good' ? goodText : theme.text;
  const chipBg = (() => {
    const c = rgbOf(toneColor);
    return c ? `rgba(${c[0]},${c[1]},${c[2]},0.13)` : theme.backgroundElement;
  })();
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const label = (size: number) => ({ fontSize: size * k, lineHeight: (size + 4) * k });
  const lineColor = theme.textTertiary;

  return (
    <View style={styles.root}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint="Apre la spiegazione del grafico" style={styles.press} onLayout={onLayout}>
        <View style={{ width: BASE_W * k, height: BASE_H * k }}>
          <Svg width={BASE_W * k} height={BASE_H * k} viewBox={`0 0 ${BASE_W} ${BASE_H}`} style={StyleSheet.absoluteFill}>
            {colors.map((c, i) => {
              const deg = ((i - MID) / MID) * SPAN;
              return <Line key={i} x1={px(R_IN, deg)} y1={py(R_IN, deg)} x2={px(R_OUT, deg)} y2={py(R_OUT, deg)} stroke={c} strokeWidth={STRIP_W} strokeLinecap="round" />;
            })}

            {/* The equilibrium line: solid from the surplus end to 0, dashed from 0 to the deficit end. */}
            {zeroDeg > -SPAN + 0.5 ? <Path d={arc(LINE_R, -SPAN, zeroDeg)} stroke={lineColor} strokeWidth={1.2} fill="none" /> : null}
            {zeroDeg < SPAN - 0.5 ? <Path d={arc(LINE_R, zeroDeg, SPAN)} stroke={lineColor} strokeWidth={1.2} strokeDasharray="3 4" fill="none" /> : null}
            {scale.dots.map((d, i) => (
              <Circle key={i} cx={d.x} cy={d.y} r={1.7} fill={lineColor} />
            ))}
            {/* 0 itself: a short tick across the line. */}
            <Line x1={px(LINE_R - 5, zeroDeg)} y1={py(LINE_R - 5, zeroDeg)} x2={px(LINE_R + 5, zeroDeg)} y2={py(LINE_R + 5, zeroDeg)} stroke={theme.textSecondary} strokeWidth={1.6} strokeLinecap="round" />

            {/* The goal's mark: a small tip over the centre strip. */}
            <Path d={`M ${CX - 4.5} ${CY - LINE_R - 12} L ${CX + 4.5} ${CY - LINE_R - 12} L ${CX} ${CY - LINE_R - 6} Z`} fill={goodText} />
          </Svg>

          {scale.labels.map((t) => (
            <ThemedText
              key={t.v}
              themeColor={t.v === 0 ? 'textSecondary' : 'textTertiary'}
              numberOfLines={1}
              style={[
                styles.tick,
                label(11),
                t.v === 0 && styles.tickZero,
                {
                  left: (t.deg > 35 ? px(LABEL_R, t.deg) : t.deg < -35 ? px(LABEL_R, t.deg) - 48 : px(LABEL_R, t.deg) - 24) * k,
                  top: (py(LABEL_R, t.deg) - 7) * k,
                  width: 48 * k,
                  textAlign: t.deg > 35 ? 'left' : t.deg < -35 ? 'right' : 'center',
                },
              ]}>
              {formatSignedKcal(t.v)}
            </ThemedText>
          ))}

          {/* The two ends of the scale. */}
          <ThemedText themeColor="textSecondary" style={[styles.end, label(12), { left: (px(R, -SPAN) - 40) * k, top: (CY + 10) * k, width: 80 * k }]}>
            ‹ Surplus
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={[styles.end, label(12), { left: (px(R, SPAN) - 40) * k, top: (CY + 10) * k, width: 80 * k }]}>
            Deficit ›
          </ThemedText>

          {/* The marker: one strip, enlarged where the day actually is. */}
          {noReading ? null : (
            <Animated.View pointerEvents="none" style={[styles.marker, { width: STRIP_W * k, height: LEN * k, borderRadius: (STRIP_W * k) / 2, backgroundColor: theme.text }, markerStyle]} />
          )}

          {/* The middle: the balance, the goal, the state. */}
          <View pointerEvents="box-none" style={[styles.centre, { top: (CY - 88) * k, paddingHorizontal: 70 * k }]}>
            <ThemedText pointerEvents="none" style={[styles.value, { fontSize: (value.length >= 7 ? 27 : value.length === 6 ? 31 : 36) * k, lineHeight: 40 * k }]} numberOfLines={1}>
              {value}
            </ThemedText>
            <Pressable onPress={onGoalPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Obiettivo ${goalText}`} style={styles.goalRow}>
              <ThemedText style={label(12)} themeColor="textSecondary" numberOfLines={1}>
                Obiettivo
              </ThemedText>
              <ThemedText style={[styles.goalValue, label(12), { color: goodText }]} numberOfLines={1}>
                {goalText}
              </ThemedText>
            </Pressable>
          </View>
          <View style={[styles.chipRow, { top: (CY - 26) * k, height: 24 * k }]}>
            <View pointerEvents="none" style={[styles.chip, { backgroundColor: chipBg, height: 24 * k, borderRadius: 12 * k, paddingHorizontal: 11 * k }]}>
              <View style={[styles.dot, { backgroundColor: toneColor }]} />
              <ThemedText style={[styles.chipText, { color: toneColor }, label(12)]} numberOfLines={1}>
                {copy.badge}
              </ThemedText>
            </View>
          </View>
        </View>
      </Pressable>

      <ThemedText style={[styles.message, { color: messageColor }]}>{copy.message}</ThemedText>
      {copy.cause ? (
        <ThemedText style={styles.cause} themeColor="textSecondary">
          {copy.cause}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  press: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  tick: {
    position: 'absolute',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    pointerEvents: 'none',
  },
  tickZero: {
    fontWeight: '700',
  },
  end: {
    position: 'absolute',
    textAlign: 'center',
    fontWeight: '600',
    pointerEvents: 'none',
  },
  marker: {
    position: 'absolute',
    left: 0,
    top: 0,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  centre: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  value: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  chipRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontWeight: '700',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  goalValue: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  cause: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
