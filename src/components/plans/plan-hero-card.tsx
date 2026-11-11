import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { CountUpText } from '@/components/energy-guide/count-up-text';
import { usePlayValue } from '@/components/energy-guide/use-play-value';
import { ThemedText } from '@/components/themed-text';
import { CheckinInfoPopup } from '@/components/training/checkin-info-popup';
import { PrimaryButton } from '@/components/ui/primary-button';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { OnBrand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Goal } from '@/lib/mock/types';
import { currentMonthIndex, currentMonthProgress, monthEndInfo } from '@/lib/planning/plan-progress';
import type { DietPlan, TrainingPlan } from '@/lib/planning/types';

const DAY_MS = 86_400_000;

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

/** The whole plan's objective, in a sentence, for the card's "Obiettivo del piano". */
const TRAINING_GOAL_TEXT: Record<Goal, string> = {
  loseFat: 'Ridurre la massa grassa mantenendo il muscolo, con allenamenti progressivi e un dispendio energetico costante.',
  gainMuscle: 'Aumentare la massa muscolare con volume e carichi che crescono mese dopo mese.',
  gainStrength: 'Diventare più forte sui grandi movimenti, alzando i carichi in modo graduale e sicuro.',
  maintainImprove: 'Mantenere ciò che hai costruito e migliorarlo con piccoli passi, senza stress.',
  improveEndurance: 'Costruire fiato e resistenza, aumentando la capacità di sostenere lo sforzo nel tempo.',
  generalHealth: 'Stare bene ogni giorno: una routine regolare di movimento che puoi mantenere a lungo.',
};

const DIET_GOAL_TEXT: Record<Goal, string> = {
  loseFat: 'Un deficit calorico moderato, con proteine alte per perdere grasso senza perdere muscolo.',
  gainMuscle: 'Un leggero surplus calorico, con proteine e carboidrati a sostegno della crescita muscolare.',
  gainStrength: 'Energia sufficiente per allenamenti pesanti e recupero, con un surplus contenuto.',
  maintainImprove: 'Calorie in equilibrio e una distribuzione dei macro che sostiene il tuo livello attuale.',
  improveEndurance: 'Carboidrati a sufficienza per alimentare le sessioni lunghe e recuperare bene.',
  generalHealth: 'Un’alimentazione varia ed equilibrata, sul modello mediterraneo.',
};

type Stat = { icon: IconName; value: string; label: string };

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const fmtDate = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** The Training plan's big card for the Piani page. */
export function TrainingPlanHeroCard({ plan, goal, checkinPendingMonth, onPress, onCheckin }: HeroActions & { plan: TrainingPlan; goal: Goal }) {
  const monthIndex = currentMonthIndex(plan);
  const month = plan.months.find((m) => m.monthIndex === monthIndex) ?? plan.months[0];
  const workouts = month.weeklySplit.filter((d) => d.type === 'workout');
  const runs = month.weeklySplit.filter((d) => d.type === 'cardio').length;
  // "Upper A" / "Upper B" are the same split: show each pattern once.
  const splits = [...new Set(workouts.map((d) => d.title.replace(/ [AB]$/, '')))];
  const avgExercises = workouts.length > 0 ? Math.round(workouts.reduce((sum, d) => sum + (d.exercises?.length ?? 0), 0) / workouts.length) : 0;
  const structure = [splits.length > 0 ? splits.join(' · ') : null, runs > 0 ? `${runs} ${runs === 1 ? 'corsa' : 'corse'}` : null].filter(Boolean).join(' + ');

  return (
    <PlanHeroCard
      tag="IL TUO PROGRAMMA"
      title={GOAL_NAME[goal]}
      subtitle={structure}
      plan={plan}
      monthTitle={month.title}
      monthGoal={month.focusNote}
      planGoal={TRAINING_GOAL_TEXT[goal]}
      stats={[
        { icon: 'calendar', value: `${plan.durationMonths} mesi`, label: 'Durata' },
        { icon: 'barbell', value: `${workouts.length + runs}/sett.`, label: 'Sedute' },
        { icon: 'categoryAll', value: avgExercises > 0 ? `~${avgExercises}` : '—', label: 'Esercizi' },
      ]}
      checkinPendingMonth={checkinPendingMonth}
      onPress={onPress}
      onCheckin={onCheckin}
      accessibilityLabel="Dettagli del programma"
    />
  );
}

