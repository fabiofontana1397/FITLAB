import { useMemo, useRef, useState } from 'react';
import { View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { AppText as Text } from '@/components/ui/app-text';
import { useTheme } from '@/hooks/use-theme';
import { formatDayRange } from '@/lib/mock/dates';
import { hapticSelection } from '@/lib/haptics';

/** One axis slot (a day/week/month depending on the series).
 * `value` is null when nothing was logged for that slot: the line runs straight through it to the nearest real points
 * on either side. `date` is the slot's real calendar date, used for the period caption and the scrub tooltip. */
export type WeightPoint = {
  xLabel: string;
  value: number | null;
  date: string;
};

export type GoalTrendChartProps = {
  points: WeightPoint[];
  /** Goal weight; null/undefined = the person has none: no reference line. */
  target?: number | null;
  /** Whether each point is a single day or a whole month: changes the period caption's wording. */
  dateGranularity: 'day' | 'month';
  width?: number;
  height?: number;
  color: string;
  targetColor: string;
  axisColor: string;
  gridColor: string;
};

const GUTTER_WIDTH = 34;
const INSET_X = 10;
const PADDING_TOP = 22;
const PADDING_BOTTOM = 24;
const Y_TICK_COUNT = 3;
const X_LABEL_COUNT = 5;
const CAPTION_HEIGHT = 18;
const TIP_WIDTH = 96;
const TIP_HEIGHT = 40;

type XY = { x: number; y: number; value: number; i: number };

/** Smooth line through the points (monotone cubic: it never overshoots above or below the real values). */
function smoothPath(pts: XY[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  const n = pts.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    slope.push((pts[i + 1].y - pts[i].y) / (dx[i] || 1));
  }
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) m.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  m.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3;
    const c1y = pts[i].y + (m[i] * dx[i]) / 3;
    const c2x = pts[i + 1].x - dx[i] / 3;
    const c2y = pts[i + 1].y - (m[i + 1] * dx[i]) / 3;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${pts[i + 1].x.toFixed(2)} ${pts[i + 1].y.toFixed(2)}`;
  }
  return d;
}

function buildChart(points: WeightPoint[], target: number | null | undefined, plotWidth: number, height: number) {
  const values = points.map((p) => p.value).filter((v): v is number => v != null);
  if (points.length === 0 || plotWidth <= 0) return null;

  const rawValues = target != null ? [...values, target] : values.length > 0 ? values : [70];
  const rawMin = Math.min(...rawValues);
  const rawMax = Math.max(...rawValues);
  // Headroom so the line and the last value's label never touch the edges; with no data, a fixed envelope.
  const pad = values.length === 0 ? 3 : Math.max((rawMax - rawMin) * 0.18, 0.6);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const range = max - min || 1;

  const innerWidth = plotWidth - INSET_X * 2;
  const plotHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const toX = (i: number) => (points.length === 1 ? plotWidth / 2 : INSET_X + (i / (points.length - 1)) * innerWidth);
  const toY = (v: number) => PADDING_TOP + plotHeight * (1 - (v - min) / range);

  const xy = points.map((p, i) => (p.value == null ? null : { x: toX(i), y: toY(p.value), value: p.value, i })).filter((p): p is XY => p != null);
  const line = smoothPath(xy);
  const baseY = height - PADDING_BOTTOM;
  const area = xy.length > 1 ? `${line} L ${xy[xy.length - 1].x.toFixed(2)} ${baseY} L ${xy[0].x.toFixed(2)} ${baseY} Z` : '';

  // A handful of evenly spaced day labels, always including the first and the last.
  const step = Math.max(1, Math.ceil((points.length - 1) / (X_LABEL_COUNT - 1)));
  const xIdx: number[] = [];
  for (let i = 0; i < points.length; i += step) xIdx.push(i);
  if (xIdx[xIdx.length - 1] !== points.length - 1) {
    if (points.length - 1 - xIdx[xIdx.length - 1] < step / 2) xIdx.pop();
    xIdx.push(points.length - 1);
  }
  const xTicks = xIdx.map((i) => ({ x: toX(i), label: points[i].xLabel }));
  const yTicks = Array.from({ length: Y_TICK_COUNT }, (_, i) => {
    const v = min + pad * 0.5 + ((range - pad) * i) / (Y_TICK_COUNT - 1);
    return { y: toY(v), label: v.toFixed(1).replace('.', ',') };
  });

  return { xy, line, area, baseY, toX, targetY: target != null ? toY(target) : null, xTicks, yTicks };
}

/** "mar 27 ott" */
function tipDate(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Gennaio - Giugno 2026" / "Settembre 2026". */
function formatMonthRange(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const month = (d: Date) => capitalize(d.toLocaleDateString('it-IT', { month: 'long' }));
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) return `${month(start)} ${start.getFullYear()}`;
  if (start.getFullYear() === end.getFullYear()) return `${month(start)} - ${month(end)} ${start.getFullYear()}`;
  return `${month(start)} ${start.getFullYear()} - ${month(end)} ${end.getFullYear()}`;
}

/** Weight trend in the Health/Stocks look: the whole series fits the card (no sideways scroll), a smooth line over a soft
 * gradient, three hairline dashed gridlines, a few day labels, the goal as a dashed line with its pill, and the latest
 * weigh-in highlighted with a halo and its value. Touching and sliding along the plot moves a cursor that shows the
 * nearest day's weight. Labels are RN Text over the SVG (SVG text baselines differ between web, iOS and Android). */
export function GoalTrendChart({ points, target, dateGranularity, width, height = 200, color, targetColor, axisColor, gridColor }: GoalTrendChartProps) {
  const theme = useTheme();
  const [measuredWidth, setMeasuredWidth] = useState(width ?? 0);
  const containerWidth = width ?? measuredWidth;
  const plotWidth = Math.max(containerWidth - GUTTER_WIDTH, 0);

  const chart = useMemo(() => buildChart(points, target, plotWidth, height), [points, target, plotWidth, height]);

  // Only a real change in width is committed, so sub-pixel onLayout jitter on web cannot loop.
  const lastWidth = useRef<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    if (width != null) return;
    const w = e.nativeEvent.layout.width;
    if (lastWidth.current != null && Math.abs(w - lastWidth.current) < 1) return;
    lastWidth.current = w;
    setMeasuredWidth(w);
  };

  // Scrubbing: the cursor snaps to the nearest logged point under the finger.
  const [active, setActive] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const pick = (e: GestureResponderEvent) => {
    if (!chart || chart.xy.length === 0) return;
    const x = e.nativeEvent.locationX;
    let best = chart.xy[0];
    for (const p of chart.xy) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    if (activeRef.current !== best.i) {
      activeRef.current = best.i;
      setActive(best.i);
      hapticSelection();
    }
  };
  const release = () => {
    activeRef.current = null;
    setActive(null);
  };

  const first = points[0];
  const last = points[points.length - 1];
  const periodLabel = first && last ? (dateGranularity === 'day' ? formatDayRange(first.date, last.date) : formatMonthRange(first.date, last.date)) : '';

  const lastPoint = chart?.xy[chart.xy.length - 1];
  const activePoint = active != null ? chart?.xy.find((p) => p.i === active) : undefined;
  const labelFont = { fontSize: 11, lineHeight: 14, fontWeight: '500' as const, color: axisColor, fontVariant: ['tabular-nums' as const] };

  return (
    <View style={{ width: width ?? '100%', height: height + CAPTION_HEIGHT }} onLayout={onLayout}>
      {chart ? (
        <>
          <View style={{ flexDirection: 'row', height }}>
            <View style={{ width: GUTTER_WIDTH, height }}>
              {chart.yTicks.map((t, i) => (
                <Text key={i} style={[labelFont, { position: 'absolute', left: 0, width: GUTTER_WIDTH - 8, top: t.y - 7, textAlign: 'right' }]}>
                  {t.label}
                </Text>
              ))}
            </View>

            <View
              style={{ width: plotWidth, height }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={pick}
              onResponderMove={pick}
              onResponderRelease={release}
              onResponderTerminate={release}
              accessibilityLabel={lastPoint ? `Andamento peso, ultimo valore ${lastPoint.value.toFixed(1).replace('.', ',')} kg` : 'Andamento peso'}>
              <Svg width={plotWidth} height={height}>
                <Defs>
                  <LinearGradient id="gtcFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={color} stopOpacity={0.32} />
                    <Stop offset="0.6" stopColor={color} stopOpacity={0.08} />
                    <Stop offset="1" stopColor={color} stopOpacity={0} />
                  </LinearGradient>
                  <LinearGradient id="gtcStroke" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={color} stopOpacity={0.45} />
                    <Stop offset="1" stopColor={color} stopOpacity={1} />
                  </LinearGradient>
                </Defs>

                {chart.yTicks.map((t, i) => (
                  <Line key={i} x1={0} y1={t.y} x2={plotWidth} y2={t.y} stroke={gridColor} strokeWidth={1} strokeDasharray="1 5" strokeLinecap="round" />
                ))}

                {chart.targetY != null ? (
                  <Line x1={0} y1={chart.targetY} x2={plotWidth} y2={chart.targetY} stroke={targetColor} strokeOpacity={0.8} strokeWidth={1.25} strokeDasharray="5 5" strokeLinecap="round" />
                ) : null}

                {chart.area ? <Path d={chart.area} fill="url(#gtcFill)" /> : null}
                {chart.line ? <Path d={chart.line} stroke="url(#gtcStroke)" strokeWidth={2.75} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}

                {activePoint ? (
                  <>
                    <Line x1={activePoint.x} y1={PADDING_TOP - 8} x2={activePoint.x} y2={chart.baseY} stroke={axisColor} strokeOpacity={0.5} strokeWidth={1} />
                    <Circle cx={activePoint.x} cy={activePoint.y} r={9} fill={color} fillOpacity={0.18} />
                    <Circle cx={activePoint.x} cy={activePoint.y} r={4.5} fill={theme.backgroundElement} stroke={color} strokeWidth={2.5} />
                  </>
                ) : lastPoint ? (
                  <>
                    <Circle cx={lastPoint.x} cy={lastPoint.y} r={11} fill={color} fillOpacity={0.14} />
                    <Circle cx={lastPoint.x} cy={lastPoint.y} r={6.5} fill={color} fillOpacity={0.28} />
                    <Circle cx={lastPoint.x} cy={lastPoint.y} r={4} fill={color} />
                  </>
                ) : null}

                {/* Invisible full-size rect: the plot keeps receiving touches on web between the lines. */}
                <Rect x={0} y={0} width={plotWidth} height={height} fill="transparent" />
              </Svg>

              {chart.xTicks.map((t, i) => (
                <Text key={i} style={[labelFont, { position: 'absolute', left: t.x - 20, width: 40, top: chart.baseY + 8, textAlign: 'center' }]}>
                  {t.label}
                </Text>
              ))}

              {/* The latest weigh-in's value, above its dot (hidden while scrubbing). */}
              {lastPoint && !activePoint ? (
                <Text
                  style={{
                    position: 'absolute',
                    left: Math.min(lastPoint.x - 30, plotWidth - 60),
                    width: 60,
                    top: lastPoint.y - 26,
                    textAlign: lastPoint.x > plotWidth - 30 ? 'right' : 'center',
                    fontSize: 12,
                    lineHeight: 15,
                    fontWeight: '700',
                    color,
                    fontVariant: ['tabular-nums'],
                  }}>
                  {lastPoint.value.toFixed(1).replace('.', ',')}
                </Text>
              ) : null}

              {chart.targetY != null && target != null ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 2,
                    top: Math.max(chart.targetY - 10, 0),
                    height: 20,
                    paddingHorizontal: 8,
                    borderRadius: 10,
                    justifyContent: 'center',
                    backgroundColor: theme.backgroundElement,
                    borderWidth: 1,
                    borderColor: targetColor + '55',
                  }}>
                  <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '700', color: targetColor }}>
                    Obiettivo {String(target).replace('.', ',')} kg
                  </Text>
                </View>
              ) : null}

              {activePoint ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: Math.min(Math.max(activePoint.x - TIP_WIDTH / 2, 0), plotWidth - TIP_WIDTH),
                    top: activePoint.y - TIP_HEIGHT - 14 < 0 ? activePoint.y + 14 : activePoint.y - TIP_HEIGHT - 14,
                    width: TIP_WIDTH,
                    height: TIP_HEIGHT,
                    borderRadius: 12,
                    backgroundColor: theme.surfacePopup,
                    borderWidth: 1,
                    borderColor: theme.borderStrong,
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0px 6px 18px rgba(0,0,0,0.18)',
                  }}>
                  <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '800', color: theme.text, fontVariant: ['tabular-nums'] }}>
                    {activePoint.value.toFixed(1).replace('.', ',')} kg
                  </Text>
                  <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '500', color: theme.textSecondary }}>{tipDate(points[activePoint.i].date)}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={{ textAlign: 'center', fontSize: 12, lineHeight: CAPTION_HEIGHT, fontWeight: '500', color: axisColor }}>{periodLabel}</Text>
        </>
      ) : null}
    </View>
  );
}
