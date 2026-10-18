import { createContext, useContext, useEffect, type RefObject } from 'react';
import { Dimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  makeMutable,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { SpringReveal, STAGGER_MAX_STEPS, STAGGER_STEP, TimingFill } from '@/constants/motion';

/** Provided by ScreenScroll: where the list is scrolled to and how tall the
 * visible window is, so each Reveal can tell when it has come into view. */
export type ScrollRevealContextValue = {
  scrollY: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  /** Date.now() of the screen's first paint; Reveals mounting shortly after
   * it join the opening stagger, later ones (scroll-in, a section appearing
   * on a tab switch) start right away. */
  mountedAt: RefObject<number>;
};

export const ScrollRevealContext = createContext<ScrollRevealContextValue | null>(null);

// Outside any Reveal everything counts as already on screen.
const ALWAYS_REVEALED = makeMutable(1);
const RevealProgressContext = createContext<SharedValue<number>>(ALWAYS_REVEALED);

/** The enclosing Reveal's 0→1 entrance progress (1 outside any Reveal). */
export function useRevealProgress() {
  return useContext(RevealProgressContext);
}

// A section must be this far into the visible window before it reveals, so
// the motion happens where the eye is rather than under the very edge.
const IN_VIEW_MARGIN = 28;
const STAGGER_WINDOW_MS = 700;
const RISE = 22;

export type RevealProps = {
  /** Position in the screen's stack; drives the opening stagger. */
  index?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/** One section of a screen that rises and fades in: staggered with its
 * siblings on first paint, or as it scrolls into view if it starts below the
 * fold. Plays once — scrolling back up never re-hides anything. With the
 * system's "reduce motion" on, content is simply there. */
export function Reveal({ index = 0, style, children }: RevealProps) {
  const ctx = useContext(ScrollRevealContext);
  const reduceMotion = useReducedMotion();

  const fallbackScrollY = useSharedValue(0);
  const fallbackViewport = useSharedValue(Dimensions.get('window').height);
  const scrollY = ctx?.scrollY ?? fallbackScrollY;
  const viewportHeight = ctx?.viewportHeight ?? fallbackViewport;
  const mountedAt = ctx?.mountedAt;

  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const top = useSharedValue(-1);
  const delay = useSharedValue(0);
  const triggered = useSharedValue(reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      triggered.set(true);
      progress.set(1);
      return;
    }
    const sinceMount = Date.now() - (mountedAt?.current ?? 0);
    delay.set(sinceMount < STAGGER_WINDOW_MS ? Math.min(index, STAGGER_MAX_STEPS) * STAGGER_STEP : 0);
    // index is only read for the first paint, on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  useAnimatedReaction(
    () => top.value >= 0 && scrollY.value + viewportHeight.value > top.value + IN_VIEW_MARGIN,
    (inView) => {
      if (!inView || triggered.get()) return;
      triggered.set(true);
      progress.set(withDelay(delay.get(), withSpring(1, SpringReveal)));
    }
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.55], [0, 1], 'clamp'),
    transform: [
      { translateY: (1 - progress.value) * RISE },
      { scale: interpolate(progress.value, [0, 1], [0.985, 1]) },
    ],
  }));

  return (
    <RevealProgressContext.Provider value={progress}>
      <Animated.View
        style={[style, animatedStyle]}
        onLayout={(e) => {
          top.set(e.nativeEvent.layout.y);
        }}>
        {children}
      </Animated.View>
    </RevealProgressContext.Provider>
  );
}

/** A number that animates from 0 to `target` once the enclosing Reveal has
 * come into view (so a chart below the fold grows when you scroll to it, not
 * unseen on mount), then follows later changes of `target` smoothly. */
export function useRevealedValue(target: number, delayMs = 0) {
  const reveal = useRevealProgress();
  const goal = useSharedValue(target);
  const value = useSharedValue(0);

  useEffect(() => {
    goal.set(target);
  }, [target, goal]);

  useAnimatedReaction(
    () => (reveal.value > 0.05 ? goal.value : null),
    (next, previous) => {
      if (next == null || next === previous) return;
      // The first grow waits for its stagger slot; later updates move at once.
      value.set(withDelay(previous == null ? delayMs : 0, withTiming(next, TimingFill)));
    }
  );

  return value;
}