/** The Diet plan's counterpart: strategy for the goal, daily calories and the month's macro targets. */
export function DietPlanHeroCard({ plan, goal, checkinPendingMonth, onPress, onCheckin }: HeroActions & { plan: DietPlan; goal: Goal }) {
  const monthIndex = currentMonthIndex(plan);
  const month = plan.months.find((m) => m.monthIndex === monthIndex) ?? plan.months[0];
  const meals = month.weeklySplit[0]?.meals.length ?? 0;
  const kcal = Math.round(month.calorieTarget).toLocaleString('it-IT');
  const { protein, carbs, fats } = month.macroTargetsG;

  return (
    <PlanHeroCard
      tag="IL TUO PIANO ALIMENTARE"
      title={DIET_STRATEGY[goal]}
      subtitle={`~${kcal} kcal al giorno${meals > 0 ? ` · ${meals} pasti` : ''}`}
      plan={plan}
      monthTitle={month.title}
      monthGoal={month.focusNote}
      planGoal={DIET_GOAL_TEXT[goal]}
      stats={[
        { icon: 'protein', value: `${Math.round(protein)} g`, label: 'Proteine' },
        { icon: 'carbs', value: `${Math.round(carbs)} g`, label: 'Carboidrati' },
        { icon: 'fats', value: `${Math.round(fats)} g`, label: 'Grassi' },
      ]}
      checkinPendingMonth={checkinPendingMonth}
      onPress={onPress}
      onCheckin={onCheckin}
      accessibilityLabel="Dettagli del piano alimentare"
    />
  );
}

type HeroActions = {
  /** The ended month still waiting for its check-in, or null when none is due. */
  checkinPendingMonth: number | null;
  onPress: () => void;
  onCheckin: () => void;
};

