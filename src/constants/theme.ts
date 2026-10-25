/**
 * FITLAB design tokens.
 *
 * Palette: black / white / gray neutrals with a single high-energy orange
 * accent reserved for CTAs, progress, active state and achievements.
 * Both light and dark are first-class; dark is the "hero" mode.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { PageBackground } from '@/constants/page-background';

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

/**
 * Brand fills that stay the same in both schemes, because the surface they
 * paint *is* the color — a gradient CTA, the coach orb, a progress ring.
 * Flipping these per scheme would change the brand, not adapt it; what
 * adapts is the page around them, and the `OnBrand` text drawn on top.
 */
export const Brand = {
  /** Three-stop accent ramp for large fills (plan summary card). */
  accentGradient: ['#FF8F2A', '#FF6A13', '#F25A00'] as const,
  /** Two-stop accent ramp for tiles and small CTAs. */
  accentGradientSoft: ['#FF8A1F', '#FF5E00'] as const,
  /** Two-stop ramp for small square badges (workout badge). */
  badgeGradient: ['#FF8F2A', '#FF6A13'] as const,
  /** Mid-stop of the ramps above, for glows/shadows cast by an accent fill. */
  accentGlow: '#FF6A13',
  /** The same glow as a drop shadow (web `boxShadow` takes a color, not an opacity). */
  accentShadow: 'rgba(255,106,19,0.28)',
  successShadow: 'rgba(34,179,94,0.28)',
  /** Pressed/recessed state inside an accent fill (a track behind a bar). */
  accentWell: 'rgba(242,90,0,0.55)',
  successGradient: ['#34C77B', '#1FA85B'] as const,
  successGlow: '#22B35E',
  green: '#22B35E',
  yellow: '#F6B21B',
  /** Blobs that orbit inside the coach orb. */
  orbWarm: ['#D9660F', '#FF7A1A', '#FFB454'] as const,
  orbDeep: ['#7A1E00', '#B33A0A', '#E8590C'] as const,
  orbBright: ['#C24E12', '#FF7A1A', '#FFA83D'] as const,
} as const;

/**
 * Ink drawn on a `Brand` fill or any other known-dark, known-saturated
 * surface. Scheme-independent for the same reason `Brand` is: the surface
 * underneath does not change with the scheme, so neither may its contrast.
 */
export const OnBrand = {
  text: '#FFFFFF',
  /** Supporting copy on a brand fill — still well over 4.5:1 on the ramps above. */
  textMuted: 'rgba(255,255,255,0.88)',
  textFaint: 'rgba(255,255,255,0.72)',
  /** Translucent white tiles/chips carved out of a brand fill. */
  fill: 'rgba(255,255,255,0.18)',
  fillStrong: 'rgba(255,255,255,0.28)',
  divider: 'rgba(255,255,255,0.22)',
  /**
   * Band painted over the top safe area of the iOS Home Screen web app.
   * Black in both schemes on purpose: that status bar is
   * "black-translucent", so iOS always draws the clock and battery in
   * white, and a scheme-following band would hide them in light mode.
   */
  statusBarBand: '#000000',
} as const;

/**
 * Workout session ("gym floor") mode: a black canvas with graphite tiles and
 * a neon go-colour, legible at arm's length under gym lighting while a set is
 * running. Deliberately the same in both schemes — the session takes over the
 * whole screen, so it sets its own lighting rather than following the app's,
 * the way a camera viewfinder does.
 */
export const SessionColors = {
  background: '#000000',
  card: '#1C1C1E',
  cardHigh: '#2C2C2E',
  text: '#FFFFFF',
  muted: '#8E8E93',
  go: '#3DF56B',
  goSoft: 'rgba(61,245,107,0.16)',
  accent: orange[500],
} as const;

