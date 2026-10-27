import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { AppText as Text } from "@/components/ui/app-text";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

import { useTheme } from "@/hooks/use-theme";
import { formatDayRange } from "@/lib/mock/dates";

/** One axis slot (a day/week/month depending on the selected range).
 * `value` is null when nothing was logged for that slot — the slot still
 * gets its gridline/label and no dot, but the trend line still runs
 * straight through it to connect the nearest real points on either side,
 * rather than breaking. `date` is that slot's real calendar date (the
 * 1st of the month for "anno" slots) — used only to build the "1-30
 * settembre" style period caption, never for x positioning. */
export type WeightPoint = {
  xLabel: string;
  value: number | null;
  date: string;
};

export type GoalTrendChartProps = {
  points: WeightPoint[];
  /** Goal weight; null/undefined = the person has none: no reference line. */
  target?: number | null;
  /** Whether each point represents a single day or a whole month — changes
   * how the period caption below the chart is worded. */
  dateGranularity: "day" | "month";
  width?: number;
  height?: number;
  color: string;
  targetColor: string;
  axisColor: string;
  gridColor: string;
};

// The y-axis label column stays fixed while the plot itself scrolls
// horizontally underneath it, so the kg scale is never lost when browsing a
// dense range (e.g. every day of the month).
const GUTTER_WIDTH = 38;
const INSET_LEFT = 10;
const INSET_RIGHT = 16;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 22;
const Y_TICK_COUNT = 4;
// Minimum space per axis slot so dots/labels never overlap once a range has
// many slots (e.g. 28-31 days in "Mese") — the plot then becomes wider than
// the card and scrolls instead of squeezing everything together.
const MIN_SLOT_WIDTH = 40;
const PERIOD_LABEL_HEIGHT = 20;

type XY = { x: number; y: number; value: number; i: number };

/** One continuous line/fill through every real (non-null) point, in order —
 * gaps where nothing was logged are skipped rather than breaking the line,
 * so e.g. a Monday and the following Friday's weigh-ins connect straight
 * through the missing Tue-Thu instead of leaving a visual gap. */
function buildSegments(xy: (XY | null)[], height: number) {
  const run = xy.filter((p): p is XY => p != null);
  if (run.length === 0) return [];

  const path = run
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const area =
    run.length > 1
      ? `${path} L ${run[run.length - 1].x.toFixed(2)} ${height} L ${run[0].x.toFixed(2)} ${height} Z`
      : "";
  return [{ path, area }];
}

function buildChart(
  points: WeightPoint[],
  target: number | null | undefined,
  plotWidth: number,
  height: number,
) {
  const empty = {
    segments: [] as { path: string; area: string }[],
    xy: [] as XY[],
    targetY: null as number | null,
    xTicks: [] as { x: number; label: string }[],
    yTicks: [] as { y: number; label: string }[],
  };
  if (points.length === 0 || plotWidth <= 0) return empty;

  const values = points
    .map((p) => p.value)
    .filter((v): v is number => v != null);
  const rawValues =
    target != null ? [...values, target] : values.length > 0 ? values : [70];
  const rawMin = Math.min(...rawValues);
  const rawMax = Math.max(...rawValues);
  // A little headroom above/below so dots and their value labels near the
  // extremes never sit flush against the plot edge. When there's no logged
  // data at all yet, fall back to a fixed envelope around the target so the
  // axes still read as a real chart rather than a flat line.
  const pad = values.length === 0 ? 3 : Math.max((rawMax - rawMin) * 0.15, 0.5);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const valueRange = max - min || 1;

  const innerWidth = plotWidth - INSET_LEFT - INSET_RIGHT;
  const plotHeight = height - PADDING_TOP - PADDING_BOTTOM;

  // Slots are evenly spaced by index rather than by actual elapsed time:
  // each point is already one fixed axis category (a day/week/month), not a
  // raw timestamp, so a categorical axis is what actually matches the
  // labels underneath it.
  const toX = (i: number) =>
    points.length === 1
      ? plotWidth / 2
      : INSET_LEFT + (i / (points.length - 1)) * innerWidth;
  const toY = (value: number) =>
    PADDING_TOP + plotHeight * (1 - (value - min) / valueRange);

  const xy = points.map((p, i) =>
    p.value == null ? null : { x: toX(i), y: toY(p.value), value: p.value, i },
  );
  const segments = buildSegments(xy, height);

  const xTicks = points.map((p, i) => ({ x: toX(i), label: p.xLabel }));
  const yTicks = Array.from({ length: Y_TICK_COUNT }, (_, i) => {
    const value = min + (valueRange * i) / (Y_TICK_COUNT - 1);
    return { y: toY(value), label: value.toFixed(1) };
  }).reverse();

  return {
    segments,
    xy: xy.filter((p): p is XY => p != null),
    targetY: target != null ? toY(target) : null,
    xTicks,
    yTicks,
  };
}

