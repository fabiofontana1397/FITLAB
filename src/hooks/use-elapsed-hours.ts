import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * The whole hours elapsed today (0–23), refreshed on the hour and whenever the
 * app returns to the foreground. Drives the calories that accrue through the
 * day (resting metabolism), so the Home gauge grows hour by hour.
 */
export function useElapsedHours(): number {
  const [hours, setHours] = useState(() => new Date().getHours());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => setHours(new Date().getHours());
    const schedule = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(now.getHours() + 1, 0, 1, 0);
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