function PlanHeroCard({
  tag,
  title,
  subtitle,
  plan,
  monthTitle,
  monthGoal,
  planGoal,
  stats,
  checkinPendingMonth,
  onPress,
  onCheckin,
  accessibilityLabel,
}: HeroActions & {
  tag: string;
  title: string;
  subtitle?: string;
  plan: { generatedAt: string; durationMonths: number };
  monthTitle: string;
  monthGoal: string;
  planGoal: string;
  stats: Stat[];
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const narrow = useWindowDimensions().width < 360;
  const [infoOpen, setInfoOpen] = useState(false);

  const total = plan.durationMonths;
  const monthIndex = currentMonthIndex(plan);
  const { dayInMonth, fraction: monthFraction } = currentMonthProgress(plan);
  const start = new Date(plan.generatedAt);
  const end = new Date(start.getTime() + total * 30 * DAY_MS);
  // Read once on mount: `Date.now()` is impure, so it cannot be called while rendering.
  const [now] = useState(() => Date.now());
  const planFraction = clamp01((now - start.getTime()) / (total * 30 * DAY_MS));
  const { end: monthEnd, daysLeft } = monthEndInfo(plan, monthIndex);
  const monthEndLabel = monthEnd.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

  // One 0→1 value drives the whole entrance: bars fill month after month, the ring sweeps, numbers count up.
  const intro = usePlayValue(1, true);
  const ringSize = narrow ? 96 : 112;
  const stroke = 9;
  const r = (ringSize - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ringProps = useAnimatedProps(() => ({ strokeDasharray: `${Math.max(monthFraction * intro.value, 0.02) * c} ${c}` }));

  const pending = checkinPendingMonth != null;

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

        <View style={styles.topRow}>
          <ThemedText type="label" themeColor="textSecondary" numberOfLines={1} style={styles.tag}>
            {tag}
          </ThemedText>
          <View style={styles.details}>
            <ThemedText style={[styles.detailsText, { color: theme.accent }]}>Dettagli</ThemedText>
            <Icon name="chevronRight" size={13} color={theme.accent} />
          </View>
        </View>

        <View style={styles.heroTitle}>
          <LinearGradient colors={['#FFA11E', '#FF5A00']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.slash} />
          <View style={styles.heroText}>
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
      </Pressable>

      <View style={styles.body}>
        {/* The running month: a ring through its 30 days, and what it is for. */}
        <View style={styles.monthRow}>
          <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Giorno ${dayInMonth} di 30 del Mese ${monthIndex}`}>
            <Svg width={ringSize} height={ringSize} style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgGradient id="monthRing" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#FFA11E" />
                  <Stop offset="1" stopColor="#FF5A00" />
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
            <ThemedText style={styles.ringCaption} themeColor="textSecondary">
              Giorno
            </ThemedText>
            <View style={styles.ringValueRow}>
              <CountUpText value={dayInMonth} play delay={150} format={(n) => String(Math.round(n))} style={styles.ringValue} />
              <ThemedText style={styles.ringTotal} themeColor="textSecondary">
                /30
              </ThemedText>
            </View>
          </View>

          <View style={styles.monthText}>
            <ThemedText type="label" themeColor="textSecondary">
              MESE {monthIndex}
            </ThemedText>
            <ThemedText style={styles.monthTitle} numberOfLines={2}>
              {monthTitle}
            </ThemedText>
            <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <Icon name="clock" size={14} color={theme.accent} />
              <ThemedText style={styles.chipText} numberOfLines={1}>
                {daysLeft <= 1 ? 'Ultimo giorno' : `${daysLeft} giorni alla fine`}
              </ThemedText>
            </View>
            <ThemedText style={styles.monthEnd} themeColor="textSecondary" numberOfLines={1}>
              Check-in dal {monthEndLabel}
            </ThemedText>
          </View>
        </View>

        <GoalBlock icon="target" label="Obiettivo del mese" text={monthGoal} />
      </View>

      {pending ? (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.pendingNote}>
            Il Mese {checkinPendingMonth} è concluso: fai il check-in per aggiornare il piano e passare al Mese {monthIndex}.
          </ThemedText>
          <Pressable
            onPress={onCheckin}
            accessibilityRole="button"
            accessibilityLabel={`Fai il check-in del Mese ${checkinPendingMonth}`}
            style={[styles.checkin, { backgroundColor: theme.accent }]}
          >
            <Icon name="checkCircle" size={18} color={OnBrand.text} />
            <ThemedText style={[styles.checkinText, { color: OnBrand.text }]}>Fai il check-in · Mese {checkinPendingMonth}</ThemedText>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={() => setInfoOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Check-in del Mese ${monthIndex} bloccato fino alla fine del mese`}
          accessibilityState={{ disabled: true }}
          style={[styles.checkin, { backgroundColor: theme.backgroundElement }]}
        >
          <Icon name="lock" size={18} color={theme.textTertiary} />
          <ThemedText style={[styles.checkinText, { color: theme.textSecondary }]}>Check-in · Mese {monthIndex}</ThemedText>
        </Pressable>
      )}

      <CheckinInfoPopup visible={infoOpen} onClose={() => setInfoOpen(false)} monthIndex={monthIndex} daysLeft={daysLeft} endDate={monthEndLabel} />

      <PrimaryButton label="Visualizza piano" icon="calendar" variant="outline" onPress={onPress} />

      <View style={[styles.divider, { backgroundColor: theme.borderStrong }]} />

      <View style={styles.body}>
        {/* The plan's whole span: one segment per month, filling left to right up to today. */}
        <View style={[styles.panel, { backgroundColor: theme.backgroundElevated }]}>
          <View style={styles.spanDates}>
            <View>
              <ThemedText style={styles.dateCaption} themeColor="textSecondary">
                INIZIO
              </ThemedText>
              <ThemedText style={styles.dateValue}>{fmtDate(start)}</ThemedText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <ThemedText style={styles.dateCaption} themeColor="textSecondary">
                FINE
              </ThemedText>
              <ThemedText style={styles.dateValue}>{fmtDate(end)}</ThemedText>
            </View>
          </View>

          <View style={styles.segments}>
            {Array.from({ length: total }, (_, i) => (
              <MonthSegment key={i} index={i} total={total} planFraction={planFraction} intro={intro} current={i + 1 === monthIndex} />
            ))}
          </View>
          <View style={styles.segmentLabels}>
            {Array.from({ length: total }, (_, i) => (
              <ThemedText
                key={i}
                style={[styles.segmentLabel, { color: i + 1 === monthIndex ? theme.accent : theme.textTertiary }, i + 1 === monthIndex && { fontWeight: '800' }]}
              >
                {i + 1}
              </ThemedText>
            ))}
          </View>

          <View style={styles.spanFoot}>
            <ThemedText type="small" themeColor="textSecondary">
              Mese {monthIndex} di {total}
            </ThemedText>
            <CountUpText value={Math.round(planFraction * 100)} play format={(n) => `${Math.round(n)}%`} suffix=" del piano" style={styles.spanPercent} />
          </View>
        </View>

        <GoalBlock icon="flag" label="Obiettivo del piano" text={planGoal} />
        <View style={[styles.statsPanel, { backgroundColor: theme.backgroundElevated }]}>
          {stats.map((st, i) => (
            <View key={st.label} style={[styles.stat, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.borderStrong }]}>
              <Icon name={st.icon} size={17} color={theme.accent} />
              <ThemedText style={styles.statValue} numberOfLines={1}>
                {st.value}
              </ThemedText>
              <ThemedText style={styles.statLabel} themeColor="textSecondary" numberOfLines={1} adjustsFontSizeToFit>
                {st.label}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    </FlatCard>
  );
}

