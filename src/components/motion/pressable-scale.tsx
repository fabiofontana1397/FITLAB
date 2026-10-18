import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { SpringPressIn, SpringPressOut } from '@/constants/motion';
import { hapticPress, hapticTap } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Scale while held: ~0.96 for buttons and tiles, ~0.985 for wide cards
   * (a big surface shrinking by the same ratio moves too many pixels). */
  scaleTo?: number;
  /** Haptic on a completed tap (not finger down, which also fires when a
   * scroll starts over the button): a light tick by default, a firmer one for a
   * screen's main call-to-action, or none. */
  haptic?: 'tap' | 'press' | false;
};

/** The app's tappable surface: it sinks a little under the finger and springs
 * back on release, so every press gets immediate physical feedback instead of
 * a flat opacity blink, plus a haptic tick on device. Drop-in for Pressable (static style only). */
export function PressableScale({ scaleTo = 0.96, haptic = 'tap', style, onPress, onPressIn, onPressOut, children, ...rest }: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        pressed.value = withSpring(1, SpringPressIn);
        onPressIn?.(e);
      }}
      onPress={(e) => {
        if (haptic === 'press') hapticPress();
        else if (haptic === 'tap') hapticTap();
        onPress?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, SpringPressOut);
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}
