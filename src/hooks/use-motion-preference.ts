import { useReducedMotion } from 'react-native-reanimated';

/**
 * "Reduce Motion" for the parts of the app Reanimated does not reach.
 *
 * Reanimated already honours the setting on its own: every `withTiming` /
 * `withSpring` defaults to `ReduceMotion.System` and jumps straight to its
 * end value, and `withRepeat` stops after a single pass. So a component
 * animating with Reanimated needs nothing extra.
 *
 * Three kinds of motion are NOT covered, and this hook is for those:
 *
 * 1. `Modal`'s built-in `animationType`, which is implemented natively and
 *    ignores the setting entirely.
 * 2. The navigator's own screen transitions.
 * 3. Motion driven by something other than an animation — the coach orb's
 *    accelerometer tilt keeps moving however the animations are configured.
 */
export function useMotionPreference() {
  const reduceMotion = useReducedMotion();

  return {
    reduceMotion,
    /**
     * `animationType` for a React Native `Modal`. Returns 'none' when the
     * user has asked for less motion, so the modal simply appears.
     */
    modalAnimation: (preferred: 'slide' | 'fade'): 'slide' | 'fade' | 'none' =>
      reduceMotion ? 'none' : preferred,
  };
}
