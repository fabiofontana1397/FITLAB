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
    // Apple-inspired premium light scheme: a near-white page, cards a shade
    // lighter set off by a delicate hairline rather than by shadow, and a
    // single orange accent carrying calories, progress and nutrition.
    background: '#F2F2F2',
    // Card surface. Opaque (not translucent glass): the reference language
    // is flat surfaces with a hairline, which stays legible over anything.
    backgroundElevated: '#F7F7F7',
    // Wells and tracks *inside* a card: a shade darker than the card.
    backgroundElement: '#EAEAEA',
    backgroundSelected: '#E4E4E4',
    surfaceGlass: '#F7F7F7',
    surfaceGlassStrong: '#FFFFFF',
    border: 'rgba(28,28,30,0.08)',
    borderStrong: 'rgba(28,28,30,0.16)',
    // The card hairline (FlatCard's border) — delicate but visible on the page.
    cardEdge: '#E6E6E6',
    // Round header buttons (notifications, profile…): white on the grey page.
    iconButton: '#FFFFFF',
    text: '#1C1C1E',
    // The brief's #858585 reads 3.4:1 on the page, under the 4.5:1 minimum
    // for text, so the same neutral family is darkened until it passes:
    // secondary 6.2:1, tertiary 4.6:1. #858585 itself survives only where
    // it is decoration, never type.
    textSecondary: '#5E5E63',
    textTertiary: '#767676',
    accent: '#FB4C01',
    accentPressed: '#D63E00',
    // Orange reads 3.1:1 as a fill colour, fine for graphics and large type
    // but not for the small orange labels ("Dettagli", KPI captions), which
    // use this darker step (4.9:1) instead.
    accentText: '#C43A00',
    accentSoft: '#FFEDE4',
    onAccent: '#FFFFFF',
    // Pure #00FF00 is unusable as text on a light page (1.4:1), so the
    // positive state keeps a green that passes as type; the bright one is
    // reserved for fills and dots.
    success: '#00A651',
    successBright: '#00C853',
    successSoft: '#E3F7EC',
    warning: '#D9A600',
    danger: '#D6402C',
    // Used only for the calorie-delta bars (surplus/deficit) on the weekly
    // burn chart — deliberately distinct from success/danger so that bar
    // reads as its own "delta" signal rather than duplicating the
    // good/bad framing already carried by color elsewhere on that card.
    calorieSurplus: '#0B72E0',
    calorieDeficit: '#C2178E',
    // Fixed brand greens/yellows from the Figma screens — unlike success/warning, these also have to work as solid fills behind white labels (e.g. the green "Registra allenamento" button), so they don't change per scheme.
    brandGreen: '#22B35E',
    brandYellow: '#F6B21B',
    tabBarBlur: 'light' as const,
    shadow: 'rgba(28,28,30,0.10)',
  },
  dark: {
    background: neutral[950],
    // Card surfaces need a clearly different dark gray from the page's
    // near-black background, or every flat card silently disappears into
    // it — neutral[900] read as almost the same color as neutral[950] at
    // a glance, so this jumps to neutral[800] instead (backgroundElement,
    // used for inset wells/tracks *inside* a card, now reads as a subtly
    // recessed shade relative to the card surface, which is the right way
    // around for an elevation hierarchy).
    backgroundElevated: 'rgba(255,255,255,0.10)',
    backgroundElement: neutral[850],
    backgroundSelected: '#26272F',
    surfaceGlass: 'rgba(28,29,34,0.55)',
    surfaceGlassStrong: 'rgba(28,29,34,0.78)',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    cardEdge: 'rgba(255,255,255,0.12)',
    iconButton: '#26272F',
    text: neutral[0],
    textSecondary: neutral[300],
    textTertiary: neutral[500],
    accent: '#FB4C01',
    accentPressed: '#FF7A2E',
    // On near-black the accent itself clears 4.5:1 only from this lighter
    // step up, so small orange type uses it instead.
    accentText: '#FF8A4C',
    accentSoft: 'rgba(251,76,1,0.18)',
    onAccent: neutral[0],
    // True neon-marker green/yellow — dark is the hero mode, and these read
    // as genuinely bright against near-black the way a highlighter does
    // under UV rather than the previous muted amber/jade.
    success: '#39FF14',
    successBright: '#39FF14',
    successSoft: 'rgba(57,255,20,0.14)',
    warning: '#FFE600',
    danger: '#FF6B57',
    // Used only for the calorie-delta bars (surplus/deficit) on the weekly
    // burn chart — deliberately distinct from success/danger so that bar
    // reads as its own "delta" signal rather than duplicating the
    // good/bad framing already carried by color elsewhere on that card.
    calorieSurplus: '#3AA0FF',
    calorieDeficit: '#FF3FD1',
    brandGreen: '#22B35E',
    brandYellow: '#F6B21B',
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
  small: 14,
  medium: 20,
  large: 28,
  xlarge: 34,
  pill: 999,
} as const;

// Clearance for the floating tab bar's own height (excludes the safe-area
// gap under it, which callers add separately). Platform.select has no
// 'web' case, so this used to silently fall back to 0 on web — the
// scrollable tab screens' actual primary target — leaving their last bit
// of content hidden behind the tab bar with no way to scroll to it.
export const BottomTabInset = Platform.select({ ios: 44, android: 72, web: 56 }) ?? 56;
export const MaxContentWidth = 900;
