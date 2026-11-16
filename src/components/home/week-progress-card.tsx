import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
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

import { AnimatedFill } from '@/components/motion/animated-fill';
import { PressableScale } from '@/components/motion/pressable-scale';
import { useRevealedValue } from '@/components/motion/reveal';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { acceptableRange, balanceHalfRange } from '@/domain/calorie-balance';
import { OnBrand } from '@/constants/theme';
import { nextStreakMilestone, pickMotivation, weekAverageState, type MotivationKind, type WeekAverageState } from '@/domain/week-progress';
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

const TONE_ICON: Record<MotivationKind, IconName> = {
  todayOnGoal: 'check',
  streak: 'flame',
  weekOnTrack: 'target',
  workoutsDone: 'trophy',
  startStreak: 'sparkle',
  keepGoing: 'bolt',
};

/** The message box is the colour: fire for a streak and for the invitation to track, green for a goal met. Same in both schemes. */
const HERO_FIRE = ['#FF8A1F', '#F4511E', '#D8311F'] as const;
const HERO_GOOD = ['#2FBF71', '#17995A', '#0B7A5C'] as const;
const HERO_INK: Record<'fire' | 'good', string> = { fire: '#D8401B', good: '#0F7F55' };

const WEEK_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

/** A soft light drifting slowly inside the message box, so the colour is never still. */
function Glow({ size, top, left, drift, duration }: { size: number; top: number; left: number; drift: number; duration: number }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(reduceMotion ? 0 : withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduceMotion, duration, t]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: t.value * drift }, { translateY: t.value * drift * 0.5 }, { scale: 1 + t.value * 0.12 }] }));
  return <Animated.View pointerEvents="none" style={[styles.glow, { width: size, height: size, borderRadius: size / 2, top, left }, style]} />;
}

/** One day of the week in the message box: a white tick once tracked, a breathing ring for today still to track. */
function DayDot({ letter, tracked, today, future, delay, ink }: { letter: string; tracked: boolean; today: boolean; future: boolean; delay: number; ink: string }) {
  const reduceMotion = useReducedMotion();
  const enter = useRevealedValue(1, delay);
  const pulse = useSharedValue(1);
  const breathes = today && !tracked && !reduceMotion;
  useEffect(() => {
    pulse.set(breathes ? withRepeat(withSequence(withTiming(1.16, { duration: 800 }), withTiming(1, { duration: 800 })), -1) : 1);
  }, [breathes, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ scale: (0.5 + 0.5 * enter.value) * pulse.value }] }));
  return (
    <View style={styles.day}>
      <Animated.View
        style={[
          styles.dayDot,
          tracked ? { backgroundColor: OnBrand.text } : today ? { borderWidth: 2, borderColor: OnBrand.text } : { backgroundColor: future ? 'rgba(255,255,255,0.14)' : OnBrand.fillStrong },
          style,
        ]}>
        {tracked ? <Icon name="check" size={14} color={ink} /> : null}
      </Animated.View>
      <ThemedText style={[styles.dayLetter, { color: today ? OnBrand.text : OnBrand.textFaint }]}>{letter}</ThemedText>
    </View>
  );
}

type HeroProps = {
  kind: MotivationKind;
  title: string;
  text: string;
  streakDays: number;
  todayTracked: boolean;
  /** Monday to Sunday: that day has meals logged. */
  weekTracked: boolean[];
  /** Today's place in the week (0 = Monday). */
  todayIndex: number;
  onRegisterMeal?: () => void;
};

/**
 * The motivational message as its own box: a full colour gradient with lights drifting inside, the icon
 * breathing, the week's tracked days as dots, and the next step — "Registra un pasto" while today is still to
 * track, the next streak milestone once it is.
 */
