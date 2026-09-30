import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayOfMonth, isToday, weekdayShort } from '@/lib/mock/dates';

export type WeekDayStripProps = {
  weekDates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  isDayComplete: (date: string) => boolean;
  /** Tapping a day's circle directly (not the rest of the card) marks
   * every exercise scheduled that day as done — or, if the day is
   * already fully done, undoes all of them — without needing to open
   * that day and check off each exercise one by one. */
  onToggleDayComplete: (date: string) => void;
  monthYearLabel: string;
  /** Opens the full month-grid calendar popup — replaces the old prev/next
   * week arrows, since jumping to any day there also repositions the week
   * this strip shows. */
  onOpenCalendar: () => void;
};

/** A fixed Mon–Sun week grid with month-navigation arrows above it — the
 * paginated-by-week counterpart to Home's day-circle row, replacing the old
 * continuously-scrollable DayWheel to match the reference calendar design:
 * each day shows its weekday label, number, and a filled check (done) or
 * plain outline (not yet), with the selected day boxed in a tinted highlight
 * and today's circle getting an accent ring even when not selected. */
export function WeekDayStrip({
  weekDates,
  selectedDate,
  onSelectDate,
  isDayComplete,
  onToggleDayComplete,
  monthYearLabel,
  onOpenCalendar,
}: WeekDayStripProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={styles.monthNavRow}>
        <ThemedText type="subtitle">{monthYearLabel}</ThemedText>
        <Pressable onPress={onOpenCalendar} hitSlop={8} style={styles.navButton}>
          <Icon name="calendar" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {weekDates.map((date) => {
          const selected = date === selectedDate;
          const today = isToday(date);
          const complete = isDayComplete(date);
          return (
            <Pressable
              key={date}
              onPress={() => onSelectDate(date)}
              style={[
                styles.dayCol,
                { backgroundColor: selected ? theme.accentSoft : theme.backgroundElevated },
              ]}>
              <ThemedText type="caption" themeColor="textSecondary" style={{ fontWeight: '700' }}>
                {weekdayShort(date)}
              </ThemedText>
              <ThemedText type="small" style={{ fontWeight: '800' }}>
                {dayOfMonth(date)}
              </ThemedText>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onSelectDate(date);
                  onToggleDayComplete(date);
                }}
                hitSlop={6}
                style={[
                  styles.dayCircle,
                  complete
                    ? { backgroundColor: theme.accent, borderColor: theme.accent }
                    : { backgroundColor: 'transparent', borderColor: theme.border },
                  today && !complete ? { borderColor: theme.accent } : null,
                ]}>
                {complete ? <Icon name="check" size={13} color={theme.onAccent} /> : null}
              </Pressable>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    padding: 2,
  },
  grid: {
    flexDirection: 'row',
    gap: 6,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: Radius.medium,
  },
  dayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
