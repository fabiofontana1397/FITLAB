import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { InsightCard } from '@/components/ui/insight-card';
import { ProgressRing } from '@/components/ui/progress-ring';
import { TrendChart } from '@/components/ui/trend-chart';
import { Icon, type IconName } from '@/components/ui/icon';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWeeklyEnergy } from '@/hooks/use-weekly-energy';
import { dailyStepsTarget, stepsHistory } from '@/lib/mock/activity';
import { latestSnapshot } from '@/lib/mock/body';
import { addDaysISO, currentWeekDates, daysAgoISO, formatFullDay, mondayIndex } from '@/lib/mock/dates';
import { useCoachInsights } from '@/hooks/use-coach-insights';
import { estimateDailyEnergyExpenditure } from '@/lib/nutrition/targets';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import type { TrainingExerciseEntry } from '@/lib/planning/types';
import { useBodyStore } from '@/store/body-store';
import { useNutritionStore, sumMacros } from '@/store/nutrition-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { historyForExercise, isExerciseCompleted, useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buongiorno';
  if (hour < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

function clamp01(n: number): number {
  return Math.min(Math.max(n, 0), 1);
}

/** Italian thousands-separated magnitude, e.g. 2450 -> "2.450". Hand-rolled
 * rather than `toLocaleString('it-IT')` — Hermes (and some minimal-ICU
 * browser builds) don't reliably apply grouping for that locale, silently
 * returning "2450" instead. Callers that need a sign use formatSignedKcal
 * instead. */
function formatKcal(n: number): string {
  return Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "-2.450" / "+1.200" / "0" — the weekly-goal hero card's convention
 * (intake minus expenditure: negative = deficit, positive = surplus). */
function formatSignedKcal(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return '0';
  return `${rounded < 0 ? '-' : '+'}${formatKcal(rounded)}`;
}

function formatTodayHeading(iso: string): string {
  const d = new Date(iso);
  const weekday = capitalize(d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', ''));
  const month = capitalize(d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''));
  return `${weekday} ${d.getDate()} ${month}`;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** ±100 kcal — how close a day's net balance (intake minus expenditure)
 * has to land to that day's share of the weekly goal to count as "met". */
const DAILY_TOLERANCE_KCAL = 100;

function isDayWithinTolerance(dayBalanceKcal: number, dailyGoalKcal: number, toleranceKcal = DAILY_TOLERANCE_KCAL): boolean {
  return Math.abs(dayBalanceKcal - dailyGoalKcal) <= toleranceKcal;
}

/** A generated split label ("Push", "Legs"...) to a loosely-matching icon
 * for the Allenamento card's small badge — cosmetic only, falls back to
 * the generic dumbbell for anything not in the map (custom AI-suggested
 * titles included). */
const SPLIT_ICON: Record<string, IconName> = {
  Push: 'armFlex',
  Pull: 'armFlex',
  Upper: 'armFlex',
  Legs: 'running',
  Lower: 'running',
};
function splitIconFor(title: string): IconName {
  return SPLIT_ICON[title] ?? 'training';
}

/** Flat, opaque, drop-shadowed card — the Home hero section's own card
 * language (matching the reference mockup: solid white/tinted cards, no
 * blur), deliberately distinct from GlassSurface's translucent Liquid
 * Glass used everywhere else in the app. `tint` overrides the default
 * neutral fill for the category-colored cards (diet/training/result). */
function FlatCard({ tint, radius = Radius.large, style, children }: { tint?: string; radius?: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.flatCard, { backgroundColor: tint ?? theme.backgroundElevated, borderRadius: radius, borderColor: theme.border }, style]}>{children}</View>;
}

export default function HomeScreen() {
  const theme = useTheme();
  const currentUser = useUserStore();
  const today = daysAgoISO(0);

  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const onboardingAnswers = useOnboardingStore((s) => s.answers);
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const loggedSets = useTrainingProgressStore((s) => s.sets);
  const nutritionEntries = useNutritionStore((s) => s.entries);
  const bodyEntries = useBodyStore((s) => s.entries);

  // Same weeklySplit[weekday] lookup training.tsx uses for the selected day
  // — here always pinned to today, so the ring/card below track the exact
  // same tick marks the Training tab shows, not the separate legacy plan
  // the dashboard used to read from.
  const todayPlanDay = useMemo(() => {
    if (!trainingPlan) return undefined;
    const monthIdx = currentMonthIndex(trainingPlan);
    const month = trainingPlan.months.find((m) => m.monthIndex === monthIdx);
    return month?.weeklySplit[mondayIndex(new Date(today))];
  }, [trainingPlan, today]);

  const workoutExercises = todayPlanDay?.type === 'workout' ? (todayPlanDay.exercises ?? []) : [];
  const completedCount = workoutExercises.filter((ex) => isExerciseCompleted(completedExercises, ex.id, today)).length;
  // Rest/cardio days (or no plan at all) have no checkboxes to tick, so the
  // ring simply reads as "done" rather than stuck at some arbitrary partial
  // value.
  const trainingProgress =
    todayPlanDay?.type === 'workout' ? (workoutExercises.length > 0 ? completedCount / workoutExercises.length : 1) : 1;
  const workoutSplitTitle = todayPlanDay?.type === 'workout' ? todayPlanDay.title : undefined;

  // The generated diet plan's OWN calorie target for the active month (it
  // can differ month to month) takes priority over the static profile
  // default, since that's what the plan actually asks for today.
  const dietMonth = dietPlan?.months.find((m) => m.monthIndex === currentMonthIndex(dietPlan));
  const calorieTarget = dietMonth?.calorieTarget ?? currentUser.dailyCalorieTarget;

  // "Settimana X/Y" in the goal card — the plan itself is month-based (each
  // month reuses one weeklySplit template), so a week number isn't a field
  // anywhere; approximated as 4 weeks/month against how many days have
  // elapsed since the plan was generated.
  const activePlan = dietPlan ?? trainingPlan;
  const planTotalWeeks = activePlan ? Math.max(1, activePlan.durationMonths * 4) : 0;
  const daysSincePlanStart = activePlan
    ? Math.max(0, Math.floor((new Date(today).getTime() - new Date(activePlan.generatedAt.slice(0, 10)).getTime()) / 86400000))
    : 0;
  const currentPlanWeek = activePlan ? Math.min(Math.floor(daysSincePlanStart / 7) + 1, planTotalWeeks) : 0;

  const todaysTotals = sumMacros(nutritionEntries.filter((e) => e.date === today));
  const dietProgress = calorieTarget > 0 ? Math.min(todaysTotals.kcal / calorieTarget, 1) : 0;

  const todaysSteps = stepsHistory[stepsHistory.length - 1]?.steps ?? 0;
  const stepsProgress = Math.min(todaysSteps / dailyStepsTarget, 1);

  // Memoized (not a plain expression) so `latestBody.weightKg` below is a
  // stable dependency for other useMemo/useCallback hooks — an unmemoized
  // `latestSnapshot(bodyEntries)` returns a fresh object every render, and
  // the React Compiler can't prove a member access on that is safe to use
  // as a dependency.
  const latestBody = useMemo(() => latestSnapshot(bodyEntries), [bodyEntries]);

  const { insights, isLoading: insightsLoading, refresh: refreshInsights } = useCoachInsights();
  const [insightsModalOpen, setInsightsModalOpen] = useState(false);

  // Which week the goal card is showing — 0 is the current calendar week,
  // negative pages back into history. Clamped by the prev/next handlers
  // below to [1, currentPlanWeek], so this can't run past today or before
  // the plan started.
  const [weekOffset, setWeekOffset] = useState(0);
  const viewedWeekIndex = currentPlanWeek > 0 ? Math.max(1, currentPlanWeek + weekOffset) : 0;
  const viewedWeekReferenceDate = weekOffset === 0 ? undefined : addDaysISO(today, weekOffset * 7);

  // Shared with the Progressi tab's own weekly burn chart — see
  // use-weekly-energy.ts for the day-by-day pipeline this reduces to.
  // Two separate calls on purpose: `currentWeek` always anchors to the
  // real calendar week and feeds today-specific numbers (daily result
  // card) that must stay put while browsing history; `viewedWeek` follows
  // weekOffset and feeds the weekly goal card's own display, the part the
  // user can page back through.
  const currentWeek = useWeeklyEnergy();
  const viewedWeek = useWeeklyEnergy(viewedWeekReferenceDate);
  const { todayEstimatedBalance } = currentWeek;
  const { weekDaysWithActivity, weekEstimatedExpenditureSoFar, weeklyProgrammedKcal } = viewedWeek;

  // weeklyExpenditureFullAdherence below is Home-hero-specific (it assumes
  // full plan adherence, unlike useWeeklyEnergy's actual-completion figures
  // above), so it still needs its own weekDates.
  const weekDates = useMemo(() => currentWeekDates(new Date()), []);

  // Weekly balance goal (Home hero card): full-adherence expenditure
  // estimate (completionFraction=1 on every training day, i.e. "if the
  // plan is followed") minus the weekly intake target. Negative = a
  // deficit goal (loseFat), positive = a surplus goal (gainMuscle/
  // gainStrength), ~0 = maintenance. This is a plain per-render
  // computation (not useMemo) — cheap (7 BMR calls) and deliberately kept
  // out of any memoization boundary given this file's documented React
  // Compiler fragility around fresh-object dependencies (see latestBody).
  const weeklyExpenditureFullAdherence = weekDates.reduce((sum, _date, i) => {
    const monthIdx = trainingPlan ? currentMonthIndex(trainingPlan) : null;
    const month = trainingPlan?.months.find((m) => m.monthIndex === monthIdx);
    const dayPlan = month?.weeklySplit[i];
    const completionFraction = dayPlan?.type === 'workout' ? 1 : 0;
    return (
      sum +
      estimateDailyEnergyExpenditure({
        sex: currentUser.sex,
        age: currentUser.age,
        heightCm: currentUser.heightCm,
        weightKg: latestBody.weightKg,
        jobActivity: onboardingAnswers.jobActivity as string | undefined,
        sessionDurationBucket: onboardingAnswers.sessionDuration as string | undefined,
        completionFraction,
      })
    );
  }, 0);
  const weeklyBalanceGoalKcal = weeklyProgrammedKcal - weeklyExpenditureFullAdherence;
  const dailyGoalPerDayKcal = weeklyBalanceGoalKcal / 7;
  const eatenSoFarThisWeek = weekDaysWithActivity.filter((d) => d.hasHappened).reduce((sum, d) => sum + d.eatenKcal, 0);
  const weeklyBalanceSoFarKcal = eatenSoFarThisWeek - weekEstimatedExpenditureSoFar;
  const weeklyGoalProgress = weeklyBalanceGoalKcal !== 0 ? clamp01(weeklyBalanceSoFarKcal / weeklyBalanceGoalKcal) : 0;
  const daysElapsedThisWeek = weekDaysWithActivity.filter((d) => d.hasHappened).length;
  const onTrackThisWeek = weeklyBalanceGoalKcal === 0 || weeklyGoalProgress >= (daysElapsedThisWeek / 7) * 0.85;

  // Current streak of days (this week, up to and including today) within
  // ±100 kcal of that day's share of the weekly goal — resets on a missed
  // day. A genuine cross-week streak would need its own persisted counter,
  // out of scope here.
  let weeklyStreakCount = 0;
  for (const d of currentWeek.weekDaysWithActivity) {
    if (!d.hasHappened) break;
    if (isDayWithinTolerance(d.eatenKcal - d.estimatedExpenditureKcal, dailyGoalPerDayKcal)) weeklyStreakCount++;
    else weeklyStreakCount = 0;
  }

  const dailyBalanceKcal = -todayEstimatedBalance; // intake - expenditure, same convention as weeklyBalanceGoalKcal
  const dailyGoalMet = isDayWithinTolerance(dailyBalanceKcal, dailyGoalPerDayKcal);
  const dailyGoalProgress = dailyGoalMet ? 1 : dailyGoalPerDayKcal !== 0 ? clamp01(dailyBalanceKcal / dailyGoalPerDayKcal) : 0.5;
  const balanceGoalNoun = weeklyBalanceGoalKcal < 0 ? 'il deficit calorico' : weeklyBalanceGoalKcal > 0 ? 'il surplus calorico' : 'il bilancio calorico';
  const resultHeadline = dailyGoalMet ? 'Obiettivo raggiunto!' : 'Ci sei quasi';
  const resultBody = dailyGoalMet
    ? `Hai mantenuto ${balanceGoalNoun} di oggi. Continua così!`
    : `Ti mancano circa ${formatKcal(Math.max(Math.abs(dailyGoalPerDayKcal) - Math.abs(dailyBalanceKcal), 0))} kcal per raggiungere l'obiettivo di oggi.`;

  // Every exercise appearing anywhere in the plan (same de-duplication
  // training-progress.tsx uses), so "recent" lifts aren't limited to today.
  const exercisesInPlan = useMemo(() => {
    if (!trainingPlan) return [];
    const byId = new Map<string, TrainingExerciseEntry>();
    for (const month of trainingPlan.months) {
      for (const day of month.weeklySplit) {
        if (day.type !== 'workout') continue;
        for (const ex of day.exercises ?? []) {
          if (!byId.has(ex.id)) byId.set(ex.id, ex);
        }
      }
    }
    return [...byId.values()];
  }, [trainingPlan]);

  const recentLifts = useMemo(() => {
    const withHistory = exercisesInPlan
      .map((exercise) => ({ exercise, history: historyForExercise(loggedSets, exercise.id) }))
      .filter((l) => l.history.length >= 2);
    return withHistory
      .sort((a, b) => b.history[b.history.length - 1].date.localeCompare(a.history[a.history.length - 1].date))
      .slice(0, 3);
  }, [exercisesInPlan, loggedSets]);

  const topLift = recentLifts[0];
  const topLiftDeltaPct = topLift && topLift.history[0].weightKg > 0
    ? ((topLift.history[topLift.history.length - 1].weightKg - topLift.history[0].weightKg) / topLift.history[0].weightKg) * 100
    : undefined;

  const weekAgoDate = daysAgoISO(7);
  const weekAgoWeight = [...bodyEntries].filter((e) => e.date <= weekAgoDate).sort((a, b) => b.date.localeCompare(a.date))[0];
  const weightTrendPct = weekAgoWeight && weekAgoWeight.weightKg > 0 ? ((latestBody.weightKg - weekAgoWeight.weightKg) / weekAgoWeight.weightKg) * 100 : undefined;
  const weightSparkline = [...bodyEntries].sort((a, b) => a.date.localeCompare(b.date)).slice(-10).map((e) => e.weightKg);
  const topInsight = insights[0];

  const [selectedDay, setSelectedDay] = useState<WeeklyGoalDay | null>(null);

  return (
    <ScreenScroll>
      <View style={styles.homeHeader}>
        <View style={styles.homeHeaderRow}>
          <Image source={require('@/assets/images/logo-wordmark.png')} style={styles.homeLogo} resizeMode="contain" />
          <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
            <GlassSurface level="card" radius={Radius.pill} style={styles.homeAvatarWrap}>
              <View style={styles.homeAvatarInner}>
                <Icon name="profile" size={20} color={theme.text} />
              </View>
            </GlassSurface>
          </Pressable>
        </View>
        <ThemedText style={styles.homeGreeting}>
          {greeting()} {currentUser.name}!
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.homeSubtitle}>
          Ecco come sta andando la settimana
        </ThemedText>
      </View>

      <WeeklyGoalCard
        goalKcal={weeklyBalanceGoalKcal}
        soFarKcal={weeklyBalanceSoFarKcal}
        progress={weeklyGoalProgress}
        onTrack={onTrackThisWeek}
        dailyGoalKcal={dailyGoalPerDayKcal}
        days={weekDaysWithActivity.map((d, i) => ({
          date: d.date,
          label: WEEKDAY_LABELS[i],
          isToday: d.isToday,
          hasHappened: d.hasHappened,
          balanceKcal: d.eatenKcal - d.estimatedExpenditureKcal,
        }))}
        onSelectDay={setSelectedDay}
        weekIndex={viewedWeekIndex}
        weekTotal={planTotalWeeks}
        onPrevWeek={viewedWeekIndex > 1 ? () => setWeekOffset((o) => o - 1) : undefined}
        onNextWeek={viewedWeekIndex > 0 && viewedWeekIndex < currentPlanWeek ? () => setWeekOffset((o) => o + 1) : undefined}
      />
      <DayDetailModal day={selectedDay} dailyGoalKcal={dailyGoalPerDayKcal} onClose={() => setSelectedDay(null)} />

      <View style={{ gap: Spacing.three }}>
        <Pressable style={styles.todayHeaderRow} onPress={() => router.push('/nutrition')}>
          <ThemedText style={styles.todayHeaderTitle}>Oggi</ThemedText>
          <View style={styles.todayHeaderRight}>
            <ThemedText type="caption" themeColor="textSecondary">
              {formatTodayHeading(today)}
            </ThemedText>
            <Icon name="chevronRight" size={16} color={theme.textTertiary} />
          </View>
        </Pressable>
        <View style={styles.todayStatsRow}>
          <TodayStatCard
            icon="nutrition"
            label="Dieta"
            valueLine={`${formatKcal(todaysTotals.kcal)} / ${formatKcal(calorieTarget)} kcal`}
            progress={dietProgress}
            statusOk={todaysTotals.kcal <= calorieTarget * 1.05}
            statusLabel={todaysTotals.kcal > calorieTarget * 1.05 ? 'Oltre il target' : 'In linea'}
            tint={theme.accentSoft}
            onPress={() => router.push('/nutrition')}
          />
          <TodayStatCard
            icon="training"
            label="Allenamento"
            valueLine={
              workoutExercises.length > 0
                ? `${completedCount}/${workoutExercises.length} completat${workoutExercises.length === 1 ? 'a' : 'e'}`
                : todayPlanDay?.type === 'cardio'
                  ? (todayPlanDay.note ?? 'Sessione cardio')
                  : 'Riposo'
            }
            progress={trainingProgress}
            statusOk={trainingProgress >= 1}
            statusLabel={trainingProgress >= 1 ? 'Fatto' : workoutExercises.length > 0 ? 'Da completare' : 'Riposo'}
            tint={theme.successSoft}
            onPress={() => router.push('/training')}
            subBadge={workoutSplitTitle ? { icon: splitIconFor(workoutSplitTitle), label: workoutSplitTitle } : undefined}
          />
          <TodayStatCard
            icon="footsteps"
            label="Passi"
            valueLine={`${formatKcal(todaysSteps)} / ${formatKcal(dailyStepsTarget)}`}
            progress={stepsProgress}
            statusOk={stepsProgress >= 0.6}
            statusLabel={stepsProgress >= 1 ? 'Obiettivo raggiunto' : stepsProgress >= 0.6 ? 'In linea' : 'Sotto al target'}
            tint={theme.successSoft}
          />
        </View>
      </View>

      <DailyResultCard met={dailyGoalMet} progress={dailyGoalProgress} streakCount={weeklyStreakCount} headline={resultHeadline} body={resultBody} onPress={() => router.push('/body')} />

      <View style={styles.miniCardsRow}>
        <MiniStatCard
          label="Andamento peso"
          value={latestBody.weightKg.toFixed(1)}
          unit="kg"
          icon="scale"
          trend={weightTrendPct}
          trendGoodDirection={currentUser.goal === 'gainMuscle' || currentUser.goal === 'gainStrength' ? 'up' : 'down'}
          sparkline={weightSparkline}
          onPress={() => router.push('/progress')}
        />
        <MiniStatCard
          label={topLift ? topLift.exercise.name : 'Forza'}
          value={topLift ? String(topLift.history[topLift.history.length - 1].weightKg) : '—'}
          unit={topLift ? 'kg' : undefined}
          icon="training"
          trend={topLiftDeltaPct}
          sparkline={topLift ? topLift.history.slice(-10).map((h) => h.weightKg) : undefined}
          onPress={() => router.push('/training-progress')}
        />
        <AICoachMiniCard
          headline={topInsight?.headline ?? 'Nessun consiglio ancora'}
          body={topInsight?.body ?? 'Apri per generare un consiglio personalizzato dal coach AI.'}
          onPress={() => setInsightsModalOpen(true)}
        />
      </View>

      <InsightsModal
        visible={insightsModalOpen}
        insights={insights}
        isLoading={insightsLoading}
        onRefresh={refreshInsights}
        onClose={() => setInsightsModalOpen(false)}
      />
    </ScreenScroll>
  );
}

export type WeeklyGoalDay = {
  date: string;
  label: string;
  isToday: boolean;
  hasHappened: boolean;
  balanceKcal: number;
};

function WeeklyGoalCard({
  goalKcal,
  soFarKcal,
  progress,
  onTrack,
  dailyGoalKcal,
  days,
  onSelectDay,
  weekIndex,
  weekTotal,
  onPrevWeek,
  onNextWeek,
}: {
  goalKcal: number;
  soFarKcal: number;
  progress: number;
  onTrack: boolean;
  dailyGoalKcal: number;
  days: WeeklyGoalDay[];
  onSelectDay: (day: WeeklyGoalDay) => void;
  weekIndex: number;
  weekTotal: number;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
}) {
  const theme = useTheme();
  const isCurrentWeek = onNextWeek == null;
  return (
    <FlatCard style={styles.goalHeroCard}>
      <View style={styles.goalHeroHeader}>
        <View style={[styles.goalHeroIcon, { backgroundColor: theme.accentSoft }]}>
          <Icon name="flame" size={16} color={theme.accent} />
        </View>
        <ThemedText type="caption" themeColor="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
          {isCurrentWeek ? 'Obiettivo di questa settimana' : 'Obiettivo settimanale'}
        </ThemedText>
      </View>

      {weekTotal > 0 ? (
        <View style={styles.goalWeekNavRow}>
          <Pressable onPress={onPrevWeek} disabled={!onPrevWeek} hitSlop={8} style={styles.goalWeekNavBtn}>
            <Icon name="arrowBack" size={14} color={onPrevWeek ? theme.text : theme.textTertiary} />
          </Pressable>
          <ThemedText style={styles.goalWeekNavLabel}>
            Settimana {weekIndex}/{weekTotal}
            {isCurrentWeek ? '' : ' · storico'}
          </ThemedText>
          <Pressable onPress={onNextWeek} disabled={!onNextWeek} hitSlop={8} style={styles.goalWeekNavBtn}>
            <Icon name="chevronRight" size={14} color={onNextWeek ? theme.text : theme.textTertiary} />
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.goalStatusPill, { backgroundColor: onTrack ? theme.successSoft : theme.backgroundElement }]}>
        <Icon name={onTrack ? 'checkCircle' : 'alert'} size={12} color={onTrack ? theme.success : theme.warning} />
        <ThemedText type="caption" style={{ color: onTrack ? theme.success : theme.warning, fontWeight: '700' }}>
          {onTrack ? 'Sei sulla buona strada' : 'Puoi recuperare'}
        </ThemedText>
      </View>

      <ThemedText style={[styles.goalHeroValue, { color: theme.accent }]}>{formatSignedKcal(goalKcal)} kcal</ThemedText>
      <ThemedText style={styles.goalHeroSubValue}>
        {formatSignedKcal(soFarKcal)} / {formatSignedKcal(goalKcal)}
      </ThemedText>

      <View style={[styles.goalProgressTrack, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.goalProgressFill, { width: `${Math.round(clamp01(progress) * 100)}%`, backgroundColor: theme.accent }]} />
      </View>

      <View style={styles.streakRow}>
        {days.map((d) => {
          const met = d.hasHappened && !d.isToday ? isDayWithinTolerance(d.balanceKcal, dailyGoalKcal) : false;
          const ringProgress = d.hasHappened ? (dailyGoalKcal !== 0 ? clamp01(d.balanceKcal / dailyGoalKcal) : met ? 1 : 0) : 0;
          const ringColor = d.isToday ? theme.accent : !d.hasHappened ? theme.backgroundElement : met ? theme.success : theme.danger;
          const clickable = d.hasHappened && !d.isToday;
          return (
            <Pressable key={d.date} style={styles.streakDayCol} disabled={!clickable} onPress={() => onSelectDay(d)} hitSlop={4}>
              <ProgressRing size={32} strokeWidth={4} progress={d.hasHappened ? Math.max(ringProgress, 0.06) : 0} color={ringColor} trackColor={theme.backgroundElement}>
                {clickable ? <Icon name={met ? 'check' : 'close'} size={13} color={met ? theme.success : theme.danger} /> : null}
              </ProgressRing>
              <ThemedText type="caption" themeColor="textSecondary">
                {d.label}
              </ThemedText>
              {d.isToday ? <ThemedText style={[styles.streakTodayLabel, { color: theme.accent }]}>OGGI</ThemedText> : null}
            </Pressable>
          );
        })}
      </View>
    </FlatCard>
  );
}

function DayDetailModal({ day, dailyGoalKcal, onClose }: { day: WeeklyGoalDay | null; dailyGoalKcal: number; onClose: () => void }) {
  const theme = useTheme();
  if (!day) return null;
  const met = isDayWithinTolerance(day.balanceKcal, dailyGoalKcal);
  const deltaKcal = day.balanceKcal - dailyGoalKcal;
  return (
    <Modal visible={day != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <FlatCard style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <ThemedText type="smallBold">{formatFullDay(day.date)}</ThemedText>
              <Pressable onPress={onClose} hitSlop={8}>
                <Icon name="close" size={20} color={theme.textTertiary} />
              </Pressable>
            </View>
            <View style={[styles.modalStatusRow, { backgroundColor: met ? theme.successSoft : theme.accentSoft }]}>
              <Icon name={met ? 'check' : 'close'} size={14} color={met ? theme.success : theme.danger} />
              <ThemedText type="caption" style={{ color: met ? theme.success : theme.danger, fontWeight: '700' }}>
                {met ? 'Obiettivo raggiunto' : 'Fuori target'}
              </ThemedText>
            </View>
            <View style={styles.modalRow}>
              <ThemedText type="caption" themeColor="textSecondary">
                Bilancio del giorno
              </ThemedText>
              <ThemedText type="smallBold">{formatSignedKcal(day.balanceKcal)} kcal</ThemedText>
            </View>
            <View style={styles.modalRow}>
              <ThemedText type="caption" themeColor="textSecondary">
                Obiettivo giornaliero
              </ThemedText>
              <ThemedText type="smallBold">{formatSignedKcal(dailyGoalKcal)} kcal</ThemedText>
            </View>
            <View style={styles.modalRow}>
              <ThemedText type="caption" themeColor="textSecondary">
                Differenza dall&apos;obiettivo
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: met ? theme.success : theme.danger }}>
                {formatSignedKcal(deltaKcal)} kcal
              </ThemedText>
            </View>
          </FlatCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TodayStatCard({
  icon,
  label,
  valueLine,
  progress,
  statusOk,
  statusLabel,
  tint,
  onPress,
  subBadge,
}: {
  icon: IconName;
  label: string;
  valueLine: string;
  progress: number;
  statusOk: boolean;
  statusLabel: string;
  tint: string;
  onPress?: () => void;
  subBadge?: { icon: IconName; label: string };
}) {
  const theme = useTheme();
  const content = (
    <FlatCard tint={tint} radius={Radius.medium} style={styles.todayStatCard}>
      <View style={styles.todayStatTopRow}>
        <View style={[styles.todayStatIcon, { backgroundColor: theme.backgroundElevated }]}>
          <Icon name={icon} size={16} color={theme.accent} />
        </View>
        {onPress ? <Icon name="chevronRight" size={13} color={theme.textTertiary} /> : null}
      </View>
      <ThemedText numberOfLines={1} style={styles.todayStatLabel}>
        {label}
      </ThemedText>
      {subBadge ? (
        <View style={styles.todaySplitBadge}>
          <Icon name={subBadge.icon} size={11} color={theme.accent} />
          <ThemedText numberOfLines={1} style={styles.todaySplitBadgeLabel}>
            {subBadge.label}
          </ThemedText>
        </View>
      ) : null}
      <ThemedText numberOfLines={2} style={styles.todayStatValue}>
        {valueLine}
      </ThemedText>
      <View style={[styles.todayStatTrack, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.todayStatFill, { width: `${Math.round(clamp01(progress) * 100)}%`, backgroundColor: statusOk ? theme.success : theme.accent }]} />
      </View>
      <View style={styles.todayStatStatusRow}>
        <Icon name="checkCircle" size={11} color={statusOk ? theme.success : theme.textTertiary} />
        <ThemedText style={[styles.todayStatStatusLabel, { color: statusOk ? theme.success : theme.textTertiary, flexShrink: 1 }]} numberOfLines={2}>
          {statusLabel}
        </ThemedText>
      </View>
    </FlatCard>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={styles.todayStatPressable}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

function DailyResultCard({
  met,
  progress,
  streakCount,
  headline,
  body,
  onPress,
}: {
  met: boolean;
  progress: number;
  streakCount: number;
  headline: string;
  body: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      <FlatCard tint={met ? theme.successSoft : undefined} style={styles.resultCard}>
        {met ? (
          <View style={styles.resultIconRing}>
            <LinearGradient
              colors={[theme.warning, theme.success, theme.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.resultIconInner}>
              <Icon name="trophy" size={20} color={theme.warning} />
            </View>
          </View>
        ) : (
          <ProgressRing size={56} strokeWidth={6} progress={progress} color={theme.accent} trackColor={theme.backgroundElevated}>
            <Icon name="trophy" size={20} color={theme.textTertiary} />
          </ProgressRing>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="label" themeColor="textSecondary">
            Risultato giornaliero
          </ThemedText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ThemedText style={styles.resultHeadline}>{headline}</ThemedText>
            {met && streakCount > 0 ? (
              <ThemedText type="caption" style={{ color: theme.success, fontWeight: '700' }}>
                +{streakCount} giorno{streakCount === 1 ? '' : 'i'}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText type="caption" themeColor="textSecondary">
            {body}
          </ThemedText>
        </View>
        <Icon name="chevronRight" size={18} color={theme.textTertiary} />
      </FlatCard>
    </Pressable>
  );
}

function AICoachMiniCard({ headline, body, onPress }: { headline: string; body: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.miniCard}>
      <FlatCard style={styles.coachMiniCard}>
        <View style={styles.miniStatHeaderRow}>
          <View style={[styles.coachMiniIcon, { backgroundColor: theme.accentSoft }]}>
            <Icon name="bulb" size={16} color={theme.accent} />
          </View>
          <View style={{ flex: 1 }} />
          <Icon name="chevronRight" size={13} color={theme.textTertiary} />
        </View>
        <ThemedText type="label" themeColor="textSecondary">
          AI Coach
        </ThemedText>
        <ThemedText type="smallBold" numberOfLines={1}>
          {headline}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
          {body}
        </ThemedText>
      </FlatCard>
    </Pressable>
  );
}

/** Popup listing every active coach insight — opened from the AI Coach
 * mini card instead of navigating away, since there's no dedicated
 * insights screen. */
function InsightsModal({
  visible,
  insights,
  isLoading,
  onRefresh,
  onClose,
}: {
  visible: boolean;
  insights: { id: string; tone: 'positive' | 'warning' | 'neutral'; headline: string; body: string }[];
  isLoading: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.insightsModalWrap}>
          <FlatCard style={styles.insightsModalCard}>
            <View style={styles.modalHeaderRow}>
              <ThemedText type="smallBold">Consigli del coach AI</ThemedText>
              <Pressable onPress={onClose} hitSlop={8}>
                <Icon name="close" size={20} color={theme.textTertiary} />
              </Pressable>
            </View>
            <ScrollView style={styles.insightsModalScroll} showsVerticalScrollIndicator={false}>
              <View style={{ gap: Spacing.three }}>
                {insights.length === 0 ? (
                  <ThemedText type="caption" themeColor="textSecondary">
                    Nessun consiglio disponibile al momento.
                  </ThemedText>
                ) : null}
                {insights.map((insight) => (
                  <InsightCard key={insight.id} tone={insight.tone} headline={insight.headline} body={insight.body} />
                ))}
              </View>
            </ScrollView>
            <Pressable onPress={isLoading ? undefined : onRefresh} hitSlop={8}>
              <ThemedText type="caption" style={{ color: theme.accent, textAlign: 'center', fontWeight: '700' }}>
                {isLoading ? 'Aggiornamento…' : 'Aggiorna consigli'}
              </ThemedText>
            </Pressable>
          </FlatCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Flat counterpart to StatTile for the Home hero mini-row — same data
 * shape (value/trend/sparkline), but a solid card and a sparkline colored
 * by whether the trend is good news, matching the reference mockup's green
 * "trending the right way" charts instead of a neutral accent line. */
function MiniStatCard({
  label,
  value,
  unit,
  icon,
  trend,
  trendGoodDirection = 'up',
  sparkline,
  onPress,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: IconName;
  trend?: number;
  trendGoodDirection?: 'up' | 'down';
  sparkline?: number[];
  onPress?: () => void;
}) {
  const theme = useTheme();
  const trendPositive = (trend ?? 0) >= 0;
  const trendIsGood = trend != null && trendPositive === (trendGoodDirection === 'up');
  const trendColor = trend == null ? theme.textTertiary : trendIsGood ? theme.success : theme.danger;
  const sparklineColor = trend == null ? theme.accent : trendColor;

  return (
    <Pressable onPress={onPress} style={styles.miniCard}>
      <FlatCard style={styles.miniStatCard}>
        <View style={styles.miniStatHeaderRow}>
          <ThemedText type="label" themeColor="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
            {label}
          </ThemedText>
          <Icon name={onPress ? 'chevronRight' : icon} size={onPress ? 13 : 14} color={theme.textTertiary} />
        </View>
        <View style={styles.miniStatValueRow}>
          <ThemedText type="title">{value}</ThemedText>
          {unit ? (
            <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 2 }}>
              {unit}
            </ThemedText>
          ) : null}
        </View>
        {trend != null ? (
          <View style={styles.miniStatTrendRow}>
            <Icon name={trendPositive ? 'trendUp' : 'trendDown'} size={12} color={trendColor} />
            <ThemedText type="caption" style={{ color: trendColor }}>
              {trendPositive ? '+' : ''}
              {trend.toFixed(1)}%
            </ThemedText>
          </View>
        ) : null}
        {sparkline && sparkline.length >= 2 ? (
          <View style={styles.miniStatChart}>
            <TrendChart data={sparkline} width={110} height={32} color={sparklineColor} />
          </View>
        ) : null}
      </FlatCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  homeHeader: {
    gap: 4,
  },
  homeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeLogo: {
    width: 132,
    height: 36,
  },
  homeAvatarWrap: {
    width: 40,
    height: 40,
  },
  homeAvatarInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeGreeting: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: Spacing.two,
  },
  homeSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  goalHeroCard: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  goalHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  goalHeroIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalHeroValue: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: Spacing.one,
  },
  goalHeroSubValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  goalWeekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
  },
  goalWeekNavBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalWeekNavLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  goalStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
  },
  goalProgressTrack: {
    height: 8,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    marginTop: Spacing.one,
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
  },
  streakDayCol: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  streakTodayLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: Spacing.four,
  },
  modalCard: {
    width: 300,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insightsModalWrap: {
    width: '100%',
    maxWidth: 380,
  },
  insightsModalCard: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  insightsModalScroll: {
    maxHeight: 420,
  },
  todayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayHeaderTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  todayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  todayStatsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  todayStatPressable: {
    flex: 1,
  },
  todayStatCard: {
    flex: 1,
    minWidth: 0,
    padding: Spacing.two,
    gap: 5,
  },
  todayStatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayStatIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayStatLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  todaySplitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  todaySplitBadgeLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  todayStatValue: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  todayStatTrack: {
    height: 5,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  todayStatFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  todayStatStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayStatStatusLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  resultIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultHeadline: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  miniCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  miniCard: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 0,
  },
  coachMiniCard: {
    padding: Spacing.three,
    gap: Spacing.two,
    minHeight: '100%',
  },
  coachMiniIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatCard: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      web: { boxShadow: '0px 8px 20px rgba(20,20,25,0.08)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
      },
    }),
  },
  miniStatCard: {
    padding: Spacing.three,
    gap: 6,
  },
  miniStatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  miniStatValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  miniStatTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniStatChart: {
    marginTop: 2,
    alignSelf: 'stretch',
  },
});
