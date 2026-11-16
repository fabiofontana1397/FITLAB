import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const STEP_MINUTES = 15;

/** Hours from midnight, to the last quarter of an hour (07:40 → 7.5). */
const nowHours = () => {
  const d = new Date();
  return d.getHours() + (Math.floor(d.getMinutes() / STEP_MINUTES) * STEP_MINUTES) / 60;
};

/**
 * The hours elapsed today (0–24, by quarters of an hour), refreshed every 15 minutes and whenever the app returns to
 * the foreground. Drives the calories counted through the day (resting metabolism and everyday activity, from breakfast
 * to dinner: domain/energy.ts), so the Home gauge grows steadily.
 */
export function useElapsedHours(): number {
  const [hours, setHours] = useState(nowHours);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => setHours(nowHours());
    const schedule = () => {
      const now = new Date();
      const next = new Date(now);
      next.setMinutes((Math.floor(now.getMinutes() / STEP_MINUTES) + 1) * STEP_MINUTES, 1, 0);
      timer = setTimeout(() => {
        tick();
        schedule();
      }, next.getTime() - now.getTime());
    };
    schedule();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        tick();
        clearTimeout(timer);
        schedule();
      }
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return hours;
}
