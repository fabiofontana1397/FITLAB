import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

import { CountUpText } from '@/components/energy-guide/count-up-text';
import { usePlayValue } from '@/components/energy-guide/use-play-value';
import { GlassPopup } from '@/components/glass/glass-popup';
import { Reveal } from '@/components/motion/reveal';
import { ThemedText } from '@/components/themed-text';
import { CheckinInfoPopup } from '@/components/training/checkin-info-popup';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { HorizontalScrollDefaults } from '@/constants/scroll';
import { OnBrand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';
import { mondayIndex } from '@/lib/mock/dates';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { currentMonthIndex, monthEndInfo, monthProgress } from '@/lib/planning/plan-progress';
import type { PlanPhaseKind } from '@/lib/planning/types';
import { checkinUnlockedThroughMonth, useMonthlyCheckinStore } from '@/store/monthly-checkin-store';

const DAY_MS = 86_400_000;
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
  subtitle?: string;
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
};

/**
 * The Piani page for one plan, kept light: a quiet header (plan name, overall progress, a pill per month), one line
 * for the chosen month (small ring, name, download) and then the week, which takes most of the screen. Descriptions,
 * objectives and numbers sit behind a tap. The check-in closes the page.
 */
export function PlanView({ kind, plan, title, subtitle, description, objective, phaseDetail, monthStats, renderDay, exportPdf, notice, footer, checkinPendingMonth, onCheckin }: PlanViewProps) {
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
  const planBar = usePlayValue(planFraction, true, 250);
  const planBarStyle = useAnimatedStyle(() => ({ width: `${Math.max(planBar.value, 0.015) * 100}%` }));

  const month = plan.months.find((m) => m.monthIndex === selectedMonth) ?? plan.months[0];
  const unlockedThrough = checkinUnlockedThroughMonth(completedMonths);
  // A month needs BOTH real time to have passed AND the check-in of the month before it (spec §0.4 punto 2).
  const timeElapsed = selectedMonth <= currentMonth;
  const unlocked = timeElapsed && selectedMonth <= unlockedThrough;
  const needsCheckin = timeElapsed && !unlocked;
  const isCurrent = selectedMonth === currentMonth;
  const isDone = selectedMonth < currentMonth;

  const progress = monthProgress(plan, selectedMonth);
  const { daysLeft, end: monthEnd } = monthEndInfo(plan, selectedMonth);
  const monthEndLabel = monthEnd.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  const monthSub = isDone ? 'Concluso' : isCurrent ? `Giorno ${progress.dayInMonth} di 30 · ${daysLeft <= 1 ? 'ultimo giorno' : `${daysLeft} giorni alla fine`}` : 'Non ancora sbloccato';

  // The small ring sweeps to the chosen month's fraction and glides when another month is picked.
  const ringSize = 52;
  const stroke = 5;
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
      {/* The plan in a glance: name, overall progress, one pill per month. */}
      <Reveal index={0}>
        <View style={styles.head}>
          <View style={styles.headRow}>
            <View style={styles.flex}>
              <ThemedText style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
                {title}
              </ThemedText>
              {subtitle ? (
                <ThemedText style={styles.subtitle} themeColor="textSecondary" numberOfLines={1}>
                  {subtitle}
                </ThemedText>
              ) : null}
            </View>
            <CountUpText value={Math.round(planFraction * 100)} play delay={300} format={(n) => `${Math.round(n)}%`} style={[styles.percent, { color: theme.accent }]} />
            <Pressable
              onPress={() => {
                hapticSelection();
                setPlanInfoOpen((v) => !v);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityState={{ expanded: planInfoOpen }}
              accessibilityLabel="Dettagli del piano"
            >
              <Icon name={planInfoOpen ? 'chevronUp' : 'info'} size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
            <Animated.View style={[styles.trackFill, planBarStyle]}>
              <LinearGradient colors={['#FFA11E', '#FF5A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>

          {planInfoOpen ? (
            <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOut.duration(120)} style={styles.info}>
              <ThemedText style={styles.infoText} themeColor="textSecondary">
                {description}
              </ThemedText>
              <ThemedText style={styles.infoText}>
                <ThemedText style={[styles.infoText, { color: theme.accent, fontWeight: '700' }]}>Obiettivo · </ThemedText>
                {objective}
              </ThemedText>
            </Animated.View>
          ) : null}

          <MonthPills months={plan.months.map((m) => m.monthIndex)} current={currentMonth} selected={selectedMonth} onSelect={(m) => setSelectedMonth(m)} />
        </View>
      </Reveal>

      {/* The chosen month, on one line. */}
      <Reveal index={1} style={styles.section}>
        <Animated.View layout={LinearTransition.duration(260)}>
          <Animated.View key={`month-${selectedMonth}`} entering={FadeIn.duration(300)} style={styles.monthRow}>
            <Pressable
              onPress={() => {
                hapticSelection();
                setMonthInfoOpen((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: monthInfoOpen }}
              accessibilityLabel={`Mese ${selectedMonth}: dettagli`}
              style={styles.monthMain}
            >
              <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
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
                  <Icon name="lock" size={18} color={theme.textTertiary} />
                )}
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.monthTitle} numberOfLines={1}>
                  {month.title}
                </ThemedText>
                <ThemedText style={styles.monthSub} themeColor="textSecondary" numberOfLines={1}>
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
              style={[styles.downloadButton, { backgroundColor: theme.backgroundElement, opacity: unlocked ? 1 : 0.4 }]}
            >
              <Icon name="download" size={18} color={theme.accent} />
            </Pressable>
          </Animated.View>

          {monthInfoOpen ? (
            <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOut.duration(120)} style={styles.info}>
              <ThemedText style={styles.infoText} themeColor="textSecondary">
                {phaseDetail[month.phase]}
              </ThemedText>
              <ThemedText style={styles.infoText}>
                <ThemedText style={[styles.infoText, { color: theme.accent, fontWeight: '700' }]}>Obiettivo · </ThemedText>
                {month.focusNote}
              </ThemedText>
              {stats.length > 0 ? (
                <View style={styles.stats}>
                  {stats.map((st) => (
                    <View key={st.label} style={styles.stat}>
                      <CountUpText
                        value={st.value}
                        play
                        format={(n) => Math.round(n).toLocaleString('it-IT')}
                        suffix={st.unit ? ` ${st.unit}` : ''}
                        style={styles.statValue}
                      />
                      <ThemedText style={styles.statLabel} themeColor="textSecondary" numberOfLines={1}>
                        {st.label}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>
      </Reveal>

      {notice ? <View style={styles.section}>{notice}</View> : null}

      {/* The week: the heart of the page. */}
      <Reveal index={2} style={styles.weekSection}>
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

      {/* Check-in, at the end of the month. */}
      <Reveal index={3} style={styles.section}>
        <Animated.View key={`checkin-${selectedMonth}-${checkinDone}-${checkinDue}`} entering={FadeIn.duration(300)}>
          {checkinDone ? (
            <View style={[styles.checkin, { backgroundColor: theme.backgroundElement }]} accessibilityLabel={`Check-in del Mese ${selectedMonth} completato`}>
              <Icon name="checkCircle" size={18} color={theme.brandGreen} />
              <ThemedText style={styles.checkinText}>Check-in completato</ThemedText>
            </View>
          ) : checkinDue ? (
            <Pressable onPress={onCheckin} accessibilityRole="button" accessibilityLabel={`Fai il check-in del Mese ${selectedMonth}`} style={[styles.checkin, { backgroundColor: theme.accent }]}>
              <Icon name="checkCircle" size={18} color={OnBrand.text} />
              <ThemedText style={[styles.checkinText, { color: OnBrand.text }]}>Fai il check-in · Mese {selectedMonth}</ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setCheckinInfoOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Check-in del Mese ${selectedMonth} bloccato fino alla fine del mese`}
              accessibilityState={{ disabled: true }}
              style={[styles.checkin, { backgroundColor: theme.backgroundElement }]}
            >
              <Icon name="lock" size={16} color={theme.textTertiary} />
              <ThemedText style={[styles.checkinText, { color: theme.textSecondary }]}>Check-in · Mese {selectedMonth}</ThemedText>
            </Pressable>
          )}
        </Animated.View>
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

/** One small pill per month: a check when done, the accent when running, a padlock when still locked. */
function MonthPills({ months, current, selected, onSelect }: { months: number[]; current: number; selected: number; onSelect: (month: number) => void }) {
  const theme = useTheme();
  const scrolls = months.length > 6;
  const pills = months.map((m) => {
    const done = m < current;
    const running = m === current;
    const isSelected = m === selected;
    const bg = running ? theme.accent : done ? theme.backgroundElement : theme.backgroundElement;
    return (
      <Pressable
        key={m}
        onPress={() => {
          hapticSelection();
          onSelect(m);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`Mese ${m}${done ? ', completato' : running ? ', in corso' : ', bloccato'}`}
        style={[styles.pill, scrolls ? styles.pillFixed : styles.flex, { backgroundColor: bg }, isSelected && { borderColor: running ? theme.accent : theme.text, borderWidth: 1.5 }]}
      >
        {done ? (
          <Icon name="check" size={15} color={theme.brandGreen} />
        ) : !running ? (
          <Icon name="lock" size={12} color={theme.textTertiary} />
        ) : null}
        <ThemedText style={[styles.pillText, { color: running ? OnBrand.text : done ? theme.text : theme.textTertiary }]}>{m}</ThemedText>
      </Pressable>
    );
  });
  if (scrolls) {
    return (
      <ScrollView {...HorizontalScrollDefaults} contentContainerStyle={styles.pills}>
        {pills}
      </ScrollView>
    );
  }
  return <View style={styles.pills}>{pills}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  stack: { gap: 12 },
  section: { marginTop: 16 },
  weekSection: { marginTop: 14 },
  center: { textAlign: 'center' },
  head: { gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  percent: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 2, overflow: 'hidden' },
  info: { gap: 8 },
  infoText: { fontSize: 14, lineHeight: 20 },
  pills: { flexDirection: 'row', gap: 6 },
  pill: { height: 38, borderRadius: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  pillFixed: { width: 52 },
  pillText: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ringValue: { fontSize: 16, lineHeight: 20, fontWeight: '800' },
  monthTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  monthSub: { fontSize: 13, lineHeight: 18 },
  downloadButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  stat: { alignItems: 'center', gap: 1 },
  statValue: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  statLabel: { fontSize: 12, lineHeight: 16 },
  locked: { alignItems: 'center', gap: 6, paddingVertical: 40, paddingHorizontal: 12 },
  lockedIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  lockedTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  checkin: { minHeight: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  checkinText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  popup: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
});
