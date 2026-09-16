import { daysAgoISO } from './dates';
import type { BodyMetricSnapshot } from './types';

// A real account can reach Home/Body with zero measurements (e.g. a second
// device logging in before this device has ever synced a real entry) — a
// zero-value snapshot for today, not a fabricated one, keeps callers from
// having to null-check on every read.
function emptySnapshot(): BodyMetricSnapshot {
  return {
    date: daysAgoISO(0),
    weightKg: 0,
    bodyFatPct: 0,
    muscleMassKg: 0,
    shouldersCm: 0,
    chestCm: 0,
    bicepsCm: 0,
    waistCm: 0,
    hipsCm: 0,
    thighCm: 0,
    restingHeartRate: 0,
    sleepHours: 0,
  };
}

export function latestSnapshot(entries: BodyMetricSnapshot[]): BodyMetricSnapshot {
  return entries[entries.length - 1] ?? emptySnapshot();
}

export function seriesOf(entries: BodyMetricSnapshot[], key: keyof BodyMetricSnapshot): number[] {
  return entries.map((s) => Number(s[key]));
}

export function percentChange(entries: BodyMetricSnapshot[], key: keyof BodyMetricSnapshot, spanFromEnd = 4): number {
  const series = seriesOf(entries, key);
  const start = series[Math.max(0, series.length - 1 - spanFromEnd)];
  const end = series[series.length - 1];
  if (!start) return 0;
  return ((end - start) / start) * 100;
}

export function deltaFromPrevious(entries: BodyMetricSnapshot[], key: keyof BodyMetricSnapshot): number {
  if (entries.length < 2) return 0;
  const end = Number(entries[entries.length - 1][key]);
  const prev = Number(entries[entries.length - 2][key]);
  return end - prev;
}
