import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isToday, mondayIndex } from '@/lib/mock/dates';
import { useState } from 'react';

const SHEET_MAX_WIDTH = 440;
const WEEKDAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function isoDate(year: number, month0: number, day: number): string {
  const d = new Date(year, month0, day, 12, 0, 0);
  return d.toISOString().slice(0, 10);
}

function monthLabel(year: number, month0: number): string {
  const label = new Date(year, month0, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export type NutritionCalendarModalProps = {
  visible: boolean;
  selectedDate: string;
  loggedDates: Set<string>;
  onSelectDate: (date: string) => void;
  onClose: () => void;
};

/** A full month-grid popup opened from Nutrition's header calendar icon —
 * lets the user jump straight to any day across months (unlike the
 * always-visible week strip, which only pages a week at a time), with a
 * checkmark on every day that already has logged meals. */
export function NutritionCalendarModal({ visible, selectedDate, loggedDates, onSelectDate, onClose }: NutritionCalendarModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const selected = new Date(selectedDate);
  const [viewedYear, setViewedYear] = useState(selected.getFullYear());
  const [viewedMonth0, setViewedMonth0] = useState(selected.getMonth());

  // Reset the viewed month to selectedDate's whenever the popup reopens —
  // "adjust state during render" (React's own recommended replacement for
  // an effect here) rather than an effect, since this only needs to run
  // in response to a prop change, not to synchronize with anything external.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setViewedYear(selected.getFullYear());
      setViewedMonth0(selected.getMonth());
    }
  }

  const goToAdjacentMonth = (delta: number) => {
    let month0 = viewedMonth0 + delta;
    let year = viewedYear;
    if (month0 < 0) {
      month0 = 11;
      year -= 1;
    } else if (month0 > 11) {
      month0 = 0;
      year += 1;
    }
    setViewedMonth0(month0);
    setViewedYear(year);
  };

  const leadingBlanks = mondayIndex(new Date(viewedYear, viewedMonth0, 1));
  const totalDays = daysInMonth(viewedYear, viewedMonth0);
  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => isoDate(viewedYear, viewedMonth0, i + 1)),
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <GlassSurface
          level="overlay"
          radius={Radius.xlarge}
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={{ flex: 1 }}>
              Calendario
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.monthNavRow}>
            <Pressable onPress={() => goToAdjacentMonth(-1)} hitSlop={8} style={styles.navButton}>
              <Icon name="arrowBack" size={18} color={theme.textSecondary} />
            </Pressable>
            <ThemedText type="smallBold">{monthLabel(viewedYear, viewedMonth0)}</ThemedText>
            <Pressable onPress={() => goToAdjacentMonth(1)} hitSlop={8} style={styles.navButton}>
              <Icon name="chevronRight" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LETTERS.map((letter, i) => (
              <View key={i} style={styles.cell}>
                <ThemedText type="caption" themeColor="textTertiary" style={{ fontWeight: '700' }}>
                  {letter}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((date, i) => {
              if (!date) return <View key={`blank-${i}`} style={styles.cell} />;
              const logged = loggedDates.has(date);
              const isSelected = date === selectedDate;
              const today = isToday(date);
              return (
                <View key={date} style={styles.cell}>
                  <Pressable
                    onPress={() => {
                      onSelectDate(date);
                      onClose();
                    }}
                    style={[
                      styles.dayCircle,
                      isSelected ? { backgroundColor: theme.accent, borderColor: theme.accent } : { borderColor: 'transparent' },
                      !isSelected && today ? { borderColor: theme.accent } : null,
                    ]}>
                    <ThemedText
                      type="small"
                      style={{ fontWeight: '700', color: isSelected ? theme.onAccent : theme.text }}>
                      {new Date(date).getDate()}
                    </ThemedText>
                    {logged ? (
                      <View
                        style={[
                          styles.loggedDot,
                          { backgroundColor: isSelected ? theme.onAccent : theme.success },
                        ]}
                      />
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  navButton: {
    padding: 4,
  },
  weekdayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: '78%',
    aspectRatio: 1,
    maxWidth: 40,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loggedDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
