import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { ProgressRing } from '@/components/ui/progress-ring';
import { ThemedText } from '@/components/themed-text';
import { formatDayRange } from '@/lib/mock/dates';
import { Spacing } from '@/constants/theme';

export type WeeklyBurnDay = {
  label: string;
  /** ISO date, used only to build the "14-20 settembre" style period caption. */
  date: string;
  /** Estimated energy expenditure — never a wearable/HR measurement, see spec §5 bis. */
  estimatedExpenditureKcal: number;
  eatenKcal: number;
  isToday: boolean;
  hasHappened: boolean;
  rings: { training: number; diet: number; steps: number };
};

export type WeeklyBurnChartProps = {
  days: WeeklyBurnDay[];
  /** Legend swatch only — no bar is drawn in this color anymore. */
  expenditureColor: string;
  /** Legend swatch only — no bar is drawn in this color anymore. */
  eatenColor: string;
  /** Bar color on a surplus day (ate more than burned) — grows upward, above zero. */
  surplusColor: string;
  /** Bar color on a deficit day (burned more than ate) — grows downward, below zero. */
  deficitColor: string;
  trackColor: string;
  axisColor: string;
  todayBadgeColor: string;
  todayBadgeTextColor: string;
  trainingColor: string;
  dietColor: string;
  stepsColor: string;
  width?: number;
  /** Height of the bar-chart area only (excludes the ring-badge row, period
   * caption and legend below it). */
  height?: number;
};

// Wide enough that a 4-5 digit kcal value never clips/wraps, while still
// leaving the ring-badge row below as much of the card's width as possible
// (the 7 same-width rings would otherwise overlap in a no-scroll week).
const GUTTER_WIDTH = 34;
const PADDING_TOP = 14;
const PADDING_BOTTOM = 14;
const PERIOD_LABEL_HEIGHT = 18;
const RING_SIZE = 36;

type Bar = {
  colX: number;
  barX: number;
  barY: number;
  barH: number;
  barWidth: number;
  delta: number | null;
  /** Where the value label goes — above the bar for a surplus (it grows up),
   * below the bar for a deficit (it grows down). */
  labelY: number;
};

function buildBars(days: WeeklyBurnDay[], plotWidth: number, height: number) {
  const plotHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const halfHeight = plotHeight / 2;
  const zeroY = PADDING_TOP + halfHeight;
  if (plotWidth <= 0 || days.length === 0) return { bars: [] as Bar[], zeroY, maxLabel: '0' };

  // Surplus (ate more than the estimated expenditure) is positive and grows
  // up from zero; deficit (estimated expenditure more than ate) is negative
  // and grows down from zero.
  const deltas = days.map((d) => (d.hasHappened ? d.eatenKcal - d.estimatedExpenditureKcal : null));
  const max = Math.max(...deltas.filter((d): d is number => d != null).map((d) => Math.abs(d)), 1);

  const colWidth = plotWidth / days.length;
  const barWidth = Math.max(10, Math.min(22, colWidth * 0.5));

  const bars: Bar[] = days.map((day, i) => {
    const colX = i * colWidth + colWidth / 2;
    const delta = deltas[i];
    const barH = delta != null ? (Math.abs(delta) / max) * halfHeight : 0;
    const barY = delta != null && delta >= 0 ? zeroY - barH : zeroY;
    return {
      colX,
      barX: colX - barWidth / 2,
      barY,
      barH,
      barWidth,
      delta,
      labelY: delta != null && delta >= 0 ? barY - 13 : barY + barH + 3,
    };
  });

  return { bars, zeroY, maxLabel: `${Math.round(max)}` };
}

/** A week-at-a-glance card, always showing Monday-Sunday of the current
 * week (no scrolling): one bar per day for that day's calorie
 * deficit/surplus, growing up from a centered zero line on a surplus day
 * (blue) and down on a deficit day (fuchsia), labeled with its kcal value.
 * A concentric-ring badge below each day summarizes that day's
 * training/diet/steps. Days that haven't happened yet show no bar. */
