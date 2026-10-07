import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/ui/app-text';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDayMonth } from '@/lib/mock/dates';
import type { BodyMetricSnapshot } from '@/lib/mock/types';
import type { MeasurementZone } from './body-silhouette';

const CHART_WIDTH = 268;
const CHART_HEIGHT = 180;
const PADDING_LEFT = 34;
const PADDING_RIGHT = 10;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 20;
const Y_TICK_COUNT = 4;
const MAX_X_TICKS = 5;

function buildChart(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, 0.5);
  const lo = min - pad;
  const hi = max + pad;
  const range = hi - lo || 1;

  const plotWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const toX = (i: number) => (values.length === 1 ? PADDING_LEFT + plotWidth / 2 : PADDING_LEFT + (i / (values.length - 1)) * plotWidth);
  const toY = (v: number) => PADDING_TOP + plotHeight * (1 - (v - lo) / range);

  const xy = values.map((v, i) => ({ x: toX(i), y: toY(v), value: v }));
  const path = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const area = xy.length > 1 ? `${path} L ${xy[xy.length - 1].x.toFixed(2)} ${CHART_HEIGHT} L ${xy[0].x.toFixed(2)} ${CHART_HEIGHT} Z` : '';

  const yTicks = Array.from({ length: Y_TICK_COUNT }, (_, i) => {
    const v = lo + (range * i) / (Y_TICK_COUNT - 1);
    return { y: toY(v), label: v.toFixed(1) };
  }).reverse();

  // Only a handful of x-axis date labels, evenly spread — plotting every
  // entry would get illegible once more than a few measurements pile up.
  const tickCount = Math.min(MAX_X_TICKS, values.length);
  const tickIndices = [...new Set(Array.from({ length: tickCount }, (_, i) => Math.round((i * (values.length - 1)) / (tickCount - 1 || 1))))];

  return { xy, path, area, yTicks, tickIndices };
}

export type MeasurementTrendModalProps = {
  zone: MeasurementZone | null;
  label: string;
  entries: BodyMetricSnapshot[];
  color: string;
  onClose: () => void;
};

/** Popup opened by tapping a measurement's sparkline — the same value
 * plotted over every entry logged so far, with real axes instead of a bare
 * sparkline. */
export function MeasurementTrendModal({ zone, label, entries, color, onClose }: MeasurementTrendModalProps) {
  const theme = useTheme();
  if (!zone) return null;

  // Entries logged before this zone existed (or simply never recorded for
  // it) carry no value — drop those rather than let a missing number reach
  // the chart as NaN. `entries` is filtered in lockstep so date labels
  // still line up with `values` by index.
  const entriesWithValue = entries.filter((e) => Number.isFinite(Number(e[zone])));
  const values = entriesWithValue.map((e) => Number(e[zone]));
  const hasEnoughData = values.length >= 2;
  const chart = hasEnoughData ? buildChart(values) : null;

  return (
    <Modal visible={zone != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <GlassSurface level="overlay" radius={Radius.xlarge} style={styles.card}>
            <View style={styles.header}>
              <ThemedText type="subtitle">Andamento: {label}</ThemedText>
              <Pressable onPress={onClose} hitSlop={8}>
                <Icon name="close" size={22} color={theme.text} />
              </Pressable>
            </View>

            {chart ? (
              <View style={{ width: CHART_WIDTH, height: CHART_HEIGHT }}>
                <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                  <Defs>
                    <LinearGradient id="measurementTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={color} stopOpacity={0.28} />
                      <Stop offset="1" stopColor={color} stopOpacity={0} />
                    </LinearGradient>
                  </Defs>
                  {chart.yTicks.map((tick, i) => (
                    <Line key={`y${i}`} x1={PADDING_LEFT} y1={tick.y} x2={CHART_WIDTH - PADDING_RIGHT} y2={tick.y} stroke={theme.backgroundElement} strokeWidth={1} />
                  ))}
                  <Path d={chart.area} fill="url(#measurementTrendFill)" />
                  <Path d={chart.path} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {chart.xy.map((p, i) => (
                    <Circle key={i} cx={p.x} cy={p.y} r={i === chart.xy.length - 1 ? 4.5 : 3} fill={color} />
                  ))}
                </Svg>

                {chart.yTicks.map((tick, i) => (
                  <Text
                    key={i}
                    style={{ position: 'absolute', left: 0, width: PADDING_LEFT - 6, top: tick.y - 7, fontSize: 10, color: theme.textTertiary, textAlign: 'right' }}>
                    {tick.label}
                  </Text>
                ))}

                {chart.tickIndices.map((i) => (
                  <Text
                    key={i}
                    style={{
                      position: 'absolute',
                      left: chart.xy[i].x - 22,
                      width: 44,
                      top: CHART_HEIGHT - PADDING_BOTTOM + 6,
                      fontSize: 9,
                      color: theme.textTertiary,
                      textAlign: 'center',
                    }}>
                    {formatDayMonth(entriesWithValue[i].date)}
                  </Text>
                ))}

                <Text
                  style={{
                    position: 'absolute',
                    left: chart.xy[chart.xy.length - 1].x - 22,
                    width: 44,
                    top: chart.xy[chart.xy.length - 1].y - 20,
                    fontSize: 10,
                    fontWeight: '700',
                    textAlign: 'center',
                    color,
                  }}>
                  {values[values.length - 1].toFixed(1)}
                </Text>
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary" style={{ width: CHART_WIDTH }}>
                Aggiungi almeno due misurazioni per vedere l’andamento nel tempo.
              </ThemedText>
            )}
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: Spacing.four,
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
});
