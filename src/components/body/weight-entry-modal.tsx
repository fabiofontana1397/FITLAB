import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { daysAgoISO } from '@/lib/mock/dates';

const STEP_PX = 9; // width of one 0.1 kg tick
const RANGE_KG = 15; // how far either side of the starting weight the wheel reaches
const MIN_KG = 30;

export type WeightEntryModalProps = {
  visible: boolean;
  /** The weight the wheel starts on (latest known weight). */
  initialWeightKg: number;
  /** ISO day being recorded — defaults to today. A past day edits that entry. */
  date?: string;
  /** Days that already have a weigh-in, marked with a dot in the date picker. */
  markedDates?: string[];
  onClose: () => void;
  onSave: (weightKg: number, date?: string) => void;
};

/** "Nuova misurazione" popup: a horizontal ruler wheel (drag it, or tap − / +
 * for 0.1 kg steps) in a centered glass card with the rest of the screen
 * blurred. The date and time default to the moment the popup opens. */
export function WeightEntryModal({ visible, initialWeightKg, date, markedDates, onClose, onSave }: WeightEntryModalProps) {
  return (
    <GlassPopup visible={visible} onClose={onClose}>
      <WeightEntryForm initialWeightKg={initialWeightKg} date={date} markedDates={markedDates} onClose={onClose} onSave={onSave} />
    </GlassPopup>
  );
}

