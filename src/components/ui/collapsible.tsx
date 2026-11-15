import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

const OPEN_MS = 320;
const CLOSE_MS = 240;
/** iOS-like deceleration: quick to start, long soft landing. */
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

export type CollapsibleProps = {
  open: boolean;
  children: ReactNode;
  /** Style of the content itself (padding, gap): it is measured with it. */
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Content that opens and closes by growing to its own height. The content stays mounted and is measured once, so the
 * height moves continuously between 0 and that measure on the UI thread: what sits below is pushed down frame by frame
 * instead of jumping to its new place, and the text fades in as the space opens.
 */
export function Collapsible({ open, children, contentStyle }: CollapsibleProps) {
  const reduceMotion = useReducedMotion();
  const height = useSharedValue(0);
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(open ? 1 : 0, { duration: reduceMotion ? 0 : open ? OPEN_MS : CLOSE_MS, easing: EASE }));
  }, [open, reduceMotion, progress]);

  const onLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    // First measure lands as is; a later change (another month's text) glides to its new height.
    height.set(height.get() === 0 || reduceMotion ? measured : withTiming(measured, { duration: 200, easing: EASE }));
  };

  const frameStyle = useAnimatedStyle(() => ({ height: height.value * progress.value }));
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, (progress.value - 0.25) / 0.75)),
    transform: [{ translateY: (1 - progress.value) * -6 }],
  }));

  return (
    <Animated.View
      style={[styles.frame, frameStyle]}
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      aria-hidden={!open}
    >
      <Animated.View style={[styles.content, contentAnimatedStyle]}>
        <View onLayout={onLayout} style={contentStyle}>
          {children}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  // Out of the flow, so the content keeps its full height while the frame around it is still closed.
  content: { position: 'absolute', top: 0, left: 0, right: 0 },
});
