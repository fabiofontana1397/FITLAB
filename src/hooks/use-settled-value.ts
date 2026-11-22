import { useEffect, useState } from 'react';

import { TimingQuick } from '@/constants/motion';

/** How long a selector's thumb takes to slide: the content behind it changes once it has landed. */
export const SELECTOR_SETTLE_MS = TimingQuick.duration ?? 220;

/**
 * `value`, but only once it has stopped changing for `delayMs`. A selector shows its new choice at once (its thumb
 * slides on the UI thread) while the heavy content behind it — a whole page, a deck of cards — swaps after the
 * slide, so mounting it never stalls the animation.
 */
export function useSettledValue<T>(value: T, delayMs: number = SELECTOR_SETTLE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (Object.is(value, settled)) return;
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, settled, delayMs]);
  return settled;
}
