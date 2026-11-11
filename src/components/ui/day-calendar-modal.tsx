import { useMemo, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Layout } from '@/constants/theme';
import type { GoalBandState } from '@/domain/calorie-balance';
import { useDayGoalStatus } from '@/hooks/use-day-goal-status';
import { useTheme } from '@/hooks/use-theme';
import { formatKcal } from '@/lib/format-kcal';
import { hapticSelection } from '@/lib/haptics';
import { daysAgoISO, mondayIndex } from '@/lib/mock/dates';

const WEEKDAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const CIRCLE = 40;
const SWIPE_DISTANCE = 40;

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Local calendar date, not the UTC one `toISOString` would give. */
function isoDate(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthLabel(year: number, month0: number): string {
  const label = new Date(year, month0, 1).toLocaleDateString('it-IT', { month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** What a day's circle shows about the calorie goal: reached (✓), close, or off. */
type GoalLevel = 'reached' | 'close' | 'off';
function levelOf(state: GoalBandState): GoalLevel | null {
  if (state === 'missing') return null;
  if (state === 'reached') return 'reached';
  return state === 'deficitShort' || state === 'surplusShort' ? 'close' : 'off';
}

export type DayCalendarModalProps = {
  visible: boolean;
  selectedDate: string;
  /** Whether a given date gets the small dot marker — e.g. "workout done" for Training. A plain predicate so callers can answer for any month the sheet pages to. Ignored when `showGoalStatus` is on. */
  isDayMarked?: (date: string) => boolean;
  /** Colours every day by how its calorie balance stands against its goal (✓ reached, close, off), with a legend. */
  showGoalStatus?: boolean;
  onSelectDate: (date: string) => void;
  onClose: () => void;
};

/**
 * The calendar: a bottom sheet like Profilo and Promemoria (same rise, same close
 * gestures), holding an iOS-style month — the month in large type with its arrows,
 * round day numbers, today in the accent colour, the picked day ringed. Swipe the
 * grid sideways (or use the arrows) to change month.
 */
export function DayCalendarModal({ visible, selectedDate, isDayMarked, showGoalStatus = false, onSelectDate, onClose }: DayCalendarModalProps) {
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {visible ? <CalendarSheet selectedDate={selectedDate} isDayMarked={isDayMarked} showGoalStatus={showGoalStatus} onSelectDate={onSelectDate} onClose={onClose} /> : null}
    </Modal>
  );
}

type SheetProps = Omit<DayCalendarModalProps, 'visible'>;

function CalendarSheet(props: SheetProps) {
  return props.showGoalStatus ? <WithGoalStatus {...props} /> : <Calendar {...props} statusOf={null} goalKcal={0} />;
}

/** Split out so the stores behind the goal reading are only read when the legend is shown. */
function WithGoalStatus(props: SheetProps) {
  const { statusOf, dailyGoalKcal } = useDayGoalStatus();
  return <Calendar {...props} statusOf={statusOf} goalKcal={dailyGoalKcal} />;
}

function Calendar({ selectedDate, isDayMarked, statusOf, goalKcal, onSelectDate, onClose }: SheetProps & { statusOf: ((date: string) => GoalBandState) | null; goalKcal: number }) {
  const theme = useTheme();
  const today = daysAgoISO(0);
  const selected = new Date(selectedDate);
  const [viewedYear, setViewedYear] = useState(selected.getFullYear());
  const [viewedMonth0, setViewedMonth0] = useState(selected.getMonth());

  const goToMonth = (delta: number) => {
    hapticSelection();
    const d = new Date(viewedYear, viewedMonth0 + delta, 1);
    setViewedYear(d.getFullYear());
    setViewedMonth0(d.getMonth());
  };
  const goToToday = () => {
    hapticSelection();
    const d = new Date(today);
    setViewedYear(d.getFullYear());
    setViewedMonth0(d.getMonth());
  };

  // Sideways swipe on the grid changes month; a mostly-vertical drag is left to the sheet (it closes on a pull down).
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_, g) => {
          if (g.dx <= -SWIPE_DISTANCE) goToMonth(1);
          else if (g.dx >= SWIPE_DISTANCE) goToMonth(-1);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewedYear, viewedMonth0]
  );

  const leadingBlanks = mondayIndex(new Date(viewedYear, viewedMonth0, 1));
  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth(viewedYear, viewedMonth0) }, (_, i) => isoDate(viewedYear, viewedMonth0, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  const levelColor: Record<GoalLevel, string> = { reached: theme.balanceGoalScale[2], close: theme.brandYellow, off: theme.accent };
  const viewingOtherMonth = new Date(today).getMonth() !== viewedMonth0 || new Date(today).getFullYear() !== viewedYear;

  return (
    <SheetScreen title="Calendario" onClose={onClose} scroll={false}>
      {(close) => (
        <View style={styles.body}>
          <View style={styles.monthRow}>
            <View style={styles.monthTitle}>
              <ThemedText style={styles.month} accessibilityRole="header">
                {monthLabel(viewedYear, viewedMonth0)}
              </ThemedText>
              <ThemedText style={styles.year} themeColor="textSecondary">
                {viewedYear}
              </ThemedText>
            </View>
            {viewingOtherMonth ? (
              <Pressable onPress={goToToday} hitSlop={8} accessibilityRole="button" style={[styles.todayPill, { backgroundColor: theme.accentSoft }]}>
                <ThemedText style={[styles.todayPillLabel, { color: theme.accent }]}>Oggi</ThemedText>
              </Pressable>
            ) : null}
            <Pressable onPress={() => goToMonth(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Mese precedente" style={styles.arrow}>
              <Icon name="arrowBack" size={24} color={theme.accent} />
            </Pressable>
            <Pressable onPress={() => goToMonth(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Mese successivo" style={styles.arrow}>
              <Icon name="chevronRight" size={24} color={theme.accent} />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LETTERS.map((letter, i) => (
              <View key={i} style={styles.cell}>
                <ThemedText style={styles.weekday} themeColor="textTertiary">
                  {letter}
                </ThemedText>
              </View>
            ))}
          </View>
          <View style={[styles.rule, { backgroundColor: theme.border }]} />

          <View {...swipe.panHandlers} style={styles.grid}>
            {weeks.map((week, w) => (
              <View key={w} style={styles.weekRow}>
                {week.map((date, i) => {
                  if (!date) return <View key={`blank-${i}`} style={styles.cell} />;
                  const level = statusOf ? levelOf(statusOf(date)) : null;
                  const marked = !statusOf && isDayMarked?.(date);
                  const isSelected = date === selectedDate;
                  const isToday = date === today;
                  const color = level ? levelColor[level] : null;
                  return (
                    <View key={date} style={styles.cell}>
                      <Pressable
                        onPress={() => {
                          hapticSelection();
                          onSelectDate(date);
                          close();
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`${new Date(date).getDate()} ${monthLabel(viewedYear, viewedMonth0)}${isToday ? ', oggi' : ''}${level === 'reached' ? ', obiettivo raggiunto' : level === 'close' ? ', vicino all’obiettivo' : level === 'off' ? ', fuori obiettivo' : ''}`}
                        style={[
                          styles.circle,
                          color ? { backgroundColor: withAlpha(color, level === 'reached' ? 0.22 : 0.26) } : null,
                          isSelected ? { borderColor: theme.accent } : { borderColor: 'transparent' },
                        ]}>
                        <ThemedText style={[styles.dayNumber, { color: isToday ? theme.accent : theme.text }, (isToday || isSelected) && styles.dayNumberStrong]}>{new Date(date).getDate()}</ThemedText>
                        {level === 'reached' ? (
                          <View style={[styles.check, { backgroundColor: levelColor.reached, borderColor: theme.surfacePopup }]}>
                            <Icon name="check" size={9} color="#FFFFFF" />
                          </View>
                        ) : null}
                        {marked ? <View style={[styles.dot, { backgroundColor: theme.success }]} /> : null}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          {statusOf ? (
            <View style={[styles.legend, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.legendTitle}>{goalSentence(goalKcal)}</ThemedText>
              <View style={styles.legendCompact}>
                <LegendRow color={levelColor.reached} check label="Raggiunto" />
                <LegendRow color={levelColor.off} label="Fuori obiettivo" />
                <LegendRow color={null} label="Senza colore" />
              </View>
            </View>
          ) : null}
        </View>
      )}
    </SheetScreen>
  );
}

/** "Il tuo obiettivo: deficit di 151 kcal al giorno" — what the colours below are measured against. */
function goalSentence(goalKcal: number): string {
  if (Math.abs(goalKcal) < 50) return 'Il tuo obiettivo: pareggio, nessun deficit né surplus';
  return `Il tuo obiettivo: ${goalKcal < 0 ? 'deficit' : 'surplus'} di ${formatKcal(goalKcal)} kcal al giorno`;
}

/** A small sample drawn like a day of the month (a tinted circle, with the check badge for "reached"), then its name. */
function LegendRow({ color, label, check = false }: { color: string | null; label: string; check?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendSwatch, color ? { backgroundColor: withAlpha(color, check ? 0.22 : 0.26) } : { borderWidth: 1.5, borderColor: theme.border }]}>
        {check && color ? (
          <View style={[styles.legendCheck, { backgroundColor: color }]}>
            <Icon name="check" size={9} color="#FFFFFF" />
          </View>
        ) : color ? (
          <View style={[styles.legendDot, { backgroundColor: color }]} />
        ) : null}
      </View>
      <ThemedText style={styles.legendLabel}>{label}</ThemedText>
    </View>
  );
}

function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: Layout.screenGutter, paddingTop: 8, paddingBottom: 24 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  monthTitle: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  month: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  year: { fontSize: 20, lineHeight: 26, fontWeight: '500' },
  arrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  todayPill: { height: 30, paddingHorizontal: 12, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  todayPillLabel: { fontSize: 13, fontWeight: '700' },
  weekdayRow: { flexDirection: 'row' },
  weekday: { fontSize: 12, fontWeight: '700' },
  rule: { height: StyleSheet.hairlineWidth, marginTop: 6, marginBottom: 4 },
  // Rows keep their usual 52 pt (only a very short screen squeezes them), so the month stays as roomy as it was.
  grid: { flexShrink: 1, minHeight: 0 },
  weekRow: { height: 52, flexShrink: 1, flexDirection: 'row' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center' },
  circle: { height: CIRCLE, maxHeight: '100%', aspectRatio: 1, borderRadius: CIRCLE, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: 17, lineHeight: 22, fontWeight: '500' },
  dayNumberStrong: { fontWeight: '800' },
  check: { position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', bottom: 3, width: 5, height: 5, borderRadius: 2.5 },
  legend: { marginTop: 10, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, gap: 6 },
  legendTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  legendCompact: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 10, rowGap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendCheck: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  legendLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
});
