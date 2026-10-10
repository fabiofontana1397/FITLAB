import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { dayOfMonth, isToday, weekdayShort } from '@/lib/mock/dates';
import type { TrainingDayPlan } from '@/lib/planning/types';

export type TrainingWeekCardProps = {
  weekDates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  isDayComplete: (date: string) => boolean;
  /** Tapping a day's circle marks every exercise scheduled that day done —
   * or undoes all of them when the day is already complete. */
  onToggleDayComplete: (date: string) => void;
  /** The planned session type for the date — only workout days get the
   * tappable check; rest days show a static moon. */
  dayType: (date: string) => TrainingDayPlan['type'] | undefined;
};

/** The Figma "Calendario settimanale": one card, seven columns of weekday,
 * date and a marker — on workout days a tappable completion circle (filled
 * orange with a check when the session is done, ringed when it is today),
 * on rest days a non-interactive moon. */
export function TrainingWeekCard({ weekDates, selectedDate, onSelectDate, isDayComplete, onToggleDayComplete, dayType }: TrainingWeekCardProps) {
  const theme = useTheme();
  return (
    <FlatCard radius={20} style={styles.card}>
      <View style={styles.row}>
        {weekDates.map((date) => {
          const selected = date === selectedDate;
          const complete = isDayComplete(date);
          const today = isToday(date);
          const type = dayType(date);
          return (
            <Pressable
              key={date}
              onPress={() => onSelectDate(date)}
              style={[styles.col, selected && { backgroundColor: theme.accentSoft }]}>
              <ThemedText style={[styles.weekday, { color: selected ? theme.accent : theme.textTertiary }]}>{weekdayShort(date).charAt(0).toUpperCase() + weekdayShort(date).slice(1)}</ThemedText>
              <ThemedText style={styles.date}>{dayOfMonth(date)}</ThemedText>
              {type === 'workout' ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onSelectDate(date);
                    onToggleDayComplete(date);
                  }}
                  hitSlop={6}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: complete }}
                  style={[
                    styles.circle,
                    complete
                      ? { backgroundColor: theme.accent, borderColor: theme.accent }
                      : { borderColor: today ? theme.accent : theme.border },
                  ]}>
                  {complete ? <Icon name="check" size={13} color={theme.onAccent} /> : null}
                </Pressable>
              ) : type === 'rest' ? (
                <View style={styles.marker} accessibilityLabel="Giorno di riposo">
                  <Icon name="moon" size={14} color={theme.textTertiary} />
                </View>
              ) : type === 'cardio' ? (
                <View style={styles.marker} accessibilityLabel="Cardio">
                  <Icon name="running" size={15} color={theme.textTertiary} />
                </View>
              ) : (
                <View style={styles.marker} />
              )}
            </Pressable>
          );
        })}
      </View>
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
  },
  col: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 9,
    borderRadius: 14,
  },
  weekday: {
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '600',
  },
  date: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  circle: {
    marginTop: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    marginTop: 7,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
