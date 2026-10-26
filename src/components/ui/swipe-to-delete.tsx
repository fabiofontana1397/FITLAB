import { useMemo, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { TimingQuick } from '@/constants/motion';
import { OnBrand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection } from '@/lib/haptics';

/** Width of the red action once the row has been swiped open. */
const ACTION_WIDTH = 92;
/** A swipe that has gone past this share of the row's width deletes it outright. */
const FULL_SWIPE = 0.6;
/** A press this soon after a drag ended is the tail of that drag, not a tap. */
const TAP_AFTER_DRAG_MS = 300;

/** Milliseconds now; only ever called from event handlers, never while rendering. */
const clock = () => Date.now();

export type SwipeToDeleteProps = {
  children: React.ReactNode;
  onDelete: () => void;
  /** A tap on the row (while it is closed). While it is open, a tap closes it instead. */
  onPress?: () => void;
  label?: string;
  accessibilityLabel?: string;
};

/**
 * A list row that opens on a swipe to the left, uncovering a red "Elimina"
 * button; a tap on that button (or a long swipe) deletes the row. The row
 * follows the finger one to one, then settles open or closed. Plain
 * PanResponder + Reanimated, so it behaves the same on iOS, Android and web.
 */
export function SwipeToDelete({ children, onDelete, onPress, label = 'Elimina', accessibilityLabel }: SwipeToDeleteProps) {
  const theme = useTheme();
  const x = useSharedValue(0);
  // Shared values rather than refs: the handlers below read and write them while the finger is down.
  const start = useSharedValue(0);
  const rowWidth = useSharedValue(0);
  // When the last drag ended: the click that follows a drag must not count as a tap on the row.
  const dragEndedAt = useSharedValue(0);
  const [open, setOpen] = useState(false);

  const settle = (to: number) => {
    x.value = withTiming(to, TimingQuick);
    setOpen(to !== 0);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only a mostly-horizontal drag: a vertical one is the page scrolling.
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.value = x.value;
        },
        onPanResponderMove: (_, g) => {
          x.value = Math.min(0, Math.max(-rowWidth.value, start.value + g.dx));
        },
        onPanResponderRelease: (_, g) => {
          dragEndedAt.value = clock();
          const current = Math.min(0, start.value + g.dx);
          if (rowWidth.value > 0 && -current > rowWidth.value * FULL_SWIPE) {
            hapticSelection();
            x.value = withTiming(-rowWidth.value, TimingQuick);
            onDelete();
            return;
          }
          settle(-current > ACTION_WIDTH / 2 || g.vx < -0.6 ? -ACTION_WIDTH : 0);
        },
        onPanResponderTerminate: () => {
          dragEndedAt.value = clock();
          settle(0);
        },
      }),
    // settle/onDelete are read at call time; the shared values are stable handles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onDelete]
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // The red area is exactly what the row has moved away from, so nothing red shows behind the row at rest.
  const actionStyle = useAnimatedStyle(() => ({ width: Math.max(0, -x.value) }));

  return (
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => {
        rowWidth.value = e.nativeEvent.layout.width;
      }}>
      <Animated.View style={[styles.action, { backgroundColor: theme.danger }, actionStyle]}>
        <Pressable
          onPress={() => {
            hapticSelection();
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ? `${label}: ${accessibilityLabel}` : label}
          style={styles.actionButton}>
          <ThemedText style={styles.actionLabel} numberOfLines={1}>
            {label}
          </ThemedText>
        </Pressable>
      </Animated.View>
      <Animated.View style={[rowStyle, Platform.OS === 'web' ? ({ touchAction: 'pan-y' } as object) : null]} {...responder.panHandlers}>
        <Pressable
          onPress={() => {
            if (clock() - dragEndedAt.value < TAP_AFTER_DRAG_MS) return;
            if (open) settle(0);
            else onPress?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  action: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  // Fixed width, anchored right: the label is revealed rather than squeezed as the row opens.
  actionButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: OnBrand.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
});
