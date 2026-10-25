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

/** Sheets rising from the bottom edge: firm, with no bounce at the top —
 * a bouncing sheet reads as a toy, and the overshoot would show the page
 * behind through the gap under it. */
export const SpringSheet: WithSpringConfig = {
  damping: 26,
  mass: 0.9,
  stiffness: 200,
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

/** Icon snapping back after a tab press: loose enough to overshoot visibly. */
export const SpringIconPop: WithSpringConfig = { damping: 9, mass: 0.5, stiffness: 300 };

/** A count or badge popping as its value changes. */
export const SpringCountPop: WithSpringConfig = { damping: 10, mass: 1, stiffness: 200 };

/** A panel settling after it has been pulled open. */
export const SpringPanel: WithSpringConfig = { damping: 15, mass: 0.9, stiffness: 110 };

/**
 * The squash under a finger, before the spring back. Deliberately much
 * shorter than TimingQuick: it has to land while the finger is still down.
 */
export const TimingTap: WithTimingConfig = { duration: 90, easing: Easing.out(Easing.quad) };

/**
 * Something leaving downward or off-screen. Eased *in* (slow start, fast
 * finish) — the mirror of the eased-out entrances above, so a sheet
 * accelerates away instead of drifting.
 */
export const TimingExit: WithTimingConfig = { duration: 240, easing: Easing.in(Easing.cubic) };

/** A screen-sized element settling after a route change. */
export const TimingScreen: WithTimingConfig = { duration: 300, easing: Easing.out(Easing.cubic) };

/** A countdown or long determinate progress running to completion. */
export const TimingCountdown: WithTimingConfig = { duration: 950, easing: Easing.linear };

/**
 * One beat of a looping pulse (a "live" dot, a halo, a timeline marker).
 * Shared so several pulses on the same screen breathe together instead of
 * drifting against one another.
 */
export const PULSE_DURATION = 1400;
export const TimingPulse: WithTimingConfig = { duration: PULSE_DURATION, easing: Easing.out(Easing.quad) };

/** A linear loop, for continuously drifting artwork (orb blobs, aura fields). */
export const loopTiming = (duration: number): WithTimingConfig => ({ duration, easing: Easing.linear });
