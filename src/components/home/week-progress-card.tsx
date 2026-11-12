import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useRevealedValue } from '@/components/motion/reveal';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { pickMotivation, weekAverageState, type MotivationKind, type WeekAverageState } from '@/domain/week-progress';
import { useTheme } from '@/hooks/use-theme';
import { formatSignedKcal } from '@/lib/format-kcal';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 70;
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
        <Circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke={theme.backgroundElement} strokeWidth={STROKE} />
        {fraction > 0 ? <AnimatedCircle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" animatedProps={props} transform={`rotate(-90 ${RING / 2} ${RING / 2})`} /> : null}
      </Svg>
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
}

const TONE_ICON: Record<MotivationKind, IconName> = {
  todayOnGoal: 'check',
  streak: 'flame',
  weekOnTrack: 'target',
  workoutsDone: 'trophy',
  startStreak: 'sparkle',
  keepGoing: 'sparkle',
};

/** The message at the top: its icon pops in when the card is shown, and the flame of a streak keeps breathing. */
function Banner({ kind, title, text, color }: { kind: MotivationKind; title: string; text: string; color: string }) {
  const reduceMotion = useReducedMotion();
  const enter = useRevealedValue(1, 40);
  const pulse = useSharedValue(1);
  const breathes = kind === 'streak' && !reduceMotion;
  useEffect(() => {
    pulse.set(breathes ? withRepeat(withSequence(withTiming(1.14, { duration: 700 }), withTiming(1, { duration: 700 })), -1) : 1);
  }, [breathes, pulse]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: (0.6 + 0.4 * enter.value) * pulse.value }], opacity: enter.value }));
  const textStyle = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateX: (1 - enter.value) * 10 }] }));
  return (
    <View style={[styles.banner, { backgroundColor: withAlpha(color, 0.12) }]}>
      <Animated.View style={[styles.bannerIcon, { backgroundColor: color }, iconStyle]}>
        <Icon name={TONE_ICON[kind]} size={22} color="#FFFFFF" />
      </Animated.View>
      <Animated.View style={[styles.bannerText, textStyle]}>
        <ThemedText style={styles.bannerTitle}>{title}</ThemedText>
        <ThemedText style={styles.bannerBody} themeColor="textSecondary">
          {text}
        </ThemedText>
      </Animated.View>
    </View>
  );
}

