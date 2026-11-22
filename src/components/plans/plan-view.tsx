import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { CountUpText } from '@/components/energy-guide/count-up-text';
import { usePlayValue } from '@/components/energy-guide/use-play-value';
import { GlassPopup } from '@/components/glass/glass-popup';
import { MonthTimeline } from '@/components/plans/month-timeline';
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
import type { PlanPhaseKind } from '@/lib/planning/types';
import { checkinUnlockedThroughMonth, useMonthlyCheckinStore } from '@/store/monthly-checkin-store';

const DAY_MS = 86_400_000;
const RING_SIZE = 40;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
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

  const progress = monthProgress(plan, selectedMonth);
  const { daysLeft, end: monthEnd } = monthEndInfo(plan, selectedMonth);
  const monthEndLabel = monthEnd.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  const monthSub = isDone ? 'Concluso' : isCurrent ? `Giorno ${progress.dayInMonth} di 30 · ${daysLeft <= 1 ? 'ultimo giorno' : `${daysLeft} giorni alla fine`}` : 'Non ancora sbloccato';

  // The small ring sweeps to the chosen month's fraction and glides when another month is picked.
  const ringSize = RING_SIZE;
  const stroke = 4;
  const r = (ringSize - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ring = usePlayValue(progress.fraction, true, 200);
  const ringProps = useAnimatedProps(() => ({ strokeDasharray: `${Math.max(ring.value, 0.03) * c} ${c}` }));

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
  const ringColor = isDone ? theme.brandGreen : theme.accent;

  // The check-in of the chosen month: done, due now, or still to come.
  const checkinDone = completedMonths.includes(selectedMonth);
  const checkinDue = !checkinDone && (selectedMonth === checkinPendingMonth || (timeElapsed && selectedMonth < currentMonth));

  return (
    <>
      {/* The macro plan, in one small box: where the plan stands, the month selector, the chosen month. */}
      {custom ? (
        <Reveal index={0}>
          <CustomPlanSummary kind={kind} own={custom.own} stats={monthStats(selectedMonth)} onUpdate={custom.onUpdate} />
        </Reveal>
      ) : (
      <Reveal index={0}>
        <FlatCard radius={Radius.medium} style={styles.box}>
          <View>
          <View style={styles.headRow}>
            <View style={styles.flex}>
              <ThemedText style={styles.title} numberOfLines={1} accessibilityRole="header">
                {kind === 'training' ? 'Il tuo piano di allenamento' : 'Il tuo piano alimentare'}
              </ThemedText>
              <View style={[styles.strategy, { backgroundColor: theme.accentSoft }]}>
                <ThemedText style={[styles.strategyText, { color: theme.accent }]} numberOfLines={1}>
                  {title}
                </ThemedText>
              </View>
            </View>
            <Pressable
              onPress={() => {
                hapticSelection();
                setPlanInfoOpen((v) => !v);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ expanded: planInfoOpen }}
              accessibilityLabel="Dettagli del piano"
              style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 }]}
            >
              <Icon name={planInfoOpen ? 'chevronUp' : 'info'} size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* The plan at a glance: how long it lasts, where it stands. */}
          <View style={styles.facts}>
            <View style={styles.fact}>
              <ThemedText style={styles.factValue} numberOfLines={1}>
                {total} {total === 1 ? 'mese' : 'mesi'}
              </ThemedText>
              <ThemedText style={styles.factLabel} themeColor="textSecondary">
                Durata
              </ThemedText>
            </View>
            <View style={[styles.fact, styles.factDivided, { borderLeftColor: theme.border }]}>
              <ThemedText style={styles.factValue} numberOfLines={1}>
                {Math.min(currentMonth, total)} di {total}
              </ThemedText>
              <ThemedText style={styles.factLabel} themeColor="textSecondary">
                Mese in corso
              </ThemedText>
            </View>
            <View style={[styles.fact, styles.factDivided, { borderLeftColor: theme.border }]}>
              <CountUpText value={Math.round(planFraction * 100)} play delay={300} format={(n) => `${Math.round(n)}%`} style={[styles.factValue, { color: theme.accent }]} />
              <ThemedText style={styles.factLabel} themeColor="textSecondary">
                Completato
              </ThemedText>
            </View>
          </View>

            <Collapsible open={planInfoOpen} contentStyle={styles.info}>
              <ThemedText style={styles.infoText} themeColor="textSecondary">
                {description}
              </ThemedText>
              <ThemedText style={styles.infoText}>
                <ThemedText style={[styles.infoText, { color: theme.accent, fontWeight: '700' }]}>Obiettivo · </ThemedText>
                {objective}
              </ThemedText>
            </Collapsible>
          </View>

          <MonthTimeline months={plan.months.map((m) => m.monthIndex)} current={currentMonth} selected={selectedMonth} elapsedMonths={planFraction * total} onSelect={(m) => setSelectedMonth(m)} />

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
              <View style={styles.ring}>
                <Svg width={ringSize} height={ringSize} style={StyleSheet.absoluteFill}>
                  <Circle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke={theme.backgroundElement} strokeWidth={stroke} fill="none" />
                  <AnimatedCircle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={r}
                    stroke={ringColor}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                    animatedProps={ringProps}
                    transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                  />
                </Svg>
                {timeElapsed ? (
                  <CountUpText value={progress.dayInMonth} play delay={150} format={(n) => String(Math.round(n))} style={styles.ringValue} />
                ) : (
                  <Icon name="lock" size={15} color={theme.textTertiary} />
                )}
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.monthTitle} numberOfLines={2}>
                  {month.title}
                </ThemedText>
                <ThemedText style={styles.caption} themeColor="textSecondary" numberOfLines={1}>
                  {monthSub}
                </ThemedText>
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
              style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.backgroundElement, opacity: !unlocked ? 0.4 : pressed ? 0.6 : 1 }]}
            >
              <Icon name="download" size={17} color={theme.accent} />
            </Pressable>
          </Animated.View>

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
            <View style={[styles.lockedIcon, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="lock" size={20} color={theme.textTertiary} />
            </View>
            <ThemedText style={styles.lockedTitle}>{needsCheckin ? 'Fai il check-in per sbloccare' : 'Ancora da sbloccare'}</ThemedText>
            <ThemedText style={[styles.infoText, styles.center]} themeColor="textSecondary">
              {needsCheckin ? `Il Mese ${selectedMonth - 1} è finito: il check-in sblocca e adatta il Mese ${selectedMonth}.` : `Si sblocca al termine del Mese ${selectedMonth - 1}.`}
            </ThemedText>
            {needsCheckin ? <PrimaryButton label="Fai il check-in" onPress={onCheckin} style={{ marginTop: Spacing.two }} /> : null}
          </Animated.View>
        )}
      </Reveal>

      <CheckinInfoPopup visible={checkinInfoOpen} onClose={() => setCheckinInfoOpen(false)} monthIndex={selectedMonth} daysLeft={daysLeft} endDate={monthEndLabel} />

      <GlassPopup visible={downloadOpen} onClose={() => (exporting ? undefined : setDownloadOpen(false))} style={styles.popup}>
        <View style={[styles.lockedIcon, { backgroundColor: theme.backgroundElement, alignSelf: 'center' }]}>
          <Icon name="download" size={22} color={theme.accent} />
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

