import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { InsightCard } from '@/components/ui/insight-card';
import { ProgressRing } from '@/components/ui/progress-ring';
import { SectionHeader } from '@/components/ui/section-header';
import { TrendChart } from '@/components/ui/trend-chart';
import { Icon, type IconName } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sumActivityKcalForDate, useWeeklyEnergy } from '@/hooks/use-weekly-energy';
import { dailyStepsTarget, stepsHistory } from '@/lib/mock/activity';
import { latestSnapshot } from '@/lib/mock/body';
import { currentWeekDates, daysAgoISO, formatFullDay, mondayIndex } from '@/lib/mock/dates';
import { useCoachInsights } from '@/hooks/use-coach-insights';
import { estimateDailyEnergyExpenditure, estimateStepsKcal, estimateTrainingContributionKcal } from '@/lib/nutrition/targets';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
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

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
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

function upcomingMealLabel(hour: number): string {
  if (hour < 11) return 'colazione';
  if (hour < 15) return 'pranzo';
  if (hour < 18) return 'spuntino';
  return 'cena';
}

/** ±100 kcal — how close a day's net balance (intake minus expenditure)
 * has to land to that day's share of the weekly goal to count as "met". */
const DAILY_TOLERANCE_KCAL = 100;

function isDayWithinTolerance(dayBalanceKcal: number, dailyGoalKcal: number, toleranceKcal = DAILY_TOLERANCE_KCAL): boolean {
  return Math.abs(dayBalanceKcal - dailyGoalKcal) <= toleranceKcal;
}

