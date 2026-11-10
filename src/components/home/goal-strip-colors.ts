import type { GoalBand } from '@/domain/calorie-balance';
import type { useTheme } from '@/hooks/use-theme';

type Theme = ReturnType<typeof useTheme>;
export type Rgb = [number, number, number];

export const CHAMPAGNE: Rgb = [248, 220, 149];

export function rgbOf(color: string): Rgb | null {
  const hex = /^#([0-9a-f]{6})/i.exec(color);
  if (!hex) return null;
  const n = parseInt(hex[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const css = (c: Rgb) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;

/**
 * The colour of each of `count` strips (odd, so one sits on the goal) of a goal
 * ring: the deep green at the goal, fading through the acceptable range, then
 * champagne and finally orange towards the two ends. Shared by Home's big gauge
 * and the little semi-rings of the week strip, so they always read the same way.
 */
export function goalStripColors(count: number, band: Pick<GoalBand, 'halfRangeKcal' | 'toleranceKcal'>, theme: Theme, inactive = false): string[] {
  const mid = (count - 1) / 2;
  const [pale, soft, , deep] = theme.balanceGoalScale.map((c) => rgbOf(c) as Rgb);
  const orange = rgbOf(theme.accent) as Rgb;
  const track = rgbOf(theme.backgroundElement) ?? pale;
  return Array.from({ length: count }, (_, i) => {
    const d = (Math.abs(i - mid) / mid) * band.halfRangeKcal;
    if (inactive) return css(mix(track, pale, i === mid ? 0.4 : 0));
    let c: Rgb;
    if (d <= band.toleranceKcal) c = mix(deep, soft, Math.pow(d / band.toleranceKcal, 1.1) * 0.9);
    else {
      const u = (d - band.toleranceKcal) / Math.max(1, band.halfRangeKcal - band.toleranceKcal);
      c = u < 0.25 ? mix(soft, CHAMPAGNE, u / 0.25) : mix(CHAMPAGNE, orange, Math.min(1, Math.pow((u - 0.25) / 0.75, 0.9)));
    }
    return css(c);
  });
}
