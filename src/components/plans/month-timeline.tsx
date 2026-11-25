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
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection } from '@/lib/haptics';

const TRACK = 4;
const TRACK_SELECTED = 7;
const STAGGER_MS = 90;
const FILL_MS = 750;
const SHIMMER = 36;
/** The accent ramp of the app's progress fills. */
const ACCENT_RAMP = ['#FFA11E', '#FF5A00'] as const;

export type MonthTimelineProps = {
  months: number[];
  /** The month the person is living. */
  current: number;
  selected: number;
  /** How far along the plan is, in months (2.4 = 40% into the third month). */
  elapsedMonths: number;
  onSelect: (month: number) => void;
  /** One label per month (its calendar name), in the same order as `months`. */
  labels?: string[];
};

/**
 * The plan as a row of thin capsules, one per month, with the month's name under it. On opening they fill one after
 * the other from the left: months behind are full, the one being lived fills up to today in the accent colour with a
 * slow light sweeping across it, the ones ahead stay empty. The chosen month's capsule grows a little thicker and its
 * name turns bold; everything fits the width, so nothing is cut off or scrolled.
 */
export function MonthTimeline({ months, current, selected, elapsedMonths, onSelect, labels }: MonthTimelineProps) {
  const short = months.length > 4;
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {months.map((m, i) => {
        const fill = Math.min(1, Math.max(0, elapsedMonths - i));
        const label = labels?.[i] ?? `Mese ${m}`;
        return (
          <MonthSegment
            key={m}
            index={i}
            label={short ? label.slice(0, 3) : label}
            fullLabel={label}
            fill={m < current ? 1 : m === current ? Math.max(fill, 0.04) : 0}
            running={m === current}
            selected={m === selected}
            state={m < current ? 'concluso' : m === current ? 'in corso' : 'da iniziare'}
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

function MonthSegment({
  index,
  label,
  fullLabel,
  fill,
  running,
  selected,
  state,
  onPress,
}: {
  index: number;
  label: string;
  fullLabel: string;
  fill: number;
  running: boolean;
  selected: boolean;
  state: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  // The capsules fill one after the other, left to right.
  const progress = useSharedValue(reduceMotion ? fill : 0);
  useEffect(() => {
    progress.set(reduceMotion ? fill : withDelay(120 + index * STAGGER_MS, withTiming(fill, { duration: FILL_MS, easing: Easing.out(Easing.cubic) })));
  }, [fill, index, reduceMotion, progress]);
  const fillStyle = useAnimatedStyle(() => ({ width: progress.value * width }));

  // The chosen month's capsule thickens with a soft spring.
  const thick = useSharedValue(selected ? TRACK_SELECTED : TRACK);
  useEffect(() => {
    thick.set(reduceMotion ? (selected ? TRACK_SELECTED : TRACK) : withSpring(selected ? TRACK_SELECTED : TRACK, { damping: 16, stiffness: 260 }));
  }, [selected, reduceMotion, thick]);
  const trackStyle = useAnimatedStyle(() => ({ height: thick.value, borderRadius: thick.value / 2 }));

  // A slow light sweeps across the month being lived.
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (!running || reduceMotion) return;
    sweep.set(
      withDelay(
        120 + index * STAGGER_MS + FILL_MS,
        withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 1400 }), withTiming(0, { duration: 0 })), -1)
      )
    );
  }, [running, reduceMotion, index, sweep]);
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: sweep.value > 0 && sweep.value < 1 ? 1 : 0,
    transform: [{ translateX: -SHIMMER + sweep.value * (progress.value * width + SHIMMER) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${fullLabel}, ${state}`}
      hitSlop={{ top: 10, bottom: 6 }}
      style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.trackSlot} onLayout={onLayout}>
        <Animated.View style={[styles.track, { backgroundColor: theme.backgroundElement }, trackStyle]}>
          <Animated.View style={[styles.fill, { backgroundColor: running ? undefined : theme.text }, fillStyle]}>
            {running ? <LinearGradient colors={ACCENT_RAMP} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
            {running ? (
              <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]}>
                <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            ) : null}
          </Animated.View>
        </Animated.View>
      </View>
      <ThemedText
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: selected ? (running ? theme.accent : theme.text) : theme.textTertiary,
            fontWeight: selected ? '700' : '500',
          },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, paddingTop: 4 },
  cell: { flex: 1, minWidth: 0, gap: 8 },
  trackSlot: { height: TRACK_SELECTED, justifyContent: 'center' },
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%', overflow: 'hidden' },
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SHIMMER },
  label: { fontSize: 12, lineHeight: 15, letterSpacing: 0.1, textTransform: 'capitalize' },
});
