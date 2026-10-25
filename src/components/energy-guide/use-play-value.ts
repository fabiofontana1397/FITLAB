import { useEffect, useRef, useState } from 'react';
import { useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { TimingFill, TimingSlow } from '@/constants/motion';

/**
 * A chart value for a carousel page: it rests at 0 until the page is first
 * shown (`play`), then grows to `target` once, and from then on follows any
 * change of `target` with a short glide — swiping away and back never
 * replays it, and re-renders never restart it. Under Reduce Motion (or
 * `prefers-reduced-motion` on the web) it is simply the target.
 */
export function usePlayValue(target: number, play: boolean, delayMs = 0) {
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(play && reduceMotion ? target : 0);
  const played = useRef(false);

  useEffect(() => {
    if (!play) return;
    const first = !played.current;
    played.current = true;
    if (reduceMotion) value.set(target);
    else value.set(first ? withDelay(delayMs, withTiming(target, TimingFill)) : withTiming(target, TimingSlow));
  }, [target, play, reduceMotion, delayMs, value]);

  return value;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * The JS-side twin of usePlayValue, for numbers shown as text: counts up to
 * `target` the first time the page is shown, then glides to new values.
 * Kept to a leaf component (CountUpText) so only the label re-renders.
 */
export function useCountUp(target: number, play: boolean, delayMs = 0) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(play && reduceMotion ? target : 0);
  const current = useRef(value);
  const played = useRef(false);

  useEffect(() => {
    if (!play) return;
    const first = !played.current;
    played.current = true;
    const from = current.current;
    const set = (v: number) => {
      current.current = v;
      setValue(v);
    };
    if (reduceMotion || from === target) {
      set(target);
      return;
    }
    const duration = first ? TimingFill.duration ?? 820 : TimingSlow.duration ?? 520;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min((now - start) / duration, 1);
      set(from + (target - from) * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, first ? delayMs : 0);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, play, reduceMotion, delayMs]);

  return value;
}
