import { createContext } from 'react';

/**
 * Forces a colour scheme on everything rendered inside it (a dark hero on a light page draws its text, rings and
 * glass buttons with the dark palette). `null` lifts an outer override again: popups and menus opened from inside a
 * forced area follow the app's own scheme.
 */
export const ColorSchemeOverride = createContext<'light' | 'dark' | null>(null);
