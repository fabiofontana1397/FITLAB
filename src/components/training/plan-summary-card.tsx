import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { CheckinInfoPopup } from '@/components/training/checkin-info-popup';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { useMonthlyCheckinStore } from '@/store/monthly-checkin-store';
import type { Goal } from '@/lib/mock/types';
import { currentMonthIndex, currentMonthProgress, monthEndInfo } from '@/lib/planning/plan-progress';
import type { DietPlan, TrainingPlan } from '@/lib/planning/types';

const GOAL_NAME: Record<Goal, string> = {
  loseFat: 'Definizione',
  gainMuscle: 'Ipertrofia',
  maintainImprove: 'Mantenimento',
  gainStrength: 'Forza',
  improveEndurance: 'Resistenza',
  generalHealth: 'Benessere',
};

/** What the diet does for each goal, as the diet card's headline. */
const DIET_STRATEGY: Record<Goal, string> = {
  loseFat: 'Deficit calorico',
  gainMuscle: 'Surplus controllato',
  gainStrength: 'Leggero surplus',
  maintainImprove: 'Mantenimento',
  improveEndurance: 'Energia per la resistenza',
  generalHealth: 'Equilibrio mediterraneo',
};

type Stat = { icon: IconName; value: string; label: string };

/** Where the plan is: month X of N and day Y of the whole plan. */
function planProgress(plan: { generatedAt: string; durationMonths: number }) {
  const monthIndex = currentMonthIndex(plan);
  const totalDays = plan.durationMonths * 30;
  const day = Math.min((monthIndex - 1) * 30 + currentMonthProgress(plan).dayInMonth, totalDays);
  return { monthIndex, totalDays, day };
}

/** The training plan screen's header card: where the Training tab sells the
 * journey ("Il tuo percorso"), this is the program's spec sheet — goal,
 * weekly structure, progress through the whole plan and key numbers.
 * Tapping it opens the full program description. */
export function PlanSummaryCard({ plan, goal, onPress }: { plan: TrainingPlan; goal: Goal; onPress: () => void }) {
  const { monthIndex, totalDays, day } = planProgress(plan);
  const month = plan.months.find((m) => m.monthIndex === monthIndex) ?? plan.months[0];
  const workouts = month.weeklySplit.filter((d) => d.type === 'workout');
  const runs = month.weeklySplit.filter((d) => d.type === 'cardio').length;
  // "Upper A" / "Upper B" are the same split: show each pattern once.
  const splits = [...new Set(workouts.map((d) => d.title.replace(/ [AB]$/, '')))];
  const avgExercises = workouts.length > 0 ? Math.round(workouts.reduce((sum, d) => sum + (d.exercises?.length ?? 0), 0) / workouts.length) : 0;
  const structure = [splits.length > 0 ? splits.join(' · ') : null, runs > 0 ? `${runs} ${runs === 1 ? 'corsa' : 'corse'}` : null]
    .filter(Boolean)
    .join(' + ');

  return (
    <PlanSpecCard
      tag="IL TUO PROGRAMMA"
      title={GOAL_NAME[goal]}
      subtitle={structure}
      plan={plan}
      monthIndex={monthIndex}
      durationMonths={plan.durationMonths}
      day={day}
      totalDays={totalDays}
      stats={[
        { icon: 'calendar', value: `${plan.durationMonths} mesi`, label: 'Durata' },
        { icon: 'barbell', value: `${workouts.length + runs}/sett.`, label: 'Sedute' },
        { icon: 'categoryAll', value: avgExercises > 0 ? `~${avgExercises}` : '—', label: 'Esercizi' },
      ]}
      onPress={onPress}
      accessibilityLabel="Dettagli del programma"
    />
  );
}

/** The diet plan screen's counterpart: strategy for the goal, daily calories
 * and meals, progress through the plan and the month's macro targets. */
