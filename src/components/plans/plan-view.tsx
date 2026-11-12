import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { CountUpText } from '@/components/energy-guide/count-up-text';
import { usePlayValue } from '@/components/energy-guide/use-play-value';
import { GlassPopup } from '@/components/glass/glass-popup';
import { Reveal } from '@/components/motion/reveal';
import { ThemedText } from '@/components/themed-text';
import { CheckinInfoPopup } from '@/components/training/checkin-info-popup';
import { PlanMonthStepper } from '@/components/training/plan-month-stepper';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { OnBrand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSuccess } from '@/lib/haptics';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { currentMonthIndex, monthEndInfo, monthProgress } from '@/lib/planning/plan-progress';
import type { PlanPhaseKind } from '@/lib/planning/types';
import { checkinUnlockedThroughMonth, useMonthlyCheckinStore } from '@/store/monthly-checkin-store';

const DAY_MS = 86_400_000;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((weekday) => ({ value: weekday, label: weekday }));

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const fmtDate = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
/** Monday-first weekday label of today, so the week opens on the day the person is living. */
const todayLabel = () => WEEKDAY_LABELS[(new Date().getDay() + 6) % 7];

export type PlanStat = { icon: IconName; label: string; value: number; unit?: string };

export type PlanViewProps = {
  kind: 'training' | 'diet';
  plan: {
    generatedAt: string;
    durationMonths: number;
    months: { monthIndex: number; phase: PlanPhaseKind; title: string; focusNote: string }[];
  };
  /** Small caption over the macro plan's title. */
  tag: string;
  /** The macro plan's name. */
  title: string;
  subtitle?: string;
  description: string;
  objective: string;
  phaseLabels: Record<PlanPhaseKind, string>;
  phaseDetail: Record<PlanPhaseKind, string>;
  /** The numbers that sum up one month. */
  monthStats: (monthIndex: number) => PlanStat[];
  /** What a day of a month contains: workouts or meals. */
  renderDay: (monthIndex: number, weekday: string) => ReactNode;
  /** Builds and shares the PDF of one month. */
  exportPdf: (monthIndex: number) => Promise<void>;
  /** Shown between the macro plan and the month (warnings). */
  notice?: ReactNode;
  /** Shown after the week, before the check-in. */
  footer?: ReactNode;
  /** The ended month still waiting for its check-in, or null when none is due. */
  checkinPendingMonth: number | null;
  onCheckin: () => void;
};

/**
 * The Piani page for one plan: the macro plan on top (name, description, objective and the month-by-month path, which
 * picks the month), then the chosen month (progress ring, description, objective, numbers, download), its week of
 * workouts or meals and, last, the month's check-in. It is a fragment of sections so each one enters on its own.
 */
