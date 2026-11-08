import { useIsFocused } from 'expo-router';
import { createContext, useContext, useEffect, type RefObject } from 'react';
import { Dimensions, Platform, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
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

// A section is hidden again (ready to enter next time) only once a sliver of it is left on screen, and shows the
// moment more than that appears. The two are only a few px apart so that no box is ever left blank while a real
// part of it is in view, whatever the scroll position it stops at.
const HIDE_MAX_PX = 20;
const HIDE_FRACTION = 0.2;
const SHOW_MARGIN_PX = 6;
const STAGGER_WINDOW_MS = 700;
const RISE = 26;
/** How blurred a section starts (web only: React Native has no blur on iOS). */
const BLUR_PX = 8;

export type RevealProps = {
  /** Position in the screen's stack; drives the opening stagger. */
  index?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * One section of a screen entering the way the reference animation does: it
 * fades in out of a blur, rising and growing a little into place, one section
 * after another from the top.
 *
 * It plays every time, not once:
 *  - each time the page is switched to, the sections that are in view replay
 *    their staggered entrance;
 *  - each time a section comes back into view while scrolling (it left the
 *    screen entirely, above or below), it enters again.
 * With the system's "reduce motion" on, content is simply there.
 */
export function Reveal({ index = 0, style, children }: RevealProps) {
  const ctx = useContext(ScrollRevealContext);
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();

  const fallbackScrollY = useSharedValue(0);
  const fallbackViewport = useSharedValue(Dimensions.get('window').height);
  const scrollY = ctx?.scrollY ?? fallbackScrollY;
  const viewportHeight = ctx?.viewportHeight ?? fallbackViewport;

  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const top = useSharedValue(-1);
  const height = useSharedValue(0);
  const delay = useSharedValue(0);
  const triggered = useSharedValue(reduceMotion);
  /** Bumped to make the reaction below run again (a page switch replays the entrance). */
  const replay = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      triggered.set(true);
      progress.set(1);
      return;
    }
    if (!focused) {
      // Page left: park the section hidden, ready to enter again.
      cancelAnimation(progress);
      triggered.set(false);
      progress.set(0);
      return;
    }
    // Page shown (first paint or coming back): the sections in view enter one after another.
    delay.set(Math.min(index, STAGGER_MAX_STEPS) * STAGGER_STEP);
    triggered.set(false);
    progress.set(0);
    replay.set(replay.get() + 1);
    // The stagger only belongs to this page switch, not to later scroll-ins.
    const clear = setTimeout(() => delay.set(0), STAGGER_WINDOW_MS);
    return () => clearTimeout(clear);
    // index is only read at the moment of the switch, on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, focused]);

  useAnimatedReaction(
    () => {
      // How much of the section is on screen: 1 = enough to be shown, 2 = only a sliver (hide it, ready to enter
      // again), 0 = right on the edge (leave it as it is); the page switch counter rides along.
      const measured = top.value >= 0;
      const visible = Math.min(top.value + height.value, scrollY.value + viewportHeight.value) - Math.max(top.value, scrollY.value);
      const hideAt = Math.min(HIDE_MAX_PX, height.value * HIDE_FRACTION);
      return (!measured ? 0 : visible > hideAt + SHOW_MARGIN_PX ? 1 : visible < hideAt ? 2 : 0) + replay.value * 3;
    },
    (state) => {
      const kind = state % 3;
      if (reduceMotion) return;
      if (kind === 2) {
        // Only a sliver left on screen: hide it again (a quick fade) so it can enter next time.
        if (triggered.get()) {
          triggered.set(false);
          cancelAnimation(progress);
          progress.set(withTiming(0, { duration: 140 }));
        }
        return;
      }
      if (kind !== 1 || triggered.get()) return;
      triggered.set(true);
      progress.set(withDelay(delay.get(), withSpring(1, SpringReveal)));
    }
  );

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const base = {
      opacity: interpolate(p, [0, 0.55], [0, 1], 'clamp'),
      transform: [{ translateY: (1 - p) * RISE }, { scale: interpolate(p, [0, 1], [0.96, 1]) }],
    };
    return Platform.OS === 'web' ? { ...base, filter: `blur(${Math.max(0, (1 - p) * BLUR_PX)}px)` } : base;
  });

  return (
    <RevealProgressContext.Provider value={progress}>
      <Animated.View
        style={[style, animatedStyle]}
        onLayout={(e) => {
          top.set(e.nativeEvent.layout.y);
          height.set(e.nativeEvent.layout.height);
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
