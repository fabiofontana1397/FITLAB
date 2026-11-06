import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { balancePosition, type GoalBand, type GoalBandState } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';

/** Odd, so one strip sits exactly on the goal. 31 keeps each strip readable down to the narrowest iPhone. */
const STRIPS = 25;
const MID = (STRIPS - 1) / 2;
const GAP = 3;
const STRIP_H = 20;
const MARKER = 18;
const HALO = 34;
const TAG_W = 30;
const TICK_W = 48;
/** Room above the strips for the marker's tag. */
const TAG_ROOM = 26;
const CHAMPAGNE: Rgb = [248, 220, 149];

type Rgb = [number, number, number];
function rgbOf(color: string): Rgb | null {
  const hex = /^#([0-9a-f]{6})/i.exec(color);
  if (!hex) return null;
  const n = parseInt(hex[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
const css = (c: Rgb) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

// ─── Copy ───────────────────────────────────────────────────────────────────
// The wording of each state. It only describes the gap from the plan; it never
// tells the person to eat less or train more.

export type GoalBandCopy = {
  /** Short chip on the gauge: the one place the state is named. */
  badge: string;
  /** One sentence under the bar. */
  message: string;
  /** What the gap mostly depends on (intake or burned), when there is one. */
  cause: string | null;
  tone: 'good' | 'warn' | 'neutral';
};

const BASE: Record<Exclude<GoalBandState, 'missing'>, { badge: string; message: string; tone: 'good' | 'warn' }> = {
  reached: { badge: 'In range', message: 'Sei nel range previsto, continua così!', tone: 'good' },
  surplus: { badge: 'Surplus eccessivo', message: 'Hai assunto più calorie rispetto al tuo obiettivo', tone: 'warn' },
  deficit: { badge: 'Deficit eccessivo', message: 'Il deficit calorico è superiore al target previsto', tone: 'warn' },
  deficitShort: { badge: 'Deficit insufficiente', message: 'Sei ancora lontano dal deficit calorico desiderato', tone: 'warn' },
  surplusShort: { badge: 'Surplus insufficiente', message: 'Sei ancora lontano dal surplus calorico desiderato', tone: 'warn' },
};

export function goalBandCopy(band: GoalBand, { hasMeals, future }: { hasMeals: boolean; future: boolean }): GoalBandCopy {
  if (future) return { badge: 'Nessun dato', message: 'Giorno non ancora iniziato.', cause: null, tone: 'neutral' };
  if (band.state === 'missing') {
    return hasMeals
      ? { badge: 'Dati insufficienti', message: 'Mancano le calorie bruciate per leggere il bilancio.', cause: null, tone: 'neutral' }
      : { badge: 'Nessun pasto', message: 'Registra un pasto per vedere il bilancio rispetto al tuo obiettivo.', cause: null, tone: 'neutral' };
  }
  return { ...BASE[band.state], cause: causeText(band) };
}

function causeText(band: GoalBand): string | null {
  const over = band.deltaKcal > 0;
  const e = band.eatenVsPlanKcal;
  const b = band.burnedVsPlanKcal;
  switch (band.cause) {
    case 'eaten':
      return `Soprattutto per le assunte: ${formatKcal(e)} kcal ${over ? 'in più' : 'in meno'} del piano.`;
    case 'burned':
      return `Soprattutto per le bruciate: ${formatKcal(b)} kcal ${over ? 'in meno' : 'in più'} del piano.`;
    case 'both':
      return `Rispetto al piano: assunte ${formatSignedKcal(e)}, bruciate ${formatSignedKcal(b)} kcal.`;
    default:
      return null;
  }
}

// ─── The bar ────────────────────────────────────────────────────────────────

/** A round step (1, 2 or 5 × 10ⁿ) giving about four ticks across `span` kcal. */
function niceStep(span: number): number {
  const raw = span / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
}

export type GoalBarProps = {
  band: GoalBand;
  copy: GoalBandCopy;
  /** Nothing to read (a day not yet started): the strips stay grey and there is no marker. */
  inactive?: boolean;
  accessibilityLabel: string;
};

/**
 * "Obiettivo deficit / surplus": a symmetric scale of vertical strips centred
 * on the goal, with a light kcal axis under it. Surplus to the left, deficit
 * to the right; the green zone is the acceptable range around the goal. The
 * marker is where the day actually is: every time Home comes into view it
 * springs out from zero (equilibrium) to the real value, it breathes while it
 * rests, and it rests on the end of the scale when the real value lies past it.
 */
export function GoalBar({ band, copy, inactive = false, accessibilityLabel }: GoalBarProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const [barW, setBarW] = useState(0);
  const noReading = inactive || band.state === 'missing';

  const stripW = barW > 0 ? (barW - GAP * (STRIPS - 1)) / STRIPS : 0;
  const xOf = (position: number) => (barW > 0 ? stripW / 2 + ((position + 1) / 2) * (barW - stripW) : 0);

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

  // The kcal axis: round balance values across the range, equilibrium (0) included whenever it is in view.
  const ticks = useMemo(() => {
    if (barW <= 0) return [];
    const lo = band.goalKcal - band.halfRangeKcal;
    const hi = band.goalKcal + band.halfRangeKcal;
    const step = niceStep(band.halfRangeKcal * 2);
    const out: { v: number; x: number }[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      const x = xOf(balancePosition(v - band.goalKcal, band.halfRangeKcal).position);
      if (x >= TICK_W / 2 && x <= barW - TICK_W / 2) out.push({ v: Math.round(v), x });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barW, band.goalKcal, band.halfRangeKcal]);

  // The marker: out from zero to the real value each time Home is shown, springing past it a little; between values it glides.
  const targetX = xOf(band.position);
  const zeroX = xOf(balancePosition(0 - band.goalKcal, band.halfRangeKcal).position);
  const x = useSharedValue(0);
  const halo = useSharedValue(0);
  const armed = useRef(false);
  useEffect(() => {
    if (barW <= 0) return;
    if (!focused || noReading) {
      x.value = zeroX;
      armed.current = false;
      return;
    }
    if (reduceMotion) {
      x.value = targetX;
      return;
    }
    // First time (or first since Home was left): start from zero, then run out to the value.
    if (!armed.current) {
      x.value = zeroX;
      armed.current = true;
    }
    x.value = withSpring(targetX, { damping: 11, stiffness: 70, mass: 1 });
  }, [barW, focused, noReading, targetX, zeroX, reduceMotion, x]);
  useEffect(() => {
    if (!focused || reduceMotion || noReading) {
      halo.value = 0;
      return;
    }
    halo.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false);
  }, [focused, reduceMotion, noReading, halo]);

  const markerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - MARKER / 2 }] }));
  const haloStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - HALO / 2 }, { scale: 0.5 + halo.value * 0.9 }], opacity: 0.35 * (1 - halo.value) }));
  const tagStyle = useAnimatedStyle(() => ({ transform: [{ translateX: Math.min(Math.max(x.value, TAG_W / 2), Math.max(TAG_W / 2, barW - TAG_W / 2)) - TAG_W / 2 }] }));

  const goodText = theme.balanceGoalScale[3];
  const onLayout = (e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width);
  const messageColor = copy.tone === 'good' ? goodText : theme.text;

  return (
    <View style={styles.root} accessible accessibilityLabel={accessibilityLabel}>
      <View style={styles.stripsWrap} onLayout={onLayout}>
        <View style={styles.strips}>
          {colors.map((c, i) => (
            <View
              key={i}
              style={{
                width: stripW,
                height: i === MID ? STRIP_H + 4 : STRIP_H,
                borderRadius: stripW / 2,
                backgroundColor: c,
                marginLeft: i === 0 ? 0 : GAP,
              }}
            />
          ))}
        </View>
        {noReading || barW <= 0 ? null : (
          <>
            <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: theme.text }, haloStyle]} />
            <Animated.View pointerEvents="none" style={[styles.tag, { backgroundColor: theme.text }, tagStyle]}>
              <ThemedText style={[styles.tagText, { color: theme.backgroundElevated }]}>Tu</ThemedText>
            </Animated.View>
            <Animated.View pointerEvents="none" style={[styles.marker, { backgroundColor: theme.text, borderColor: theme.backgroundElevated }, markerStyle]} />
          </>
        )}
      </View>

      {/* The kcal axis, in light grey: surplus (positive balance) to the left, deficit (negative) to the right. */}
      <View style={styles.axis} pointerEvents="none">
        {ticks.map((t) => (
          <ThemedText key={t.v} style={[styles.tick, { left: t.x - TICK_W / 2 }]} themeColor="textTertiary">
            {formatSignedKcal(t.v)}
          </ThemedText>
        ))}
      </View>

      {/* The two ends' names, and the goal marked under the centre. */}
      <View style={styles.legend}>
        <ThemedText style={styles.endName} themeColor="textSecondary">
          ‹ Surplus
        </ThemedText>
        <ThemedText style={styles.endName} themeColor="textSecondary">
          Deficit ›
        </ThemedText>
        <View pointerEvents="none" style={styles.goalMark}>
          <View style={[styles.goalTip, { borderBottomColor: goodText }]} />
          <ThemedText style={[styles.goalText, { color: goodText }]}>Obiettivo</ThemedText>
        </View>
      </View>

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
    marginTop: 14,
  },
  stripsWrap: {
    height: STRIP_H + 4 + TAG_ROOM,
    justifyContent: 'flex-end',
  },
  strips: {
    flexDirection: 'row',
    alignItems: 'center',
    height: STRIP_H + 4,
  },
  marker: {
    position: 'absolute',
    left: 0,
    bottom: (STRIP_H + 4 - MARKER) / 2,
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  halo: {
    position: 'absolute',
    left: 0,
    bottom: (STRIP_H + 4 - HALO) / 2,
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
  },
  tag: {
    position: 'absolute',
    left: 0,
    top: 2,
    width: TAG_W,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  axis: {
    height: 14,
    marginTop: 6,
  },
  tick: {
    position: 'absolute',
    top: 0,
    width: TICK_W,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    minHeight: 30,
  },
  endName: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  goalMark: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -2,
    alignItems: 'center',
  },
  goalTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  goalText: {
    marginTop: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  message: {
    marginTop: 4,
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
