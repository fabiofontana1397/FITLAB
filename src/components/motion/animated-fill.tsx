import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useRevealedValue } from '@/components/motion/reveal';

/** The filled part of a horizontal progress track, growing from 0 to
 * `progress` (0..1) when its section comes into view and easing to any new
 * value after that. Style it like the plain fill View it replaces (height,
 * radius, color) — the width is driven here. */
export function AnimatedFill({ progress, delay = 0, style }: { progress: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const value = useRevealedValue(Math.min(Math.max(progress, 0), 1), delay);
  const animatedStyle = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));
  return <Animated.View style={[style, animatedStyle]} />;
}

/** A chart column growing up to `height` (px) when its section comes into
 * view; `delay` staggers neighbouring columns into a wave. */
export function GrowBar({ height, delay = 0, style }: { height: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const value = useRevealedValue(height, delay);
  const animatedStyle = useAnimatedStyle(() => ({ height: value.value }));
  return <Animated.View style={[style, animatedStyle]} />;
}