/** i -> the slot's fractional x position, inverted back to a slot index —
 * used to figure out which slots are currently scrolled into view. */
function slotIndexAt(x: number, pointCount: number, innerWidth: number) {
  if (pointCount <= 1 || innerWidth <= 0) return 0;
  const t = (x - INSET_LEFT) / innerWidth;
  return Math.max(
    0,
    Math.min(pointCount - 1, Math.round(t * (pointCount - 1))),
  );
}

const TIP_WIDTH = 104;
const TIP_HEIGHT = 44;

/** "mar 27 ott" */
function tipDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Gennaio - Giugno 2026" / "Settembre 2026". */
function formatMonthRange(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const month = (d: Date) =>
    capitalize(d.toLocaleDateString("it-IT", { month: "long" }));

  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    return `${month(start)} ${start.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${month(start)} - ${month(end)} ${start.getFullYear()}`;
  }
  return `${month(start)} ${start.getFullYear()} - ${month(end)} ${end.getFullYear()}`;
}

/** A weight trend chart matching the familiar Health-app look: horizontal
 * gridlines with value labels, vertical dashed gridlines per x tick, a
 * solid trend line with a value label at every dot (not just the last),
 * and the target as its own reference line. The axis grid always renders,
 * even for slots with nothing logged yet, so the chart never looks broken
 * before there's data. Dense ranges (e.g. every day of the month) get a
 * wider-than-the-card plot the user scrolls horizontally, while the kg
 * scale on the left stays fixed and a caption below the chart tracks which
 * days/months are currently scrolled into view. Axis/value labels are
 * plain React Native Text absolutely positioned over the SVG rather than
 * SVG <Text> — the latter's baseline handling isn't consistent enough
 * across web/iOS/Android to trust for something this small. */
