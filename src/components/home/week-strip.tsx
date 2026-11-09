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
  /** The day's calorie target, and its full expected burn: what each ring fills towards. */
  targetKcal: number;
  fullDayBurnedKcal: number;
};

const SIZE = 38;
const STROKE = 3;
const GAP = 2;
const C = SIZE / 2;
const R_OUT = (SIZE - STROKE) / 2;
const R_IN = R_OUT - STROKE - GAP;

/** A full ring from 12 o'clock, filled clockwise to `progress` (0..1). */
function Ring({ r, progress, color, track }: { r: number; progress: number; color: string; track: string }) {
  const circumference = 2 * Math.PI * r;
  const p = Math.min(Math.max(progress, 0), 1);
  return (
    <>
      <Circle cx={C} cy={C} r={r} fill="none" stroke={track} strokeWidth={STROKE} />
      {p > 0 ? <Circle cx={C} cy={C} r={r} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeDasharray={`${circumference * p} ${circumference}`} transform={`rotate(-90 ${C} ${C})`} /> : null}
    </>
  );
}

/**
 * The same two measures as Home's bars: the outer orange ring is intake
 * towards the day's calorie target ("Assunte"), the inner green ring is what
 * was burned towards the day's expected burn ("Bruciate").
 */
function MiniGauge({ day, eatenColor, burnedColor, track }: { day: WeekStripDay; eatenColor: string; burnedColor: string; track: string }) {
  const tracked = day.hasHappened && (day.eatenKcal > 0 || day.burnedKcal > 0);
  const eaten = tracked && day.targetKcal > 0 ? day.eatenKcal / day.targetKcal : 0;
  const burnedDay = Math.max(day.fullDayBurnedKcal, day.burnedKcal, 1);
  const burned = tracked ? day.burnedKcal / burnedDay : 0;
  return (
    <>
      <Ring r={R_OUT} progress={eaten} color={eatenColor} track={track} />
      <Ring r={R_IN} progress={burned} color={burnedColor} track={track} />
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
            accessibilityLabel={`${d.label} ${d.dayOfMonth}${d.isToday ? ', oggi' : ''}${d.hasHappened && (d.eatenKcal > 0 || d.burnedKcal > 0) ? `, assunte ${Math.round(d.eatenKcal)} kcal, bruciate ${Math.round(d.burnedKcal)} kcal` : ''}`}
            style={[styles.cell, selected && { backgroundColor: theme.backgroundElevated }]}>
            <ThemedText style={[styles.letter, { color: selected ? theme.text : theme.textTertiary }]}>{d.label}</ThemedText>
            <View style={styles.ring}>
              <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                <MiniGauge day={d} eatenColor={theme.accent} burnedColor={theme.brandGreen} track={theme.backgroundSelected} />
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
  num: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  numToday: { fontWeight: '800' },
});
