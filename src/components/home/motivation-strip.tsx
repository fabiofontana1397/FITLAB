import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useRevealedValue } from '@/components/motion/reveal';
import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { OnBrand } from '@/constants/theme';
import { pickMotivation, weekAverageState, type MotivationKind } from '@/domain/week-progress';
import { useTheme } from '@/hooks/use-theme';

const ICON: Record<MotivationKind, IconName> = {
  todayOnGoal: 'check',
  streak: 'flame',
  weekOnTrack: 'target',
  workoutsDone: 'trophy',
  startStreak: 'sparkle',
  keepGoing: 'bolt',
};

/** Fire while there is something to do (start or keep a streak), green once a goal is met. */
const TONE = {
  fire: { colors: ['#FF9A3D', '#F25A00'] as const, ink: '#F26A12' },
  good: { colors: ['#3CCB80', '#139A5B'] as const, ink: '#17995A' },
};

/** The message, short enough for two lines of the slim box. */
function shortText(kind: MotivationKind, streakDays: number, goalWord: string): string {
  switch (kind) {
    case 'todayOnGoal':
      return goalWord === 'pareggio' ? 'Bilancio di oggi in equilibrio, come da piano.' : `Il ${goalWord} di oggi è quello del piano.`;
    case 'streak':
      return streakDays >= 7 ? 'Tracciare è ormai un’abitudine: continua così.' : 'Serie attiva: registra anche domani.';
    case 'weekOnTrack':
      return 'Media in linea con l’obiettivo: tieni il ritmo.';
    case 'workoutsDone':
      return 'Tutte le sessioni della settimana fatte.';
    case 'startStreak':
      return streakDays === 1 ? 'Registra oggi e la serie sale a 2 giorni.' : 'Registra il primo pasto di oggi per partire.';
    default:
      return 'Ogni pasto rende la settimana più precisa.';
  }
}

const STRIP_H = 72;
const SHEEN_W = 90;

export type MotivationStripProps = {
  streakDays: number;
  todayTracked: boolean;
  todayOnGoal: boolean;
  averageBalanceKcal: number;
  trackedBalanceDays: number;
  dailyGoalKcal: number;
  weeklyGoalKcal: number;
  workoutsDone: number;
  workoutsPlanned: number;
  /** Monday to Sunday: that day has meals logged. */
  weekTracked: boolean[];
  /** Today's place in the week (0 = Monday). */
  todayIndex: number;
  /** Tapped while today is still to track: register a meal. */
  onRegisterMeal?: () => void;
};

/**
 * The as-is in one line, under the day's gauge: how the person is doing right now (today on goal, a streak,
 * a week on track, workouts done, or the day still to start), told encouragingly. A slim premium box: the
 * tone's gradient badge breathing on the left, a soft wash of the same colour, a light sheen passing now and
 * then, and the week's tracked days as seven small dots on the right.
 */
export function MotivationStrip(p: MotivationStripProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const dark = theme.tabBarBlur === 'dark';
  const goalWord = Math.abs(p.weeklyGoalKcal) < 50 ? 'pareggio' : p.weeklyGoalKcal < 0 ? 'deficit' : 'surplus';
  const average = weekAverageState(p.averageBalanceKcal, p.dailyGoalKcal, p.trackedBalanceDays);
  const m = pickMotivation({
    streakDays: p.streakDays,
    todayTracked: p.todayTracked,
    todayOnGoal: p.todayOnGoal,
    weekAverage: average.state,
    workoutsDone: p.workoutsDone,
    workoutsPlanned: p.workoutsPlanned,
    goalWord,
  });
  const tone = m.kind === 'todayOnGoal' || m.kind === 'weekOnTrack' || m.kind === 'workoutsDone' ? TONE.good : TONE.fire;
  const body = shortText(m.kind, p.streakDays, goalWord);
  const actionable = !p.todayTracked && p.onRegisterMeal != null;

  // Enter: the badge pops, the text rises. Then the badge breathes and a sheen crosses the box every few seconds.
  const enter = useRevealedValue(1, 80);
  const pulse = useSharedValue(1);
  const sheen = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      pulse.set(1);
      sheen.set(0);
      return;
    }
    pulse.set(withRepeat(withSequence(withTiming(1.08, { duration: 1100 }), withTiming(1, { duration: 1100 })), -1));
    sheen.set(withRepeat(withSequence(withDelay(1400, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) })), withTiming(0, { duration: 0 }), withDelay(4200, withTiming(0, { duration: 0 }))), -1));
  }, [reduceMotion, pulse, sheen]);
  const badgeStyle = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ scale: (0.6 + 0.4 * enter.value) * pulse.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: (1 - enter.value) * 6 }] }));
  const sheenStyle = useAnimatedStyle(() => ({ opacity: sheen.value > 0 && sheen.value < 1 ? 1 : 0, transform: [{ translateX: -SHEEN_W + sheen.value * 460 }, { skewX: '-18deg' }] }));

  const tracked = p.weekTracked.filter(Boolean).length;
  const content = (
    <FlatCard radius={24} style={styles.card}>
      <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
        <LinearGradient colors={[tone.colors[0] + (dark ? '30' : '22'), tone.colors[0] + '00']} start={{ x: 0, y: 0.5 }} end={{ x: 0.75, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.sheen, sheenStyle]}>
          <LinearGradient colors={['#FFFFFF00', dark ? '#FFFFFF14' : '#FFFFFF8C', '#FFFFFF00']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>

      <Animated.View style={badgeStyle}>
        <LinearGradient colors={tone.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
          <Icon name={ICON[m.kind]} size={20} color={OnBrand.text} />
        </LinearGradient>
      </Animated.View>

      <Animated.View style={[styles.text, textStyle]}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {m.title}
        </ThemedText>
        <ThemedText style={styles.body} themeColor="textSecondary" numberOfLines={2}>
          {body}
        </ThemedText>
      </Animated.View>

      <View style={styles.week} accessibilityLabel={`Giorni tracciati questa settimana: ${tracked} su 7`}>
        <ThemedText style={[styles.weekCount, { color: tone.ink }]}>
          {tracked}
          <ThemedText style={styles.weekOf} themeColor="textTertiary">
            /7
          </ThemedText>
        </ThemedText>
        <View style={styles.dots}>
          {p.weekTracked.map((t, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                t
                  ? { backgroundColor: tone.ink }
                  : i === p.todayIndex
                    ? { borderWidth: 1.5, borderColor: tone.ink }
                    : { backgroundColor: theme.backgroundSelected },
              ]}
            />
          ))}
        </View>
      </View>
    </FlatCard>
  );

  return actionable ? (
    <PressableScale onPress={p.onRegisterMeal} haptic="press" scaleTo={0.98} style={styles.wrap} accessibilityRole="button" accessibilityLabel={`${m.title}. ${body} Registra un pasto.`} testID="motivation-strip">
      {content}
    </PressableScale>
  ) : (
    <View style={styles.wrap} accessible accessibilityLabel={`${m.title}. ${body}`} testID="motivation-strip">
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  card: { minHeight: STRIP_H, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 12, paddingRight: 14 },
  clip: { borderRadius: 24, overflow: 'hidden' },
  sheen: { position: 'absolute', top: -10, bottom: -10, left: 0, width: SHEEN_W },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, lineHeight: 18, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  week: { alignItems: 'flex-end', gap: 5 },
  weekCount: { fontSize: 18, lineHeight: 21, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  weekOf: { fontSize: 12, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
