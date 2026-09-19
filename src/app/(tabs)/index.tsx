import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { GoalTrendChart } from '@/components/ui/goal-trend-chart';
import { InsightCard } from '@/components/ui/insight-card';
import { ProgressRing } from '@/components/ui/progress-ring';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { WeeklyBurnChart } from '@/components/ui/weekly-burn-chart';
import { Icon, type IconName } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWeightSeries, weightDateGranularity, type WeightRange } from '@/hooks/use-weight-series';
import { dailyStepsTarget, stepsHistory } from '@/lib/mock/activity';
import { latestSnapshot } from '@/lib/mock/body';
import { currentWeekDates, daysAgoISO, mondayIndex } from '@/lib/mock/dates';
import type { BodyMetricSnapshot } from '@/lib/mock/types';
import { useCoachInsights } from '@/hooks/use-coach-insights';
import { estimateDailyEnergyExpenditure, estimateStepsKcal, estimateTrainingContributionKcal } from '@/lib/nutrition/targets';
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

/** Most recent body_metrics row marked as a baseline (see body-store.ts's
 * resetStartingWeight), or undefined for accounts with none — either
 * pre-dating the baseline column, or that have never (re)done onboarding. */
function mostRecentBaselineDate(entries: BodyMetricSnapshot[]): string | undefined {
  let latest: string | undefined;
  for (const e of entries) {
    if (e.isBaseline && (!latest || e.date > latest)) latest = e.date;
  }
  return latest;
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

  const latestBody = latestSnapshot(bodyEntries);
  const startBody = bodyEntries[0] ?? latestBody;
  const doneSoFar = startBody.weightKg - latestBody.weightKg;

  // Rest/cardio days (or no plan at all) have no checkboxes to tick, so
  // completion is 0 rather than undefined — matching the same rule weekDays
  // uses below. A partially-completed workout now earns a proportional
  // share of the estimated exercise contribution (§5 bis), not zero.
  const todayCompletionFraction =
    todayPlanDay?.type === 'workout' && workoutExercises.length > 0 ? completedCount / workoutExercises.length : 0;
  const todayTrainingKcal = estimateTrainingContributionKcal({
    sex: currentUser.sex,
    age: currentUser.age,
    heightCm: currentUser.heightCm,
    weightKg: latestBody.weightKg,
    sessionDurationBucket: onboardingAnswers.sessionDuration as string | undefined,
    completionFraction: todayCompletionFraction,
  });
  const todayStepsKcal = estimateStepsKcal(todaysSteps, latestBody.weightKg);

  const [weightRange, setWeightRange] = useState<WeightRange>('settimana');
  const weightSeries = useWeightSeries(bodyEntries, weightRange);
  const { insights, isLoading: insightsLoading, refresh: refreshInsights } = useCoachInsights();

  // One entry per weekday of the CURRENT calendar week — past days read
  // from what was actually logged, today is live, and days still ahead
  // simply have nothing yet (0% rings, no burn plotted) rather than a
  // fabricated forecast. Critically, "past" here means before THIS
  // account existed too: resetStartingWeight (onboarding) creates the
  // account's first body_metrics entry on signup day, so any calendar day
  // before that literally predates the account — a BMR-based burn
  // estimate for those days would otherwise render as if a full week of
  // real activity already happened for a brand-new signup.
  const weekDates = useMemo(() => currentWeekDates(new Date()), []);
  // Prefer the most recent baseline row (resetStartingWeight now inserts
  // rather than wipes history, see body-store.ts) — falls back to the very
  // first entry for accounts created before that column existed.
  const accountStartDate = mostRecentBaselineDate(bodyEntries) ?? bodyEntries[0]?.date ?? today;
  const weekDays = useMemo(() => {
    const monthIdx = trainingPlan ? currentMonthIndex(trainingPlan) : null;
    const month = trainingPlan?.months.find((m) => m.monthIndex === monthIdx);
    const split = month?.weeklySplit ?? [];

    return weekDates.map((date, i) => {
      if (date < accountStartDate) {
        return {
          date,
          label: WEEKDAY_LABELS[i][0],
          isToday: false,
          hasHappened: false,
          trainingProgress: 0,
          dietProgress: 0,
          stepsProgress: 0,
          estimatedExpenditureKcal: 0,
          eatenKcal: 0,
        };
      }

      const dayPlan = split[i];
      const exercises = dayPlan?.type === 'workout' ? (dayPlan.exercises ?? []) : [];
      const completed = exercises.filter((ex) => isExerciseCompleted(completedExercises, ex.id, date)).length;
      const dayTrainingProgress = dayPlan?.type === 'workout' ? (exercises.length > 0 ? completed / exercises.length : 1) : 1;
      const completionFraction = dayPlan?.type === 'workout' && exercises.length > 0 ? completed / exercises.length : 0;

      const dayTotals = sumMacros(nutritionEntries.filter((e) => e.date === date));
      const dayDietProgress = calorieTarget > 0 ? Math.min(dayTotals.kcal / calorieTarget, 1) : 0;

      const stepsEntry = stepsHistory.find((s) => s.date === date);
      const dayStepsProgress = stepsEntry ? Math.min(stepsEntry.steps / dailyStepsTarget, 1) : 0;

      const estimatedExpenditureKcal = estimateDailyEnergyExpenditure({
        sex: currentUser.sex,
        age: currentUser.age,
        heightCm: currentUser.heightCm,
        weightKg: latestBody.weightKg,
        jobActivity: onboardingAnswers.jobActivity as string | undefined,
        sessionDurationBucket: onboardingAnswers.sessionDuration as string | undefined,
        completionFraction,
      });

      return {
        date,
        label: WEEKDAY_LABELS[i][0],
        isToday: date === today,
        hasHappened: date <= today,
        trainingProgress: dayTrainingProgress,
        dietProgress: dayDietProgress,
        stepsProgress: dayStepsProgress,
        estimatedExpenditureKcal,
        eatenKcal: dayTotals.kcal,
      };
    });
  }, [trainingPlan, weekDates, accountStartDate, completedExercises, nutritionEntries, calorieTarget, currentUser, latestBody.weightKg, onboardingAnswers, today]);

  const todayExpenditure = weekDays.find((d) => d.isToday);
  const weekEstimatedExpenditureSoFar = weekDays.filter((d) => d.hasHappened).reduce((sum, d) => sum + d.estimatedExpenditureKcal, 0);
  const weeklyProgrammedKcal = calorieTarget * weekDays.length;
  const todayEstimatedBalance = todayExpenditure ? todayExpenditure.estimatedExpenditureKcal - todayExpenditure.eatenKcal : 0;

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

  return (
    <ScreenScroll>
      <ScreenHeader eyebrow={`${greeting()}`} title={currentUser.name} />

      <View>
        <SectionHeader title="Obiettivo" action="Vedi corpo" onActionPress={() => router.push('/body')} />
        <GlassSurface level="card" radius={Radius.large} style={styles.goalCard}>
          <SegmentedControl
            options={[
              { value: 'settimana', label: 'Settimana' },
              { value: 'mese', label: 'Mese' },
              { value: 'anno', label: 'Anno' },
            ]}
            value={weightRange}
            onChange={(v) => setWeightRange(v as typeof weightRange)}
          />

          <View style={styles.goalEmphasisRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="caption" themeColor="textSecondary">
                Peso attuale
              </ThemedText>
              <ThemedText type="subtitle">{latestBody.weightKg.toFixed(1)} kg</ThemedText>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <ThemedText type="caption" themeColor="textSecondary">
                Progressi finora
              </ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name={doneSoFar > 0 ? 'trendDown' : 'trendUp'} size={14} color={doneSoFar > 0 ? theme.success : theme.danger} />
                <ThemedText type="subtitle" style={{ color: doneSoFar > 0 ? theme.success : theme.danger }}>
                  {doneSoFar > 0 ? '-' : '+'}
                  {Math.abs(doneSoFar).toFixed(1)} kg
                </ThemedText>
              </View>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <ThemedText type="caption" themeColor="textSecondary">
                Peso target
              </ThemedText>
              <ThemedText type="subtitle" style={{ color: theme.success }}>
                {currentUser.targetWeightKg} kg
              </ThemedText>
            </View>
          </View>

          <GoalTrendChart
            points={weightSeries}
            target={currentUser.targetWeightKg}
            dateGranularity={weightDateGranularity(weightRange)}
            height={240}
            color={theme.accent}
            targetColor={theme.success}
            axisColor={theme.textTertiary}
            gridColor={theme.backgroundElement}
          />
        </GlassSurface>
      </View>

      <View>
        <SectionHeader title="Riepilogo di oggi" />
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

        <GlassSurface level="card" radius={Radius.large} style={styles.burnCard}>
          <View style={{ gap: Spacing.two }}>
            <ThemedText type="smallBold">Dispendio stimato e calorie assunte</ThemedText>
            <View style={styles.burnEmphasisRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="caption" themeColor="textSecondary">
                  Oggi
                </ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name={todayEstimatedBalance >= 0 ? 'trendDown' : 'trendUp'} size={14} color={todayEstimatedBalance >= 0 ? theme.success : theme.danger} />
                  <ThemedText type="subtitle" style={{ color: todayEstimatedBalance >= 0 ? theme.success : theme.danger }}>
                    {todayEstimatedBalance >= 0 ? '-' : '+'}
                    {Math.abs(Math.round(todayEstimatedBalance))} kcal
                  </ThemedText>
                </View>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <ThemedText type="caption" themeColor="textSecondary">
                  Settimana
                </ThemedText>
                <ThemedText type="smallBold">Dispendio stimato {Math.round(weekEstimatedExpenditureSoFar)} kcal</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  Target settimanale {Math.round(weeklyProgrammedKcal)} kcal
                </ThemedText>
              </View>
            </View>
          </View>
          <WeeklyBurnChart
            days={weekDays.map((d) => ({
              label: d.label,
              date: d.date,
              estimatedExpenditureKcal: d.estimatedExpenditureKcal,
              eatenKcal: d.eatenKcal,
              isToday: d.isToday,
              hasHappened: d.hasHappened,
              rings: { training: d.trainingProgress, diet: d.dietProgress, steps: d.stepsProgress },
            }))}
            expenditureColor={theme.accent}
            eatenColor={theme.success}
            deficitColor={theme.calorieDeficit}
            surplusColor={theme.calorieSurplus}
            trackColor={theme.backgroundElement}
            axisColor={theme.textTertiary}
            todayBadgeColor={theme.accent}
            todayBadgeTextColor={theme.onAccent}
            trainingColor={theme.accent}
            dietColor={theme.success}
            stepsColor={theme.warning}
          />
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
  goalCard: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
  goalEmphasisRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
  },
  burnCard: {
    marginTop: Spacing.three,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  burnEmphasisRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
});
