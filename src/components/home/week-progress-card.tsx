import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedProps, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useRevealedValue } from '@/components/motion/reveal';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { acceptableRange, balanceHalfRange } from '@/domain/calorie-balance';
import { weekAverageState, type WeekAverageState } from '@/domain/week-progress';
import { useTheme } from '@/hooks/use-theme';
import { formatSignedKcal } from '@/lib/format-kcal';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 68;
const STROKE = 8;

function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/** A number that counts up from 0 when its section comes into view (every time Home is shown) and follows later changes. */
function RevealCount({ value, delay = 0, format = (n: number) => String(Math.round(n)), style }: { value: number; delay?: number; format?: (n: number) => string; style?: object }) {
  const v = useRevealedValue(value, delay);
  const [shown, setShown] = useState(0);
  useAnimatedReaction(
    () => Math.round(v.value),
    (next, previous) => {
      if (next !== previous) runOnJS(setShown)(next);
    }
  );
  return (
    <ThemedText style={[{ fontVariant: ['tabular-nums'] }, style]} numberOfLines={1} adjustsFontSizeToFit>
      {format(shown)}
    </ThemedText>
  );
}

/** A ring that sweeps clockwise from 12 o'clock to `fraction` when its section comes into view, with `children` in the middle. */
function Ring({ fraction, color, delay, children }: { fraction: number; color: string; delay: number; children: React.ReactNode }) {
  const theme = useTheme();
  const value = useRevealedValue(clamp01(fraction), delay);
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const props = useAnimatedProps(() => ({ strokeDasharray: `${Math.max(value.value, 0.012) * c} ${c}` }));
  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke={withAlpha(color, theme.tabBarBlur === 'dark' ? 0.22 : 0.16)} strokeWidth={STROKE} />
        {fraction > 0 ? <AnimatedCircle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" animatedProps={props} transform={`rotate(-90 ${RING / 2} ${RING / 2})`} /> : null}
      </Svg>
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
}

const BAR_W = 76;
const BAR_H = 10;
const DOT = 18;

/**
 * The average daily balance on a short horizontal scale centred on the daily goal: the acceptable range is the
 * green band, the goal a tick in the middle, and a dot glides from the goal to where the week really sits
 * (deficit to the right, surplus to the left, like the day's gauge). The value stays above it.
 */
function AverageGauge({ average, goalKcal, state, color, hasData }: { average: number; goalKcal: number; state: WeekAverageState; color: string; hasData: boolean }) {
  const theme = useTheme();
  const half = balanceHalfRange(goalKcal);
  const tolerance = acceptableRange(goalKcal);
  const pos = clamp01(0.5 - (average - goalKcal) / (2 * half));
  const t = useRevealedValue(hasData ? 1 : 0, 320);
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (0.5 + (pos - 0.5) * t.value) * BAR_W - DOT / 2 }], opacity: t.value }));
  const zoneW = Math.min(1, tolerance / half) * BAR_W;
  const zoneColor = withAlpha(theme.balanceGoalScale[2], 0.35);
  return (
    <View style={styles.gauge}>
      <View style={styles.gaugeValue}>
        <RevealCount value={average} delay={320} format={formatSignedKcal} style={styles.gaugeNumber} />
        <ThemedText style={styles.centerUnit} themeColor="textTertiary">
          kcal al giorno
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.zone, { width: zoneW, left: (BAR_W - zoneW) / 2, backgroundColor: zoneColor }]} />
        <View style={[styles.goalTick, { backgroundColor: theme.textSecondary }]} />
        {hasData ? (
          <Animated.View style={[styles.dot, { backgroundColor: state === 'onTrack' ? theme.balanceGoalScale[2] : color, borderColor: theme.backgroundElevated }, dotStyle]} />
        ) : null}
      </View>
    </View>
  );
}

function Tile({ label, status, statusColor, statusIcon, tint, children }: { label: string; status: string; statusColor: string; statusIcon?: IconName; tint: string; children: React.ReactNode }) {
  return (
    <View style={[styles.tile, { backgroundColor: tint }]}>
      {children}
      <ThemedText style={styles.tileLabel} themeColor="textSecondary" numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </ThemedText>
      <View style={styles.statusRow}>
        {statusIcon ? <Icon name={statusIcon} size={12} color={statusColor} /> : null}
        <ThemedText style={[styles.status, { color: statusColor }]} numberOfLines={2} adjustsFontSizeToFit>
          {status}
        </ThemedText>
      </View>
    </View>
  );
}

export type WeekProgressCardProps = {
  workoutsDone: number;
  workoutsPlanned: number;
  trackedMealDays: number;
  /** Days in a row with meals logged (see trackingStreak). */
  streakDays: number;
  todayTracked: boolean;
  /** Today's balance is inside the acceptable range around the day's goal. */
  todayOnGoal: boolean;
  averageBalanceKcal: number;
  trackedBalanceDays: number;
  dailyGoalKcal: number;
  weeklyGoalKcal: number;
};

const AVERAGE_STATUS: Record<WeekAverageState, string> = {
  none: 'Registra i pasti',
  onTrack: 'In linea con l’obiettivo',
  close: 'Quasi in linea',
  off: 'Puoi riequilibrare',
};

