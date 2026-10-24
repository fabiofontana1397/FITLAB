/**
 * The page background for each scheme.
 *
 * Its own module, with no React Native (or CSS) imports, so the static web
 * shell in src/app/+html.tsx — which renders in a bare Node pass during
 * `expo export` and cannot pull in constants/theme.ts — can share the exact
 * same values instead of repeating them. theme.ts builds `background` from
 * these, so the three places the page colour appears can never drift.
 */
export const PageBackground = {
  light: '#E9E9E8',
  dark: '#000000',
} as const;