/** Flat, opaque, drop-shadowed card — the Home hero section's own card
 * language (matching the reference mockup: solid white/tinted cards, no
 * blur), deliberately distinct from GlassSurface's translucent Liquid
 * Glass used everywhere else in the app (kept as-is further down this same
 * screen, and on every other tab). `tint` overrides the default neutral
 * fill for the category-colored cards (diet/training/result). */
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

  // The generated diet plan's OWN calorie/macro targets for the active
  // month (they can differ month to month) take priority over the static
  // profile defaults, since those are what the plan actually asks for today.
  const dietMonth = dietPlan?.months.find((m) => m.monthIndex === currentMonthIndex(dietPlan));
  const calorieTarget = dietMonth?.calorieTarget ?? currentUser.dailyCalorieTarget;
  const macroTargets = dietMonth?.macroTargetsG ?? currentUser.macroTargetsG;

  const todaysTotals = sumMacros(nutritionEntries.filter((e) => e.date === today));
  const dietProgress = calorieTarget > 0 ? Math.min(todaysTotals.kcal / calorieTarget, 1) : 0;

  const todaysSteps = stepsHistory[stepsHistory.length - 1]?.steps ?? 0;
  const stepsProgress = Math.min(todaysSteps / dailyStepsTarget, 1);

  const planIcon: IconName =
    !todayPlanDay || todayPlanDay.type === 'workout' ? 'training' : todayPlanDay.type === 'cardio' ? 'running' : 'moon';
  const planTitle = !todayPlanDay ? 'Nessun programma' : todayPlanDay.type === 'rest' ? 'Giorno di riposo' : todayPlanDay.title;
  const planSubtitle = !todayPlanDay
    ? 'Genera un programma dalla scheda Training.'
    : todayPlanDay.type === 'workout'
      ? `${workoutExercises.length} esercizi · ${completedCount}/${workoutExercises.length} completati`
      : todayPlanDay.type === 'cardio'
        ? (todayPlanDay.note ?? 'Sessione cardio')
        : 'Recupero attivo';

  // Memoized (not a plain expression) so `latestBody.weightKg` below is a
  // stable dependency for other useMemo/useCallback hooks — an unmemoized
  // `latestSnapshot(bodyEntries)` returns a fresh object every render, and
  // the React Compiler can't prove a member access on that is safe to use
  // as a dependency (see weekDays below).
  const latestBody = useMemo(() => latestSnapshot(bodyEntries), [bodyEntries]);

  // Rest/cardio days (or no plan at all) have no checkboxes to tick, so
  // completion is 0 rather than undefined — matching the same rule weekDays
  // uses below. A partially-completed workout now earns a proportional
  // share of the estimated exercise contribution (§5 bis), not zero.
  const todayCompletionFraction =
    todayPlanDay?.type === 'workout' && workoutExercises.length > 0 ? completedCount / workoutExercises.length : 0;
  // Manually-logged sessions ("Aggiungi allenamento" in Training) count
  // toward the estimate too — an extra/unplanned workout shouldn't be
  // invisible just because it wasn't part of the generated plan.
  const todayLoggedActivitiesKcal = sumActivityKcalForDate(activityLogEntries, today);
  const todayTrainingKcal =
    estimateTrainingContributionKcal({
      sex: currentUser.sex,
      age: currentUser.age,
      heightCm: currentUser.heightCm,
      weightKg: latestBody.weightKg,
      sessionDurationBucket: onboardingAnswers.sessionDuration as string | undefined,
      completionFraction: todayCompletionFraction,
    }) + todayLoggedActivitiesKcal;
  const todayStepsKcal = estimateStepsKcal(todaysSteps, latestBody.weightKg);

  const { insights, isLoading: insightsLoading, refresh: refreshInsights } = useCoachInsights();

  // Shared with the Progressi tab's own weekly burn chart — see
  // use-weekly-energy.ts for the day-by-day pipeline this reduces to.
  const { weekDaysWithActivity, todayEstimatedBalance, weekEstimatedExpenditureSoFar, weeklyProgrammedKcal } = useWeeklyEnergy();

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
  for (const d of weekDaysWithActivity) {
    if (!d.hasHappened) break;
    if (isDayWithinTolerance(d.eatenKcal - d.estimatedExpenditureKcal, dailyGoalPerDayKcal)) weeklyStreakCount++;
    else weeklyStreakCount = 0;
  }
  // Plain tally (not a streak — a miss doesn't reset it) of how many days
  // this week landed within tolerance, for the card's own "X/7 giorni
  // obiettivo raggiunto" celebration banner.
  const daysMetThisWeekCount = weekDaysWithActivity.filter(
    (d) => d.hasHappened && isDayWithinTolerance(d.eatenKcal - d.estimatedExpenditureKcal, dailyGoalPerDayKcal)
  ).length;

  const dailyBalanceKcal = -todayEstimatedBalance; // intake - expenditure, same convention as weeklyBalanceGoalKcal
  const dailyGoalMet = isDayWithinTolerance(dailyBalanceKcal, dailyGoalPerDayKcal);
  const dailyGoalProgress = dailyGoalMet ? 1 : dailyGoalPerDayKcal !== 0 ? clamp01(dailyBalanceKcal / dailyGoalPerDayKcal) : 0.5;
  const balanceGoalNoun = weeklyBalanceGoalKcal < 0 ? 'il deficit calorico' : weeklyBalanceGoalKcal > 0 ? 'il surplus calorico' : 'il bilancio calorico';
  const resultHeadline = dailyGoalMet ? 'Obiettivo raggiunto!' : 'Ci sei quasi';
  const resultBody = dailyGoalMet
    ? `Hai mantenuto ${balanceGoalNoun} di oggi. Continua così!`
    : `Ti mancano circa ${formatKcal(Math.max(Math.abs(dailyGoalPerDayKcal) - Math.abs(dailyBalanceKcal), 0))} kcal per raggiungere l'obiettivo di oggi.`;

  // "Prossima azione": an incomplete workout wins over diet tracking (the
  // more time-sensitive of the two), which in turn wins over a generic
  // fallback once both are effectively done for today.
  const remainingCalorieBudget = calorieTarget - todaysTotals.kcal;
  const isWorkoutDayIncomplete = todayPlanDay?.type === 'workout' && workoutExercises.length > 0 && trainingProgress < 1;
  const upcomingMeal = upcomingMealLabel(new Date().getHours());
  const nextAction: { icon: IconName; title: string; subtitle: string; cta: string; route: '/training' | '/nutrition' | '/body' } = isWorkoutDayIncomplete
    ? {
        icon: 'training',
        title: 'Allenamento',
        subtitle: `${workoutExercises.length - completedCount} esercizi da completare`,
        cta: 'Vai all’allenamento',
        route: '/training',
      }
    : remainingCalorieBudget > 100
      ? {
          icon: 'nutrition',
          title: capitalize(upcomingMeal),
          subtitle: `${formatKcal(remainingCalorieBudget)} kcal rimasti`,
          cta: `Vai a ${upcomingMeal}`,
          route: '/nutrition',
        }
      : {
          icon: 'checkCircle',
          title: 'Giornata completata',
          subtitle: 'Hai raggiunto i tuoi obiettivi di oggi',
          cta: 'Vedi il corpo',
          route: '/body',
        };

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
      <ScreenHeader eyebrow={`${greeting()}`} title={currentUser.name} />

      <WeeklyGoalCard
        goalKcal={weeklyBalanceGoalKcal}
        soFarKcal={weeklyBalanceSoFarKcal}
        progress={weeklyGoalProgress}
        onTrack={onTrackThisWeek}
        dailyGoalKcal={dailyGoalPerDayKcal}
        daysMetCount={daysMetThisWeekCount}
        daysElapsed={daysElapsedThisWeek}
        days={weekDaysWithActivity.map((d, i) => ({
          date: d.date,
          label: WEEKDAY_LABELS[i],
          isToday: d.isToday,
          hasHappened: d.hasHappened,
          balanceKcal: d.eatenKcal - d.estimatedExpenditureKcal,
        }))}
        onSelectDay={setSelectedDay}
      />
      <DayDetailModal day={selectedDay} dailyGoalKcal={dailyGoalPerDayKcal} onClose={() => setSelectedDay(null)} />

      <View style={{ gap: Spacing.three }}>
        <Pressable style={styles.todayHeaderRow} onPress={() => router.push('/nutrition')}>
          <ThemedText type="subtitle">Oggi</ThemedText>
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

      <PrimaryButton label="Continua la giornata →" onPress={() => router.push(nextAction.route)} />

      <DailyResultCard met={dailyGoalMet} progress={dailyGoalProgress} streakCount={weeklyStreakCount} headline={resultHeadline} body={resultBody} onPress={() => router.push('/body')} />

      <NextActionCard icon={nextAction.icon} title={nextAction.title} subtitle={nextAction.subtitle} ctaLabel={nextAction.cta} onPress={() => router.push(nextAction.route)} />

      <View style={styles.miniCardsRow}>
        <MiniStatCard
          label="Andamento peso"
          value={latestBody.weightKg.toFixed(1)}
          unit="kg"
          icon="scale"
          trend={weightTrendPct}
          trendGoodDirection={currentUser.goal === 'gainMuscle' || currentUser.goal === 'gainStrength' ? 'up' : 'down'}
          sparkline={weightSparkline}
        />
        <MiniStatCard
          label={topLift ? topLift.exercise.name : 'Forza'}
          value={topLift ? String(topLift.history[topLift.history.length - 1].weightKg) : '—'}
          unit={topLift ? 'kg' : undefined}
          icon="training"
          trend={topLiftDeltaPct}
          sparkline={topLift ? topLift.history.slice(-10).map((h) => h.weightKg) : undefined}
        />
        <AICoachMiniCard
          headline={topInsight?.headline ?? 'Nessun consiglio ancora'}
          body={topInsight?.body ?? 'Aggiorna per ricevere un consiglio personalizzato dal coach AI.'}
          onPress={() => (topInsight ? router.push('/chat') : refreshInsights())}
        />
      </View>

      <View>
        <SectionHeader title="Riepilogo di oggi" action="Vedi progressi" onActionPress={() => router.push('/progress')} />
        <GlassSurface level="card" radius={Radius.large} style={styles.overviewCard}>
          <View style={styles.ringsStack}>
            <ProgressRing size={128} strokeWidth={12} progress={trainingProgress} color={theme.accent} trackColor={theme.backgroundElement}>
              <ProgressRing size={92} strokeWidth={10} progress={dietProgress} color={theme.success} trackColor={theme.backgroundElement}>
                <ProgressRing size={58} strokeWidth={8} progress={stepsProgress} color={theme.warning} trackColor={theme.backgroundElement} />
              </ProgressRing>
            </ProgressRing>
          </View>
          <View style={styles.legendColumn}>
            <OverviewLegendRow icon="training" color={theme.accent} label="Allenamento" value={`-${Math.round(todayTrainingKcal)} kcal`} />
            <OverviewLegendRow icon="nutrition" color={theme.success} label="Dieta" value={`+${Math.round(todaysTotals.kcal)} kcal`} />
            <OverviewLegendRow icon="footsteps" color={theme.warning} label="Passi" value={`-${Math.round(todayStepsKcal)} kcal`} />
          </View>
        </GlassSurface>
      </View>

      <View>
        <SectionHeader title="Allenamento di oggi" action="Vedi training" onActionPress={() => router.push('/training')} />
        <GlassSurface level="card" radius={Radius.large}>
          <Pressable style={styles.planRow} onPress={() => router.push('/training')}>
            <View style={[styles.sportBadge, { backgroundColor: theme.accentSoft }]}>
              <Icon name={planIcon} size={22} color={theme.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText type="smallBold">{planTitle}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {planSubtitle}
              </ThemedText>
            </View>
            <Icon name="chevronRight" size={18} color={theme.textTertiary} />
          </Pressable>
          {workoutExercises.length > 0 ? (
            <View style={styles.exerciseListRow}>
              <ThemedText type="caption" themeColor="textSecondary">
                {workoutExercises.map((ex) => ex.name).join(' · ')}
              </ThemedText>
            </View>
          ) : null}
        </GlassSurface>
      </View>

      <View>
        <SectionHeader title="Piano alimentare di oggi" action="Dettagli" onActionPress={() => router.push('/nutrition')} />
        <GlassSurface level="card" radius={Radius.large} style={styles.nutritionCard}>
          <View style={styles.calorieRow}>
            <ThemedText type="title">{Math.round(todaysTotals.kcal)}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {' '}
              / {Math.round(calorieTarget)} kcal
            </ThemedText>
          </View>
          <View style={styles.macroRingsRow}>
            <MacroRingStat
              icon="protein"
              label="Proteine"
              color={theme.accent}
              value={`${Math.round(todaysTotals.protein)}g`}
              progress={macroTargets.protein > 0 ? todaysTotals.protein / macroTargets.protein : 0}
            />
            <MacroRingStat
              icon="carbs"
              label="Carboidrati"
              color={theme.success}
              value={`${Math.round(todaysTotals.carbs)}g`}
              progress={macroTargets.carbs > 0 ? todaysTotals.carbs / macroTargets.carbs : 0}
            />
            <MacroRingStat
              icon="fats"
              label="Grassi"
              color={theme.warning}
              value={`${Math.round(todaysTotals.fats)}g`}
              progress={macroTargets.fats > 0 ? todaysTotals.fats / macroTargets.fats : 0}
            />
          </View>
        </GlassSurface>
      </View>

      {recentLifts.length > 0 ? (
        <View>
          <SectionHeader title="Ultimi progressi nei carichi" action="Vedi tutti" onActionPress={() => router.push('/training-progress')} />
          <View style={{ gap: Spacing.three }}>
            {recentLifts.map(({ exercise, history }) => {
              const firstKg = history[0].weightKg;
              const lastKg = history[history.length - 1].weightKg;
              const deltaPct = firstKg > 0 ? ((lastKg - firstKg) / firstKg) * 100 : 0;
              return (
                <GlassSurface key={exercise.id} level="card" radius={Radius.large}>
                  <View style={styles.liftRow}>
                    <View style={[styles.liftIcon, { backgroundColor: theme.accentSoft }]}>
                      <Icon name="training" size={18} color={theme.accent} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText type="smallBold">{exercise.name}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {firstKg}kg → {lastKg}kg
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={{ color: deltaPct >= 0 ? theme.success : theme.danger }}>
                      {deltaPct >= 0 ? '+' : ''}
                      {deltaPct.toFixed(1)}%
                    </ThemedText>
                  </View>
                </GlassSurface>
              );
            })}
          </View>
        </View>
      ) : null}

      <View>
        <SectionHeader
          title="Consigli del coach AI"
          action={insightsLoading ? 'Aggiornamento…' : 'Aggiorna'}
          onActionPress={insightsLoading ? undefined : refreshInsights}
        />
        <View style={{ gap: Spacing.three }}>
          {insights.map((insight) => (
            <InsightCard key={insight.id} tone={insight.tone} headline={insight.headline} body={insight.body} />
          ))}
        </View>
      </View>
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
  daysMetCount,
  daysElapsed,
  days,
  onSelectDay,
}: {
  goalKcal: number;
  soFarKcal: number;
  progress: number;
  onTrack: boolean;
  dailyGoalKcal: number;
  daysMetCount: number;
  daysElapsed: number;
  days: WeeklyGoalDay[];
  onSelectDay: (day: WeeklyGoalDay) => void;
}) {
  const theme = useTheme();
  return (
    <FlatCard style={styles.goalHeroCard}>
      <View style={styles.goalHeroHeader}>
        <View style={[styles.goalHeroIcon, { backgroundColor: theme.accentSoft }]}>
          <Icon name="flame" size={18} color={theme.accent} />
        </View>
        <ThemedText type="caption" themeColor="textSecondary" style={{ flex: 1 }}>
          Obiettivo di questa settimana
        </ThemedText>
        <View style={[styles.goalStatusPill, { backgroundColor: onTrack ? theme.successSoft : theme.backgroundElement }]}>
          <Icon name={onTrack ? 'checkCircle' : 'alert'} size={12} color={onTrack ? theme.success : theme.warning} />
          <ThemedText type="caption" style={{ color: onTrack ? theme.success : theme.warning, fontWeight: '700' }}>
            {onTrack ? 'Sei sulla buona strada' : 'Puoi recuperare'}
          </ThemedText>
        </View>
      </View>

      <ThemedText type="display" style={{ color: theme.accent, fontWeight: '800' }}>
        {formatSignedKcal(soFarKcal)} / {formatSignedKcal(goalKcal)} kcal
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

      <View style={[styles.goalStreakBanner, { backgroundColor: theme.successSoft }]}>
        <View style={[styles.goalStreakIcon, { backgroundColor: theme.backgroundElevated }]}>
          <Icon name="trophy" size={20} color={theme.success} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.goalStreakCount, { color: theme.success }]}>
            {daysMetCount}/{daysElapsed || 7} giorni obiettivo raggiunto
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {daysMetCount >= daysElapsed && daysElapsed > 0 ? 'Settimana perfetta finora — continua così!' : 'Ogni giorno in linea conta, avanti così!'}
          </ThemedText>
        </View>
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
}: {
  icon: IconName;
  label: string;
  valueLine: string;
  progress: number;
  statusOk: boolean;
  statusLabel: string;
  tint: string;
}) {
  const theme = useTheme();
  return (
    <FlatCard tint={tint} radius={Radius.medium} style={styles.todayStatCard}>
      <View style={[styles.todayStatIcon, { backgroundColor: theme.backgroundElevated }]}>
        <Icon name={icon} size={18} color={theme.accent} />
      </View>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={2}>
        {valueLine}
      </ThemedText>
      <View style={[styles.todayStatTrack, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.todayStatFill, { width: `${Math.round(clamp01(progress) * 100)}%`, backgroundColor: statusOk ? theme.success : theme.accent }]} />
      </View>
      <View style={styles.todayStatStatusRow}>
        <Icon name="checkCircle" size={12} color={statusOk ? theme.success : theme.textTertiary} />
        <ThemedText type="caption" style={{ color: statusOk ? theme.success : theme.textTertiary, flexShrink: 1 }} numberOfLines={2}>
          {statusLabel}
        </ThemedText>
      </View>
    </FlatCard>
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
        <ProgressRing size={56} strokeWidth={6} progress={progress} color={met ? theme.success : theme.accent} trackColor={theme.backgroundElevated}>
          <Icon name="trophy" size={20} color={met ? theme.success : theme.textTertiary} />
        </ProgressRing>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="caption" themeColor="textSecondary">
            Risultato giornaliero
          </ThemedText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ThemedText type="smallBold">{headline}</ThemedText>
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

function NextActionCard({
  icon,
  title,
  subtitle,
  ctaLabel,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  ctaLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <FlatCard style={styles.nextActionCard}>
      <View style={[styles.sportBadge, { backgroundColor: theme.accentSoft }]}>
        <Icon name={icon} size={20} color={theme.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="caption" themeColor="textSecondary">
          Prossima azione
        </ThemedText>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
      <PrimaryButton label={ctaLabel} onPress={onPress} />
    </FlatCard>
  );
}

function AICoachMiniCard({ headline, body, onPress }: { headline: string; body: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.miniCard}>
      <FlatCard style={styles.coachMiniCard}>
        <View style={[styles.coachMiniIcon, { backgroundColor: theme.accentSoft }]}>
          <Icon name="bulb" size={16} color={theme.accent} />
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
}: {
  label: string;
  value: string;
  unit?: string;
  icon: IconName;
  trend?: number;
  trendGoodDirection?: 'up' | 'down';
  sparkline?: number[];
}) {
  const theme = useTheme();
  const trendPositive = (trend ?? 0) >= 0;
  const trendIsGood = trend != null && trendPositive === (trendGoodDirection === 'up');
  const trendColor = trend == null ? theme.textTertiary : trendIsGood ? theme.success : theme.danger;
  const sparklineColor = trend == null ? theme.accent : trendColor;

  return (
    <FlatCard style={[styles.miniCard, styles.miniStatCard]}>
      <View style={styles.miniStatHeaderRow}>
        <ThemedText type="label" themeColor="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </ThemedText>
        <Icon name={icon} size={14} color={theme.textTertiary} />
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
  );
}

function OverviewLegendRow({ icon, color, label, value }: { icon: IconName; color: string; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Icon name={icon} size={14} color={theme.textSecondary} />
      <View style={{ flex: 1 }}>
        <ThemedText type="caption" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="smallBold" style={{ color }}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

function MacroRingStat({
  icon,
  label,
  color,
  value,
  progress,
}: {
  icon: IconName;
  label: string;
  color: string;
  value: string;
  progress: number;
}) {
  const theme = useTheme();
  return (
    <View style={styles.macroRingCol}>
      <ProgressRing size={60} strokeWidth={6} progress={progress} color={color} trackColor={theme.backgroundElement}>
        <Icon name={icon} size={16} color={color} />
      </ProgressRing>
      <ThemedText type="caption" style={{ marginTop: Spacing.one, fontWeight: '700' }}>
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  exerciseListRow: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  sportBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
  },
  ringsStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendColumn: {
    flex: 1,
    gap: Spacing.three,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingTop: 2,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nutritionCard: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  macroRingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroRingCol: {
    alignItems: 'center',
    flex: 1,
  },
  liftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  liftIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalHeroCard: {
    gap: Spacing.two,
    padding: Spacing.four,
  },
  goalHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  goalHeroIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalHeroValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  goalStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
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
  goalStreakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  goalStreakIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalStreakCount: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
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
  todayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  todayStatCard: {
    flex: 1,
    minWidth: 0,
    padding: Spacing.three,
    gap: 6,
  },
  todayStatIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
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
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  nextActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
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