function MotivationHero({ kind, title, text, streakDays, todayTracked, weekTracked, todayIndex, onRegisterMeal }: HeroProps) {
  const reduceMotion = useReducedMotion();
  const tone = kind === 'todayOnGoal' || kind === 'weekOnTrack' || kind === 'workoutsDone' ? 'good' : 'fire';
  const enter = useRevealedValue(1, 40);
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.set(reduceMotion ? 1 : withRepeat(withSequence(withTiming(1.12, { duration: 900 }), withTiming(1, { duration: 900 })), -1));
  }, [reduceMotion, pulse]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: (0.6 + 0.4 * enter.value) * pulse.value }], opacity: enter.value }));
  const textStyle = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: (1 - enter.value) * 8 }] }));

  const eyebrow = streakDays >= 2 ? `Serie di ${streakDays} giorni` : todayTracked ? 'Oggi tracciato' : 'Oggi tocca a te';
  const milestone = nextStreakMilestone(streakDays);
  const toGo = milestone - streakDays;
  return (
    <LinearGradient colors={tone === 'good' ? HERO_GOOD : HERO_FIRE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <Glow size={170} top={-70} left={-40} drift={26} duration={5200} />
      <Glow size={150} top={150} left={230} drift={-22} duration={6400} />

      <View style={styles.heroTop}>
        <Animated.View style={[styles.heroIcon, iconStyle]}>
          <Icon name={TONE_ICON[kind]} size={24} color={HERO_INK[tone]} />
        </Animated.View>
        <View style={styles.eyebrow}>
          <Icon name="flame" size={12} color={OnBrand.text} />
          <ThemedText style={styles.eyebrowText}>{eyebrow}</ThemedText>
        </View>
      </View>

      <Animated.View style={[styles.heroText, textStyle]}>
        <ThemedText style={styles.heroTitle} accessibilityRole="header">
          {title}
        </ThemedText>
        <ThemedText style={styles.heroBody}>{text}</ThemedText>
      </Animated.View>

      <View style={styles.days} accessibilityLabel={`Giorni tracciati questa settimana: ${weekTracked.filter(Boolean).length} su 7`}>
        {WEEK_LETTERS.map((letter, i) => (
          <DayDot key={i} letter={letter} tracked={weekTracked[i] ?? false} today={i === todayIndex} future={i > todayIndex} delay={160 + i * 60} ink={HERO_INK[tone]} />
        ))}
      </View>

      {!todayTracked && onRegisterMeal ? (
        <PressableScale onPress={onRegisterMeal} haptic="press" style={styles.heroCta} accessibilityRole="button" accessibilityLabel="Registra un pasto" testID="progress-register-meal">
          <Icon name="plus" size={18} color={HERO_INK[tone]} />
          <ThemedText style={[styles.heroCtaText, { color: HERO_INK[tone] }]}>Registra un pasto</ThemedText>
        </PressableScale>
      ) : (
        <View style={styles.milestone}>
          <View style={styles.milestoneLine}>
            <ThemedText style={styles.milestoneLabel}>Prossimo traguardo: {milestone} giorni</ThemedText>
            <ThemedText style={styles.milestoneLabel}>{toGo === 1 ? 'manca 1 giorno' : `mancano ${toGo} giorni`}</ThemedText>
          </View>
          <View style={styles.milestoneTrack}>
            <AnimatedFill progress={streakDays / milestone} delay={420} style={styles.milestoneFill} />
          </View>
        </View>
      )}
    </LinearGradient>
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
  /** Monday to Sunday: that day has meals logged. */
  weekTracked: boolean[];
  /** Today's place in the week (0 = Monday). */
  todayIndex: number;
  /** The message's own call to action while today is still to track. */
  onRegisterMeal?: () => void;
};

const AVERAGE_STATUS: Record<WeekAverageState, string> = {
  none: 'Registra i pasti',
  onTrack: 'In linea con l’obiettivo',
  close: 'Quasi in linea',
  off: 'Puoi riequilibrare',
};

/**
 * "I tuoi progressi": how the week is going, told encouragingly, in two boxes.
 * First the message — a coloured, moving box that picks the best news of the
 * moment (today on goal, a tracking streak, a week on track, workouts done) and
 * invites the next step. Under it the indicators: workouts, days with meals
 * logged, and a scale for the average deficit/surplus against the goal. Rings
 * sweep and numbers count up every time Home is shown.
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

  const workoutsLeft = p.workoutsPlanned - p.workoutsDone;
  const workoutsComplete = p.workoutsPlanned > 0 && workoutsLeft <= 0;
  const workoutsStatus = p.workoutsPlanned === 0 ? 'Settimana di riposo' : workoutsComplete ? 'Tutti fatti!' : workoutsLeft === 1 ? 'Ne manca 1' : `Ne mancano ${workoutsLeft}`;
  const mealsStatus = p.streakDays >= 2 ? `${p.streakDays} giorni di fila` : p.todayTracked ? 'Oggi tracciato' : 'Registra oggi';
  const averageColor = average.state === 'onTrack' ? good : average.state === 'none' ? theme.textTertiary : theme.accent;
  const tintAlpha = theme.tabBarBlur === 'dark' ? 0.14 : 0.09;

  return (
    <View style={styles.wrap}>
      <MotivationHero
        kind={motivation.kind}
        title={motivation.title}
        text={motivation.text}
        streakDays={p.streakDays}
        todayTracked={p.todayTracked}
        weekTracked={p.weekTracked}
        todayIndex={p.todayIndex}
        onRegisterMeal={p.onRegisterMeal}
      />

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
  wrap: { marginTop: 12, gap: 12 },
  hero: { borderRadius: 24, padding: 16, gap: 14, overflow: 'hidden' },
  glow: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.13)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: OnBrand.text },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: OnBrand.fill },
  eyebrowText: { color: OnBrand.text, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  heroText: { gap: 4 },
  heroTitle: { color: OnBrand.text, fontSize: 24, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5 },
  heroBody: { color: OnBrand.textMuted, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 4, width: 32 },
  dayDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dayLetter: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  heroCta: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: OnBrand.text },
  heroCtaText: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  milestone: { gap: 6 },
  milestoneLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  milestoneLabel: { color: OnBrand.textMuted, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  milestoneTrack: { height: 6, borderRadius: 3, backgroundColor: OnBrand.fillStrong, overflow: 'hidden' },
  milestoneFill: { height: 6, borderRadius: 3, backgroundColor: OnBrand.text },
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
