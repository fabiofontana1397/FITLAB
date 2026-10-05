import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { dayOfMonth, isToday } from '@/lib/mock/dates';

export type NutritionWeekStripProps = {
  dates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
  monthLabel: string;
};

const CIRCLE = 29;
const CIRCLE_SELECTED = 32;

/** The Figma Nutrizione week row: seven small outlined day circles spread
 * edge to edge, the selected one filled orange (and a hair larger), a tiny
 * "OGGI" tag under today's circle and the month name centered below. */
export function NutritionWeekStrip({ dates, selectedDate, onSelect, monthLabel }: NutritionWeekStripProps) {
  const theme = useTheme();

  return (
    <View>
      <View style={styles.row}>
        {dates.map((date) => {
          const selected = date === selectedDate;
          const today = isToday(date);
          return (
            <Pressable key={date} onPress={() => onSelect(date)} style={styles.col} hitSlop={4}>
              <View style={styles.circleSlot}>
                <View
                  style={[
                    styles.circle,
                    selected
                      ? { width: CIRCLE_SELECTED, height: CIRCLE_SELECTED, borderRadius: CIRCLE_SELECTED / 2, backgroundColor: theme.accent, borderColor: theme.accent }
                      : { borderColor: theme.border },
                  ]}>
                  <ThemedText
                    style={[styles.dayNumber, selected ? { color: theme.onAccent, fontWeight: '700', fontSize: 13 } : { color: theme.textTertiary }]}>
                    {dayOfMonth(date)}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.todayTag, { color: theme.accent, opacity: today ? 1 : 0 }]}>OGGI</ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ThemedText style={styles.month} themeColor="textTertiary">
        {monthLabel}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    width: CIRCLE,
    alignItems: 'center',
  },
  circleSlot: {
    width: CIRCLE,
    height: CIRCLE_SELECTED,
    alignItems: 'center',
    justifyContent: 'center',
    // The selected circle is wider than its slot — let it spill evenly.
    overflow: 'visible',
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  todayTag: {
    marginTop: 4,
    fontSize: 7.5,
    lineHeight: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  month: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
  },
});
