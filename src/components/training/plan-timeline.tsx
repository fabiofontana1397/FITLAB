import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { SpringSnappy, TimingPulse, TimingSlow } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PlanTimelineProps = {
  totalMonths: number;
  /** The month unlocked so far by real elapsed time — months beyond this are locked. */
  currentMonth: number;
  selectedMonth: number;
  onSelectMonth: (month: number) => void;
};

const CHIP_SIZE = 36;
const PULSE_SIZE = CHIP_SIZE + 16;

/** A month-by-month progress bar. Unlocked months (<= currentMonth) can be
 * opened in full; later ones stay greyed out and locked until the plan
 * reaches them. The filled track animates in to show overall progress. */
export function PlanTimeline({ totalMonths, currentMonth, selectedMonth, onSelectMonth }: PlanTimelineProps) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    const target = totalMonths > 1 ? (currentMonth - 1) / (totalMonths - 1) : 1;
    progress.value = withDelay(150, withTiming(target, TimingSlow));
  }, [currentMonth, totalMonths, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={styles.wrap}>
      <View style={styles.trackContainer}>
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <Animated.View style={[styles.fill, { backgroundColor: theme.accent }, fillStyle]} />
        </View>
      </View>
      <View style={styles.row}>
        {Array.from({ length: totalMonths }, (_, i) => i + 1).map((month, index) => (
          <MonthNode
            key={month}
            month={month}
            index={index}
            isUnlocked={month <= currentMonth}
            isCurrent={month === currentMonth}
            isSelected={month === selectedMonth}
            onPress={() => onSelectMonth(month)}
          />
        ))}
      </View>
    </View>
  );
}

function MonthNode({
  month,
  index,
  isUnlocked,
  isCurrent,
  isSelected,
  onPress,
}: {
  month: number;
  index: number;
  isUnlocked: boolean;
  isCurrent: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const enter = useSharedValue(0);
  const pulse = useSharedValue(0);
  const select = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    enter.value = withDelay(index * 70, withSpring(1, SpringSnappy));
  }, [enter, index]);

  useEffect(() => {
    if (!isCurrent) return;
    pulse.value = withRepeat(withTiming(1, TimingPulse), -1, false);
  }, [isCurrent, pulse]);

  useEffect(() => {
    select.value = withSpring(isSelected ? 1 : 0, SpringSnappy);
  }, [isSelected, select]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: enter.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: isCurrent ? (1 - pulse.value) * 0.55 : 0,
    transform: [{ scale: 1 + pulse.value * 0.4 }],
  }));
  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + select.value * 0.12 }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.nodeWrap} hitSlop={6}>
      <Animated.View style={enterStyle}>
        <View style={styles.nodeCenter}>
          {isCurrent ? (
            <Animated.View pointerEvents="none" style={[styles.pulseRing, { borderColor: theme.accent }, pulseStyle]} />
          ) : null}
          <Animated.View style={chipStyle}>
            <GlassSurface
              level={isSelected ? 'raised' : 'card'}
              radius={Radius.pill}
              style={[
                styles.chip,
                { borderColor: isSelected ? theme.accent : isUnlocked ? theme.accentSoft : 'transparent' },
              ]}>
              <View style={styles.chipInner}>
                {isUnlocked ? (
                  <ThemedText
                    type="caption"
                    style={{ color: isSelected ? theme.accent : theme.text, fontWeight: '700' }}>
                    {month}
                  </ThemedText>
                ) : (
                  <Icon name="lock" size={13} color={isSelected ? theme.accent : theme.textTertiary} />
                )}
              </View>
            </GlassSurface>
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 6,
  },
  trackContainer: {
    position: 'absolute',
    left: CHIP_SIZE / 2,
    right: CHIP_SIZE / 2,
    top: 6 + CHIP_SIZE / 2 - 2,
    height: 4,
  },
  track: {
    flex: 1,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nodeWrap: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
  },
  nodeCenter: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    borderWidth: 2,
  },
  chip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderWidth: 1.5,
  },
  chipInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
