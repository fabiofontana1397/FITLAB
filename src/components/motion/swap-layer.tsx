import { memo, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

/** How far (pt) a layer drifts sideways as it leaves and the next one arrives, in the direction of the choice. */
const DRIFT = 26;
const OUT = { duration: 170, easing: Easing.out(Easing.quad) };
const IN_FADE = { duration: 280, easing: Easing.out(Easing.cubic) };
const IN_SPRING = { damping: 24, stiffness: 230, mass: 0.9 };
/** A layer not built yet is mounted this long after the choice, while the one leaving is already fading. */
export const SWAP_BUILD_AFTER_MS = 90;

export type SwapLayerProps = {
  /** The one showing. The others stay mounted, invisible and untouchable, ready for the next switch. */
  active: boolean;
  /** +1 when the choice moved to the right of the previous one, -1 to the left: the layers drift that way. */
  direction: number;
  /** Shown at once on mount, with no entrance (the layer the page opens on). */
  instant?: boolean;
  children: ReactNode;
};

/**
 * One of several contents stacked in the same place behind a selector (a meal's recipe deck, a workout's proposals),
 * kept mounted once built. Leaving, it fades and drifts away from the choice; arriving, it glides in from that side
 * and settles with a soft spring, growing the last few percent into place. Only opacity and transform move, on the
 * UI thread: the content itself is never redrawn by a switch. With "reduce motion" on, it simply cross-fades.
 *
 * Memoised: give it stable children (or memoised ones) so a switch re-renders only the layers whose `active` changed.
 */
export const SwapLayer = memo(function SwapLayer({ active, direction, instant, children }: SwapLayerProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(active && instant ? 1 : 0);
  const x = useSharedValue(0);
  const scale = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    const firstRun = !mounted.current;
    mounted.current = true;
    if (firstRun && (instant || !active)) return;
    if (reduceMotion) {
      opacity.set(withTiming(active ? 1 : 0, { duration: 160 }));
      return;
    }
    if (active) {
      x.set(direction * DRIFT);
      scale.set(0.97);
      opacity.set(withTiming(1, IN_FADE));
      x.set(withSpring(0, IN_SPRING));
      scale.set(withSpring(1, IN_SPRING));
    } else {
      opacity.set(withTiming(0, OUT));
      x.set(withTiming(-direction * DRIFT * 0.6, OUT));
      scale.set(withTiming(0.97, OUT));
    }
    // direction is read at the moment of the switch, on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      aria-hidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={[StyleSheet.absoluteFill, { pointerEvents: active ? 'auto' : 'none' }, style]}>
      {children}
    </Animated.View>
  );
});
