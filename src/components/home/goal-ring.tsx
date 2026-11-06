import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import type { GoalBandCopy } from '@/components/home/goal-band-copy';
import { ThemedText } from '@/components/themed-text';
import { Palette } from '@/constants/theme';
import { balancePosition, type GoalBand } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';
import { formatSignedKcal } from '@/lib/format-kcal';

// ─── Geometry ──────────────────────────────────────────────────────────────
// Drawn in a fixed 300-wide space and scaled to the card. Angles are degrees
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
const TICK_R = R_OUT + 9;
const CY = TICK_R + 14;
const BASE_H = CY + 30;
const MARKER = 26;
const HALO = 46;
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

/** A round step (1, 2 or 5 × 10ⁿ) giving about four ticks across `span` kcal. */
function niceStep(span: number): number {
  const raw = span / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
}

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
 * is the acceptable range around the goal, and a light kcal axis runs along the
 * outside. The marker is where the day actually is: every time Home comes into
 * view it springs from zero (equilibrium) to the real value, then breathes; it
 * rests on an end of the scale when the real value lies beyond it. In the
 * middle: the balance, the goal and the state.
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

  // The kcal axis: round balance values around the outside; equilibrium (0) is among them whenever it is in view.
  const ticks = useMemo(() => {
    const lo = band.goalKcal - band.halfRangeKcal;
    const hi = band.goalKcal + band.halfRangeKcal;
    const step = niceStep(band.halfRangeKcal * 2);
    const out: { v: number; deg: number }[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      const deg = balancePosition(v - band.goalKcal, band.halfRangeKcal).position * SPAN;
      // Not on top of the goal's own mark, nor out at the very ends (the end names sit there).
      if (Math.abs(deg) > 9 && Math.abs(deg) < 84) out.push({ v: Math.round(v), deg });
    }
    return out;
  }, [band.goalKcal, band.halfRangeKcal]);

  // The marker's angle. Every time Home is shown it starts at the surplus end of the scale and runs across to the real value, springing past it a little before it settles; afterwards it glides between values.
  const targetDeg = band.position * SPAN;
  const ang = useSharedValue(-SPAN);
  const halo = useSharedValue(0);
  const armed = useRef(false);
  useEffect(() => {
    if (!focused || noReading) {
      ang.value = -SPAN;
      armed.current = false;
      return;
    }
    if (reduceMotion) {
      ang.value = targetDeg;
      return;
    }
    if (!armed.current) {
      armed.current = true;
      ang.value = -SPAN;
      // The short delay lets the start position paint first, so the run is seen.
      ang.value = withDelay(140, withSpring(targetDeg, { damping: 12, stiffness: 36, mass: 1 }));
      return;
    }
    ang.value = withSpring(targetDeg, { damping: 18, stiffness: 90 });
  }, [focused, noReading, targetDeg, reduceMotion, ang]);
  useEffect(() => {
    if (!focused || reduceMotion || noReading) {
      halo.value = 0;
      return;
    }
    halo.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }), -1, false);
  }, [focused, reduceMotion, noReading, halo]);

  // `ang.value` is read right in each style (not through a helper), so the style follows it every frame.
  const markerStyle = useAnimatedStyle(() => {
    const a = (ang.value * Math.PI) / 180;
    return { transform: [{ translateX: (CX + R * Math.sin(a)) * k - (MARKER * k) / 2 }, { translateY: (CY - R * Math.cos(a)) * k - (MARKER * k) / 2 }] };
  });
  const haloStyle = useAnimatedStyle(() => {
    const a = (ang.value * Math.PI) / 180;
    return {
      transform: [{ translateX: (CX + R * Math.sin(a)) * k - (HALO * k) / 2 }, { translateY: (CY - R * Math.cos(a)) * k - (HALO * k) / 2 }, { scale: 0.55 + halo.value * 0.75 }],
      opacity: 0.5 * (1 - halo.value),
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

  return (
    <View style={styles.root}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint="Apre la spiegazione del grafico" style={styles.press} onLayout={onLayout}>
        <View style={{ width: BASE_W * k, height: BASE_H * k }}>
          <Svg width={BASE_W * k} height={BASE_H * k} viewBox={`0 0 ${BASE_W} ${BASE_H}`} style={StyleSheet.absoluteFill}>
            {colors.map((c, i) => {
              const deg = ((i - MID) / MID) * SPAN;
              const extra = i === MID ? 4 : 0;
              return <Line key={i} x1={px(R_IN - extra, deg)} y1={py(R_IN - extra, deg)} x2={px(R_OUT + extra, deg)} y2={py(R_OUT + extra, deg)} stroke={c} strokeWidth={STRIP_W} strokeLinecap="round" />;
            })}
            {/* The goal's mark: a small tip over the centre strip. */}
            <Path d={`M ${CX - 4.5} ${CY - R_OUT - 11} L ${CX + 4.5} ${CY - R_OUT - 11} L ${CX} ${CY - R_OUT - 5} Z`} fill={goodText} />
          </Svg>

          {/* The kcal axis, in light grey, around the outside. */}
          {ticks.map((t) => (
            <ThemedText
              key={t.v}
              themeColor="textTertiary"
              numberOfLines={1}
              style={[styles.tick, label(11), { left: (t.deg > 35 ? px(TICK_R, t.deg) : t.deg < -35 ? px(TICK_R, t.deg) - 48 : px(TICK_R, t.deg) - 24) * k, top: (py(TICK_R, t.deg) - 7) * k, width: 48 * k, textAlign: t.deg > 35 ? 'left' : t.deg < -35 ? 'right' : 'center' }]}>
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

          {noReading ? null : (
            <>
              <Animated.View pointerEvents="none" style={[styles.halo, { width: HALO * k, height: HALO * k, borderRadius: (HALO * k) / 2, borderColor: theme.text }, haloStyle]} />
              <Animated.View
                pointerEvents="none"
                style={[styles.marker, { width: MARKER * k, height: MARKER * k, borderRadius: (MARKER * k) / 2, borderWidth: 8 * k, backgroundColor: Palette.neutral[950] }, markerStyle]}
              />
            </>
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
  end: {
    position: 'absolute',
    textAlign: 'center',
    pointerEvents: 'none',
    fontWeight: '600',
  },
  halo: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderWidth: 2,
  },
  marker: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
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
