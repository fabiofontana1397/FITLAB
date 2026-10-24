import type { BalanceReading } from '@/domain/calorie-balance';
import type { useTheme } from '@/hooks/use-theme';

type Theme = ReturnType<typeof useTheme>;

/**
 * Where along the goal scale each of its four greens sits, as progress from
 * equilibrium (0) to the goal (1): very faint, mid, strong, full. Between two
 * stops the colour is interpolated, so it changes continuously rather than in
 * steps; the full green is reserved for the goal itself.
 */
export const GOAL_TONE_STOPS = [0, 0.5, 0.85, 1] as const;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[c(ar, br), c(ag, bg), c(ab, bb)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Colour at `t` (0…1) along evenly spaced or explicitly placed stops. */
function sampleScale(colors: readonly string[], t: number, stops?: readonly number[]): string {
  const at = stops ?? colors.map((_, i) => i / (colors.length - 1));
  const x = Math.max(0, Math.min(1, t));
  for (let i = 1; i < at.length; i++) {
    if (x <= at[i]) {
      const span = at[i] - at[i - 1];
      return mix(colors[i - 1], colors[i], span > 0 ? (x - at[i - 1]) / span : 1);
    }
  }
  return colors[colors.length - 1];
}

/**
 * The single colour of the day's balance — the semi-ring's fill and both
 * markers share it, so they can never disagree.
 *
 * - On the goal's side of equilibrium: the goal greens, by progress.
 * - On the other side: the delta colour of that side (surplus blue, deficit
 *   magenta), deeper the further out, measured against the display range.
 * - No intake logged: neutral, because there is nothing to judge yet.
 */
export function balanceTone(reading: BalanceReading, theme: Theme): string {
  if (reading.status === 'missing') return theme.textTertiary;
  if (reading.towardGoal) return sampleScale(theme.balanceGoalScale, reading.reached ? 1 : Math.min(reading.progress, 0.999), GOAL_TONE_STOPS);
  const away = Math.abs(reading.balanceKcal) / reading.halfRangeKcal;
  return sampleScale(reading.balanceKcal > 0 ? theme.balanceSurplusScale : theme.balanceDeficitScale, away);
}