function Tile({ label, status, statusColor, statusIcon, children }: { label: string; status: string; statusColor: string; statusIcon?: IconName; children: React.ReactNode }) {
  return (
    <View style={styles.tile}>
      {children}
      <ThemedText style={styles.tileLabel} themeColor="textTertiary" numberOfLines={1}>
        {label}
      </ThemedText>
      <View style={styles.statusRow}>
        {statusIcon ? <Icon name={statusIcon} size={12} color={statusColor} /> : null}
        <ThemedText style={[styles.status, { color: statusColor }]} numberOfLines={2}>
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
 * "I tuoi progressi": how the week is going, told encouragingly. A message on
 * top picks the best news of the moment (today on goal, a tracking streak, a
 * week on track, workouts done); under it three rings — workouts, days with
 * meals logged (with the streak), and the average deficit/surplus against the
 * goal. Rings sweep and numbers count up every time Home is shown.
 */
export function WeekProgressCard(p: WeekProgressCardProps) {
  const theme = useTheme();
  const good = theme.balanceGoalScale[2];
  const goalWord = Math.abs(p.weeklyGoalKcal) < 50 ? 'pareggio' : p.weeklyGoalKcal < 0 ? 'deficit' : 'surplus';
  const average = weekAverageState(p.averageBalanceKcal, p.dailyGoalKcal, p.trackedBalanceDays);
  const motivation = pickMotivation({
    streakDays: p.streakDays,
    todayTracked: p.todayTracked,
    todayOnGoal: p.todayOnGoal,
    weekAverage: average.state,
    workoutsDone: p.workoutsDone,
    workoutsPlanned: p.workoutsPlanned,
    goalWord,
  });
  const bannerColor = motivation.kind === 'streak' ? theme.accent : motivation.kind === 'startStreak' || motivation.kind === 'keepGoing' ? theme.accent : good;

  const workoutsLeft = p.workoutsPlanned - p.workoutsDone;
  const workoutsComplete = p.workoutsPlanned > 0 && workoutsLeft <= 0;
  const workoutsStatus = p.workoutsPlanned === 0 ? 'Settimana di riposo' : workoutsComplete ? 'Tutti fatti!' : workoutsLeft === 1 ? 'Ne manca 1' : `Ne mancano ${workoutsLeft}`;
  const mealsStatus = p.streakDays >= 2 ? `${p.streakDays} giorni di fila` : p.todayTracked ? 'Oggi tracciato' : 'Registra oggi';
  const averageColor = average.state === 'onTrack' ? good : average.state === 'none' ? theme.textTertiary : theme.accent;

  return (
    <FlatCard radius={24} style={styles.card}>
      <ThemedText style={styles.heading} accessibilityRole="header">
        I tuoi progressi
      </ThemedText>
      <Banner kind={motivation.kind} title={motivation.title} text={motivation.text} color={bannerColor} />

      <View style={styles.tiles}>
        <Tile label="Allenamenti" status={workoutsStatus} statusColor={workoutsComplete ? theme.brandGreen : theme.textSecondary} statusIcon={workoutsComplete ? 'check' : undefined}>
          <Ring fraction={p.workoutsPlanned > 0 ? p.workoutsDone / p.workoutsPlanned : 0} color={theme.brandGreen} delay={120}>
            <View style={styles.centerRow}>
              <RevealCount value={p.workoutsDone} delay={120} style={styles.centerValue} />
              <ThemedText style={styles.centerOf} themeColor="textTertiary">
                /{p.workoutsPlanned}
              </ThemedText>
            </View>
          </Ring>
        </Tile>

        <Tile label="Pasti tracciati" status={mealsStatus} statusColor={p.streakDays >= 2 ? theme.accent : theme.textSecondary} statusIcon={p.streakDays >= 2 ? 'flame' : undefined}>
          <Ring fraction={p.trackedMealDays / 7} color={theme.accent} delay={220}>
            <View style={styles.centerRow}>
              <RevealCount value={p.trackedMealDays} delay={220} style={styles.centerValue} />
              <ThemedText style={styles.centerOf} themeColor="textTertiary">
                /7
              </ThemedText>
            </View>
          </Ring>
        </Tile>

        <Tile label={p.weeklyGoalKcal >= 0 ? 'Surplus medio' : 'Deficit medio'} status={AVERAGE_STATUS[average.state]} statusColor={averageColor} statusIcon={average.state === 'onTrack' ? 'check' : undefined}>
          <Ring fraction={average.closeness} color={average.state === 'onTrack' ? good : theme.accent} delay={320}>
            <View style={styles.centerCol}>
              <RevealCount value={p.averageBalanceKcal} delay={320} format={formatSignedKcal} style={styles.centerValueSmall} />
              <ThemedText style={styles.centerUnit} themeColor="textTertiary">
                kcal
              </ThemedText>
            </View>
          </Ring>
        </Tile>
      </View>
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16, gap: 12 },
  heading: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 12 },
  bannerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bannerText: { flex: 1, gap: 1 },
  bannerTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.2 },
  bannerBody: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  tiles: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  tile: { flex: 1, alignItems: 'center', gap: 6 },
  ring: { width: RING, height: RING },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  centerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 1 },
  centerCol: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  centerValue: { fontSize: 24, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5 },
  centerValueSmall: { fontSize: 16, lineHeight: 19, fontWeight: '800', letterSpacing: -0.3 },
  centerOf: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  centerUnit: { fontSize: 11, lineHeight: 12, fontWeight: '600' },
  tileLabel: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 30 },
  status: { fontSize: 12, lineHeight: 15, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
});
