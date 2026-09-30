import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { GlassSurface } from '@/components/glass/glass-surface';
import { PlanTheoryModal } from '@/components/plan-theory-modal';
import { FlatCard } from '@/components/ui/flat-card';
import { InfoPopover } from '@/components/ui/info-popover';
import { InsightCard } from '@/components/ui/insight-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ProgressRing } from '@/components/ui/progress-ring';
import { TrendChart } from '@/components/ui/trend-chart';
import { Icon, type IconName } from '@/components/ui/icon';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { SpringSnappy, TimingQuick } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';
import { sumActivityKcalForDate, useWeeklyEnergy } from '@/hooks/use-weekly-energy';
import { latestSnapshot } from '@/lib/mock/body';
import { addDaysISO, currentWeekDates, dayOfMonth, daysAgoISO, formatFullDay, mondayIndex } from '@/lib/mock/dates';
import { useCoachInsights } from '@/hooks/use-coach-insights';
import { estimateDailyEnergyExpenditure, estimateEnergyExpenditureBreakdown } from '@/lib/nutrition/targets';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { dietRoadmapSteps, trainingRoadmapSteps } from '@/lib/planning/roadmap-content';
import type { TrainingExerciseEntry } from '@/lib/planning/types';
import { useActivityLogStore } from '@/store/activity-log-store';
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