export const Colors = {
  light: {
    // Greys sampled from the Liquid Glass reference: soft grey page, milky
    // translucent glass cards only a shade lighter than it (their white rim
    // does the separating), recessed wells a shade darker.
    background: PageBackground.light,
    // Reference style: a near-white page with plain white cards on it — no
    // glass, no rim — and wells inside the cards a hair darker.
    backgroundElevated: '#FFFFFF',
    backgroundElement: '#F1F1F3',
    backgroundSelected: '#EAEAEC',
    surfaceGlass: 'rgba(247,247,247,0.72)',
    surfaceGlassStrong: 'rgba(247,247,247,0.88)',
    border: 'rgba(14,14,17,0.07)',
    borderStrong: 'rgba(14,14,17,0.14)',
    cardEdge: 'rgba(255,255,255,0)',
    // Round header buttons (notifications, profile…).
    iconButton: '#F4F4F4',
    // Text colours sampled from the light reference: near-black titles and
    // values, #89898A for labels and secondary lines, a lighter grey for
    // what is not there yet (future days, hints).
    text: '#0B0B0D',
    textSecondary: '#89898A',
    textTertiary: '#ABABAD',
    accent: orange[500],
    accentPressed: orange[600],
    accentSoft: orange[50],
    onAccent: neutral[0],
    // Pushed toward the same "highlighter marker" saturation as dark mode's
    // neon green/yellow below, but held back a notch so they still read as
    // text on a white background instead of washing out.
    success: '#00A651',
    // Soft mint tint for "this card is a success/positive-status card" fills
    // (Home's today/result cards) — the flat-card counterpart to accentSoft,
    // same role but for the success color instead of the accent.
    successSoft: '#E3F7EC',
    warning: '#D9A600',
    danger: '#D6402C',
    // Used only for the calorie-delta bars (surplus/deficit) on the weekly
    // burn chart — deliberately distinct from success/danger so that bar
    // reads as its own "delta" signal rather than duplicating the
    // good/bad framing already carried by color elsewhere on that card.
    calorieSurplus: '#0B72E0',
    calorieDeficit: '#C2178E',
    // Fixed brand greens/yellows from the Figma screens — unlike success/warning (neon in dark mode, chosen to read as *text*), these also have to work as solid fills behind white labels (e.g. the green "Registra allenamento" button), so they don't change per scheme.
    brandGreen: '#22B35E',
    brandYellow: '#F6B21B',
    tabBarBlur: 'light' as const,
    shadow: 'rgba(20,20,25,0.12)',

    // Page wash: the soft vertical grey gradient painted behind every light
    // screen (ScreenScroll). Dark mode is a flat near-black instead, so both
    // stops collapse onto `background` there.
    washTop: '#F7F7F7',
    washBottom: '#F7F7F7',

    /** Dimming layer behind a sheet or popup. */
    scrim: 'rgba(0,0,0,0.45)',
    /** Softer dim used by glass popups, which already blur what is behind. */
    scrimSoft: 'rgba(20,20,30,0.18)',
    /** Ticks notched into a progress bar, over and before the fill. */
    tickOnFill: 'rgba(0,0,0,0.14)',
    tickOnTrack: 'rgba(255,106,19,0.16)',

    // Calorie-balance scales (Home's semi-ring, components/home/balance-tone.ts).
    // Toward the goal: very faint far from it, then mid, strong, and a full
    // green only once the goal is reached. Hex only — they are interpolated.
    balanceGoalScale: ['#CDEFD9', '#86D4A6', '#3DBA72', '#14904F'] as const,
    // Away from the goal, on the surplus side: the weekly chart's surplus blue.
    balanceSurplusScale: ['#CFE3FA', '#0B72E0'] as const,
    // Away from the goal on the deficit side (only reachable on a surplus goal): its deficit magenta.
    balanceDeficitScale: ['#F6D3EA', '#C2178E'] as const,
  },
  dark: {
    background: PageBackground.dark,
    // Reference style: pure black page, graphite cards a step above it, wells a step above the cards.
    backgroundElevated: '#141519',
    backgroundElement: '#1D1E23',
    backgroundSelected: '#26272D',
    surfaceGlass: 'rgba(28,29,34,0.55)',
    surfaceGlassStrong: 'rgba(28,29,34,0.78)',
    border: 'rgba(255,255,255,0.07)',
    borderStrong: 'rgba(255,255,255,0.16)',
    cardEdge: 'rgba(255,255,255,0.04)',
    iconButton: '#1D1E23',
    // Text colours sampled from the dark reference: white titles and values,
    // soft grey for secondary lines, a dimmer grey for hints.
    text: '#FFFFFF',
    textSecondary: '#A6A7AD',
    textTertiary: '#76777D',
    accent: orange[500],
    accentPressed: orange[300],
    accentSoft: 'rgba(255,122,0,0.16)',
    onAccent: neutral[0],
    // True neon-marker green/yellow — dark is the hero mode, and these read
    // as genuinely bright against near-black the way a highlighter does
    // under UV rather than the previous muted amber/jade.
    success: '#39FF14',
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

    // Dark mode's page is already a flat near-black: no wash to paint, so
    // both stops sit on the background and ScreenScroll skips the gradient.
    washTop: neutral[950],
    washBottom: neutral[950],

    scrim: 'rgba(0,0,0,0.55)',
    scrimSoft: 'rgba(0,0,0,0.38)',
    // Black notches vanish on a dark track; white ones read the same way
    // black ones do in light mode.
    tickOnFill: 'rgba(0,0,0,0.22)',
    tickOnTrack: 'rgba(255,255,255,0.12)',

    // Same roles as light; the faint ends sit just above the dark track
    // instead of just below white, and the full ends stay clear of neon.
    balanceGoalScale: ['#1E4A31', '#2D7D4F', '#3FBF73', '#5BEA91'] as const,
    balanceSurplusScale: ['#1C3550', '#3AA0FF'] as const,
    balanceDeficitScale: ['#4A1D3F', '#FF3FD1'] as const,
  },
} as const;

