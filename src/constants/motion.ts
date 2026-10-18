import { WithSpringConfig, WithTimingConfig, Easing } from 'react-native-reanimated';

export const SpringSnappy: WithSpringConfig = {
  damping: 18,
  mass: 0.6,
  stiffness: 220,
};

export const SpringSoft: WithSpringConfig = {
  damping: 20,
  mass: 0.9,
  stiffness: 140,
};

export const TimingQuick: WithTimingConfig = {
  duration: 220,
  easing: Easing.out(Easing.cubic),
};

export const TimingSlow: WithTimingConfig = {
  duration: 520,
  easing: Easing.out(Easing.cubic),
};

/** Sections settling into place (mount stagger, scroll-in): just under
 * critical damping, so they glide and land with no visible bounce. */
export const SpringReveal: WithSpringConfig = {
  damping: 24,
  mass: 1,
  stiffness: 170,
};

/** Finger down: fast and firm, so the press registers instantly. */
export const SpringPressIn: WithSpringConfig = {
  damping: 26,
  mass: 0.5,
  stiffness: 420,
};

/** Finger up: a touch looser, with a hint of overshoot back to rest. */
export const SpringPressOut: WithSpringConfig = {
  damping: 13,
  mass: 0.6,
  stiffness: 260,
};

/** Popups landing in the middle of the screen. */
export const SpringPopup: WithSpringConfig = {
  damping: 20,
  mass: 0.8,
  stiffness: 240,
};

/** Bars, fills and chart columns growing to their value. */
export const TimingFill: WithTimingConfig = {
  duration: 820,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
};

/** How far apart (ms) consecutive sections start on a screen's first paint,
 * and after how many the stagger stops growing (later ones are off-screen). */
export const STAGGER_STEP = 55;
export const STAGGER_MAX_STEPS = 7;