/** Italian comma-decimal weight, e.g. 78.7 -> "78,7". */
function formatWeightKg(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

/** Appends an alpha channel to a "#rrggbb" color (RN supports 8-digit hex).
 * Returns the input unchanged for any other format, so a caller can pass a
 * theme token without knowing whether it happens to be hex or rgba(). */
function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(clamp01(alpha) * 255).toString(16).padStart(2, '0')}`;
}

/** "-0,3" / "+5" — signed kg delta with an Italian decimal comma, dropping
 * the decimal for whole-kg deltas (how lift progressions are usually
 * logged) while keeping it for fractional body-weight deltas. */
function formatSignedKg(n: number): string {
  const abs = Math.abs(n);
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const isWhole = Math.abs(abs - Math.round(abs)) < 0.05;
  return `${sign}${isWhole ? Math.round(abs) : formatWeightKg(abs)}`;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Which month a week "belongs to" for the calendar's caption, when the
 * viewed week straddles a month boundary — the Thursday (index 3) is the
 * same ISO-week convention used to decide a week's year/month. */
function monthCaptionFor(weekDates: string[]): string {
  const anchor = new Date(weekDates[3] ?? weekDates[0]);
  return capitalize(anchor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }));
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
  const activityLogEntries = useActivityLogStore((s) => s.entries);

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
  // Distinct from trainingProgress above: that one reads 1 ("done") on a
  // rest/cardio day purely so the ring shows nothing pending — it would
  // fabricate exercise calories on a day with no workout at all if reused
  // here. This is 0 on any non-workout day, matching the same convention
  // useWeeklyEnergy.ts uses for the real per-day expenditure estimate.
  const todayExerciseCompletionFraction =
    todayPlanDay?.type === 'workout' && workoutExercises.length > 0 ? completedCount / workoutExercises.length : 0;
  const workoutSplitTitle = todayPlanDay?.type === 'workout' ? todayPlanDay.title : undefined;
  const isWorkoutDayIncomplete = todayPlanDay?.type === 'workout' && workoutExercises.length > 0 && trainingProgress < 1;

  // The generated diet plan's OWN calorie target for the active month (it
  // can differ month to month) takes priority over the static profile
  // default, since that's what the plan actually asks for today.
  const dietMonth = dietPlan?.months.find((m) => m.monthIndex === currentMonthIndex(dietPlan));
  const calorieTarget = dietMonth?.calorieTarget ?? currentUser.dailyCalorieTarget;
  const macroTargets = dietMonth?.macroTargetsG ?? currentUser.macroTargetsG;

  const todaysTotals = sumMacros(nutritionEntries.filter((e) => e.date === today));
  const dietProgress = calorieTarget > 0 ? Math.min(todaysTotals.kcal / calorieTarget, 1) : 0;

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

  // Memoized (not a plain expression) so `latestBody.weightKg` below is a
  // stable dependency for other useMemo/useCallback hooks — an unmemoized
  // `latestSnapshot(bodyEntries)` returns a fresh object every render, and
  // the React Compiler can't prove a member access on that is safe to use
  // as a dependency.
  const latestBody = useMemo(() => latestSnapshot(bodyEntries), [bodyEntries]);

  // Today's real estimated-expenditure breakdown (not the full-adherence
  // hypothetical weeklyExpenditureFullAdherence below) — feeds the "Calorie
  // bruciate" bar chart on the Oggi card: basale = resting + baseline daily
  // activity (everything that isn't training), allenamento = today's
  // workout contribution plus any manually-logged activity. A plain
  // per-render call, not a useMemo, same reasoning as weeklyExpenditureFullAdherence below.
  const todayEnergyBreakdown = estimateEnergyExpenditureBreakdown({
    sex: currentUser.sex,
    age: currentUser.age,
    heightCm: currentUser.heightCm,
    weightKg: latestBody.weightKg,
    jobActivity: onboardingAnswers.jobActivity as string | undefined,
    sessionDurationBucket: onboardingAnswers.sessionDuration as string | undefined,
    completionFraction: todayExerciseCompletionFraction,
    loggedActivitiesKcal: sumActivityKcalForDate(activityLogEntries, today),
  });
  const basalKcal = todayEnergyBreakdown.resting + todayEnergyBreakdown.baselineActivity;
  const trainingBurnKcal = todayEnergyBreakdown.exercise + todayEnergyBreakdown.loggedActivities;

  const { insights, isLoading: insightsLoading, refresh: refreshInsights } = useCoachInsights();
  const [insightsModalOpen, setInsightsModalOpen] = useState(false);

  // Which week the goal card is showing — 0 is the current calendar week,
  // negative pages back into history, positive previews the rest of the
  // plan (those days just render empty, same as future days within the
  // current week already do). Clamped by the prev/next handlers below to
  // [1, planTotalWeeks].
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

  const weekAgoDate = daysAgoISO(7);
  const weekAgoWeight = [...bodyEntries].filter((e) => e.date <= weekAgoDate).sort((a, b) => b.date.localeCompare(a.date))[0];
  const weightTrendKg = weekAgoWeight ? latestBody.weightKg - weekAgoWeight.weightKg : undefined;
  const weightSparkline = [...bodyEntries].sort((a, b) => a.date.localeCompare(b.date)).slice(-10).map((e) => e.weightKg);

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
  const topLiftDeltaKg = topLift ? topLift.history[topLift.history.length - 1].weightKg - topLift.history[0].weightKg : undefined;

  const topInsight = insights[0];

  const [selectedDay, setSelectedDay] = useState<WeeklyGoalDay | null>(null);

  // Header icon shortcuts (next to the profile avatar): each opens a popup
  // explaining the "why" behind that plan (same phase content shown once
  // during onboarding), with a persistent shortcut into this month's plan.
  const [theoryTopic, setTheoryTopic] = useState<'training' | 'diet' | null>(null);
  const dietSteps = dietRoadmapSteps(onboardingAnswers.goal as string | undefined);
  const trainingSteps = trainingRoadmapSteps(onboardingAnswers.gymSkillLevel as string | undefined);

  return (
    <ScreenScroll>
      <View style={styles.homeHeader}>
        <View style={styles.homeHeaderRow}>
          <Image source={require('@/assets/images/logo-wordmark.png')} style={styles.homeLogo} resizeMode="contain" />
          <View style={styles.homeHeaderIcons}>
            {trainingPlan ? (
              <Pressable onPress={() => setTheoryTopic('training')} hitSlop={8}>
                <GlassSurface level="card" radius={Radius.pill} style={styles.homeAvatarWrap}>
                  <View style={styles.homeAvatarInner}>
                    <Icon name="training" size={19} color={theme.text} />
                  </View>
                </GlassSurface>
              </Pressable>
            ) : null}
            {dietPlan ? (
              <Pressable onPress={() => setTheoryTopic('diet')} hitSlop={8}>
                <GlassSurface level="card" radius={Radius.pill} style={styles.homeAvatarWrap}>
                  <View style={styles.homeAvatarInner}>
                    <Icon name="nutrition" size={19} color={theme.text} />
                  </View>
                </GlassSurface>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
              <GlassSurface level="card" radius={Radius.pill} style={styles.homeAvatarWrap}>
                <View style={styles.homeAvatarInner}>
                  <Icon name="profile" size={20} color={theme.text} />
                </View>
              </GlassSurface>
            </Pressable>
          </View>
        </View>
        <ThemedText style={styles.homeGreeting}>
          {greeting()} {currentUser.name}!
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.homeSubtitle}>
          Continua così, stai facendo un ottimo lavoro.
        </ThemedText>
      </View>

      <PlanTheoryModal
        visible={theoryTopic === 'training'}
        kicker="Allenamento"
        title="Come evolve il tuo allenamento"
        subtitle="Il percorso pensato per te, fase per fase."
        steps={trainingSteps}
        ctaLabel="Vai al piano del mese"
        onPressCta={() => {
          setTheoryTopic(null);
          router.push('/training-plan');
        }}
        onClose={() => setTheoryTopic(null)}
      />

      <PlanTheoryModal
        visible={theoryTopic === 'diet'}
        kicker="Alimentazione"
        title="Come evolve la tua dieta"
        subtitle="Un percorso a fasi, non una dieta fissa."
        steps={dietSteps}
        ctaLabel="Vai al piano del mese"
        onPressCta={() => {
          setTheoryTopic(null);
          router.push('/diet-plan');
        }}
        onClose={() => setTheoryTopic(null)}
      />

      <WeeklyGoalCard
        goalKcal={weeklyBalanceGoalKcal}
        soFarKcal={weeklyBalanceSoFarKcal}
        progress={weeklyGoalProgress}
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
        onNextWeek={viewedWeekIndex > 0 && viewedWeekIndex < planTotalWeeks ? () => setWeekOffset((o) => o + 1) : undefined}
      />
      <DayDetailModal day={selectedDay} dailyGoalKcal={dailyGoalPerDayKcal} onClose={() => setSelectedDay(null)} />

      <DailyResultBox
        met={dailyGoalMet}
        progress={dailyGoalProgress}
        streakCount={weeklyStreakCount}
        headline={resultHeadline}
        body={resultBody}
        onPress={() => router.push('/body')}
      />

      <View style={{ gap: Spacing.three }}>
        <ThemedText style={styles.todayHeaderTitle}>Oggi</ThemedText>
        <TodaySummaryCard
          eatenKcal={todaysTotals.kcal}
          calorieTarget={calorieTarget}
          dietProgress={dietProgress}
          basalKcal={basalKcal}
          trainingBurnKcal={trainingBurnKcal}
          macroTotals={todaysTotals}
          macroTargets={macroTargets}
        />
        <View style={styles.todayCardsRow}>
          <TodayStatusCard
            icon="nutrition"
            title="Dieta"
            percent={Math.round(clamp01(dietProgress) * 100)}
            percentCaption="delle calorie"
            barColor={theme.accent}
            statusLabel={calorieTarget > 0 ? 'Piano in corso' : 'Nessun piano'}
            onOpen={() => router.push('/nutrition')}
          />
          <TodayStatusCard
            icon={workoutSplitTitle ? splitIconFor(workoutSplitTitle) : 'training'}
            title="Allenamento"
            percent={Math.round(clamp01(trainingProgress) * 100)}
            percentCaption="completato"
            barColor={theme.success}
            statusLabel={
              workoutExercises.length === 0
                ? todayPlanDay?.type === 'cardio'
                  ? 'Sessione cardio'
                  : 'Giorno di riposo'
                : trainingProgress >= 1
                  ? 'Sessione completata'
                  : 'Sessione in corso'
            }
            onOpen={() => router.push('/training')}
          />
        </View>
      </View>

      <View style={{ gap: Spacing.three }}>
        <ThemedText style={styles.todayHeaderTitle}>Progressi</ThemedText>
        <View style={styles.miniCardsRow}>
          <MiniStatCard
            icon="scale"
            label="Andamento peso"
            value={formatWeightKg(latestBody.weightKg)}
            unit="kg"
            delta={weightTrendKg}
            deltaLabel={weightTrendKg != null ? `${formatSignedKg(weightTrendKg)} kg` : undefined}
            deltaGoodDirection={currentUser.goal === 'gainMuscle' || currentUser.goal === 'gainStrength' ? 'up' : 'down'}
            caption="rispetto a settimana scorsa"
            sparkline={weightSparkline}
            onPress={() => router.push('/progress')}
          />
          <MiniStatCard
            icon="training"
            label="Andamento carichi"
            subLabel={topLift ? topLift.exercise.name : undefined}
            value={topLift ? String(topLift.history[topLift.history.length - 1].weightKg) : '—'}
            unit={topLift ? 'kg' : undefined}
            delta={topLiftDeltaKg}
            deltaLabel={topLiftDeltaKg != null ? `${formatSignedKg(topLiftDeltaKg)} kg` : undefined}
            caption="ultime 4 settimane"
            sparkline={topLift ? topLift.history.slice(-10).map((h) => h.weightKg) : undefined}
            onPress={() => router.push('/training-progress')}
          />
        </View>
      </View>

      <AICoachDarkCard
        headline={topInsight?.headline ?? 'Nessun consiglio ancora'}
        body={topInsight?.body ?? 'Apri per generare un consiglio personalizzato dal coach AI.'}
        ctaLabel={isWorkoutDayIncomplete ? "Recupera l'allenamento" : 'Vedi il consiglio'}
        onPress={() => (isWorkoutDayIncomplete ? router.push('/training') : setInsightsModalOpen(true))}
        onOpenAll={() => setInsightsModalOpen(true)}
      />

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
  dailyGoalKcal: number;
  days: WeeklyGoalDay[];
  onSelectDay: (day: WeeklyGoalDay) => void;
  weekIndex: number;
  weekTotal: number;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
}) {
  const theme = useTheme();
  const monthCaption = monthCaptionFor(days.map((d) => d.date));
  return (
    <FlatCard style={styles.goalHeroCard}>
      <View style={styles.goalHeroHeader}>
        <View style={styles.goalHeroHeaderLeft}>
          <Icon name="flame" size={20} color={theme.accent} />
          <ThemedText style={styles.goalHeroLabel} numberOfLines={2}>
            Bilancio calorico settimanale
          </ThemedText>
        </View>
        {weekTotal > 0 ? (
          <View style={styles.goalWeekNavRow}>
            <Pressable onPress={onPrevWeek} disabled={!onPrevWeek} hitSlop={6} style={styles.goalWeekNavBtn}>
              <Icon name="arrowBack" size={15} color={onPrevWeek ? theme.text : theme.textTertiary} />
            </Pressable>
            <ThemedText style={styles.goalWeekNavLabel} numberOfLines={1}>
              Settimana {weekIndex}/{weekTotal}
            </ThemedText>
            <Pressable onPress={onNextWeek} disabled={!onNextWeek} hitSlop={6} style={styles.goalWeekNavBtn}>
              <Icon name="chevronRight" size={15} color={onNextWeek ? theme.text : theme.textTertiary} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <ThemedText style={[styles.goalHeroValue, { color: theme.accent }]}>{formatSignedKcal(soFarKcal)} kcal</ThemedText>
      <ThemedText style={styles.goalHeroSubValue}>di {formatKcal(Math.abs(goalKcal))} kcal</ThemedText>

      <View style={styles.goalProgressRow}>
        <View style={[styles.goalProgressTrack, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.goalProgressFill, { width: `${Math.round(clamp01(progress) * 100)}%`, backgroundColor: theme.accent }]} />
        </View>
        <ThemedText style={styles.goalProgressPercent}>{Math.round(clamp01(progress) * 100)}%</ThemedText>
      </View>

      <View style={styles.streakRow}>
        {days.map((d) => {
          const met = d.hasHappened && !d.isToday ? isDayWithinTolerance(d.balanceKcal, dailyGoalKcal) : false;
          const ringProgress = dailyGoalKcal !== 0 ? clamp01(d.balanceKcal / dailyGoalKcal) : 0.5;
          const clickable = d.hasHappened && !d.isToday;
          return (
            <Pressable key={d.date} style={styles.streakDayCol} disabled={!clickable} onPress={() => onSelectDay(d)} hitSlop={4}>
              {d.isToday ? (
                <ProgressRing size={32} strokeWidth={4} progress={Math.max(ringProgress, 0.06)} color={theme.accent} trackColor={theme.backgroundElement} />
              ) : clickable && met ? (
                <View style={[styles.streakSolidCircle, { backgroundColor: theme.success }]}>
                  <Icon name="check" size={15} color={theme.onAccent} />
                </View>
              ) : clickable ? (
                <View style={[styles.streakOutlineCircle, { borderColor: theme.danger, backgroundColor: theme.backgroundElevated }]}>
                  <Icon name="close" size={14} color={theme.danger} />
                </View>
              ) : (
                <View style={[styles.streakOutlineCircle, { borderColor: theme.backgroundElement }]} />
              )}
              <ThemedText style={styles.streakDayNumber}>{dayOfMonth(d.date)}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {d.label}
              </ThemedText>
              <ThemedText style={[styles.streakDayValue, clickable && !met ? { color: theme.danger } : null]} numberOfLines={1}>
                {d.hasHappened ? formatSignedKcal(d.balanceKcal) : '–'}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.goalMonthCaption}>
        {monthCaption}
      </ThemedText>
    </FlatCard>
  );
}

/** A soft colored blob behind the trophy that continuously breathes
 * (scale + fade), so the icon area never reads as static chrome even
 * before the day's goal is actually met. */
function PulsingGlow({ color }: { color: string }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.5 - pulse.value * 0.3,
    transform: [{ scale: 1.15 + pulse.value * 0.3 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.resultGlow, { backgroundColor: color }, style]} />;
}

/** One confetti speck that bobs and twinkles on an infinite loop, each
 * instance offset by its own `delay` so the whole burst feels organic
 * instead of a single flat blink. */
function FloatingDot({
  positionStyle,
  color,
  size = 7,
  delay = 0,
}: {
  positionStyle: { top?: number; left?: number; right?: number; bottom?: number };
  color: string;
  size?: number;
  delay?: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + t.value * 0.55,
    transform: [{ translateY: -t.value * 5 }],
  }));
  return (
    <Animated.View
      style={[
        styles.resultConfettiDot,
        positionStyle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

/** The achievements/motivational box shown right under the weekly goal
 * card — kept as its own component since it has real internal structure
 * (the gradient sweep, glow, confetti, celebratory pop). The "met" state
 * is the full celebration (gradient ring, confetti, a streak chip); an
 * unmet day stays visibly calmer so hitting the goal still reads as
 * earned, but keeps its own glow/gradient so it never looks inert. */
function DailyResultBox({
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
  // Green reads as "on track", orange as "needs a push" — same mapping the
  // day-circle ring/x-mark already uses elsewhere on Home.
  const moodColor = met ? theme.success : theme.accent;
  const celebrate = useSharedValue(met ? 1 : 0);

  useEffect(() => {
    celebrate.value = met ? withDelay(80, withSpring(1, SpringSnappy)) : withTiming(0, TimingQuick);
  }, [met, celebrate]);

  const celebrateStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.8 + celebrate.value * 0.2 }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.resultBox}>
      <LinearGradient
        colors={[withAlpha(moodColor, met ? 0.32 : 0.16), withAlpha(moodColor, met ? 0.16 : 0.08)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {met ? (
        <>
          <FloatingDot positionStyle={{ top: 6, left: 10 }} color={theme.success} delay={0} />
          <FloatingDot positionStyle={{ top: 20, left: 2 }} color={theme.success} size={5} delay={220} />
          <FloatingDot positionStyle={{ top: 10, right: 18 }} color={theme.warning} size={4} delay={340} />
          <FloatingDot positionStyle={{ bottom: 10, right: 46 }} color={theme.success} size={5} delay={420} />
          <FloatingDot positionStyle={{ bottom: 4, right: 60 }} color={theme.warning} delay={640} />
        </>
      ) : null}
      <View style={styles.resultRingWrap}>
        <PulsingGlow color={moodColor} />
        {met ? (
          <Animated.View style={[styles.resultIconRing, celebrateStyle, { backgroundColor: theme.success }]}>
            <View style={styles.resultIconInner}>
              <Icon name="trophy" size={22} color={theme.success} />
            </View>
          </Animated.View>
        ) : (
          <ProgressRing size={56} strokeWidth={6} progress={progress} color={theme.accent} trackColor={theme.backgroundElevated}>
            <Icon name="trophy" size={20} color={theme.accent} />
          </ProgressRing>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="label" themeColor="textSecondary">
          Risultato giornaliero
        </ThemedText>
        <ThemedText style={styles.resultHeadline}>{headline}</ThemedText>
        {met && streakCount > 0 ? (
          <View style={[styles.resultStreakChip, { backgroundColor: theme.success }]}>
            <Icon name="flame" size={11} color={theme.onAccent} />
            <ThemedText type="caption" style={{ color: theme.onAccent, fontWeight: '700' }}>
              +{streakCount} giorno{streakCount === 1 ? '' : 'i'}
            </ThemedText>
          </View>
        ) : null}
        <ThemedText type="caption" themeColor="textSecondary">
          {body}
        </ThemedText>
      </View>
      <Icon name="chevronRight" size={18} color={theme.textTertiary} />
    </Pressable>
  );
}

/** The combined "Oggi" summary card: a calorie-intake ring on the left, a
 * two-bar basale/allenamento burn chart on the right, and the three
 * macros in a row underneath — the single at-a-glance card that replaces
 * the old separate ring/result box, keeping Home to one screen's worth of
 * content instead of stacking every metric as its own card. */
function TodaySummaryCard({
  eatenKcal,
  calorieTarget,
  dietProgress,
  basalKcal,
  trainingBurnKcal,
  macroTotals,
  macroTargets,
}: {
  eatenKcal: number;
  calorieTarget: number;
  dietProgress: number;
  basalKcal: number;
  trainingBurnKcal: number;
  macroTotals: { protein: number; carbs: number; fats: number };
  macroTargets: { protein: number; carbs: number; fats: number };
}) {
  const theme = useTheme();
  const [infoTopic, setInfoTopic] = useState<'intake' | 'basal' | 'training' | null>(null);
  const maxBurnKcal = Math.max(basalKcal, trainingBurnKcal, 1);

  return (
    <FlatCard style={styles.todaySummaryCard}>
      <View style={styles.todaySummaryTopRow}>
        <Pressable onPress={() => setInfoTopic('intake')} style={styles.todaySummaryLeft}>
          <ThemedText style={styles.metricTitle}>Calorie assunte</ThemedText>
          <ProgressRing size={56} strokeWidth={6} progress={dietProgress} color={theme.success} trackColor={theme.accentSoft}>
            <Icon name="nutrition" size={20} color={theme.accent} />
          </ProgressRing>
          <ThemedText style={styles.todaySummaryKcal}>{formatKcal(eatenKcal)}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            kcal / {formatKcal(calorieTarget)}
          </ThemedText>
        </Pressable>

        <View style={styles.todaySummaryRight}>
          <ThemedText style={styles.metricTitle} numberOfLines={1}>
            Calorie bruciate
          </ThemedText>
          <View style={styles.burnChartRow}>
            <BurnBar label="BMR" kcal={basalKcal} maxKcal={maxBurnKcal} color={theme.calorieSurplus} onPress={() => setInfoTopic('basal')} />
            <BurnBar label="Allenamento" kcal={trainingBurnKcal} maxKcal={maxBurnKcal} color={theme.accent} onPress={() => setInfoTopic('training')} />
          </View>
          <ThemedText style={styles.todaySummaryKcal}>{formatKcal(basalKcal + trainingBurnKcal)}</ThemedText>
        </View>
      </View>

      <InfoPopover
        visible={infoTopic === 'intake'}
        icon="nutrition"
        title="Calorie assunte"
        body="Il totale delle calorie che hai registrato oggi tra i pasti, rispetto all'obiettivo calorico giornaliero del tuo piano alimentare. Restare vicino a questo obiettivo è ciò che determina se sei in deficit, surplus o mantenimento rispetto al tuo obiettivo."
        onClose={() => setInfoTopic(null)}
      />
      <InfoPopover
        visible={infoTopic === 'basal'}
        icon="flame"
        title="BMR (metabolismo basale)"
        body="Una stima delle calorie che il tuo corpo brucia a riposo per le funzioni vitali, più l'energia della tua attività quotidiana non sportiva. Si calcola dai tuoi dati fisici e concorre al totale delle calorie bruciate usato per calcolare il tuo bilancio energetico verso l'obiettivo."
        onClose={() => setInfoTopic(null)}
      />
      <InfoPopover
        visible={infoTopic === 'training'}
        icon="training"
        title="Allenamento"
        body="Una stima delle calorie bruciate con l'allenamento di oggi (o le attività registrate manualmente). Più alto è questo valore, maggiore è il contributo al deficit o surplus calorico necessario per raggiungere il tuo obiettivo."
        onClose={() => setInfoTopic(null)}
      />

      <View style={[styles.todaySummaryDivider, { backgroundColor: theme.backgroundElement }]} />

      <View style={styles.todaySummaryMacrosRow}>
        <TodaySummaryMacro icon="protein" label="Proteine" value={Math.round(macroTotals.protein)} target={Math.round(macroTargets.protein)} />
        <View style={[styles.todaySummaryMacroDivider, { backgroundColor: theme.backgroundElement }]} />
        <TodaySummaryMacro icon="carbs" label="Carboidrati" value={Math.round(macroTotals.carbs)} target={Math.round(macroTargets.carbs)} />
        <View style={[styles.todaySummaryMacroDivider, { backgroundColor: theme.backgroundElement }]} />
        <TodaySummaryMacro icon="fats" label="Grassi" value={Math.round(macroTotals.fats)} target={Math.round(macroTargets.fats)} />
      </View>
    </FlatCard>
  );
}

function TodaySummaryMacro({ icon, label, value, target }: { icon: IconName; label: string; value: number; target: number }) {
  const theme = useTheme();
  return (
    <View style={styles.todaySummaryMacroCol}>
      <View style={styles.todaySummaryMacroHeader}>
        <Icon name={icon} size={14} color={theme.accent} />
        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
          {label}
        </ThemedText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <ThemedText style={styles.todaySummaryMacroValue}>{value} g</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          /{target}g
        </ThemedText>
      </View>
    </View>
  );
}

/** One column of the "Calorie bruciate" mini bar chart — bar height is
 * relative to whichever of the two values (basale/allenamento) is larger,
 * with a small minimum sliver so a genuine 0 still reads as an empty bar
 * rather than nothing at all. */
function BurnBar({
  label,
  kcal,
  maxKcal,
  color,
  onPress,
}: {
  label: string;
  kcal: number;
  maxKcal: number;
  color: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const heightPct = maxKcal > 0 ? Math.max(kcal / maxKcal, 0.05) * 100 : 5;
  return (
    <Pressable onPress={onPress} style={styles.burnBarCol}>
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.burnBarLabel}>
        {label}
      </ThemedText>
      <View style={[styles.burnBarTrack, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.burnBarFill, { height: `${heightPct}%`, backgroundColor: color }]} />
      </View>
      <ThemedText type="caption" style={styles.burnBarValue} numberOfLines={1}>
        {formatKcal(kcal)}
      </ThemedText>
    </Pressable>
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

/** The condensed "Dieta"/"Allenamento" pair below the Oggi summary — just
 * enough to glance at (icon+title, a big percent, a bar, a status line)
 * and tap through to the full screen for anything more; the calorie/macro
 * breakdown already lives in TodaySummaryCard above, so it isn't repeated
 * here. */
function TodayStatusCard({
  icon,
  title,
  percent,
  percentCaption,
  barColor,
  statusLabel,
  onOpen,
}: {
  icon: IconName;
  title: string;
  percent: number;
  percentCaption: string;
  barColor: string;
  statusLabel: string;
  onOpen: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onOpen} style={styles.todayCard}>
      <FlatCard radius={Radius.medium} style={styles.todayCardInner}>
        <View style={styles.todayCardTopRow}>
          <View style={[styles.todayCardIcon, { backgroundColor: theme.accentSoft }]}>
            <Icon name={icon} size={17} color={theme.accent} />
          </View>
          <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </ThemedText>
          <Icon name="chevronRight" size={15} color={theme.textTertiary} />
        </View>
        <View style={styles.todayCardPercentRow}>
          <ThemedText style={styles.todayCardPercent}>{percent}%</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {percentCaption}
          </ThemedText>
        </View>
        <View style={[styles.goalProgressTrack, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.goalProgressFill, { width: `${percent}%`, backgroundColor: barColor }]} />
        </View>
        <View style={styles.todayCardStatusRow}>
          <Icon name="checkCircle" size={14} color={theme.success} />
          <ThemedText type="caption" style={{ color: theme.success, fontWeight: '700' }} numberOfLines={1}>
            {statusLabel}
          </ThemedText>
        </View>
      </FlatCard>
    </Pressable>
  );
}

/** The dark "AI Coach" card — deliberately always dark regardless of the
 * app's own light/dark setting (a distinct "AI feature" surface, like the
 * chat FAB's own orb), with a soft glowing accent circle bleeding off the
 * bottom-right corner. */
function AICoachDarkCard({
  headline,
  body,
  ctaLabel,
  onPress,
  onOpenAll,
}: {
  headline: string;
  body: string;
  ctaLabel: string;
  onPress: () => void;
  onOpenAll: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.aiCoachDarkCard}>
      <View pointerEvents="none" style={styles.aiCoachGlow} />
      <Pressable style={styles.aiCoachHeaderRow} onPress={onOpenAll} hitSlop={4}>
        <Icon name="bulb" size={16} color={theme.accent} />
        <ThemedText style={styles.aiCoachTitle}>AI Coach</ThemedText>
        <View style={styles.aiCoachPill}>
          <ThemedText style={styles.aiCoachPillLabel}>Nuovo insight</ThemedText>
        </View>
      </Pressable>
      <ThemedText numberOfLines={1} style={styles.aiCoachHeadline}>
        {headline}
      </ThemedText>
      <ThemedText style={styles.aiCoachBody} numberOfLines={3}>
        {body}
      </ThemedText>
      <PrimaryButton label={ctaLabel} onPress={onPress} style={styles.todayCardButton} />
    </View>
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
 * shape, but a solid card matching the reference mockup: a tinted icon
 * badge + label + chevron header, a sub-label line (e.g. an exercise
 * name), a big value, a colored kg-delta trend row, a real history
 * sparkline, and a trailing caption. The header label and sub-label rows
 * always reserve the same height whether or not they have content, so
 * this card and its sibling in the Progressi row (Andamento peso / Forza)
 * stay the same size with every row aligned, regardless of which fields
 * either one happens to have. */
function MiniStatCard({
  icon,
  label,
  subLabel,
  value,
  unit,
  delta,
  deltaLabel,
  deltaGoodDirection = 'up',
  caption,
  sparkline,
  onPress,
}: {
  icon: IconName;
  label: string;
  subLabel?: string;
  value: string;
  unit?: string;
  /** Signed magnitude, used only to pick the trend arrow/color — the
   * displayed text always comes from `deltaLabel` so callers can format
   * it however that metric's unit requires (kg, %, ...). */
  delta?: number;
  deltaLabel?: string;
  deltaGoodDirection?: 'up' | 'down';
  caption?: string;
  sparkline?: number[];
  onPress?: () => void;
}) {
  const theme = useTheme();
  const deltaPositive = (delta ?? 0) >= 0;
  const deltaIsGood = delta != null && deltaPositive === (deltaGoodDirection === 'up');
  const deltaColor = delta == null ? theme.textTertiary : deltaIsGood ? theme.success : theme.danger;

  return (
    <Pressable onPress={onPress} style={styles.miniCard}>
      <FlatCard style={styles.miniStatCard}>
        <View style={styles.miniStatHeaderRow}>
          <View style={styles.miniStatHeaderLeft}>
            <View style={[styles.miniStatIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name={icon} size={13} color={theme.accent} />
            </View>
            <View style={styles.miniStatLabelBox}>
              <ThemedText themeColor="textSecondary" numberOfLines={2} style={styles.miniStatLabel}>
                {label}
              </ThemedText>
            </View>
          </View>
          {onPress ? <Icon name="chevronRight" size={13} color={theme.textTertiary} /> : null}
        </View>
        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.miniStatSubLabel}>
          {subLabel ?? ' '}
        </ThemedText>
        <View style={styles.miniStatValueRow}>
          <ThemedText type="title">{value}</ThemedText>
          {unit ? <ThemedText type="title">{` ${unit}`}</ThemedText> : null}
        </View>
        {delta != null && deltaLabel ? (
          <View style={styles.miniStatTrendLeft}>
            <Icon name={deltaPositive ? 'trendUp' : 'trendDown'} size={12} color={deltaColor} />
            <ThemedText type="caption" style={{ color: deltaColor }}>
              {deltaLabel}
            </ThemedText>
          </View>
        ) : null}
        {sparkline && sparkline.length >= 2 ? (
          <View style={styles.miniStatChart}>
            <TrendChart data={sparkline} width={110} height={32} color={deltaColor} />
          </View>
        ) : null}
        {caption && delta != null ? (
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2} style={styles.miniStatCaption}>
            {caption}
          </ThemedText>
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
  homeHeaderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  homeLogo: {
    width: 132,
    height: 32,
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
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  goalHeroHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
    minWidth: 0,
  },
  goalHeroLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
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
    gap: 2,
    flexShrink: 0,
  },
  goalWeekNavBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalWeekNavLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  goalProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  goalProgressTrack: {
    flex: 1,
    height: 8,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  goalProgressPercent: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
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
  streakSolidCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakOutlineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDayNumber: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  streakDayValue: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  goalMonthCaption: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    overflow: 'hidden',
  },
  resultConfettiDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  resultIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultRingWrap: {
    width: 56,
    height: 56,
    flexShrink: 0,
  },
  resultGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
  },
  resultStreakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
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
  todayCardsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  todayCard: {
    flex: 1,
    minWidth: 0,
  },
  todayCardInner: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  todayCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  todayCardIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCardPercentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  todayCardPercent: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  todayCardStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayCardButton: {
    marginTop: Spacing.one,
  },
  aiCoachDarkCard: {
    backgroundColor: '#15161A',
    borderRadius: Radius.large,
    padding: Spacing.four,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  aiCoachGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    bottom: -70,
    right: -50,
    backgroundColor: '#FF7A00',
    opacity: 0.3,
  },
  aiCoachHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  aiCoachTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  aiCoachPill: {
    backgroundColor: 'rgba(255,122,0,0.22)',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  aiCoachPillLabel: {
    color: '#FF7A00',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  aiCoachHeadline: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  aiCoachBody: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  todaySummaryCard: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  todaySummaryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  metricTitle: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  todaySummaryLeft: {
    alignItems: 'center',
    gap: 2,
    flex: 1.3,
    minWidth: 0,
  },
  todaySummaryKcal: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  todaySummaryRight: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  burnChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    marginTop: 2,
    width: '100%',
  },
  burnBarCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  burnBarValue: {
    fontWeight: '800',
  },
  burnBarTrack: {
    width: 26,
    height: 44,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  burnBarFill: {
    width: '100%',
    borderRadius: 6,
  },
  burnBarLabel: {
    fontSize: 9,
    textAlign: 'center',
  },
  todaySummaryDivider: {
    height: 1,
  },
  todaySummaryMacrosRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  todaySummaryMacroCol: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
  },
  todaySummaryMacroDivider: {
    width: 1,
    marginVertical: 2,
  },
  todaySummaryMacroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  todaySummaryMacroValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
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
  miniStatCard: {
    padding: Spacing.three,
    gap: 6,
  },
  miniStatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniStatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  miniStatIcon: {
    width: 20,
    height: 20,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStatLabelBox: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  miniStatLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  miniStatSubLabel: {
    height: 15,
  },
  miniStatCaption: {
    height: 30,
  },
  miniStatValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  miniStatTrendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  miniStatChart: {
    marginTop: 2,
    alignSelf: 'stretch',
  },
});