export function WeeklyBurnChart({
  days,
  expenditureColor,
  eatenColor,
  surplusColor,
  deficitColor,
  trackColor,
  axisColor,
  todayBadgeColor,
  todayBadgeTextColor,
  trainingColor,
  dietColor,
  stepsColor,
  width,
  height = 130,
}: WeeklyBurnChartProps) {
  const [measuredWidth, setMeasuredWidth] = useState(width ?? 0);
  const containerWidth = width ?? measuredWidth;
  const plotWidth = Math.max(containerWidth - GUTTER_WIDTH, 0);
  const colWidth = plotWidth / Math.max(days.length, 1);

  const { bars, zeroY, maxLabel } = buildBars(days, plotWidth, height);

  const onLayout = (e: LayoutChangeEvent) => {
    if (width == null) setMeasuredWidth(e.nativeEvent.layout.width);
  };

  const periodLabel = days.length > 0 ? formatDayRange(days[0].date, days[days.length - 1].date) : '';

  return (
    <View onLayout={onLayout} style={{ width: width ?? '100%' }}>
      {containerWidth > 0 ? (
        <>
          <View style={{ flexDirection: 'row' }}>
            {/* Fixed kcal-axis gutter — top is the surplus scale, bottom
                (mirrored) the deficit scale, zero in the middle. */}
            <View style={{ width: GUTTER_WIDTH, height }}>
              <Text
                numberOfLines={1}
                style={{ position: 'absolute', left: 0, width: GUTTER_WIDTH - 4, top: PADDING_TOP - 6, fontSize: 9, color: axisColor, textAlign: 'right' }}>
                {maxLabel}
              </Text>
              <Text
                numberOfLines={1}
                style={{ position: 'absolute', left: 0, width: GUTTER_WIDTH - 4, top: zeroY - 6, fontSize: 9, color: axisColor, textAlign: 'right' }}>
                0
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  position: 'absolute',
                  left: 0,
                  width: GUTTER_WIDTH - 4,
                  top: height - PADDING_BOTTOM - 6,
                  fontSize: 9,
                  color: axisColor,
                  textAlign: 'right',
                }}>
                -{maxLabel}
              </Text>
            </View>

            <View style={{ width: plotWidth }}>
              <View style={{ width: plotWidth, height }}>
                <Svg width={plotWidth} height={height}>
                  <Line x1={0} y1={zeroY} x2={plotWidth} y2={zeroY} stroke={trackColor} strokeWidth={1} />
                  {bars.map((bar, i) =>
                    bar.delta != null ? (
                      <Rect
                        key={`bar-${i}`}
                        x={bar.barX}
                        y={bar.barY}
                        width={bar.barWidth}
                        height={Math.max(bar.barH, 1)}
                        rx={3}
                        fill={bar.delta >= 0 ? surplusColor : deficitColor}
                      />
                    ) : null
                  )}
                </Svg>

                {bars.map((bar, i) =>
                  bar.delta != null ? (
                    <Text
                      key={i}
                      style={{
                        position: 'absolute',
                        left: bar.colX - 22,
                        width: 44,
                        top: bar.labelY,
                        fontSize: 9,
                        fontWeight: '700',
                        textAlign: 'center',
                        color: bar.delta >= 0 ? surplusColor : deficitColor,
                      }}>
                      {bar.delta >= 0 ? '+' : ''}
                      {Math.round(bar.delta)}
                    </Text>
                  ) : null
                )}
              </View>

              <View style={{ flexDirection: 'row', width: plotWidth }}>
                {days.map((day, i) => (
                  <View key={i} style={{ width: colWidth, alignItems: 'center' }}>
                    {day.isToday ? (
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: todayBadgeColor,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: Spacing.one,
                        }}>
                        <ThemedText type="caption" style={{ color: todayBadgeTextColor, fontWeight: '700', fontSize: 11 }}>
                          {day.label}
                        </ThemedText>
                      </View>
                    ) : (
                      <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: Spacing.one }}>
                        {day.label}
                      </ThemedText>
                    )}
                    <ProgressRing size={RING_SIZE} strokeWidth={4} progress={day.rings.training} color={trainingColor} trackColor={trackColor}>
                      <ProgressRing size={RING_SIZE - 10} strokeWidth={3} progress={day.rings.diet} color={dietColor} trackColor={trackColor}>
                        <ProgressRing size={RING_SIZE - 19} strokeWidth={2.5} progress={day.rings.steps} color={stepsColor} trackColor={trackColor} />
                      </ProgressRing>
                    </ProgressRing>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Period caption — the current week's fixed Monday-Sunday range,
              e.g. "14-20 settembre". */}
          <Text style={{ textAlign: 'center', fontSize: 11, fontWeight: '600', color: axisColor, height: PERIOD_LABEL_HEIGHT, marginTop: Spacing.one }}>
            {periodLabel}
          </Text>

          {/* Legend, below the period caption */}
          <View style={styles.legendRow}>
            <LegendItem color={expenditureColor} label="Dispendio stimato" />
            <LegendItem color={eatenColor} label="Assunte" />
            <LegendItem color={deficitColor} label="Deficit" />
            <LegendItem color={surplusColor} label="Surplus" />
          </View>
        </>
      ) : null}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = {
  legendRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    columnGap: Spacing.two,
    rowGap: Spacing.one,
    marginTop: Spacing.one,
  },
  legendItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
};
