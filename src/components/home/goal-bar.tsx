import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { type GoalBand, type GoalBandState } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';

/** Odd, so one strip sits exactly on the goal. 31 keeps each strip readable down to the narrowest iPhone. */
const STRIPS = 31;
const MID = (STRIPS - 1) / 2;
const GAP = 3;
const STRIP_H = 36;
const CURSOR_W = 8;
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
  /** Short pill on the gauge. */
  badge: string;
  /** Heading of the status card. */
  title: string;
  message: string;
  /** What the gap mostly depends on (intake or burned), when there is one. */
  cause: string | null;
  tone: 'good' | 'warn' | 'neutral';
  icon: IconName;
};

const BASE: Record<Exclude<GoalBandState, 'missing'>, { badge: string; title: string; message: string; tone: 'good' | 'warn'; icon: IconName }> = {
  reached: { badge: 'Obiettivo in range', title: 'Obiettivo raggiunto', message: 'Sei nel range previsto, continua così!', tone: 'good', icon: 'check' },
  surplus: { badge: 'Surplus eccessivo', title: 'Surplus eccessivo', message: 'Hai assunto più calorie rispetto al tuo obiettivo', tone: 'warn', icon: 'trendUp' },
  deficit: { badge: 'Deficit eccessivo', title: 'Deficit eccessivo', message: 'Il deficit calorico è superiore al target previsto', tone: 'warn', icon: 'trendDown' },
  deficitShort: { badge: 'Deficit insufficiente', title: 'Deficit insufficiente', message: 'Sei ancora lontano dal deficit calorico desiderato', tone: 'warn', icon: 'trendUp' },
  surplusShort: { badge: 'Surplus insufficiente', title: 'Surplus insufficiente', message: 'Sei ancora lontano dal surplus calorico desiderato', tone: 'warn', icon: 'trendDown' },
};

export function goalBandCopy(band: GoalBand, { hasMeals, future }: { hasMeals: boolean; future: boolean }): GoalBandCopy {
  if (future) return { badge: 'Nessun dato', title: 'Giorno non ancora iniziato', message: 'Qui vedrai il bilancio rispetto al tuo obiettivo.', cause: null, tone: 'neutral', icon: 'info' };
  if (band.state === 'missing') {
    return hasMeals
      ? { badge: 'Dati insufficienti', title: 'Dati insufficienti', message: 'Mancano le calorie bruciate per leggere il bilancio.', cause: null, tone: 'neutral', icon: 'info' }
      : { badge: 'Nessun pasto', title: 'Nessun pasto registrato', message: 'Registra un pasto per vedere il bilancio rispetto al tuo obiettivo.', cause: null, tone: 'neutral', icon: 'info' };
  }
  const base = BASE[band.state];
  return { ...base, cause: causeText(band) };
}

function causeText(band: GoalBand): string | null {
  const over = band.deltaKcal > 0;
  const e = band.eatenVsPlanKcal;
  const b = band.burnedVsPlanKcal;
  switch (band.cause) {
    case 'eaten':
      return `Dipende soprattutto dalle calorie assunte: ${formatKcal(e)} kcal ${over ? 'in più' : 'in meno'} del piano.`;
    case 'burned':
      return `Dipende soprattutto dalle calorie bruciate: ${formatKcal(b)} kcal ${over ? 'in meno' : 'in più'} del piano.`;
    case 'both':
      return `Rispetto al piano: assunte ${formatSignedKcal(e)} kcal, bruciate ${formatSignedKcal(b)} kcal.`;
    default:
      return null;
  }
}

// ─── The bar ────────────────────────────────────────────────────────────────

