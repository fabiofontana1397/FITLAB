import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { hapticSelection } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';

export const WHEEL_ITEM_HEIGHT = 54;
export const WHEEL_VISIBLE_ITEMS = 5;
export const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS;

/** Quiet time after the last scroll event before the wheel accepts the row
 * under the band as the answer. React Native Web never fires
 * onMomentumScrollEnd or onScrollEndDrag (its ScrollView only emits
 * onScroll — see react-native-web/dist/exports/ScrollView/ScrollViewBase.js),
 * so without this the picker would simply never commit in Safari or the
 * installed PWA. On iOS and Android the native end-of-scroll callbacks still
 * commit immediately; this only catches what they miss. */
const SCROLL_IDLE_MS = 140;

export type WheelColumnProps = {
  labels: string[];
  /** Index currently under the selection band. */
  index: number;
  /** Fired when a scroll settles on a new index — never on mount. */
  onIndexChange: (index: number) => void;
  /** Parked on a value the user hasn't chosen yet: shown at low contrast. */
  dimmed?: boolean;
  width?: number;
  accessibilityLabel: string;
};

/**
 * One column of an iOS-style wheel. Shared by the age picker and the meal-time
 * picker so both scroll, snap, tick and dim in exactly the same way.
 */
export function WheelColumn({ labels, index, onIndexChange, dimmed = false, width = 110, accessibilityLabel }: WheelColumnProps) {
  const scrollRef = useRef<Animated.ScrollView>(null);
  const offset = useSharedValue(index * WHEEL_ITEM_HEIGHT);
  const liveIndex = useSharedValue(index);
  const lastIndex = useRef<number | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The worklet below is created once, so it calls the commit through a ref
  // rather than capturing the first render's props.
  const commitRef = useRef<(next: number) => void>(() => {});

  const commit = (raw: number) => {
    const next = Math.min(labels.length - 1, Math.max(0, raw));
    if (lastIndex.current === next && !dimmed) return;
    lastIndex.current = next;
    hapticSelection();
    onIndexChange(next);
  };

  useEffect(() => {
    commitRef.current = commit;
  });

  useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  // Only scroll for an index that changed elsewhere (mount, Back to an
  // answered question, the steppers) — not for one this wheel just reported.
  useEffect(() => {
    if (lastIndex.current === index) return;
    lastIndex.current = index;
    scrollRef.current?.scrollTo({ y: index * WHEEL_ITEM_HEIGHT, animated: false });
  }, [index]);

  const scheduleCommit = useCallback((next: number) => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => commitRef.current(next), SCROLL_IDLE_MS);
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      offset.value = e.contentOffset.y;
      const next = Math.round(e.contentOffset.y / WHEEL_ITEM_HEIGHT);
      if (next === liveIndex.value) return;
      liveIndex.value = next;
      runOnJS(scheduleCommit)(next);
    },
  });

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    commit(Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT));
  };

  return (
    <Animated.ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      snapToInterval={WHEEL_ITEM_HEIGHT}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={onScroll}
      onMomentumScrollEnd={settle}
      onScrollEndDrag={settle}
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={{ paddingVertical: (WHEEL_HEIGHT - WHEEL_ITEM_HEIGHT) / 2 }}
      style={{ height: WHEEL_HEIGHT, width }}>
      {labels.map((label, i) => (
        <WheelItem key={label} index={i} offset={offset} label={label} dimmed={dimmed} />
      ))}
    </Animated.ScrollView>
  );
}

function WheelItem({ index, offset, label, dimmed }: { index: number; offset: SharedValue<number>; label: string; dimmed: boolean }) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(offset.value / WHEEL_ITEM_HEIGHT - index);
    return {
      opacity: Math.max(0.16, 1 - distance * 0.42) * (dimmed ? 0.45 : 1),
      transform: [{ scale: Math.max(0.74, 1 - distance * 0.14) }],
    };
  });

  return (
    <Animated.View style={[styles.item, style]}>
      <ThemedText style={[styles.itemText, { color: theme.text }]}>{label}</ThemedText>
    </Animated.View>
  );
}

/** The band drawn behind the centre row of a wheel (or of a row of wheels). */
export function WheelSelectionBand() {
  const theme = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[styles.band, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}
    />
  );
}

const styles = StyleSheet.create({
  item: { height: WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT,
    top: (WHEEL_HEIGHT - WHEEL_ITEM_HEIGHT) / 2,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