/** Every token name shared by both schemes. Includes the few whose value is a
 *  gradient stop list, so it is not directly usable as a single color. */
type ThemeTokenName = keyof typeof Colors.light & keyof typeof Colors.dark;

/** The tokens that resolve to one color in both schemes — the only ones a
 *  `color`/`backgroundColor` prop can take (ThemedText, ThemedView). Scale
 *  tokens like `balanceGoalScale` are excluded by construction. */
export type ThemeColor = {
  [K in ThemeTokenName]: typeof Colors.light[K] extends string
    ? typeof Colors.dark[K] extends string
      ? K
      : never
    : never;
}[ThemeTokenName];

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

/** Semantic layout rhythm, so screens and sheets share one set of edges and
 * gaps instead of each picking from the raw scale. 20 pt gutters match the
 * iPhone's own grouped screens; 24 pt between sections reads as a clear
 * break without leaving holes, and 12 pt holds related cards together. */
export const Layout = {
  screenGutter: 20,
  sectionGap: 24,
  cardPadding: 20,
  cardGap: 12,
  /** Minimum side of anything tappable (Apple HIG: 44 × 44 pt). */
  minTouch: 44,
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

/**
 * The Liquid Glass material, keyed by the tone the glass is rendered over.
 * Lives here with the rest of the tokens so a component never spells out a
 * raw rgba: `tinted` is a glass sitting on top of a coloured fill, where the
 * tint is the fill's own colour rather than white.
 *
 * Consumed by components/glass/liquid-glass.tsx and glass-surface.tsx.
 */
export type GlassTone = 'light' | 'dark' | 'tinted';

export const GlassMaterial = {
  /** Body tint: how much white the glass itself carries, top to bottom. */
  tint: {
    light: ['rgba(255,255,255,0.62)', 'rgba(255,255,255,0.26)'],
    dark: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.03)'],
    tinted: ['rgba(255,255,255,0)', 'rgba(255,255,255,0)'],
  },
  /** The specular sheen: light catching the upper half of a curved surface. */
  specular: {
    light: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'],
    dark: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'],
    tinted: ['rgba(255,255,255,0.34)', 'rgba(255,255,255,0)'],
  },
  /**
   * The rim, from the outside in: a bright top edge, a fainter caustic along
   * the bottom, a hairline all round, a glow that fades within a few points
   * of the edge, and a shade low inside that reads as the glass's thickness.
   */
  rim: {
    light: [
      'inset 0px 1px 1px rgba(255,255,255,0.95)',
      'inset 0px -1px 1px rgba(255,255,255,0.5)',
      'inset 0px 0px 0px 0.5px rgba(255,255,255,0.75)',
      'inset 0px 0px 6px rgba(255,255,255,0.4)',
      'inset 0px -6px 10px -6px rgba(0,0,0,0.10)',
    ].join(', '),
    dark: [
      'inset 0px 1px 1px rgba(255,255,255,0.30)',
      'inset 0px -1px 1px rgba(255,255,255,0.10)',
      'inset 0px 0px 0px 0.5px rgba(255,255,255,0.16)',
      'inset 0px 0px 6px rgba(255,255,255,0.06)',
      'inset 0px -6px 10px -6px rgba(0,0,0,0.35)',
    ].join(', '),
    tinted: [
      'inset 0px 1px 1px rgba(255,255,255,0.65)',
      'inset 0px -1px 1px rgba(255,255,255,0.25)',
      'inset 0px 0px 0px 0.5px rgba(255,255,255,0.35)',
      'inset 0px 0px 8px rgba(255,255,255,0.18)',
    ].join(', '),
  },
  /** What the glass casts onto the page below it. */
  dropShadow: {
    light: '0px 6px 18px rgba(20,20,25,0.10), 0px 1px 3px rgba(20,20,25,0.06)',
    dark: '0px 8px 22px rgba(0,0,0,0.38), 0px 1px 3px rgba(0,0,0,0.30)',
  },
  /** A brighter lens set into a glass surface: the selected tab's capsule. */
  lens: {
    light: {
      fill: 'rgba(255,255,255,0.72)',
      shadow:
        'inset 0px 1px 1px rgba(255,255,255,1), inset 0px -1px 1px rgba(255,255,255,0.6), inset 0px 0px 0px 0.5px rgba(255,255,255,0.9), 0px 2px 8px rgba(20,20,25,0.10)',
    },
    dark: {
      fill: 'rgba(255,255,255,0.13)',
      shadow:
        'inset 0px 1px 1px rgba(255,255,255,0.28), inset 0px 0px 0px 0.5px rgba(255,255,255,0.14), 0px 2px 8px rgba(0,0,0,0.30)',
    },
  },
  /** Larger glass panels (cards, sheets) rather than controls. */
  surfaceSheen: {
    light: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.18)'],
    dark: ['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)'],
  },
  surfaceBorder: { light: 'rgba(14,14,17,0.10)', dark: 'rgba(255,255,255,0.16)' },
  surfaceBorderTop: { light: 'rgba(255,255,255,0.9)', dark: 'rgba(255,255,255,0.30)' },
  /** A round button's own inner highlight (profile avatar). */
  buttonInset: { light: 'inset 0px 1px 1px rgba(255,255,255,0.6)', dark: 'inset 0px 1px 1px rgba(255,255,255,0.25)' },
} as const;

/**
 * The flat (non-blurred) card: an inner top highlight and a soft bloom, over
 * a drop shadow that grounds it on the page.
 */
export const FlatCardShadow = {
  light: '0px 1px 2px rgba(20,20,25,0.03)',
  dark: '0px 0px 0px rgba(0,0,0,0)',
} as const;

/** Sheets rising from the bottom edge cast upward, not down. */
export const SheetShadow = '0px -10px 34px rgba(0,0,0,0.28)';