export type GoalBarProps = {
  band: GoalBand;
  /** The goal as shown in the bubble ("+190 kcal"). */
  goalText: string;
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
export function GoalBar({ band, goalText, inactive = false, accessibilityLabel }: GoalBarProps) {
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
  const goodLine = theme.balanceGoalScale[2];
  const zoneW = barW * (band.toleranceKcal / band.halfRangeKcal);
  const onLayout = (e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width);

  return (
    <View style={styles.root} accessible accessibilityLabel={accessibilityLabel}>
      <ThemedText style={styles.title}>Obiettivo deficit / surplus</ThemedText>

      {/* The target's label, hanging over the centre strip. */}
      <View style={styles.bubbleWrap}>
        <View style={[styles.bubble, { borderColor: goodLine, backgroundColor: theme.successSoft }]}>
          <ThemedText style={[styles.bubbleText, { color: goodText }]}>Obiettivo</ThemedText>
          <ThemedText style={[styles.bubbleText, { color: goodText }]}>{goalText}</ThemedText>
        </View>
        <View style={[styles.bubbleTip, { borderColor: goodLine, backgroundColor: theme.successSoft }]} />
      </View>

      <View style={styles.stripsWrap} onLayout={onLayout}>
        <View style={styles.strips}>
          {colors.map((c, i) => (
            <View
              key={i}
              style={{
                width: stripW,
                height: i === MID ? STRIP_H + 6 : STRIP_H,
                borderRadius: Math.min(stripW / 2, 5),
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

      {/* Under the bar: the two ends' names, and the acceptable range bracketed around the goal. */}
      <View style={styles.legend}>
        <View style={styles.legendSide}>
          <ThemedText style={styles.endName} themeColor="textSecondary">
            Surplus
          </ThemedText>
          <ThemedText style={styles.endHint} themeColor="textSecondary">
            (mangiato troppo)
          </ThemedText>
        </View>
        <View style={[styles.legendMid, { width: Math.max(130, zoneW) }]}>
          <View style={[styles.bracket, { borderColor: goodLine, width: Math.max(24, zoneW) }]}>
            <View style={[styles.bracketTick, { backgroundColor: goodLine }]} />
          </View>
          <ThemedText style={[styles.rangeText, { color: goodText }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            Range accettabile
          </ThemedText>
        </View>
        <View style={[styles.legendSide, { alignItems: 'flex-end' }]}>
          <ThemedText style={styles.endName} themeColor="textSecondary">
            Deficit eccessivo
          </ThemedText>
          <ThemedText style={[styles.endHint, { textAlign: 'right' }]} themeColor="textSecondary">
            (bruciato/mangiato troppo poco)
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

/** The dynamic message under the bar: what the day amounts to, and what the gap mostly depends on. */
export function GoalStatusCard({ copy }: { copy: GoalBandCopy }) {
  const theme = useTheme();
  const color = copy.tone === 'good' ? theme.balanceGoalScale[3] : copy.tone === 'warn' ? theme.accent : theme.textSecondary;
  const disc = copy.tone === 'good' ? theme.brandGreen : copy.tone === 'warn' ? theme.accent : theme.textTertiary;
  const bg = copy.tone === 'good' ? theme.successSoft : copy.tone === 'warn' ? theme.accentSoft : theme.backgroundElement;
  return (
    <View style={[styles.status, { backgroundColor: bg }]} accessible accessibilityRole="summary" accessibilityLabel={[copy.title, copy.message, copy.cause].filter(Boolean).join('. ')}>
      <View style={[styles.statusDisc, { backgroundColor: disc }]}>
        <Icon name={copy.icon} size={22} color="#FFFFFF" />
      </View>
      <View style={[styles.statusDivider, { backgroundColor: theme.border }]} />
      <View style={styles.statusText}>
        <ThemedText style={[styles.statusTitle, { color }]}>{copy.title}</ThemedText>
        <ThemedText style={styles.statusMessage} themeColor="textSecondary">
          {copy.message}
        </ThemedText>
        {copy.cause ? (
          <ThemedText style={styles.statusCause} themeColor="textSecondary">
            {copy.cause}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    marginTop: 18,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  bubbleWrap: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  bubbleText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
  bubbleTip: {
    width: 10,
    height: 10,
    marginTop: -6,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  stripsWrap: {
    height: STRIP_H + 6,
    justifyContent: 'center',
  },
  strips: {
    flexDirection: 'row',
    alignItems: 'center',
    height: STRIP_H + 6,
  },
  cursor: {
    position: 'absolute',
    left: 0,
    top: -3,
    width: CURSOR_W,
    height: STRIP_H + 12,
    borderRadius: CURSOR_W / 2,
    borderWidth: 1.5,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
  },
  legendSide: {
    flex: 1,
    gap: 1,
  },
  legendMid: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  endName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  endHint: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  bracket: {
    height: 8,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bracketTick: {
    width: 1.5,
    height: 6,
    marginBottom: -1.5,
  },
  rangeText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  statusDisc: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  statusText: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statusMessage: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  statusCause: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    marginTop: 2,
  },
});