/** One month of the span bar: months before today are full, the current one is part-filled, the rest stay empty. */
function MonthSegment({ index, total, planFraction, intro, current }: { index: number; total: number; planFraction: number; intro: SharedValue<number>; current: boolean }) {
  const theme = useTheme();
  const target = clamp01(planFraction * total - index);
  const fillStyle = useAnimatedStyle(() => {
    // The segments fill one after the other as `intro` runs: segment i starts when the ones before it are done.
    const sweep = intro.value * total;
    const own = Math.min(1, Math.max(0, sweep - index));
    return { width: `${target * own * 100}%` };
  });
  return (
    <View style={[styles.segment, { backgroundColor: theme.backgroundElement }, current && { borderColor: theme.accent, borderWidth: 1.5 }]}>
      <Animated.View style={[styles.segmentFill, fillStyle]}>
        <LinearGradient colors={['#FFA11E', '#FF5A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
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
  card: { padding: 16, gap: 12 },
  body: { gap: 14 },
  swoosh: { position: 'absolute', left: 0, right: 0, top: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tag: { flexShrink: 1 },
  details: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailsText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  heroTitle: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  heroText: { flex: 1, minWidth: 0 },
  slash: { width: 6, alignSelf: 'stretch', borderRadius: 3, transform: [{ skewX: '-12deg' }] },
  title: { fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.6 },
  titleNarrow: { fontSize: 22, lineHeight: 28 },
  panel: { borderRadius: 20, padding: 14, gap: 8, boxShadow: '0px 4px 16px rgba(20,20,25,0.08)' },
  spanDates: { flexDirection: 'row', justifyContent: 'space-between' },
  dateCaption: { fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 0.8 },
  dateValue: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  segments: { flexDirection: 'row', gap: 4, marginTop: 4 },
  segment: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
  segmentFill: { height: '100%', borderRadius: 6, overflow: 'hidden' },
  segmentLabels: { flexDirection: 'row', gap: 4 },
  segmentLabel: { flex: 1, textAlign: 'center', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  spanFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spanPercent: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringCaption: { fontSize: 11, lineHeight: 13, fontWeight: '600' },
  ringValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  ringValue: { fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -0.8 },
  ringTotal: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  monthText: { flex: 1, minWidth: 0, gap: 4 },
  monthTitle: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginTop: 2 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  monthEnd: { fontSize: 12, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  goalBlock: { borderRadius: 18, padding: 14, gap: 6, boxShadow: '0px 4px 16px rgba(20,20,25,0.06)' },
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalText: { fontSize: 15, lineHeight: 21 },
  statsPanel: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingVertical: 10, boxShadow: '0px 4px 16px rgba(20,20,25,0.08)' },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', gap: 1, paddingHorizontal: 4 },
  statValue: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
  statLabel: { fontSize: 11, lineHeight: 14, fontWeight: '500' },
  pendingNote: { textAlign: 'center' },
  checkin: { minHeight: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  checkinText: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
});
