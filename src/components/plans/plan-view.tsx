import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { CountUpText } from '@/components/energy-guide/count-up-text';
import { GlassPopup } from '@/components/glass/glass-popup';
import { MonthTimeline, MonthWeeksProgress } from '@/components/plans/month-timeline';
import { Reveal } from '@/components/motion/reveal';
import { ThemedText } from '@/components/themed-text';
import { CheckinInfoPopup } from '@/components/training/checkin-info-popup';
import { Collapsible } from '@/components/ui/collapsible';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { OnBrand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';
import { mondayIndex } from '@/lib/mock/dates';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { currentMonthIndex, monthEndInfo, monthProgress } from '@/lib/planning/plan-progress';
import { planMonthName } from '@/lib/planning/targets-plan';
import type { PlanPhaseKind } from '@/lib/planning/types';
import { checkinUnlockedThroughMonth, useMonthlyCheckinStore } from '@/store/monthly-checkin-store';

const DAY_MS = 86_400_000;
const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((weekday) => ({ value: weekday, label: weekday }));

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Monday-first weekday label of today, so the week opens on the day the person is living. */
const todayLabel = () => WEEKDAY_LABELS[mondayIndex(new Date())];

export type PlanStat = { icon: IconName; label: string; value: number; unit?: string };

export type PlanViewProps = {
  kind: 'training' | 'diet';
  plan: {
    generatedAt: string;
    durationMonths: number;
    months: { monthIndex: number; phase: PlanPhaseKind; title: string; focusNote: string }[];
  };
  /** The macro plan's name. */
  title: string;
  description: string;
  objective: string;
  phaseDetail: Record<PlanPhaseKind, string>;
  /** The numbers that sum up one month. */
  monthStats: (monthIndex: number) => PlanStat[];
  /** What a day of a month contains: workouts or meals. */
  renderDay: (monthIndex: number, weekday: string) => ReactNode;
  /** Builds and shares the PDF of one month. */
  exportPdf: (monthIndex: number) => Promise<void>;
  /** Shown above the week (warnings). */
  notice?: ReactNode;
  /** Shown after the week, before the check-in. */
  footer?: ReactNode;
  /** The ended month still waiting for its check-in, or null when none is due. */
  checkinPendingMonth: number | null;
  onCheckin: () => void;
  /** The person's own card or diet: no months, no check-in, only a summary and the way to update it. */
  /** A plan the person loaded (`own`: built in the app instead): a summary box with one button to update it. */
  custom?: { onUpdate: () => void; own?: boolean };
};

/**
 * The Piani page for one plan. A small box sums up the macro plan (a plain title, its strategy, duration and progress as facts, the months as a path that fills)
 * and the chosen month (ring, name, download, check-in); descriptions, objectives and numbers sit behind a tap and
 * open by growing in place. Right under it comes the week of workouts or meals, which is what the page is for.
 */
export function PlanView({ kind, plan, title, description, objective, phaseDetail, monthStats, renderDay, exportPdf, notice, footer, checkinPendingMonth, onCheckin, custom }: PlanViewProps) {
  const theme = useTheme();
  const completedMonths = useMonthlyCheckinStore((s) => s.completedMonths);

  const total = plan.durationMonths;
  const currentMonth = currentMonthIndex(plan);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedWeekday, setSelectedWeekday] = useState(todayLabel);
  const [planInfoOpen, setPlanInfoOpen] = useState(false);
  const [monthInfoOpen, setMonthInfoOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [checkinInfoOpen, setCheckinInfoOpen] = useState(false);

  // Read once on mount: `Date.now()` is impure, so it cannot be called while rendering.
  const [now] = useState(() => Date.now());
  const start = new Date(plan.generatedAt);
  const planFraction = clamp01((now - start.getTime()) / (total * 30 * DAY_MS));

  const month = plan.months.find((m) => m.monthIndex === selectedMonth) ?? plan.months[0];
  const unlockedThrough = checkinUnlockedThroughMonth(completedMonths);
  // A month needs BOTH real time to have passed AND the check-in of the month before it (spec §0.4 punto 2).
  const timeElapsed = selectedMonth <= currentMonth;
  // A card or diet the person loaded is followed as written: every week is open, nothing waits for a check-in.
  const unlocked = custom != null || (timeElapsed && selectedMonth <= unlockedThrough);
  const needsCheckin = timeElapsed && !unlocked;
  const isCurrent = selectedMonth === currentMonth;
  const isDone = selectedMonth < currentMonth;

  const { daysLeft, end: monthEnd } = monthEndInfo(plan, selectedMonth);
  const monthEndLabel = monthEnd.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  const monthSub = isDone ? 'Concluso' : isCurrent ? null : 'Non ancora sbloccato';

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPdf(selectedMonth);
      hapticSuccess();
      setDownloadOpen(false);
    } catch {
      Alert.alert('Non riesco a generare il PDF', 'Riprova tra qualche istante.');
    } finally {
      setExporting(false);
    }
  };

  const stats = unlocked ? monthStats(selectedMonth) : [];

  // The check-in of the chosen month: done, due now, or still to come.
  const checkinDone = completedMonths.includes(selectedMonth);
  const checkinDue = !checkinDone && (selectedMonth === checkinPendingMonth || (timeElapsed && selectedMonth < currentMonth));

  return (
    <>
      {/* The macro plan, in one small box: where the plan stands, the month selector, the chosen month. */}
      {custom ? (
        <Reveal index={0}>
          <CustomPlanSummary kind={kind} own={custom.own} startedAt={plan.generatedAt} now={now} onUpdate={custom.onUpdate} />
        </Reveal>
      ) : (
      <Reveal index={0}>
        <FlatCard radius={Radius.medium} style={styles.box}>
          {/* The plan's name; "Come funziona" opens what it is, how it goes on and what it aims at. */}
          <View style={styles.headRow}>
            <ThemedText style={[styles.title, styles.flex]} numberOfLines={1} accessibilityRole="header">
              {kind === 'training' ? 'Il tuo piano di allenamento' : 'Il tuo piano alimentare'}
            </ThemedText>
            <Pressable
              onPress={() => {
                hapticSelection();
                setPlanInfoOpen(true);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Come funziona il piano"
              style={({ pressed }) => [styles.howButton, { opacity: pressed ? 0.5 : 1 }]}
            >
              <ThemedText style={styles.howLabel} themeColor="textSecondary">
                Come funziona
              </ThemedText>
              <Icon name="chevronRight" size={13} color={theme.textSecondary} />
            </Pressable>
          </View>

          <MonthTimeline
            months={plan.months.map((m) => m.monthIndex)}
            current={currentMonth}
            selected={selectedMonth}
            elapsedMonths={planFraction * total}
            onSelect={(m) => setSelectedMonth(m)}
            labels={plan.months.map((m) => planMonthName(plan.generatedAt, m.monthIndex))}
          />

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* The chosen month, on one line. */}
          <View>
          <Animated.View key={`month-${selectedMonth}`} entering={FadeIn.duration(300)} style={styles.monthRow}>
            <Pressable
              onPress={() => {
                hapticSelection();
                setMonthInfoOpen((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: monthInfoOpen }}
              accessibilityLabel={`Mese ${selectedMonth}: dettagli`}
              style={({ pressed }) => [styles.monthMain, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={styles.flex}>
                <ThemedText style={styles.monthTitle} numberOfLines={2}>
                  {month.title}
                </ThemedText>
                {monthSub ? (
                  <ThemedText style={styles.caption} themeColor="textSecondary" numberOfLines={1}>
                    {monthSub}
                  </ThemedText>
                ) : null}
              </View>
              <Icon name={monthInfoOpen ? 'chevronUp' : 'chevronDown'} size={16} color={theme.textTertiary} />
            </Pressable>
            <Pressable
              onPress={() => setDownloadOpen(true)}
              disabled={!unlocked}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Scarica il PDF del Mese ${selectedMonth}`}
              accessibilityState={{ disabled: !unlocked }}
              style={({ pressed }) => [styles.iconButton, { opacity: !unlocked ? 0.35 : pressed ? 0.5 : 1 }]}
            >
              <Icon name="download" size={22} color={theme.text} />
            </Pressable>
          </Animated.View>

            {/* The chosen month in its four weeks. */}
            <View style={styles.weeksRow}>
              <MonthWeeksProgress key={`weeks-${selectedMonth}`} daysElapsed={monthProgress(plan, selectedMonth).fraction * 30} />
            </View>

            <Collapsible open={monthInfoOpen} contentStyle={styles.info}>
              <ThemedText style={styles.infoText} themeColor="textSecondary">
                {phaseDetail[month.phase]}
              </ThemedText>
              <ThemedText style={styles.infoText}>
                <ThemedText style={[styles.infoText, { color: theme.accent, fontWeight: '700' }]}>Obiettivo · </ThemedText>
                {month.focusNote}
              </ThemedText>
              {stats.length > 0 ? (
                <View style={[styles.stats, { backgroundColor: theme.backgroundElement }]}>
                  {stats.map((st) => (
                    <View key={st.label} style={styles.stat}>
                      <CountUpText value={st.value} play={monthInfoOpen} format={(n) => Math.round(n).toLocaleString('it-IT')} suffix={st.unit ? ` ${st.unit}` : ''} style={styles.statValue} />
                      <ThemedText style={styles.statLabel} themeColor="textSecondary" numberOfLines={1}>
                        {st.label}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </Collapsible>
          </View>

          {/* The month's check-in: done, due now, or still to come. */}
          {checkinDone ? (
            <View style={[styles.checkin, { backgroundColor: theme.backgroundElement }]} accessibilityLabel={`Check-in del Mese ${selectedMonth} completato`}>
              <Icon name="checkCircle" size={18} color={theme.brandGreen} />
              <ThemedText style={styles.checkinText}>Check-in completato</ThemedText>
            </View>
          ) : checkinDue ? (
            <Pressable
              onPress={onCheckin}
              accessibilityRole="button"
              accessibilityLabel={`Fai il check-in del Mese ${selectedMonth}`}
              style={({ pressed }) => [styles.checkin, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <Icon name="checkCircle" size={18} color={OnBrand.text} />
              <ThemedText style={[styles.checkinText, { color: OnBrand.text }]}>Fai il check-in · Mese {selectedMonth}</ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setCheckinInfoOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Check-in del Mese ${selectedMonth}: disponibile a fine mese`}
              style={({ pressed }) => [styles.checkin, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 }]}
            >
              <Icon name="lock" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.checkinText, { color: theme.textSecondary }]}>
                Check-in · {timeElapsed && isCurrent ? (daysLeft <= 1 ? 'da domani' : `tra ${daysLeft} giorni`) : `Mese ${selectedMonth}`}
              </ThemedText>
            </Pressable>
          )}
        </FlatCard>
      </Reveal>
      )}

      {notice ? <View style={styles.section}>{notice}</View> : null}

      {/* The week: the heart of the page. */}
      <Reveal index={1} style={styles.section}>
        {unlocked ? (
          <View style={styles.stack}>
            <SegmentedControl options={WEEKDAY_OPTIONS} value={selectedWeekday} onChange={setSelectedWeekday} />
            <Animated.View key={`day-${selectedMonth}-${selectedWeekday}`} entering={FadeInDown.duration(340)} style={styles.stack}>
              {renderDay(selectedMonth, selectedWeekday)}
            </Animated.View>
            {footer}
          </View>
        ) : (
          <Animated.View key={`locked-${selectedMonth}`} entering={FadeInDown.duration(340)} style={styles.locked}>
            <View style={styles.lockedIcon}>
              <Icon name="lock" size={24} color={theme.text} />
            </View>
            <ThemedText style={styles.lockedTitle}>{needsCheckin ? 'Fai il check-in per sbloccare' : 'Ancora da sbloccare'}</ThemedText>
            <ThemedText style={[styles.infoText, styles.center]} themeColor="textSecondary">
              {needsCheckin ? `Il Mese ${selectedMonth - 1} è finito: il check-in sblocca e adatta il Mese ${selectedMonth}.` : `Si sblocca al termine del Mese ${selectedMonth - 1}.`}
            </ThemedText>
            {needsCheckin ? <PrimaryButton label="Fai il check-in" onPress={onCheckin} style={{ marginTop: Spacing.two }} /> : null}
          </Animated.View>
        )}
      </Reveal>

      <GlassPopup visible={planInfoOpen} onClose={() => setPlanInfoOpen(false)} style={styles.popup}>
        <ThemedText type="title" style={styles.center}>
          Come funziona
        </ThemedText>
        <ThemedText style={[styles.popupStrategy, styles.center]} themeColor="textSecondary">
          {title}
        </ThemedText>
        <View style={styles.popupSection}>
          <ThemedText style={styles.popupHeading}>Il programma</ThemedText>
          <ThemedText style={styles.infoText} themeColor="textSecondary">
            {description}
          </ThemedText>
        </View>
        <View style={styles.popupSection}>
          <ThemedText style={styles.popupHeading}>Obiettivo</ThemedText>
          <ThemedText style={styles.infoText} themeColor="textSecondary">
            {objective}
          </ThemedText>
        </View>
        <View style={styles.popupSection}>
          <ThemedText style={styles.popupHeading}>Come procede</ThemedText>
          <ThemedText style={styles.infoText} themeColor="textSecondary">
            {`Il piano dura ${total} ${total === 1 ? 'mese' : 'mesi'}, divisi in settimane. A fine mese fai il check-in: sblocca il mese successivo e lo adatta ai tuoi progressi. I mesi futuri restano bloccati, ma puoi già guardarli.`}
          </ThemedText>
        </View>
        <PrimaryButton label="Ho capito" onPress={() => setPlanInfoOpen(false)} />
      </GlassPopup>

      <CheckinInfoPopup visible={checkinInfoOpen} onClose={() => setCheckinInfoOpen(false)} monthIndex={selectedMonth} daysLeft={daysLeft} endDate={monthEndLabel} />

      <GlassPopup visible={downloadOpen} onClose={() => (exporting ? undefined : setDownloadOpen(false))} style={styles.popup}>
        <View style={[styles.lockedIcon, { alignSelf: 'center' }]}>
          <Icon name="download" size={26} color={theme.text} />
        </View>
        <ThemedText type="title" style={styles.center}>
          Scarica il piano
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {kind === 'training' ? 'La scheda' : 'Il piano alimentare'} del Mese {selectedMonth} in PDF.
        </ThemedText>
        <PrimaryButton label={exporting ? 'Preparazione PDF…' : `Scarica PDF · Mese ${selectedMonth}`} icon="download" onPress={handleExport} disabled={exporting} />
        {exporting ? <ActivityIndicator color={theme.accent} /> : <PrimaryButton label="Annulla" variant="outline" onPress={() => setDownloadOpen(false)} />}
      </GlassPopup>
    </>
  );
}

