import { useEffect, type ReactNode } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** Wraps a day's session. When `nonce` changes (the two sessions were just
 * exchanged) its new content starts where the other one was, `from` points
 * above (negative) or below (positive), and slides home in a blink, so the
 * two cards visibly cross over. With no `from` it only fades in. */
export function SwapSlide({
  nonce,
  from,
  children,
}: {
  nonce: number;
  from: number;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (nonce === 0 || reduceMotion) return;
    const timing = { duration: 260, easing: Easing.out(Easing.cubic) };
    if (from === 0) {
      opacity.value = 0.25;
      opacity.value = withTiming(1, timing);
      return;
    }
    y.value = from;
    y.value = withTiming(0, timing);
  }, [nonce, from, reduceMotion, y, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View style={[style, { zIndex: 1 }]}>{children}</Animated.View>
  );
}
