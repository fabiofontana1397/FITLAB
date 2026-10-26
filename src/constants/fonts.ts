import { Platform, type TextStyle } from 'react-native';

/**
 * The app's typeface is the system font — San Francisco on iPhone — so type
 * looks, sizes and scales like the rest of iOS. On the web the stack leads
 * with Apple's system font (what Safari on iPhone and Mac resolves it to) and
 * falls back to each platform's own UI font; on native, leaving `fontFamily`
 * unset is what selects the system font, with every weight built in.
 */
export const SYSTEM_FONT_FAMILY = Platform.select<string | undefined>({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  default: undefined,
});

/** A fontWeight in the range iOS text styles use: Regular, Medium, Semibold, Bold. 800 and 900 read heavier than any system style, so they step down to Bold. */
export function systemFontWeight(weight: unknown): TextStyle['fontWeight'] {
  if (weight === 'bold') return '700';
  if (weight == null || weight === 'normal') return '400';
  const n = Number(weight);
  if (!Number.isFinite(n)) return '400';
  if (n <= 400) return '400';
  if (n <= 500) return '500';
  if (n <= 600) return '600';
  return '700';
}
