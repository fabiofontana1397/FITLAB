import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { useRevealedValue } from '@/components/motion/reveal';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type IntakeSlot = {
  /** "HH:MM" — the slot's time of day, from the meal plan. */
  time: string;
  /** Calories actually registered in this slot today. */
  eatenKcal: number;
  /** The slot's share of the daily target, as a fraction (0..1). */
  share: number;
};

export type IntakePaceChartProps = {
  slots: IntakeSlot[];
  targetKcal: number;
  height?: number;
};

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map((part) => parseInt(part, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function formatKcal(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * The day's calories as they accumulate, against the pace the plan sets.
 *
 * Both lines are the user's own data: the orange one adds up what has
 * actually been registered, placed at the time of the meal it was
 * registered under; the grey one is the plan's own distribution of the
 * daily target across those same meals. Nothing here is simulated — a day
 * with nothing registered yet shows the pace alone and says so.
 */
export function IntakePaceChart({ slots, targetKcal, height = 132 }: IntakePaceChartProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const reveal = useRevealedValue(1, 220);

  const lineProps = useAnimatedProps(() => ({ opacity: reduceMotion ? 1 : reveal.value }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  // Cumulative series over the day's meal times.
  type SeriesPoint = { minutes: number; time: string; eaten: number; pace: number };
  const series: SeriesPoint[] = [];
  let runningEaten = 0;
  let runningPace = 0;
  for (const slot of slots) {
    runningEaten += Math.max(slot.eatenKcal, 0);
    runningPace += targetKcal * slot.share;
    series.push({ minutes: minutesOf(slot.time), time: slot.time, eaten: runningEaten, pace: runningPace });
  }

  // The latest meal that actually has food in it — where the orange line
  // stops, since nothing is known about the hours after it.
  let lastLogged: SeriesPoint | null = null;
  for (let i = 0; i < series.length; i++) {
    if (slots[i].eatenKcal > 0) lastLogged = series[i];
  }
  const eatenTotal = series.length > 0 ? series[series.length - 1].eaten : 0;
  const hasData: boolean = eatenTotal > 0 && lastLogged != null;
  const lastPoint: SeriesPoint | null = lastLogged;

  // Domain: from an hour before the first meal to the last one, so neither
  // line starts glued to the left edge.
  const startMinutes = (series[0]?.minutes ?? 7 * 60) - 60;
  const endMinutes = series[series.length - 1]?.minutes ?? 22 * 60;
  const maxValue = Math.max(targetKcal, eatenTotal, 1) * 1.08;

  const padLeft = 4;
  const padRight = 4;
  const padTop = 10;
  const padBottom = 8;
  const plotWidth = Math.max(width - padLeft - padRight, 1);
  const plotHeight = Math.max(height - padTop - padBottom, 1);

  const x = (minutes: number) =>
    padLeft + ((minutes - startMinutes) / Math.max(endMinutes - startMinutes, 1)) * plotWidth;
  const y = (kcal: number) => padTop + (1 - kcal / maxValue) * plotHeight;

  const pathOf = (key: 'eaten' | 'pace', stopAfterMinutes?: number) => {
    const points = [`M ${x(startMinutes)} ${y(0)}`];
    for (const point of series) {
      if (stopAfterMinutes != null && point.minutes > stopAfterMinutes) break;
      points.push(`L ${x(point.minutes)} ${y(point[key])}`);
    }
    return points.join(' ');
  };

  const targetY = y(targetKcal);
  const paceAtLast = lastPoint?.pace ?? 0;
  const diff = (lastPoint?.eaten ?? 0) - paceAtLast;
  const status = !hasData
    ? 'Nessun pasto registrato oggi'
    : Math.abs(diff) <= Math.max(targetKcal * 0.07, 80)
      ? 'In linea con il ritmo del piano'
      : diff > 0
        ? `${formatKcal(diff)} kcal sopra il ritmo`
        : `${formatKcal(diff)} kcal sotto il ritmo`;
  const statusColor = !hasData ? theme.textTertiary : Math.abs(diff) <= Math.max(targetKcal * 0.07, 80) ? theme.success : theme.accentText;

  // A few evenly spread meal times, so the axis reads as a day rather than
  // as a list of every slot.
  const axisTimes = series.filter((_, index) => index % 2 === 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <View style={styles.headText}>
          <ThemedText type="subtitle">Andamento di oggi</ThemedText>
          <ThemedText type="caption" themeColor="textTertiary">
            Calorie assunte rispetto al ritmo del piano
          </ThemedText>
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDash, { backgroundColor: theme.accent }]} />
            <ThemedText type="caption" themeColor="textSecondary">
              Assunte
            </ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDash, { backgroundColor: theme.textTertiary, opacity: 0.6 }]} />
            <ThemedText type="caption" themeColor="textSecondary">
              Ritmo
            </ThemedText>
          </View>
        </View>
      </View>

      <View onLayout={onLayout} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {/* The day's target, as a quiet reference line. */}
            <Line
              x1={padLeft}
              y1={targetY}
              x2={width - padRight}
              y2={targetY}
              stroke={theme.border}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <Path d={pathOf('pace')} stroke={theme.textTertiary} strokeOpacity={0.45} strokeWidth={1.5} fill="none" strokeDasharray="4 5" />
            {lastPoint ? (
              <AnimatedPath
                d={pathOf('eaten', lastPoint.minutes)}
                stroke={theme.accent}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                animatedProps={lineProps}
              />
            ) : null}
            {lastPoint ? <Circle cx={x(lastPoint.minutes)} cy={y(lastPoint.eaten)} r={4.5} fill={theme.accent} /> : null}
          </Svg>
        ) : null}
      </View>

      <View style={styles.axisRow}>
        {axisTimes.map((point) => (
          <ThemedText key={point.time} type="caption" themeColor="textTertiary">
            {point.time}
          </ThemedText>
        ))}
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <ThemedText type="small" style={{ color: statusColor }}>
          {status}
        </ThemedText>
        {hasData ? (
          <ThemedText type="small" themeColor="textTertiary">
            · {formatKcal(eatenTotal)} / {formatKcal(targetKcal)} kcal
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headText: {
    flexShrink: 1,
    gap: 2,
  },
  legend: {
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDash: {
    width: 14,
    height: 2.5,
    borderRadius: 2,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
