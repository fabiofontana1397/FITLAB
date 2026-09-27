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
  monthYearLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
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
  monthYearLabel,
  onPrevWeek,
  onNextWeek,
}: WeekDayStripProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={styles.monthNavRow}>
        <ThemedText type="smallBold">{monthYearLabel}</ThemedText>
        <View style={styles.monthNavArrows}>
          <Pressable onPress={onPrevWeek} hitSlop={8} style={styles.navButton}>
            <Icon name="arrowBack" size={18} color={theme.textSecondary} />
          </Pressable>
          <Pressable onPress={onNextWeek} hitSlop={8} style={styles.navButton}>
            <Icon name="chevronRight" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
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
              style={[styles.dayCol, selected ? { backgroundColor: theme.accentSoft } : null]}>
              <ThemedText type="caption" themeColor="textSecondary">
                {weekdayShort(date)}
              </ThemedText>
              <ThemedText type="caption" style={{ fontWeight: '700' }}>
                {dayOfMonth(date)}
              </ThemedText>
              <View
                style={[
                  styles.dayCircle,
                  complete
                    ? { backgroundColor: theme.accent, borderColor: theme.accent }
                    : { backgroundColor: 'transparent', borderColor: theme.border },
                  today && !complete ? { borderColor: theme.accent } : null,
                ]}>
                {complete ? <Icon name="check" size={13} color={theme.onAccent} /> : null}
              </View>
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
  monthNavArrows: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  navButton: {
    padding: 2,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: Radius.medium,
    minWidth: 40,
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
