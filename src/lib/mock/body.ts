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

/**
 * The measurements actually taken for one zone, oldest first. Every snapshot carries the previous values forward
 * (a weigh-in copies the last tape measures), so a value counts as a measurement only on the day it first appears
 * or changes; 0 means never measured.
 */
export function measurementHistory(entries: BodyMetricSnapshot[], key: keyof BodyMetricSnapshot): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  let previous = 0;
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const v = Number(e[key]);
    const value = Number.isFinite(v) && v > 0 ? v : 0;
    if (value > 0 && value !== previous) out.push({ date: e.date, value });
    previous = value;
  }
  return out;
}

/**
 * Entries with the measurement of `date` removed from one zone: that day and the following days that only carried
 * it forward go back to the value measured before (or to nothing). Returns the changed entries too, to save them.
 */
export function withoutMeasurement(entries: BodyMetricSnapshot[], key: keyof BodyMetricSnapshot, date: string): { entries: BodyMetricSnapshot[]; changed: BodyMetricSnapshot[] } {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const start = sorted.findIndex((e) => e.date === date);
  if (start < 0) return { entries, changed: [] };
  const removed = Number(sorted[start][key]);
  const before = start > 0 ? Number(sorted[start - 1][key]) : 0;
  const restore = Number.isFinite(before) && before > 0 && before !== removed ? before : 0;
  const changed: BodyMetricSnapshot[] = [];
  for (let i = start; i < sorted.length && Number(sorted[i][key]) === removed; i++) {
    sorted[i] = { ...sorted[i], [key]: restore };
    changed.push(sorted[i]);
  }
  return { entries: sorted, changed };
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