/** "3 settimane" from the start date, or "Prima settimana" while the first one is still running. */
function weeksSince(startMs: number, now: number): string {
  const weeks = Math.floor(Math.max(0, now - startMs) / (7 * DAY_MS));
  return weeks === 0 ? 'Prima settimana' : `${weeks} ${weeks === 1 ? 'settimana' : 'settimane'}`;
}

/**
 * The summary of a card or diet the person loaded (or built): only its name, when it started and how many weeks have
 * passed, with a single pill to update it. No numbers, no duration, no months: the app follows it as written.
 */
function CustomPlanSummary({ kind, own, startedAt, now, onUpdate }: { kind: 'training' | 'diet'; own?: boolean; startedAt: string; now: number; onUpdate: () => void }) {
  const theme = useTheme();
  const isDiet = kind === 'diet';
  const updateLabel = isDiet ? 'Aggiorna dieta' : own ? 'Modifica programma' : 'Aggiorna scheda';
  const startMs = new Date(startedAt).getTime();
  const startLabel = new Date(startMs).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

  return (
    <FlatCard radius={Radius.large} style={styles.summary}>
      <View style={styles.flex}>
        <ThemedText style={styles.summaryTitle} numberOfLines={1} accessibilityRole="header">
          {isDiet ? 'La tua dieta' : own ? 'Il tuo programma' : 'La tua scheda'}
        </ThemedText>
        <View style={styles.summaryMeta}>
          <Icon name="calendar" size={13} color={theme.textSecondary} />
          <ThemedText style={styles.summaryMetaText} themeColor="textSecondary" numberOfLines={1}>
            {`Dal ${startLabel}`}
            <ThemedText style={styles.summaryMetaText} themeColor="textTertiary">{'  ·  '}</ThemedText>
            {weeksSince(startMs, now)}
          </ThemedText>
        </View>
      </View>
      {/* Solid inverted pill: reads at a glance as a button, in light and dark alike. */}
      <Pressable
        onPress={() => {
          hapticSelection();
          onUpdate();
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={updateLabel}
        style={({ pressed }) => [styles.summaryButton, { backgroundColor: theme.text, transform: [{ scale: pressed ? 0.94 : 1 }], opacity: pressed ? 0.9 : 1 }]}
      >
        <Icon name={own && !isDiet ? 'edit' : 'refresh'} size={14} strokeWidth={2.2} color={theme.background} />
        <ThemedText style={[styles.summaryButtonLabel, { color: theme.background }]}>{own && !isDiet ? 'Modifica' : 'Aggiorna'}</ThemedText>
      </Pressable>
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  summaryTitle: { fontSize: 21, lineHeight: 26, fontWeight: '600', letterSpacing: -0.5 },
  summaryMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  summaryMetaText: { fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  summaryButton: { height: 34, borderRadius: 17, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 14 },
  summaryButtonLabel: { fontSize: 14, lineHeight: 18, fontWeight: '600', letterSpacing: -0.2 },
  stack: { gap: 12 },
  section: { marginTop: 16 },
  center: { textAlign: 'center' },
  box: { padding: 14, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  howButton: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  howLabel: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  weeksRow: { marginTop: 10 },
  popupStrategy: { fontSize: 15, lineHeight: 20, fontWeight: '600', marginTop: -6 },
  popupSection: { gap: 4 },
  popupHeading: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3 },
  caption: { fontSize: 13, lineHeight: 18 },
  captionStrong: { fontWeight: '700' },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  info: { gap: 8, paddingTop: 12 },
  infoText: { fontSize: 14, lineHeight: 20 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  monthMain: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  monthTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14 },
  stat: { alignItems: 'center', gap: 1 },
  statValue: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  statLabel: { fontSize: 12, lineHeight: 16 },
  locked: { alignItems: 'center', gap: 6, paddingVertical: 40, paddingHorizontal: 12 },
  lockedIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  lockedTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  checkin: { minHeight: 44, borderRadius: 14, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  checkinText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  popup: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
});