export function GoalTrendChart({
  points,
  target,
  dateGranularity,
  width,
  height = 240,
  color,
  targetColor,
  axisColor,
  gridColor,
}: GoalTrendChartProps) {
  const [measuredWidth, setMeasuredWidth] = useState(width ?? 0);
  const containerWidth = width ?? measuredWidth;
  const plotWidth = Math.max(
    containerWidth - GUTTER_WIDTH,
    points.length * MIN_SLOT_WIDTH,
  );
  const innerWidth = plotWidth - INSET_LEFT - INSET_RIGHT;

  const { segments, xy, targetY, xTicks, yTicks } = useMemo(
    () => buildChart(points, target, plotWidth, height),
    [points, target, plotWidth, height],
  );

  // Sub-pixel-different onLayout measurements (common on web, especially
  // once a horizontal scrollbar for the plot appears/disappears) used to
  // feed straight back into measuredWidth -> plotWidth -> the ScrollView's
  // own size -> another onLayout firing, a real "Maximum update depth
  // exceeded" render loop, not just a lint nit. Same guard already proven
  // in app-tabs.tsx's FloatingTabBar: only commit a change big enough to be
  // real, so the measurement settles instead of oscillating forever.
  const lastMeasuredWidth = useRef<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    if (width != null) return;
    const measured = e.nativeEvent.layout.width;
    if (
      lastMeasuredWidth.current != null &&
      Math.abs(measured - lastMeasuredWidth.current) < 1
    )
      return;
    lastMeasuredWidth.current = measured;
    setMeasuredWidth(measured);
  };

  const visibleWidth = Math.max(containerWidth - GUTTER_WIDTH, 0);
  const [visibleRange, setVisibleRange] = useState({ first: 0, last: 0 });
  const updateVisibleRange = (scrollX: number) => {
    setVisibleRange({
      first: slotIndexAt(scrollX, points.length, innerWidth),
      last: slotIndexAt(scrollX + visibleWidth, points.length, innerWidth),
    });
  };

  // Switching range (e.g. Settimana -> Mese) swaps in a whole new set of
  // slots — jump the scroll back to the start and recompute what's visible,
  // rather than keeping whatever offset/caption was left from the previous
  // range's plot.
  const scrollRef = useRef<ScrollView>(null);
  const resetKey = `${points.length}|${points[0]?.date}|${points[points.length - 1]?.date}|${plotWidth}|${visibleWidth}`;
  const [appliedKey, setAppliedKey] = useState(resetKey);
  if (appliedKey !== resetKey) {
    // "Adjust state during render" (React's replacement for a setState-in-effect): new slots mean the caption restarts at the beginning.
    setAppliedKey(resetKey);
    setVisibleRange({
      first: slotIndexAt(0, points.length, innerWidth),
      last: slotIndexAt(visibleWidth, points.length, innerWidth),
    });
  }
  useEffect(() => {
    // The latest days are what matters: open on the right end.
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [resetKey]);

  // The dot tapped for its mini popup (index into `points`); a new set of points clears it.
  const theme = useTheme();
  const [selected, setSelected] = useState<{ key: string; i: number } | null>(
    null,
  );
  const selectedPoint =
    selected?.key === resetKey ? xy.find((p) => p.i === selected.i) : undefined;
  const toggleDot = (i: number) =>
    setSelected((cur) =>
      cur?.key === resetKey && cur.i === i ? null : { key: resetKey, i },
    );

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    updateVisibleRange(e.nativeEvent.contentOffset.x);

  const first = points[visibleRange.first];
  const last = points[visibleRange.last];
  const periodLabel =
    first && last
      ? dateGranularity === "day"
        ? formatDayRange(first.date, last.date)
        : formatMonthRange(first.date, last.date)
      : "";

  return (
    <View
      style={{ width: width ?? "100%", height: height + PERIOD_LABEL_HEIGHT }}
      onLayout={onLayout}
    >
      {containerWidth > 0 ? (
        <>
          <View style={{ flexDirection: "row", height, position: "relative" }}>
            {/* Fixed y-axis gutter, stays put while the plot scrolls under it */}
            <View style={{ width: GUTTER_WIDTH, height }}>
              {yTicks.map((tick, i) => (
                <Text
                  key={i}
                  style={{
                    position: "absolute",
                    left: 0,
                    width: GUTTER_WIDTH - 6,
                    top: tick.y - 7,
                    fontSize: 11,
                    color: axisColor,
                    textAlign: "right",
                  }}
                >
                  {tick.label}
                </Text>
              ))}
            </View>

            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={32}
              style={{ width: visibleWidth }}
              contentContainerStyle={{ width: plotWidth }}
            >
              <View style={{ width: plotWidth, height }}>
                <Svg width={plotWidth} height={height}>
                  <Defs>
                    <LinearGradient
                      id="goalTrendFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <Stop offset="0" stopColor={color} stopOpacity={0.28} />
                      <Stop offset="1" stopColor={color} stopOpacity={0} />
                    </LinearGradient>
                  </Defs>

                  {/* Horizontal gridlines */}
                  {yTicks.map((tick, i) => (
                    <Line
                      key={`y${i}`}
                      x1={0}
                      y1={tick.y}
                      x2={plotWidth}
                      y2={tick.y}
                      stroke={gridColor}
                      strokeWidth={1}
                    />
                  ))}
                  {/* Vertical dashed gridlines, one per axis slot */}
                  {xTicks.map((tick, i) => (
                    <Line
                      key={`x${i}`}
                      x1={tick.x}
                      y1={PADDING_TOP}
                      x2={tick.x}
                      y2={height - PADDING_BOTTOM}
                      stroke={gridColor}
                      strokeWidth={1}
                      strokeDasharray="2 4"
                    />
                  ))}

                  {/* Target reference line */}
                  {targetY != null ? (
                    <Line
                      x1={0}
                      y1={targetY}
                      x2={plotWidth}
                      y2={targetY}
                      stroke={targetColor}
                      strokeWidth={1.5}
                    />
                  ) : null}

                  {segments.map((seg, i) =>
                    seg.area ? (
                      <Path
                        key={`area${i}`}
                        d={seg.area}
                        fill="url(#goalTrendFill)"
                      />
                    ) : null,
                  )}
                  {segments.map((seg, i) => (
                    <Path
                      key={`line${i}`}
                      d={seg.path}
                      stroke={color}
                      strokeWidth={2.5}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {xy.map((p, i) => (
                    <Circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={
                        p.i === selected?.i && selected.key === resetKey
                          ? 6
                          : i === xy.length - 1
                            ? 4.5
                            : 3
                      }
                      fill={color}
                    />
                  ))}
                </Svg>

                {/* Tapping anywhere else on the plot closes the popup. */}
                {selectedPoint ? (
                  <Pressable
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: plotWidth,
                      height,
                    }}
                    onPress={() => setSelected(null)}
                  />
                ) : null}

                {/* One tap target per dot: it opens the mini popup with that day's weight. */}
                {xy.map((p) => (
                  <Pressable
                    key={`hit${p.i}`}
                    onPress={() => toggleDot(p.i)}
                    accessibilityRole="button"
                    accessibilityLabel={`Peso del ${points[p.i].date}: ${p.value.toFixed(1)} kg`}
                    style={{
                      position: "absolute",
                      left: p.x - 18,
                      top: p.y - 18,
                      width: 36,
                      height: 36,
                    }}
                  />
                ))}

                {/* X-axis labels — always shown, even for slots with no data yet */}
                {xTicks.map((tick, i) => (
                  <Text
                    key={i}
                    style={{
                      position: "absolute",
                      left: tick.x - 20,
                      width: 40,
                      top: height - PADDING_BOTTOM + 6,
                      fontSize: 11,
                      color: axisColor,
                      textAlign: "center",
                    }}
                  >
                    {tick.label}
                  </Text>
                ))}

                {/* Per-dot kg value, so every logged/aggregated point reads its
                    own progress rather than needing to eyeball the y-axis. */}
                {xy.map((p, i) => (
                  <Text
                    key={i}
                    style={{
                      position: "absolute",
                      left: p.x - 20,
                      width: 40,
                      top: p.y - 20,
                      fontSize: 11,
                      fontWeight: "700",
                      textAlign: "center",
                      color,
                    }}
                  >
                    {p.value.toFixed(1)}
                  </Text>
                ))}

                {selectedPoint ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: Math.min(
                        Math.max(selectedPoint.x - TIP_WIDTH / 2, 4),
                        plotWidth - TIP_WIDTH - 4,
                      ),
                      top:
                        selectedPoint.y - TIP_HEIGHT - 12 < 0
                          ? selectedPoint.y + 14
                          : selectedPoint.y - TIP_HEIGHT - 12,
                      width: TIP_WIDTH,
                      height: TIP_HEIGHT,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.borderStrong,
                      backgroundColor: theme.surfacePopup,
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0px 4px 14px rgba(0,0,0,0.22)",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        lineHeight: 18,
                        fontWeight: "800",
                        color: theme.text,
                      }}
                    >
                      {selectedPoint.value.toFixed(1).replace(".", ",")} kg
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        lineHeight: 14,
                        fontWeight: "500",
                        color: theme.textSecondary,
                      }}
                    >
                      {tipDate(points[selectedPoint.i].date)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            {/* Target label — fixed at the right edge of the visible plot
                (not the scrollable content), so it stays on screen no
                matter how far the chart is scrolled. */}
            {targetY != null && target != null ? (
              <Text
                style={{
                  position: "absolute",
                  right: 4,
                  top: Math.max(targetY - 16, 0),
                  fontSize: 11,
                  fontWeight: "700",
                  color: targetColor,
                }}
              >
                Obiettivo {target}kg
              </Text>
            ) : null}
          </View>

          {/* Period caption — tracks whichever slots are currently scrolled
              into view, so it always reads e.g. "1-30 settembre" for the
              visible slice rather than the whole (possibly off-screen) range. */}
          <Text
            style={{
              textAlign: "center",
              fontSize: 12,
              fontWeight: "600",
              color: axisColor,
              height: PERIOD_LABEL_HEIGHT,
            }}
          >
            {periodLabel}
          </Text>
        </>
      ) : null}
    </View>
  );
}
