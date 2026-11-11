import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { G, Line, Path } from 'react-native-svg';

import { goalStripColors } from '@/components/home/goal-strip-colors';
import { ThemedText } from '@/components/themed-text';
import { goalBand, readBalance } from '@/domain/calorie-balance';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection } from '@/lib/haptics';

export type WeekStripDay = {
  date: string;
  /** Single-letter weekday, "L" … "D". */
  label: string;
  dayOfMonth: number;
  isToday: boolean;
  hasHappened: boolean;
  burnedKcal: number;
  eatenKcal: number;
  /** The day's calorie target, and its full expected burn: what each ring fills towards. */
  targetKcal: number;
  fullDayBurnedKcal: number;
};

const W = 48;
const H = 38;
const STROKE = 5;
const CX = W / 2;
/** The arc's centre sits low in the box so the number fits under its curve. */
const CY = H - 9;
const R = 18;
const STRIPS = 13;
const MID = (STRIPS - 1) / 2;
const STEP = 180 / STRIPS;
const MARKER_W = 3.4;
/** Half the marker's length across the arc; with R and its rounded ends it stays inside the box even at the far ends of the range. */
const MARKER_HALF = 3.2;

const px = (deg: number, r = R) => CX + r * Math.sin((deg * Math.PI) / 180);
const py = (deg: number, r = R) => CY - r * Math.cos((deg * Math.PI) / 180);

/**
 * One day's balance on a small semi-ring, the same gradient as Home's big gauge
 * (deep green on the day's goal, fading through champagne to orange at both
 * ends of the day's range) with a marker where the day actually landed: surplus
 * to the left, deficit to the right, the goal at the top. A day with nothing to
 * read (not yet lived, no meal logged) keeps the gradient faint and has no marker.
 */
function MiniGauge({ day, goalKcal, markerRing }: { day: WeekStripDay; goalKcal: number; markerRing: string }) {
  const theme = useTheme();
  const reading = readBalance({
    eatenKcal: day.hasHappened ? day.eatenKcal : 0,
    burnedKcal: day.hasHappened ? day.burnedKcal : 0,
    goalKcal,
  });
  const band = goalBand({ reading, eatenKcal: day.eatenKcal, burnedKcal: day.burnedKcal, plannedEatenKcal: day.targetKcal, dayComplete: day.hasHappened && !day.isToday });
  // A day that has not come yet is plain grey; a day gone by (or today) shows the goal gradient.
  const future = !day.hasHappened;
  const colors = future ? Array.from({ length: STRIPS }, () => theme.textTertiary) : goalStripColors(STRIPS, band, theme);
  const tracked = band.state !== 'missing';
  const markerDeg = band.position * 90;
  // The marker is a strip like the ones of the ring, in the colour of the ring at the place the day landed.
  const markerColor = colors[Math.round(((band.position + 1) / 2) * (STRIPS - 1))];
  return (
    <>
      <G opacity={future ? 0.4 : tracked ? 1 : 0.38}>
        {colors.map((color, i) => {
          const deg = ((i - MID) / MID) * (90 - STEP / 2);
          return <Path key={i} d={`M ${px(deg - STEP / 2 - 0.4)} ${py(deg - STEP / 2 - 0.4)} A ${R} ${R} 0 0 1 ${px(deg + STEP / 2 + 0.4)} ${py(deg + STEP / 2 + 0.4)}`} stroke={color} strokeWidth={STROKE} fill="none" />;
        })}
      </G>
      {tracked ? (
        <>
          <Line x1={px(markerDeg, R - MARKER_HALF)} y1={py(markerDeg, R - MARKER_HALF)} x2={px(markerDeg, R + MARKER_HALF)} y2={py(markerDeg, R + MARKER_HALF)} stroke={markerRing} strokeWidth={MARKER_W + 2} strokeLinecap="round" />
          <Line x1={px(markerDeg, R - MARKER_HALF)} y1={py(markerDeg, R - MARKER_HALF)} x2={px(markerDeg, R + MARKER_HALF)} y2={py(markerDeg, R + MARKER_HALF)} stroke={markerColor} strokeWidth={MARKER_W} strokeLinecap="round" />
        </>
      ) : null}
    </>
  );
}

export function WeekStrip({ days, selectedDate, goalKcal, onSelect }: { days: WeekStripDay[]; selectedDate: string; /** The daily balance goal (negative = deficit) every day's range is centred on. */ goalKcal: number; onSelect: (date: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {days.map((d) => {
        const selected = d.date === selectedDate;
        return (
          <Pressable
            key={d.date}
            onPress={() => {
              if (!selected) hapticSelection();
              onSelect(d.date);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${d.label} ${d.dayOfMonth}${d.isToday ? ', oggi' : ''}${d.hasHappened && (d.eatenKcal > 0 || d.burnedKcal > 0) ? `, assunte ${Math.round(d.eatenKcal)} kcal, bruciate ${Math.round(d.burnedKcal)} kcal` : ''}`}
            style={[styles.cell, selected && { backgroundColor: theme.backgroundElevated }]}>
            <ThemedText style={[styles.letter, { color: selected ? theme.text : theme.textTertiary }]}>{d.label}</ThemedText>
            <View style={styles.ring}>
              <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
                <MiniGauge day={d} goalKcal={goalKcal} markerRing={selected ? theme.backgroundElevated : theme.background} />
              </Svg>
              <ThemedText style={[styles.num, { color: d.hasHappened || d.isToday ? theme.text : theme.textTertiary }, d.isToday && styles.numToday]}>{d.dayOfMonth}</ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 8, borderRadius: 16, borderCurve: 'continuous' },
  letter: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  ring: { width: W, height: H, alignItems: 'center', justifyContent: 'flex-end' },
  num: { fontSize: 13, lineHeight: 16, fontWeight: '600', marginBottom: 1 },
  numToday: { fontWeight: '800' },
});