/**
 * The summary of a card or diet the person loaded: what it is, its key numbers in one row, and a single button to
 * update it. No duration, no months, no progress: the app follows it as written.
 */
function CustomPlanSummary({ kind, own, stats, onUpdate }: { kind: 'training' | 'diet'; own?: boolean; stats: PlanStat[]; onUpdate: () => void }) {
  const theme = useTheme();
  const isDiet = kind === 'diet';
  const updateLabel = isDiet ? 'Aggiorna dieta' : own ? 'Modifica programma' : 'Aggiorna scheda';

  return (
    <FlatCard radius={Radius.medium} style={styles.summary}>
      <View style={styles.summaryHead}>
        <View style={[styles.summaryBadge, { backgroundColor: theme.accentSoft }]}>
          <Icon name={isDiet ? 'utensils' : 'dumbbellLine'} size={16} strokeWidth={1.5} color={theme.accent} />
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.summaryOverline} themeColor="textSecondary" numberOfLines={1}>
            {isDiet ? 'Dieta personale' : own ? 'Creato da te' : 'Scheda personale'}
          </ThemedText>
          <ThemedText style={styles.summaryTitle} numberOfLines={1} accessibilityRole="header">
            {isDiet ? 'La tua dieta' : own ? 'Il tuo programma' : 'La tua scheda'}
          </ThemedText>
        </View>
        {/* Small pill in the corner: updating is occasional, so it stays out of the way. */}
        <Pressable
          onPress={() => {
            hapticSelection();
            onUpdate();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={updateLabel}
          style={({ pressed }) => [styles.summaryButton, { backgroundColor: theme.accentSoft, opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name={own && !isDiet ? 'edit' : 'refresh'} size={13} color={theme.accent} />
          <ThemedText style={[styles.summaryButtonLabel, { color: theme.accent }]}>{own && !isDiet ? 'Modifica' : 'Aggiorna'}</ThemedText>
        </Pressable>
      </View>

      {stats.length > 0 ? (
        <View style={[styles.summaryStats, { borderTopColor: theme.border }]}>
          {stats.map((st, i) => (
            <View key={st.label} style={[styles.fact, i > 0 && [styles.factDivided, { borderLeftColor: theme.border }]]}>
              <ThemedText style={styles.summaryValue} numberOfLines={1}>
                {Math.round(st.value).toLocaleString('it-IT')}
                {st.unit ? <ThemedText style={styles.summaryUnit} themeColor="textSecondary">{` ${st.unit}`}</ThemedText> : null}
              </ThemedText>
              <ThemedText style={styles.factLabel} themeColor="textSecondary" numberOfLines={1}>
                {st.label}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  summary: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  summaryOverline: { fontSize: 11, lineHeight: 14, fontWeight: '500', letterSpacing: 0.2 },
  summaryTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.3 },
  summaryStats: { flexDirection: 'row', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  summaryValue: { fontSize: 16, lineHeight: 20, fontWeight: '600', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  summaryUnit: { fontSize: 12, lineHeight: 20, fontWeight: '500' },
  summaryButton: { height: 28, borderRadius: 14, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10 },
  summaryButtonLabel: { fontSize: 13, lineHeight: 16, fontWeight: '600', letterSpacing: -0.1 },
  stack: { gap: 12 },
  section: { marginTop: 16 },
  center: { textAlign: 'center' },
  box: { padding: 14, gap: 12 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  strategy: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderCurve: 'continuous', maxWidth: '100%' },
  strategyText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  facts: { flexDirection: 'row', marginTop: 14 },
  fact: { flex: 1, minWidth: 0, gap: 1 },
  factDivided: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 12 },
  factValue: { fontSize: 16, lineHeight: 21, fontWeight: '700', fontVariant: ['tabular-nums'] },
  factLabel: { fontSize: 12, lineHeight: 16 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3 },
  caption: { fontSize: 13, lineHeight: 18 },
  captionStrong: { fontWeight: '700' },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  info: { gap: 8, paddingTop: 12 },
  infoText: { fontSize: 14, lineHeight: 20 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  monthMain: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ring: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
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
