import { useMemo } from 'react';

import type { WeightPoint } from '@/components/ui/goal-trend-chart';
import { currentWeekDates, dayOfMonth, monthShortLabel, weekdayShort } from '@/lib/mock/dates';
import type { BodyMetricSnapshot } from '@/lib/mock/types';

export type WeightRange = 'settimana' | 'mese' | 'anno';

/** Whether each point in a range's series represents a single day or a
 * whole month — feeds GoalTrendChart's period-caption wording. */
export function weightDateGranularity(range: WeightRange): 'day' | 'month' {
  return range === 'anno' ? 'month' : 'day';
}

/** The last `count` days the user actually weighed in (a day's several
 * entries averaged), oldest first: only tracked days, so a gap of untracked
 * days never leaves the chart empty. Feeds the Progress page's "Andamento peso". */
export function useRecentWeightSeries(bodyEntries: BodyMetricSnapshot[], count = 30): WeightPoint[] {
  return useMemo<WeightPoint[]>(() => {
    const byDate = new Map<string, number[]>();
    for (const e of bodyEntries) {
      const bucket = byDate.get(e.date) ?? [];
      bucket.push(e.weightKg);
      byDate.set(e.date, bucket);
    }
    return [...byDate.keys()]
      .sort()
      .slice(-count)
      .map((date) => {
        const values = byDate.get(date) ?? [];
        return { xLabel: `${dayOfMonth(date)}`, value: Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10, date };
      });
  }, [bodyEntries, count]);
}

/** Builds the fixed set of axis slots a weight trend chart shows for the
 * selected range — days of this week, days of this month, months of this
 * year — each slot keeping its gridline/label even when nothing was logged
 * for it yet, so the axes always read as a complete chart rather than only
 * appearing once data exists. Shared by the Home "Obiettivo" card and the
 * Body page's weight box so both charts stay in sync. */
export function useWeightSeries(bodyEntries: BodyMetricSnapshot[], weightRange: WeightRange): WeightPoint[] {
  return useMemo<WeightPoint[]>(() => {
    const byDate = new Map<string, number[]>();
    for (const e of bodyEntries) {
      const bucket = byDate.get(e.date) ?? [];
      bucket.push(e.weightKg);
      byDate.set(e.date, bucket);
    }
    const avgFor = (date: string) => {
      const values = byDate.get(date);
      if (!values || values.length === 0) return null;
      return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
    };

    const now = new Date();

    if (weightRange === 'settimana') {
      return currentWeekDates(now).map((date) => ({ xLabel: weekdayShort(date), value: avgFor(date), date }));
    }

    if (weightRange === 'mese') {
      const year = now.getFullYear();
      const month = now.getMonth();
      const dayCount = new Date(year, month + 1, 0).getDate();
      return Array.from({ length: dayCount }, (_, i) => {
        const date = `${year}-${(month + 1).toString().padStart(2, '0')}-${(i + 1).toString().padStart(2, '0')}`;
        return { xLabel: `${i + 1}`, value: avgFor(date), date };
      });
    }

    // anno
    const year = now.getFullYear();
    const sums = Array.from({ length: 12 }, () => ({ sum: 0, count: 0 }));
    for (const [date, values] of byDate) {
      const d = new Date(date);
      if (d.getFullYear() !== year) continue;
      const bucket = sums[d.getMonth()];
      bucket.sum += values.reduce((sum, v) => sum + v, 0);
      bucket.count += values.length;
    }
    return sums.map((bucket, i) => ({
      xLabel: monthShortLabel(year, i),
      value: bucket.count > 0 ? Math.round((bucket.sum / bucket.count) * 10) / 10 : null,
      date: `${year}-${(i + 1).toString().padStart(2, '0')}-01`,
    }));
  }, [bodyEntries, weightRange]);
}