function WeightEntryForm({
  initialWeightKg,
  date,
  markedDates,
  onClose,
  onSave,
}: {
  initialWeightKg: number;
  date?: string;
  markedDates?: string[];
  onClose: () => void;
  onSave: (weightKg: number, date?: string) => void;
}) {
  const theme = useTheme();
  const [openedAt] = useState(() => new Date());
  const today = daysAgoISO(0);
  const [selectedDate, setSelectedDate] = useState(date ?? today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const start = Math.max(MIN_KG, Math.round(initialWeightKg) - RANGE_KG);
  const tickCount = (Math.round(initialWeightKg) + RANGE_KG - start) * 10 + 1;
  const initialIndex = Math.min(Math.max(Math.round((initialWeightKg - start) * 10), 0), tickCount - 1);

  const [index, setIndex] = useState(initialIndex);
  const [viewport, setViewport] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placed = useRef(false);

  const weight = start + index / 10;

  const scrollToIndex = (i: number, animated: boolean) => {
    scrollRef.current?.scrollTo({ x: i * STEP_PX, animated });
  };

  // Put the wheel on the starting weight once its width is known.
  useEffect(() => {
    if (viewport > 0 && !placed.current) {
      placed.current = true;
      setTimeout(() => scrollToIndex(initialIndex, false), 0);
    }
  }, [viewport, initialIndex]);

  useEffect(
    () => () => {
      if (snapTimer.current) clearTimeout(snapTimer.current);
    },
    []
  );

  const indexFromX = (x: number) => Math.min(Math.max(Math.round(x / STEP_PX), 0), tickCount - 1);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = indexFromX(e.nativeEvent.contentOffset.x);
    setIndex(i);
    // Web has no native snapping for this ScrollView — settle on the nearest
    // tick shortly after the user stops moving it.
    if (Platform.OS === 'web') {
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => scrollToIndex(i, true), 140);
    }
  };

  const nudge = (delta: number) => {
    const next = Math.min(Math.max(index + delta, 0), tickCount - 1);
    setIndex(next);
    scrollToIndex(next, true);
  };

  const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeLabel = openedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const padding = Math.max(viewport / 2 - STEP_PX / 2, 0);

  return (
    <View>
      <View style={styles.header}>
        <View style={[styles.rulerBadge, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="scale" size={24} color={theme.text} />
        </View>
        <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
          <Icon name="close" size={22} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.valueRow}>
        <ThemedText style={styles.value}>{weight.toFixed(1)}</ThemedText>
        <ThemedText style={styles.unit} themeColor="textSecondary">
          kg
        </ThemedText>
      </View>

      <View style={styles.wheelRow}>
        <Pressable onPress={() => nudge(-1)} accessibilityLabel="Diminuisci" style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.minusBar, { backgroundColor: theme.text }]} />
        </Pressable>
        <Pressable onPress={() => nudge(1)} accessibilityLabel="Aumenta" style={[styles.roundButton, { backgroundColor: theme.accentSoft }]}>
          <Icon name="plus" size={22} color={theme.accent} />
        </Pressable>
      </View>

      <View style={styles.wheel} onLayout={(e: LayoutChangeEvent) => setViewport(e.nativeEvent.layout.width)}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          snapToInterval={Platform.OS === 'web' ? undefined : STEP_PX}
          decelerationRate="fast"
          contentContainerStyle={{ width: tickCount * STEP_PX + padding * 2 }}>
          <View style={[styles.tickRow, { paddingHorizontal: padding }]}>
            {Array.from({ length: tickCount }, (_, i) => {
              const major = i % 10 === 0;
              const mid = i % 5 === 0;
              return (
                <View key={i} style={styles.tickCell}>
                  <View
                    style={{
                      width: major ? 2 : 1,
                      height: major ? 26 : mid ? 18 : 11,
                      borderRadius: 1,
                      backgroundColor: major ? theme.textSecondary : theme.border,
                    }}
                  />
                </View>
              );
            })}
          </View>
          {Array.from({ length: Math.floor((tickCount - 1) / 10) + 1 }, (_, k) => (
            <ThemedText
              key={k}
              style={[styles.tickLabel, { left: padding + k * 10 * STEP_PX + STEP_PX / 2 - 22 }]}
              themeColor="textTertiary"
              numberOfLines={1}>
              {start + k}
            </ThemedText>
          ))}
        </ScrollView>
        <View pointerEvents="none" style={[styles.indicator, { backgroundColor: theme.accent }]}>
          <View style={[styles.indicatorDot, { backgroundColor: theme.accent }]} />
        </View>
      </View>

      <Pressable onPress={() => setCalendarOpen(true)} accessibilityLabel="Cambia data" style={[styles.dateRow, { backgroundColor: theme.backgroundElement }]}>
        <Icon name="calendar" size={22} color={theme.text} />
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.dateTitle}>Data e ora</ThemedText>
          <ThemedText style={styles.dateValue} themeColor="textSecondary">
            {dateLabel}, {timeLabel}
          </ThemedText>
        </View>
        <Icon name="chevronRight" size={18} color={theme.textTertiary} />
      </Pressable>

      <DayCalendarModal
        visible={calendarOpen}
        selectedDate={selectedDate}
        isDayMarked={(d) => markedDates?.includes(d) ?? false}
        onSelectDate={(d) => setSelectedDate(d > today ? today : d)}
        onClose={() => setCalendarOpen(false)}
      />

      <Pressable
        onPress={() => {
          onSave(Math.round(weight * 10) / 10, selectedDate);
          onClose();
        }}
        style={[styles.save, { backgroundColor: theme.accent }]}>
        <ThemedText style={styles.saveLabel}>Salva misurazione</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  rulerBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  value: {
    fontSize: 52,
    lineHeight: 60,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  unit: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  wheelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: -6,
    zIndex: 2,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusBar: {
    position: 'absolute',
    width: 16,
    height: 2.5,
    borderRadius: 2,
  },
  wheel: {
    height: 64,
    marginTop: -2,
    marginBottom: 14,
  },
  tickRow: {
    flexDirection: 'row',
  },
  tickCell: {
    width: STEP_PX,
    alignItems: 'center',
    paddingTop: 20,
  },
  tickLabel: {
    position: 'absolute',
    top: 50,
    width: 44,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '500',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: '50%',
    marginLeft: -1.5,
    width: 3,
    height: 46,
    borderRadius: 2,
  },
  indicatorDot: {
    position: 'absolute',
    top: -5,
    left: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
  },
  dateTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  dateValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  save: {
    marginTop: 14,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
});
