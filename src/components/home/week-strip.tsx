import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
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
};

const SIZE = 38;
const STROKE = 3;
const R = (SIZE - STROKE) / 2;
const C = SIZE / 2;
/** The same bottom-open ring as the Oggi gauge, in miniature. */
const HALF_SPAN = 138;
const MIN_SWEEP = 14;

function point(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: C + R * Math.sin(rad), y: C - R * Math.cos(rad) };
}
function arc(from: number, to: number): string {
  const a = point(from);
  const b = point(to);
  return `M ${a.x} ${a.y} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

/** Burned and eaten share the ring in proportion, like the main gauge. */
function MiniGauge({ day, burnedColor, eatenColor, track }: { day: WeekStripDay; burnedColor: string; eatenColor: string; track: string }) {
  const tracked = day.hasHappened && (day.eatenKcal > 0 || day.burnedKcal > 0);
  if (!tracked) {
    return <Circle cx={C} cy={C} r={R} fill="none" stroke={track} strokeWidth={STROKE} strokeLinecap={day.hasHappened ? 'butt' : 'round'} strokeDasharray={day.hasHappened ? '4 4.4' : undefined} />;
  }
  const span = HALF_SPAN * 2;
  const total = day.burnedKcal + day.eatenKcal;
  const burnedSweep = Math.min(Math.max(total > 0 ? span * (day.burnedKcal / total) : span / 2, MIN_SWEEP), span - MIN_SWEEP);
  const junction = -HALF_SPAN + burnedSweep;
  const gap = 4;
  return (
    <>
      <Path d={arc(-HALF_SPAN, junction - gap / 2)} fill="none" stroke={burnedColor} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d={arc(junction + gap / 2, HALF_SPAN)} fill="none" stroke={eatenColor} strokeWidth={STROKE} strokeLinecap="round" />
    </>
  );
}

export function WeekStrip({ days, selectedDate, onSelect }: { days: WeekStripDay[]; selectedDate: string; onSelect: (date: string) => void }) {
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
            accessibilityLabel={`${d.label} ${d.dayOfMonth}${d.isToday ? ', oggi' : ''}`}
            style={[styles.cell, selected && { backgroundColor: theme.backgroundElevated }]}>
            <ThemedText style={[styles.letter, { color: selected ? theme.text : theme.textTertiary }]}>{d.label}</ThemedText>
            <View style={styles.ring}>
              <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                <MiniGauge day={d} burnedColor={theme.accent} eatenColor={theme.brandGreen} track={theme.backgroundSelected} />
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
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  numToday: { fontWeight: '800' },
});
