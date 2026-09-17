/**
 * FITLAB design tokens.
 *
 * Palette: black / white / gray neutrals with a single high-energy orange
 * accent reserved for CTAs, progress, active state and achievements.
 * Both light and dark are first-class; dark is the "hero" mode.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Pushed further still into genuinely phosphorescent territory — same
// ramp shape, base shifted from #FF6A00 to a hotter, higher-luminance
// #FF7A00 (more green in the mix reads as "glowing" the way the neon
// success/warning colors below do, without tipping over into amber).
const orange = {
  50: '#FFF2E0',
  100: '#FFDDB0',
  300: '#FFB166',
  500: '#FF7A00',
  600: '#F06A00',
  700: '#C25A00',
};

const neutral = {
  0: '#FFFFFF',
  50: '#F7F7F8',
  100: '#EEEEF0',
  200: '#E2E2E6',
  300: '#C7C8CD',
  400: '#9A9BA3',
  500: '#6E6F78',
  600: '#4B4C54',
  700: '#303138',
  800: '#1C1D22',
  850: '#151519',
  900: '#0E0E11',
  950: '#000000',
};

export const Palette = { orange, neutral };

export const Colors = {
  light: {
    background: neutral[50],
    backgroundElevated: neutral[0],
    backgroundElement: neutral[100],
    backgroundSelected: neutral[200],
    surfaceGlass: 'rgba(255,255,255,0.55)',
    surfaceGlassStrong: 'rgba(255,255,255,0.75)',
    border: 'rgba(14,14,17,0.08)',
    borderStrong: 'rgba(14,14,17,0.14)',
    text: neutral[950],
    textSecondary: neutral[600],
    textTertiary: neutral[400],
    accent: orange[500],
    accentPressed: orange[600],
    accentSoft: orange[50],
    onAccent: neutral[0],
    // Pushed toward the same "highlighter marker" saturation as dark mode's
    // neon green/yellow below, but held back a notch so they still read as
    // text on a white background instead of washing out.
    success: '#00A651',
    warning: '#D9A600',
    danger: '#D6402C',
    // Used only for the calorie-delta bars (surplus/deficit) on the weekly
    // burn chart — deliberately distinct from success/danger so that bar
    // reads as its own "delta" signal rather than duplicating the
    // good/bad framing already carried by color elsewhere on that card.
    calorieSurplus: '#0B72E0',
    calorieDeficit: '#C2178E',
    tabBarBlur: 'light' as const,
    shadow: 'rgba(20,20,25,0.12)',
  },
  dark: {
    background: neutral[950],
    backgroundElevated: neutral[900],
    backgroundElement: neutral[850],
    backgroundSelected: neutral[800],
    surfaceGlass: 'rgba(28,29,34,0.55)',
    surfaceGlassStrong: 'rgba(28,29,34,0.78)',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    text: neutral[0],
    textSecondary: neutral[300],
    textTertiary: neutral[500],
    accent: orange[500],
    accentPressed: orange[300],
    accentSoft: 'rgba(255,122,0,0.16)',
    onAccent: neutral[0],
    // True neon-marker green/yellow — dark is the hero mode, and these read
    // as genuinely bright against near-black the way a highlighter does
    // under UV rather than the previous muted amber/jade.
    success: '#39FF14',
    warning: '#FFE600',
    danger: '#FF6B57',
    // Used only for the calorie-delta bars (surplus/deficit) on the weekly
    // burn chart — deliberately distinct from success/danger so that bar
    // reads as its own "delta" signal rather than duplicating the
    // good/bad framing already carried by color elsewhere on that card.
    calorieSurplus: '#3AA0FF',
    calorieDeficit: '#FF3FD1',
    tabBarBlur: 'dark' as const,
    shadow: 'rgba(0,0,0,0.5)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 12,
  medium: 18,
  large: 24,
  xlarge: 32,
  pill: 999,
} as const;

// Clearance for the floating tab bar's own height (excludes the safe-area
// gap under it, which callers add separately). Platform.select has no
// 'web' case, so this used to silently fall back to 0 on web — the
// scrollable tab screens' actual primary target — leaving their last bit
// of content hidden behind the tab bar with no way to scroll to it.
export const BottomTabInset = Platform.select({ ios: 44, android: 72, web: 56 }) ?? 56;
export const MaxContentWidth = 900;
