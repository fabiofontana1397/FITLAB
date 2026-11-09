import { startTransition } from 'react';

/**
 * Opens a popup (a calendar, "Registra pasto"…) as a low-priority update. The state that shows it lives in a big
 * screen, so flipping it rebuilds that whole screen: done in one go that is a long task right when the popup's own
 * entrance starts. As a transition React does the same work in small slices between frames, so the entrance stays smooth.
 */
export function openPopup(open: () => void): void {
  startTransition(open);
}