export function DietPlanSummaryCard({ plan, goal, onPress }: { plan: DietPlan; goal: Goal; onPress: () => void }) {
  const { monthIndex, totalDays, day } = planProgress(plan);
  const month = plan.months.find((m) => m.monthIndex === monthIndex) ?? plan.months[0];
  const meals = month.weeklySplit[0]?.meals.length ?? 0;
  const kcal = Math.round(month.calorieTarget).toLocaleString('it-IT');
  const { protein, carbs, fats } = month.macroTargetsG;

  return (
    <PlanSpecCard
      tag="IL TUO PIANO ALIMENTARE"
      title={DIET_STRATEGY[goal]}
      subtitle={`~${kcal} kcal al giorno${meals > 0 ? ` · ${meals} pasti` : ''}`}
      plan={plan}
      monthIndex={monthIndex}
      durationMonths={plan.durationMonths}
      day={day}
      totalDays={totalDays}
      stats={[
        { icon: 'protein', value: `${Math.round(protein)} g`, label: 'Proteine' },
        { icon: 'carbs', value: `${Math.round(carbs)} g`, label: 'Carboidrati' },
        { icon: 'fats', value: `${Math.round(fats)} g`, label: 'Grassi' },
      ]}
      onPress={onPress}
      accessibilityLabel="Dettagli del piano alimentare"
    />
  );
}

/** At most this many months show at once; a longer plan scrolls sideways. */
const MAX_VISIBLE_MONTHS = 6;
const NODE = 30;
const LINE = 4;

type MonthState = 'done' | 'current' | 'locked';

