import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { type GoalBand, type GoalBandState } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';

/** Odd, so one strip sits exactly on the goal. 31 keeps each strip readable down to the narrowest iPhone. */
const STRIPS = 25;
const MID = (STRIPS - 1) / 2;
const GAP = 3;
const STRIP_H = 18;
const CURSOR_W = 6;
const MOVE_MS = 700;
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

export type GoalBarProps = {
  band: GoalBand;
  copy: GoalBandCopy;
  /** Nothing to read (a day not yet started): the strips stay grey and there is no cursor. */
  inactive?: boolean;
  accessibilityLabel: string;
};

/**
 * "Obiettivo deficit / surplus": a symmetric scale of vertical strips centred
 * on the goal. Surplus to the left, deficit to the right; the green zone is
 * the acceptable range around the goal. The dark cursor is where the day
 * actually is; it glides when the numbers change and rests on the end of the
 * scale when the real value lies beyond it.
 */
export function GoalBar({ band, copy, inactive = false, accessibilityLabel }: GoalBarProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [barW, setBarW] = useState(0);
  const noReading = inactive || band.state === 'missing';

  const stripW = barW > 0 ? (barW - GAP * (STRIPS - 1)) / STRIPS : 0;
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

  // The cursor's centre, in px from the bar's left edge: strip centres span the range, so ±1 lands on the end strips.
  const targetX = barW > 0 ? stripW / 2 + ((band.position + 1) / 2) * (barW - stripW) : 0;
  const x = useSharedValue(0);
  const seen = useRef(false);
  useEffect(() => {
    if (barW <= 0) return;
    // First placement: start from the goal and glide out; afterwards glide between values.
    if (!seen.current) {
      x.value = barW / 2;
      seen.current = true;
    }
    x.value = reduceMotion ? targetX : withTiming(targetX, { duration: MOVE_MS, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  }, [barW, targetX, reduceMotion, x]);
  const cursorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - CURSOR_W / 2 }] }));

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
                borderRadius: Math.min(stripW / 2, 4),
                backgroundColor: c,
                marginLeft: i === 0 ? 0 : GAP,
              }}
            />
          ))}
        </View>
        {noReading || barW <= 0 ? null : (
          <Animated.View pointerEvents="none" style={[styles.cursor, { backgroundColor: theme.text, borderColor: theme.backgroundElevated }, cursorStyle]} />
        )}
      </View>

      {/* Under the bar: the two ends, and the goal marked under the centre. */}
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
    height: STRIP_H + 4,
    justifyContent: 'center',
  },
  strips: {
    flexDirection: 'row',
    alignItems: 'center',
    height: STRIP_H + 4,
  },
  cursor: {
    position: 'absolute',
    left: 0,
    top: -4,
    width: CURSOR_W,
    height: STRIP_H + 12,
    borderRadius: CURSOR_W / 2,
    borderWidth: 1.5,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
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
    top: -4,
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
