import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { OnBrand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection } from '@/lib/haptics';

const DOT = 30;
const SLOT = 40;
const STAGGER_MS = 70;
/** The accent ramp of the app's progress fills. */
const ACCENT_RAMP = ['#FFA11E', '#FF5A00'] as const;

export type MonthTimelineProps = {
  months: number[];
  /** The month the person is living. */
  current: number;
  selected: number;
  /** How far along the plan is, in months. Unused by the dots, kept for callers. */
  elapsedMonths?: number;
  onSelect: (month: number) => void;
  /** One label per month (its calendar name), in the same order as `months`. */
  labels?: string[];
};

/**
 * The plan's months as a row of dots with their names under them. Months behind carry a check, the one being lived
 * is the solid accent dot and breathes, the ones ahead are quiet and locked — still tappable to look at them. A thin
 * ring marks the chosen month. The dots pop in one after the other when the box opens.
 */
export function MonthTimeline({ months, current, selected, onSelect, labels }: MonthTimelineProps) {
  const short = months.length > 4;
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {months.map((m, i) => {
        const label = labels?.[i] ?? `Mese ${m}`;
        return (
          <MonthDot
            key={m}
            index={i}
            month={m}
            label={short ? label.slice(0, 3) : label}
            fullLabel={label}
            state={m < current ? 'done' : m === current ? 'running' : 'locked'}
            selected={m === selected}
            onPress={() => {
              hapticSelection();
              onSelect(m);
            }}
          />
        );
      })}
    </View>
  );
}

function MonthDot({
  index,
  month,
  label,
  fullLabel,
  state,
  selected,
  onPress,
}: {
  index: number;
  month: number;
  label: string;
  fullLabel: string;
  state: 'done' | 'running' | 'locked';
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  // Each dot pops in after the one before it.
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    enter.set(withDelay(80 + index * STAGGER_MS, withSpring(1, { damping: 14, stiffness: 220 })));
  }, [index, reduceMotion, enter]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, enter.value * 1.4), transform: [{ scale: 0.6 + 0.4 * enter.value }] }));

  // The selection ring springs in and out.
  const ring = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    ring.set(reduceMotion ? (selected ? 1 : 0) : withSpring(selected ? 1 : 0, { damping: 15, stiffness: 260 }));
  }, [selected, reduceMotion, ring]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value, transform: [{ scale: 0.8 + 0.2 * ring.value }] }));

  // The month being lived breathes: a halo that swells and fades, slowly.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (state !== 'running' || reduceMotion) return;
    pulse.set(withDelay(900, withRepeat(withSequence(withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 }), withTiming(0, { duration: 900 })), -1)));
  }, [state, reduceMotion, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 0.6 }] }));

  const stateLabel = state === 'done' ? 'concluso' : state === 'running' ? 'in corso' : 'bloccato';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${fullLabel}, ${stateLabel}`}
      style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.dotSlot}>
        <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: state === 'running' ? theme.accent : theme.text }, ringStyle]} />
        {state === 'running' ? <Animated.View pointerEvents="none" style={[styles.dot, styles.halo, { backgroundColor: theme.accent }, pulseStyle]} /> : null}
        <Animated.View style={[styles.dot, { backgroundColor: state === 'done' ? theme.text : state === 'locked' ? theme.backgroundElement : undefined }, dotStyle]}>
          {state === 'running' ? <LinearGradient colors={ACCENT_RAMP} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
          {state === 'done' ? (
            <Icon name="check" size={15} color={theme.background} />
          ) : state === 'running' ? (
            <ThemedText style={[styles.number, { color: OnBrand.text }]}>{month}</ThemedText>
          ) : (
            <Icon name="lock" size={13} color={theme.textTertiary} />
          )}
        </Animated.View>
      </View>
      <ThemedText
        numberOfLines={1}
        style={[styles.label, { color: selected ? (state === 'running' ? theme.accent : theme.text) : theme.textTertiary, fontWeight: selected ? '700' : '500' }]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const WEEK_DAYS = [7, 7, 7, 9];
const WEEK_STARTS = [0, 7, 14, 21];
const SHIMMER = 30;

/**
 * The chosen month split into its four weeks (the last runs nine days, so the four make 30): weeks behind are full,
 * the week being lived fills up to today with a slow light sweeping across it, the ones ahead are empty.
 * `daysElapsed` is how many days of the month have passed (0 … 30).
 */
export function MonthWeeksProgress({ daysElapsed }: { daysElapsed: number }) {
  const fills = WEEK_DAYS.map((len, i) => Math.min(1, Math.max(0, (daysElapsed - WEEK_STARTS[i]) / len)));
  const currentWeek = fills.findIndex((f) => f < 1);
  const running = daysElapsed > 0 && daysElapsed < 30 ? currentWeek : -1;
  return (
    <View style={styles.weeks}>
      {fills.map((f, i) => (
        <WeekSegment key={i} index={i} fill={i === running ? Math.max(f, 0.06) : f} running={i === running} />
      ))}
    </View>
  );
}

function WeekSegment({ index, fill, running }: { index: number; fill: number; running: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  const progress = useSharedValue(reduceMotion ? fill : 0);
  useEffect(() => {
    progress.set(reduceMotion ? fill : withDelay(150 + index * 110, withTiming(fill, { duration: 650, easing: Easing.out(Easing.cubic) })));
  }, [fill, index, reduceMotion, progress]);
  const fillStyle = useAnimatedStyle(() => ({ width: progress.value * width }));

  const sweep = useSharedValue(0);
  useEffect(() => {
    if (!running || reduceMotion) return;
    sweep.set(withDelay(150 + index * 110 + 650, withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 1400 }), withTiming(0, { duration: 0 })), -1)));
  }, [running, reduceMotion, index, sweep]);
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: sweep.value > 0 && sweep.value < 1 ? 1 : 0,
    transform: [{ translateX: -SHIMMER + sweep.value * (progress.value * width + SHIMMER) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.week} accessible accessibilityLabel={`Settimana ${index + 1}, ${fill >= 1 ? 'conclusa' : running ? 'in corso' : 'da iniziare'}`}>
      <View style={[styles.weekTrack, { backgroundColor: theme.backgroundElement }]} onLayout={onLayout}>
        <Animated.View style={[styles.weekFill, { backgroundColor: running ? undefined : theme.text }, fillStyle]}>
          {running ? <LinearGradient colors={ACCENT_RAMP} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
          {running ? (
            <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]}>
              <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
      <ThemedText style={[styles.weekLabel, { color: running ? theme.text : theme.textTertiary, fontWeight: running ? '600' : '500' }]} numberOfLines={1}>
        {`Sett. ${index + 1}`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  dotSlot: { width: SLOT, height: SLOT, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: SLOT, height: SLOT, borderRadius: SLOT / 2, borderWidth: 1.5 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  halo: { position: 'absolute' },
  number: { fontSize: 13, lineHeight: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { fontSize: 12, lineHeight: 15, letterSpacing: 0.1 },
  weeks: { flexDirection: 'row', gap: 5 },
  week: { flex: 1, minWidth: 0, gap: 6 },
  weekTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  weekFill: { height: '100%', borderRadius: 3, overflow: 'hidden' },
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SHIMMER },
  weekLabel: { fontSize: 11, lineHeight: 14, letterSpacing: 0.1 },
});