/** One month on the timeline: a tick once it has passed, a progress ring while it runs, a lock while it is still to come. */
function MonthNode({ index, state, fraction }: { index: number; state: MonthState; fraction: number }) {
  const theme = useTheme();
  if (state === 'done') {
    return (
      <View style={[styles.node, { backgroundColor: theme.brandGreen }]} accessibilityLabel={`Mese ${index} completato`}>
        <Icon name="check" size={16} color="#FFFFFF" />
      </View>
    );
  }
  if (state === 'locked') {
    return (
      <View style={[styles.node, { backgroundColor: theme.backgroundElement }]} accessibilityLabel={`Mese ${index} ancora da sbloccare`}>
        <Icon name="lock" size={14} color={theme.textTertiary} />
      </View>
    );
  }
  const r = (NODE - 4) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={[styles.node, { backgroundColor: theme.background }]} accessibilityLabel={`Mese ${index} in corso, ${Math.round(fraction * 100)}%`}>
      <Svg width={NODE} height={NODE} style={StyleSheet.absoluteFill}>
        <Circle cx={NODE / 2} cy={NODE / 2} r={r} stroke={theme.backgroundSelected} strokeWidth={3} fill="none" />
        <Circle
          cx={NODE / 2}
          cy={NODE / 2}
          r={r}
          stroke={theme.accent}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${Math.max(fraction, 0.04) * c} ${c}`}
          transform={`rotate(-90 ${NODE / 2} ${NODE / 2})`}
        />
      </Svg>
      <ThemedText style={[styles.nodeNumber, { color: theme.accent }]}>{index}</ThemedText>
    </View>
  );
}

function PlanSpecCard({
  tag,
  title,
  subtitle,
  plan,
  monthIndex,
  durationMonths,
  day,
  totalDays,
  stats,
  onPress,
  accessibilityLabel,
}: {
  tag: string;
  title: string;
  subtitle?: string;
  plan: { generatedAt: string; durationMonths: number };
  monthIndex: number;
  durationMonths: number;
  day: number;
  totalDays: number;
  stats: Stat[];
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const completedMonths = useMonthlyCheckinStore((s) => s.completedMonths);
  const [infoOpen, setInfoOpen] = useState(false);
  const { fraction } = currentMonthProgress(plan);

  // The month that just ended is the one whose check-in is due (same rule as the check-in screen).
  const endedMonth = monthIndex - 1;
  const checkinDue = endedMonth >= 1 && !completedMonths.includes(endedMonth);
  const checkinMonth = checkinDue ? endedMonth : monthIndex;
  const { end, daysLeft } = monthEndInfo(plan, monthIndex);
  const endDate = end.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

  const scrolls = durationMonths > MAX_VISIBLE_MONTHS;
  const [timelineWidth, setTimelineWidth] = useState(0);
  const timelineRef = useRef<ScrollView>(null);
  const colWidth = scrolls ? timelineWidth / MAX_VISIBLE_MONTHS : undefined;
  // A long plan opens with the current month in view, roughly centred.
  useEffect(() => {
    if (!scrolls || !colWidth) return;
    timelineRef.current?.scrollTo({ x: Math.max(0, (monthIndex - 1 - (MAX_VISIBLE_MONTHS - 1) / 2) * colWidth), animated: false });
  }, [scrolls, colWidth, monthIndex]);
  const months = Array.from({ length: durationMonths }, (_, i) => {
    const index = i + 1;
    const state: MonthState = index < monthIndex ? 'done' : index === monthIndex ? 'current' : 'locked';
    const lineFill = index < monthIndex ? 1 : index === monthIndex ? fraction : 0;
    return (
      <View key={index} style={[styles.monthCol, colWidth ? { flexGrow: 0, flexShrink: 0, flexBasis: colWidth, width: colWidth } : null]}>
        {i < durationMonths - 1 ? (
          <View style={[styles.line, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.lineFill, { width: `${lineFill * 100}%`, backgroundColor: index < monthIndex ? theme.brandGreen : theme.accent }]} />
          </View>
        ) : null}
        <MonthNode index={index} state={state} fraction={fraction} />
      </View>
    );
  });

  const narrow = useWindowDimensions().width < 360;
  const ringFraction = Math.min(1, monthIndex / durationMonths);

  return (
    <FlatCard radius={28} style={styles.card}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={styles.body}>
        {/* A faint orange swoosh behind the title, the card's one flourish. */}
        <Svg pointerEvents="none" width="100%" height={150} viewBox="0 0 360 150" preserveAspectRatio="none" style={styles.swoosh}>
          <Defs>
            <SvgGradient id="swoosh" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={theme.accent} stopOpacity={0} />
              <Stop offset="0.55" stopColor={theme.accent} stopOpacity={0.1} />
              <Stop offset="1" stopColor={theme.accent} stopOpacity={0.02} />
            </SvgGradient>
          </Defs>
          <Path d="M110 120 C 170 70, 230 10, 300 24 C 330 30, 350 50, 360 70 C 320 50, 260 40, 200 80 C 170 100, 140 125, 110 120 Z" fill="url(#swoosh)" />
        </Svg>

        <View style={styles.headRow}>
          <LinearGradient colors={['#FFA11E', '#FF5A00']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.slash} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText type="label" themeColor="textSecondary" numberOfLines={1} style={{ paddingRight: narrow ? 62 : 84 }}>
              {tag}
            </ThemedText>
            <ThemedText style={[styles.title, narrow && styles.titleNarrow]} numberOfLines={1} adjustsFontSizeToFit>
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.details}>
            <ThemedText style={[styles.detailsText, { color: theme.accent }]}>Dettagli</ThemedText>
            <Icon name="chevronRight" size={13} color={theme.accent} />
          </View>
        </View>

        <View style={styles.middle}>
          <View style={[styles.statsPanel, { backgroundColor: theme.backgroundElevated }]}>
            {stats.map((st, i) => (
              <View key={st.label} style={[styles.stat, narrow && styles.statNarrow, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.borderStrong }]}>
                <Icon name={st.icon} size={16} color={theme.accent} />
                <View style={{ flexShrink: 1 }}>
                  <ThemedText style={styles.statValue} numberOfLines={1}>
                    {st.value}
                  </ThemedText>
                  <ThemedText style={styles.statLabel} themeColor="textSecondary" numberOfLines={1}>
                    {st.label}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.ringCol}>
            <MonthRing fraction={ringFraction} month={monthIndex} total={durationMonths} />
            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.dayText}>
              Giorno {day} di {totalDays}
            </ThemedText>
          </View>
        </View>

        <View onLayout={(e) => setTimelineWidth(e.nativeEvent.layout.width)}>
          {scrolls ? (
            <ScrollView ref={timelineRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeline}>
              {months}
            </ScrollView>
          ) : (
            <View style={styles.timeline}>{months}</View>
          )}
        </View>
      </Pressable>

      <Pressable
        onPress={() => (checkinDue ? router.push('/monthly-checkin') : setInfoOpen(true))}
        accessibilityRole="button"
        accessibilityLabel={checkinDue ? `Fai il check-in del Mese ${checkinMonth}` : `Check-in del Mese ${checkinMonth} bloccato`}
        accessibilityState={{ disabled: !checkinDue }}
        style={[styles.checkin, checkinDue ? { backgroundColor: theme.accent } : { backgroundColor: theme.backgroundElement }]}>
        <Icon name={checkinDue ? 'checkCircle' : 'lock'} size={18} color={checkinDue ? theme.onAccent : theme.textTertiary} />
        <ThemedText style={[styles.checkinText, { color: checkinDue ? theme.onAccent : theme.textSecondary }]}>
          {checkinDue ? `Fai il check-in · Mese ${checkinMonth}` : `Check-in · Mese ${checkinMonth}`}
        </ThemedText>
      </Pressable>

      <CheckinInfoPopup visible={infoOpen} onClose={() => setInfoOpen(false)} monthIndex={checkinMonth} daysLeft={daysLeft} endDate={endDate} />
    </FlatCard>
  );
}

/** "Mese 1/8" inside a ring whose orange arc shows how many of the plan's months are reached. */
function MonthRing({ fraction, month, total }: { fraction: number; month: number; total: number }) {
  const theme = useTheme();
  const size = 82;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Mese ${month} di ${total}`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFA11E" />
            <Stop offset="1" stopColor="#FF5A00" />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.backgroundElement} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${Math.max(fraction, 0.04) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <ThemedText style={styles.ringMonth} themeColor="textSecondary">
        Mese
      </ThemedText>
      <ThemedText style={styles.ringValue}>
        {month}/{total}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 14 },
  body: { gap: 14 },
  swoosh: { position: 'absolute', left: 0, right: 0, top: 20 },
  headRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  // The orange slash beside the title: a slanted rounded bar.
  slash: { width: 6, borderRadius: 3, transform: [{ skewX: '-12deg' }], marginTop: 2, marginBottom: 2 },
  details: { position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailsText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8 },
  titleNarrow: { fontSize: 26, lineHeight: 32 },
  middle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4 },
  statsPanel: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 22,
    paddingVertical: 10,
    boxShadow: '0px 4px 16px rgba(20,20,25,0.08)',
  },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  statNarrow: { flexDirection: 'column', gap: 2, paddingHorizontal: 4 },
  ringCol: { alignItems: 'center', gap: 4 },
  dayText: { fontSize: 12 },
  ringMonth: { fontSize: 12, lineHeight: 15, fontWeight: '600' },
  ringValue: { fontSize: 21, lineHeight: 25, fontWeight: '700', letterSpacing: -0.5 },
  timeline: { flexDirection: 'row' },
  monthCol: { flex: 1, alignItems: 'center', gap: 4 },
  // Joins this month's node to the next one's: from this column's centre to the next column's.
  line: { position: 'absolute', top: NODE / 2 - LINE / 2, left: '50%', width: '100%', height: LINE, borderRadius: LINE / 2, overflow: 'hidden' },
  lineFill: { height: '100%', borderRadius: LINE / 2 },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center' },
  nodeNumber: { fontSize: 13, lineHeight: 16, fontWeight: '700' },
  statValue: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  statLabel: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  checkin: { minHeight: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  checkinText: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
});
