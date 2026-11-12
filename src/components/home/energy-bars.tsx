import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useIsSelectedTab } from '@/hooks/use-is-selected-tab';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal } from '@/lib/format-kcal';

export type EnergyBarsProps = {
  /** Intake so far, and the day's calorie target it fills towards. */
  eatenKcal: number;
  eatenTargetKcal: number;
  /** Burned by resting metabolism + everyday movement so far (grows hour by hour today), and over the whole day. */
  basalKcal: number;
  basalDayKcal: number;
  /** Burned by training and logged activities so far, and what the plan has for the day. */
  exerciseKcal: number;
  exerciseDayKcal: number;
  /** A day that has not started: empty bars and dashes. */
  inactive?: boolean;
  /** Today is still running: the basal share is shown against its full day. */
  running?: boolean;
  onEatenPress?: () => void;
  onBurnedPress?: () => void;
};

/** A bar's fill: empty whenever Home is out of view, filling to `progress` (0..1) every time it comes back, and easing to any new value after that. */
function Fill({ progress, delay = 0, style }: { progress: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const focused = useIsSelectedTab();
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(0);
  const to = Math.min(Math.max(progress, 0), 1);
  useEffect(() => {
    cancelAnimation(value);
    if (!focused) {
      value.value = 0;
      return;
    }
    value.value = reduceMotion ? to : withDelay(delay + 120, withTiming(to, { duration: 1000, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [focused, reduceMotion, to, delay, value]);
  const animated = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));
  return <Animated.View style={[style, animated]} />;
}

/** `#rrggbb` with an alpha. */
function alpha(hex: string, a: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
}

/**
 * Under the ring: where the day's energy comes from and goes.
 *
 * Intake is one orange bar filling towards the day's calorie target. Burned is
 * one green bar over the whole expected day, built from two parts: the lighter
 * metabolism (resting + everyday movement), which grows hour after hour, and
 * the deeper activity (training and logged exercise). What is still to come
 * stays as empty track.
 */
export function EnergyBars({ eatenKcal, eatenTargetKcal, basalKcal, basalDayKcal, exerciseKcal, exerciseDayKcal, inactive = false, running = false, onEatenPress, onBurnedPress }: EnergyBarsProps) {
  const theme = useTheme();
  const burnedKcal = basalKcal + exerciseKcal;
  const burnedDay = Math.max(basalDayKcal + exerciseDayKcal, burnedKcal, 1);
  const eatenShare = inactive ? 0 : eatenTargetKcal > 0 ? eatenKcal / eatenTargetKcal : 0;
  const basalShare = inactive ? 0 : basalKcal / burnedDay;
  const exerciseShare = inactive ? 0 : exerciseKcal / burnedDay;
  const green = theme.brandGreen;
  const dash = '—';

  return (
    <View style={styles.root}>
      {/* Intake */}
      <Pressable onPress={onEatenPress} accessibilityRole="button" accessibilityLabel={`Assunte ${formatKcal(eatenKcal)} su ${formatKcal(eatenTargetKcal)} kcal`} style={styles.row}>
        <View style={styles.head}>
          <View style={[styles.disc, { backgroundColor: alpha(theme.accent, 0.14) }]}>
            <Icon name="utensils" size={14} color={theme.accent} />
          </View>
          <ThemedText style={styles.title}>Assunte</ThemedText>
          <View style={styles.spacer} />
          <ThemedText style={styles.value}>{inactive ? dash : formatKcal(eatenKcal)}</ThemedText>
          <ThemedText style={styles.of} themeColor="textTertiary">
            {inactive ? '' : ` / ${formatKcal(eatenTargetKcal)} kcal`}
          </ThemedText>
        </View>
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <Fill progress={eatenShare} delay={120} style={[styles.segment, { backgroundColor: theme.accent }]} />
        </View>
      </Pressable>

      {/* Burned: metabolism (hour by hour) + activity */}
      <Pressable onPress={onBurnedPress} accessibilityRole="button" accessibilityLabel={`Bruciate ${formatKcal(burnedKcal)} kcal: metabolismo ${formatKcal(basalKcal)}, attività ${formatKcal(exerciseKcal)}`} style={[styles.row, styles.rowGap]}>
        <View style={styles.head}>
          <View style={[styles.disc, { backgroundColor: alpha(green, 0.14) }]}>
            <Icon name="flameLine" size={14} color={green} />
          </View>
          <ThemedText style={styles.title}>Bruciate</ThemedText>
          <View style={styles.spacer} />
          <ThemedText style={styles.value}>{inactive ? dash : formatKcal(burnedKcal)}</ThemedText>
          <ThemedText style={styles.of} themeColor="textTertiary">
            {inactive ? '' : ' kcal'}
          </ThemedText>
        </View>
        <View style={[styles.track, styles.stack, { backgroundColor: theme.backgroundElement }]}>
          <Fill progress={basalShare} delay={200} style={[styles.segment, { backgroundColor: alpha(green, 0.42) }]} />
          <Fill progress={exerciseShare} delay={320} style={[styles.segment, { backgroundColor: green }]} />
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: alpha(green, 0.42) }]} />
            <ThemedText style={styles.legendText} themeColor="textSecondary">
              Metabolismo
            </ThemedText>
            <ThemedText style={styles.legendValue}>{inactive ? dash : formatKcal(basalKcal)}</ThemedText>
            {running && !inactive && basalDayKcal > basalKcal ? (
              <ThemedText style={styles.legendOf} themeColor="textTertiary">
                {` / ${formatKcal(basalDayKcal)}`}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: green }]} />
            <ThemedText style={styles.legendText} themeColor="textSecondary">
              Attività
            </ThemedText>
            <ThemedText style={styles.legendValue}>{inactive ? dash : formatKcal(exerciseKcal)}</ThemedText>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
  },
  row: {
    alignSelf: 'stretch',
  },
  rowGap: {
    marginTop: 18,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 9,
  },
  disc: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  spacer: {
    flex: 1,
  },
  value: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  of: {
    fontSize: 13,
    lineHeight: 22,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  stack: {
    flexDirection: 'row',
  },
  segment: {
    height: 10,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  legendValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  legendOf: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    marginLeft: -4,
  },
});