/**
 * "I tuoi progressi": how the week is going — workouts, days with meals logged,
 * and a scale for the average deficit/surplus against the goal. The motivational
 * message lives in its own slim box under the day's gauge (MotivationStrip). Rings
 * sweep and numbers count up every time Home is shown.
 */
export function WeekProgressCard(p: WeekProgressCardProps) {
  const theme = useTheme();
  const good = theme.balanceGoalScale[2];
  const average = weekAverageState(p.averageBalanceKcal, p.dailyGoalKcal, p.trackedBalanceDays);

  const workoutsLeft = p.workoutsPlanned - p.workoutsDone;
  const workoutsComplete = p.workoutsPlanned > 0 && workoutsLeft <= 0;
  const workoutsStatus = p.workoutsPlanned === 0 ? 'Settimana di riposo' : workoutsComplete ? 'Tutti fatti!' : workoutsLeft === 1 ? 'Ne manca 1' : `Ne mancano ${workoutsLeft}`;
  const mealsStatus = p.streakDays >= 2 ? `${p.streakDays} giorni di fila` : p.todayTracked ? 'Oggi tracciato' : 'Registra oggi';
  const averageColor = average.state === 'onTrack' ? good : average.state === 'none' ? theme.textTertiary : theme.accent;
  const tintAlpha = theme.tabBarBlur === 'dark' ? 0.14 : 0.09;

  return (
    <View style={styles.wrap}>
      <FlatCard radius={24} style={styles.card}>
        <ThemedText style={styles.heading} accessibilityRole="header">
          I tuoi progressi
        </ThemedText>
        <View style={styles.tiles}>
          <Tile
            label="Allenamenti"
            tint={withAlpha(theme.brandGreen, tintAlpha)}
            status={workoutsStatus}
            statusColor={workoutsComplete ? theme.brandGreen : theme.text}
            statusIcon={workoutsComplete ? 'check' : undefined}>
            <Ring fraction={p.workoutsPlanned > 0 ? p.workoutsDone / p.workoutsPlanned : 0} color={theme.brandGreen} delay={120}>
              <View style={styles.centerRow}>
                <RevealCount value={p.workoutsDone} delay={120} style={styles.centerValue} />
                <ThemedText style={styles.centerOf} themeColor="textSecondary">
                  /{p.workoutsPlanned}
                </ThemedText>
              </View>
            </Ring>
          </Tile>

          <Tile
            label="Pasti tracciati"
            tint={withAlpha(theme.accent, tintAlpha)}
            status={mealsStatus}
            statusColor={p.streakDays >= 2 ? theme.accent : theme.text}
            statusIcon={p.streakDays >= 2 ? 'flame' : undefined}>
            <Ring fraction={p.trackedMealDays / 7} color={theme.accent} delay={220}>
              <View style={styles.centerRow}>
                <RevealCount value={p.trackedMealDays} delay={220} style={styles.centerValue} />
                <ThemedText style={styles.centerOf} themeColor="textSecondary">
                  /7
                </ThemedText>
              </View>
            </Ring>
          </Tile>

          <Tile
            label={p.weeklyGoalKcal >= 0 ? 'Surplus medio' : 'Deficit medio'}
            tint={theme.backgroundElement}
            status={AVERAGE_STATUS[average.state]}
            statusColor={average.state === 'none' ? theme.text : averageColor}
            statusIcon={average.state === 'onTrack' ? 'check' : undefined}>
            <AverageGauge average={p.averageBalanceKcal} goalKcal={p.dailyGoalKcal} state={average.state} color={averageColor} hasData={p.trackedBalanceDays > 0} />
          </Tile>
        </View>
      </FlatCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 10 },
  card: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12, gap: 12 },
  heading: { paddingHorizontal: 2, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  tiles: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  tile: { flex: 1, alignItems: 'center', gap: 6, borderRadius: 18, paddingTop: 12, paddingBottom: 8, paddingHorizontal: 6 },
  ring: { width: RING, height: RING },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  centerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 1 },
  centerValue: { fontSize: 24, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5 },
  gauge: { alignSelf: 'stretch', height: RING, alignItems: 'center', justifyContent: 'center', gap: 10 },
  gaugeValue: { alignSelf: 'stretch', alignItems: 'center', gap: 1 },
  gaugeNumber: { fontSize: 20, lineHeight: 24, fontWeight: '800', letterSpacing: -0.4 },
  track: { width: BAR_W, height: BAR_H, borderRadius: BAR_H / 2, justifyContent: 'center' },
  zone: { position: 'absolute', top: 0, bottom: 0, borderRadius: BAR_H / 2 },
  goalTick: { position: 'absolute', left: BAR_W / 2 - 1, top: -3, width: 2, height: BAR_H + 6, borderRadius: 1 },
  dot: { position: 'absolute', left: 0, width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 3 },
  centerOf: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  centerUnit: { fontSize: 11, lineHeight: 12, fontWeight: '600' },
  tileLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 30 },
  status: { fontSize: 12, lineHeight: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
});