export function PlanView({
  kind,
  plan,
  tag,
  title,
  subtitle,
  description,
  objective,
  phaseLabels,
  phaseDetail,
  monthStats,
  renderDay,
  exportPdf,
  notice,
  footer,
  checkinPendingMonth,
  onCheckin,
}: PlanViewProps) {
  const theme = useTheme();
  const narrow = useWindowDimensions().width < 360;
  const completedMonths = useMonthlyCheckinStore((s) => s.completedMonths);

  const total = plan.durationMonths;
  const currentMonth = currentMonthIndex(plan);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedWeekday, setSelectedWeekday] = useState(todayLabel);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [checkinInfoOpen, setCheckinInfoOpen] = useState(false);

  // Read once on mount: `Date.now()` is impure, so it cannot be called while rendering.
  const [now] = useState(() => Date.now());
  const start = new Date(plan.generatedAt);
  const end = new Date(start.getTime() + total * 30 * DAY_MS);
  const planFraction = clamp01((now - start.getTime()) / (total * 30 * DAY_MS));
  const planPercent = Math.round(planFraction * 100);
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

  // The ring sweeps to the chosen month's fraction (and glides when another month is picked).
  const ringSize = narrow ? 96 : 112;
  const stroke = 9;
  const r = (ringSize - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ring = usePlayValue(progress.fraction, true, 200);
  const ringProps = useAnimatedProps(() => ({ strokeDasharray: `${Math.max(ring.value, 0.02) * c} ${c}` }));

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

  const stateLabel = isDone ? 'Completato' : isCurrent ? 'In corso' : 'Bloccato';
  const stateIcon: IconName = isDone ? 'checkCircle' : isCurrent ? 'clock' : 'lock';
  const stateColor = isDone ? theme.brandGreen : isCurrent ? theme.accent : theme.textTertiary;
  const stats = unlocked ? monthStats(selectedMonth) : [];

  // The check-in of the chosen month: done, due now, or still to come.
  const checkinDone = completedMonths.includes(selectedMonth);
  const checkinDue = !checkinDone && (selectedMonth === checkinPendingMonth || (timeElapsed && selectedMonth < currentMonth));

  return (
    <>
      {/* 1 · The macro plan: what it is, what it is for, and the whole path month by month. */}
      <Reveal index={0}>
        <FlatCard radius={28} style={styles.card}>
          <View style={styles.topRow}>
            <ThemedText type="label" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
              {tag}
            </ThemedText>
            <View style={[styles.chip, { backgroundColor: theme.accentSoft }]}>
              <CountUpText value={planPercent} play delay={300} format={(n) => `${Math.round(n)}%`} suffix=" completato" style={[styles.chipText, { color: theme.accent }]} />
            </View>
          </View>

          <View style={styles.heroTitle}>
            <LinearGradient colors={['#FFA11E', '#FF5A00']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.slash} />
            <View style={styles.flex}>
              <ThemedText style={[styles.title, narrow && styles.titleNarrow]} numberOfLines={1} adjustsFontSizeToFit>
                {title}
              </ThemedText>
              {subtitle ? (
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {subtitle}
                </ThemedText>
              ) : null}
            </View>
          </View>

          <ThemedText style={styles.bodyText} themeColor="textSecondary">
            {description}
          </ThemedText>
          <GoalBlock icon="flag" label="Obiettivo del piano" text={objective} />

          <View style={[styles.panel, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.spanDates}>
              <View>
                <ThemedText style={styles.dateCaption} themeColor="textSecondary">
                  INIZIO
                </ThemedText>
                <ThemedText style={styles.dateValue}>{fmtDate(start)}</ThemedText>
              </View>
              <View style={styles.alignEnd}>
                <ThemedText style={styles.dateCaption} themeColor="textSecondary">
                  FINE
                </ThemedText>
                <ThemedText style={styles.dateValue}>{fmtDate(end)}</ThemedText>
              </View>
            </View>
            <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
              <Animated.View style={[styles.trackFill, planBarStyle]}>
                <LinearGradient colors={['#FFA11E', '#FF5A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>
            <PlanMonthStepper
              months={plan.months}
              currentMonth={currentMonth}
              currentFraction={monthProgress(plan, currentMonth).fraction}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
              phaseLabels={phaseLabels}
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Mese {currentMonth} di {total} · tocca un mese per vederne il piano
            </ThemedText>
          </View>
        </FlatCard>
      </Reveal>

      {notice ? (
        <Reveal index={1} style={styles.section}>
          {notice}
        </Reveal>
      ) : null}

      {/* 2 · The chosen month: ring, what it does, what it aims at, its numbers. */}
      <Reveal index={2} style={styles.section}>
        <FlatCard radius={28} style={styles.card}>
          <Animated.View key={`month-${selectedMonth}`} entering={FadeInDown.duration(380)} style={styles.stack}>
            <View style={styles.topRow}>
              <View style={[styles.flex, styles.stateRow]}>
                <ThemedText type="label" themeColor="textSecondary">
                  MESE {selectedMonth}
                </ThemedText>
                <View style={[styles.statePill, { backgroundColor: theme.backgroundElement }]}>
                  <Icon name={stateIcon} size={13} color={stateColor} />
                  <ThemedText style={[styles.statePillText, { color: stateColor }]}>{stateLabel}</ThemedText>
                </View>
              </View>
              <Pressable
                onPress={() => setDownloadOpen(true)}
                disabled={!unlocked}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Scarica il PDF del Mese ${selectedMonth}`}
                accessibilityState={{ disabled: !unlocked }}
                style={[styles.downloadButton, { backgroundColor: theme.backgroundElement, opacity: unlocked ? 1 : 0.4 }]}
              >
                <Icon name="download" size={20} color={theme.accent} />
              </Pressable>
            </View>

            <View style={styles.monthRow}>
              <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Giorno ${progress.dayInMonth} di 30 del Mese ${selectedMonth}`}>
                <Svg width={ringSize} height={ringSize} style={StyleSheet.absoluteFill}>
                  <Defs>
                    <SvgGradient id="monthRing" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor={isDone ? theme.brandGreen : '#FFA11E'} />
                      <Stop offset="1" stopColor={isDone ? theme.brandGreen : '#FF5A00'} />
                    </SvgGradient>
                  </Defs>
                  <Circle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke={theme.backgroundElement} strokeWidth={stroke} fill="none" />
                  <AnimatedCircle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={r}
                    stroke="url(#monthRing)"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                    animatedProps={ringProps}
                    transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                  />
                </Svg>
                {timeElapsed ? (
                  <>
                    <ThemedText style={styles.ringCaption} themeColor="textSecondary">
                      Giorno
                    </ThemedText>
                    <View style={styles.ringValueRow}>
                      <CountUpText value={progress.dayInMonth} play delay={150} format={(n) => String(Math.round(n))} style={styles.ringValue} />
                      <ThemedText style={styles.ringTotal} themeColor="textSecondary">
                        /30
                      </ThemedText>
                    </View>
                  </>
                ) : (
                  <Icon name="lock" size={28} color={theme.textTertiary} />
                )}
              </View>

              <View style={[styles.flex, styles.monthText]}>
                <ThemedText style={styles.monthTitle} numberOfLines={3}>
                  {month.title}
                </ThemedText>
                <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                  <Icon name="clock" size={14} color={theme.accent} />
                  <ThemedText style={styles.chipLabel} numberOfLines={1}>
                    {isDone ? 'Mese concluso' : isCurrent ? (daysLeft <= 1 ? 'Ultimo giorno' : `${daysLeft} giorni alla fine`) : `Dal ${new Date(start.getTime() + (selectedMonth - 1) * 30 * DAY_MS).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`}
                  </ThemedText>
                </View>
              </View>
            </View>

            <ThemedText style={styles.bodyText} themeColor="textSecondary">
              {phaseDetail[month.phase]}
            </ThemedText>
            <GoalBlock icon="target" label="Obiettivo del mese" text={month.focusNote} />

            {stats.length > 0 ? (
              <View style={[styles.statsPanel, { backgroundColor: theme.backgroundElevated }]}>
                {stats.map((st, i) => (
                  <View key={st.label} style={[styles.stat, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.borderStrong }]}>
                    <Icon name={st.icon} size={17} color={theme.accent} />
                    <CountUpText
                      value={st.value}
                      play
                      delay={200 + i * 90}
                      format={(n) => Math.round(n).toLocaleString('it-IT')}
                      suffix={st.unit ? ` ${st.unit}` : ''}
                      style={styles.statValue}
                    />
                    <ThemedText style={styles.statLabel} themeColor="textSecondary" numberOfLines={1} adjustsFontSizeToFit>
                      {st.label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </Animated.View>
        </FlatCard>
      </Reveal>

      {/* 3 · The month's week: pick the day, see its workouts or meals. */}
      <Reveal index={3} style={styles.section}>
        <View style={styles.stack}>
          <ThemedText style={styles.sectionTitle}>{kind === 'training' ? 'I tuoi allenamenti' : 'La tua dieta'}</ThemedText>
          {unlocked ? (
            <>
              <SegmentedControl options={WEEKDAY_OPTIONS} value={selectedWeekday} onChange={setSelectedWeekday} />
              <Animated.View key={`day-${selectedMonth}-${selectedWeekday}`} entering={FadeInDown.duration(340)} style={styles.stack}>
                {renderDay(selectedMonth, selectedWeekday)}
              </Animated.View>
              {footer}
            </>
          ) : (
            <Animated.View key={`locked-${selectedMonth}`} entering={FadeInDown.duration(340)}>
              <FlatCard radius={24} style={styles.lockedCard}>
                <View style={[styles.lockedIcon, { backgroundColor: theme.backgroundElement }]}>
                  <Icon name="lock" size={22} color={theme.textTertiary} />
                </View>
                <ThemedText style={styles.cardTitle}>{needsCheckin ? 'Fai il check-in per sbloccare' : 'Ancora da sbloccare'}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
                  {needsCheckin
                    ? `Il Mese ${selectedMonth - 1} è terminato: rispondi al check-in mensile per sbloccare e adattare il Mese ${selectedMonth}.`
                    : `Si sblocca al termine del Mese ${selectedMonth - 1}. I dettagli si adatteranno ai tuoi progressi fino a quel momento.`}
                </ThemedText>
                {needsCheckin ? <PrimaryButton label="Fai il check-in mensile" onPress={onCheckin} style={{ marginTop: Spacing.two }} /> : null}
              </FlatCard>
            </Animated.View>
          )}
        </View>
      </Reveal>

      {/* 4 · Check-in, at the end of the month. */}
      <Reveal index={4} style={styles.section}>
        <Animated.View key={`checkin-${selectedMonth}-${checkinDone}-${checkinDue}`} entering={FadeInDown.duration(340)} style={styles.stack}>
          {checkinDone ? (
            <View style={[styles.checkin, { backgroundColor: theme.backgroundElement }]} accessibilityLabel={`Check-in del Mese ${selectedMonth} completato`}>
              <Icon name="checkCircle" size={20} color={theme.brandGreen} />
              <ThemedText style={[styles.checkinText, { color: theme.text }]}>Check-in completato · Mese {selectedMonth}</ThemedText>
            </View>
          ) : checkinDue ? (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Il Mese {selectedMonth} è concluso: fai il check-in per aggiornare il piano e passare al Mese {selectedMonth + 1}.
              </ThemedText>
              <Pressable
                onPress={onCheckin}
                accessibilityRole="button"
                accessibilityLabel={`Fai il check-in del Mese ${selectedMonth}`}
                style={[styles.checkin, { backgroundColor: theme.accent }]}
              >
                <Icon name="checkCircle" size={18} color={OnBrand.text} />
                <ThemedText style={[styles.checkinText, { color: OnBrand.text }]}>Fai il check-in · Mese {selectedMonth}</ThemedText>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => setCheckinInfoOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Check-in del Mese ${selectedMonth} bloccato fino alla fine del mese`}
              accessibilityState={{ disabled: true }}
              style={[styles.checkin, { backgroundColor: theme.backgroundElement }]}
            >
              <Icon name="lock" size={18} color={theme.textTertiary} />
              <ThemedText style={[styles.checkinText, { color: theme.textSecondary }]}>Check-in · Mese {selectedMonth}</ThemedText>
            </Pressable>
          )}
        </Animated.View>
      </Reveal>

      <CheckinInfoPopup visible={checkinInfoOpen} onClose={() => setCheckinInfoOpen(false)} monthIndex={selectedMonth} daysLeft={daysLeft} endDate={monthEndLabel} />

      <GlassPopup visible={downloadOpen} onClose={() => (exporting ? undefined : setDownloadOpen(false))} style={styles.popup}>
        <View style={[styles.lockedIcon, styles.popupIcon, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="download" size={24} color={theme.accent} />
        </View>
        <ThemedText type="title" style={styles.center}>
          Scarica il piano
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {kind === 'training' ? 'La scheda' : 'Il piano alimentare'} del Mese {selectedMonth} in PDF, da salvare o stampare.
        </ThemedText>
        <PrimaryButton
          label={exporting ? 'Preparazione PDF…' : `Scarica PDF · Mese ${selectedMonth}`}
          icon="download"
          onPress={handleExport}
          disabled={exporting}
        />
        {exporting ? <ActivityIndicator color={theme.accent} /> : <PrimaryButton label="Annulla" variant="outline" onPress={() => setDownloadOpen(false)} />}
      </GlassPopup>
    </>
  );
}

function GoalBlock({ icon, label, text }: { icon: IconName; label: string; text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.goalBlock, { backgroundColor: theme.backgroundElevated }]}>
      <View style={styles.goalHead}>
        <Icon name={icon} size={16} color={theme.accent} />
        <ThemedText type="label" themeColor="textSecondary">
          {label.toUpperCase()}
        </ThemedText>
      </View>
      <ThemedText style={styles.goalText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  stack: { gap: 14 },
  section: { marginTop: 14 },
  center: { textAlign: 'center' },
  alignEnd: { alignItems: 'flex-end' },
  card: { padding: 16, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statePillText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  downloadButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  slash: { width: 6, alignSelf: 'stretch', borderRadius: 3, transform: [{ skewX: '-12deg' }] },
  title: { fontSize: 28, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6 },
  titleNarrow: { fontSize: 22, lineHeight: 29 },
  bodyText: { fontSize: 14, lineHeight: 20 },
  panel: { borderRadius: 20, padding: 14, gap: 10, boxShadow: '0px 4px 16px rgba(20,20,25,0.08)' },
  spanDates: { flexDirection: 'row', justifyContent: 'space-between' },
  dateCaption: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8 },
  dateValue: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 4, overflow: 'hidden' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  chipLabel: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  monthText: { gap: 8 },
  monthTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.3 },
  ringCaption: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  ringValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  ringValue: { fontSize: 30, lineHeight: 39, fontWeight: '800', letterSpacing: -0.8 },
  ringTotal: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  goalBlock: { borderRadius: 18, padding: 14, gap: 6, boxShadow: '0px 4px 16px rgba(20,20,25,0.06)' },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalText: { fontSize: 15, lineHeight: 21 },
  statsPanel: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingVertical: 10, boxShadow: '0px 4px 16px rgba(20,20,25,0.08)' },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 1, paddingHorizontal: 4 },
  statValue: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  cardTitle: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
  lockedCard: { alignItems: 'center', gap: Spacing.two, padding: Spacing.five },
  lockedIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  checkin: { minHeight: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  checkinText: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  popup: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  popupIcon: { alignSelf: 'center' },
});
