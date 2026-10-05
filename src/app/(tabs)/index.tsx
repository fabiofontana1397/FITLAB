import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { OggiGauge } from '@/components/home/oggi-gauge';
import { HomeCoachCard } from '@/components/home/home-coach-card';
import { FoodSearchModal } from '@/components/nutrition/food-search-modal';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { InfoPopover } from '@/components/ui/info-popover';
import { TickProgressBar } from '@/components/ui/tick-progress-bar';
import { LogActivityModal } from '@/components/training/log-activity-modal';
import { sumActivityKcalForDate, useWeeklyEnergy } from '@/hooks/use-weekly-energy';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { latestSnapshot } from '@/lib/mock/body';
import { currentWeekDates, dayOfMonth, daysAgoISO, mondayIndex } from '@/lib/mock/dates';
import { estimateDailyEnergyExpenditure, estimateEnergyExpenditureBreakdown } from '@/lib/nutrition/targets';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useBodyStore } from '@/store/body-store';
import { useNutritionStore, sumMacros, type MealSlot } from '@/store/nutrition-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { isExerciseCompleted, useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

const SCREEN_PADDING = 20;
const CARD_RADIUS = 20;

function clamp01(n: number): number {
  return Math.min(Math.max(n, 0), 1);
}

/** Italian thousands-separated magnitude, e.g. 2450 -> "2.450". Hand-rolled
 * rather than `toLocaleString('it-IT')` — Hermes (and some minimal-ICU
 * browser builds) don't reliably apply grouping for that locale, silently
 * returning "2450" instead. */
function formatKcal(n: number): string {
  return Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "-2.450" / "+1.200" / "0" (intake minus expenditure: negative = deficit). */
function formatSignedKcal(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return '0';
  return `${rounded < 0 ? '-' : '+'}${formatKcal(rounded)}`;
}

function weeklyMessage(progress: number): string {
  if (progress >= 1) return 'Obiettivo settimanale raggiunto!';
  if (progress >= 0.6) return 'Ci sei quasi, continua così!';
  if (progress >= 0.25) return 'Stai andando bene, continua così!';
  return 'Ogni giorno conta, continua così!';
}

/** The meal slot a "Registra pasto" tap should default to, from the time of day. */
function defaultSlotForNow(): MealSlot {
  const hour = new Date().getHours();
  if (hour < 10) return 'colazione';
  if (hour < 12) return 'spuntinoMattina';
  if (hour < 15) return 'pranzo';
  if (hour < 18) return 'spuntinoPomeriggio';
  if (hour < 21) return 'cena';
  return 'spuntinoSera';
}

/** Soft colored glow under a filled button, like the Figma's. */
function glow(color: string, alpha: number) {
  return Platform.select({
    web: { boxShadow: '0px 6px 14px ' + color + Math.round(alpha * 255).toString(16).padStart(2, '0') },
    default: { shadowColor: color, shadowOpacity: alpha, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  });
}

type InfoTopic = 'burned' | 'balance' | 'eaten';

export default function HomeScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const currentUser = useUserStore();
  const today = daysAgoISO(0);

  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const onboardingAnswers = useOnboardingStore((s) => s.answers);
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const nutritionEntries = useNutritionStore((s) => s.entries);
  const bodyEntries = useBodyStore((s) => s.entries);
  const activityLogEntries = useActivityLogStore((s) => s.entries);
  const addActivityEntry = useActivityLogStore((s) => s.addEntry);

  const [infoTopic, setInfoTopic] = useState<InfoTopic | null>(null);
  const [registerMealOpen, setRegisterMealOpen] = useState(false);
  const [registerWorkoutOpen, setRegisterWorkoutOpen] = useState(false);

  const latestBody = latestSnapshot(bodyEntries);

  // The active month's weekly split: the same weekday-indexed lookup the
  // Training tab uses, so Home and Training agree on what's planned.
  const trainingMonth = trainingPlan?.months.find((m) => m.monthIndex === currentMonthIndex(trainingPlan));
  const weeklySplit = trainingMonth?.weeklySplit ?? [];
  const todayPlanDay = weeklySplit[mondayIndex(new Date(today))];
  const workoutExercises = todayPlanDay?.type === 'workout' ? (todayPlanDay.exercises ?? []) : [];
  const completedCount = workoutExercises.filter((ex) => isExerciseCompleted(completedExercises, ex.id, today)).length;
  const isWorkoutDayIncomplete = workoutExercises.length > 0 && completedCount < workoutExercises.length;
  // 0 on any non-workout day — only a real workout earns exercise calories.
  const todayExerciseCompletionFraction = workoutExercises.length > 0 ? completedCount / workoutExercises.length : 0;

  // The generated diet plan's own calorie target for the active month
  // (it can differ month to month) takes priority over the static profile.
  const dietMonth = dietPlan?.months.find((m) => m.monthIndex === currentMonthIndex(dietPlan));
  const calorieTarget = dietMonth?.calorieTarget ?? currentUser.dailyCalorieTarget;
  const todaysTotals = sumMacros(nutritionEntries.filter((e) => e.date === today));

  // Today's real estimated-expenditure breakdown: BMR + baseline daily
  // activity (everything that isn't training), plus today's workout and any
  // manually logged activity.
  const energy = estimateEnergyExpenditureBreakdown({
    sex: currentUser.sex,
    age: currentUser.age,
    heightCm: currentUser.heightCm,
    weightKg: latestBody.weightKg,
    jobActivity: onboardingAnswers.jobActivity as string | undefined,
    sessionDurationBucket: onboardingAnswers.sessionDuration as string | undefined,
    completionFraction: todayExerciseCompletionFraction,
    loggedActivitiesKcal: sumActivityKcalForDate(activityLogEntries, today),
  });
  const basalKcal = energy.resting + energy.baselineActivity;
  const trainingBurnKcal = energy.exercise + energy.loggedActivities;
  const burnedKcal = energy.total;
  const eatenKcal = todaysTotals.kcal;
  const balanceKcal = eatenKcal - burnedKcal;

  // Current calendar week (Mon–Sun) from the shared pipeline, so Home,
  // Progressi and Nutrizione can never disagree on the numbers.
  const { weekDaysWithActivity, weekEstimatedExpenditureSoFar, weeklyProgrammedKcal } = useWeeklyEnergy();
  const weekDates = currentWeekDates(new Date());

  // Weekly balance goal: the full-adherence expenditure estimate ("if the
  // plan is followed") minus the weekly intake target. Negative = a deficit
  // goal, positive = a surplus goal.
  const weeklyExpenditureFullAdherence = weekDates.reduce((sum, _date, i) => {
    const dayPlan = weeklySplit[i];
    return (
      sum +
      estimateDailyEnergyExpenditure({
        sex: currentUser.sex,
        age: currentUser.age,
        heightCm: currentUser.heightCm,
        weightKg: latestBody.weightKg,
        jobActivity: onboardingAnswers.jobActivity as string | undefined,
        sessionDurationBucket: onboardingAnswers.sessionDuration as string | undefined,
        completionFraction: dayPlan?.type === 'workout' ? 1 : 0,
      })
    );
  }, 0);
  const weeklyGoalKcal = weeklyProgrammedKcal - weeklyExpenditureFullAdherence;
  const eatenSoFarThisWeek = weekDaysWithActivity.filter((d) => d.hasHappened).reduce((sum, d) => sum + d.eatenKcal, 0);
  const weeklySoFarKcal = eatenSoFarThisWeek - weekEstimatedExpenditureSoFar;
  const weeklyProgress = weeklyGoalKcal !== 0 ? clamp01(weeklySoFarKcal / weeklyGoalKcal) : 0;

  const dayBalances = weekDaysWithActivity.map((d) => {
    const tracked = d.hasHappened && (d.eatenKcal > 0 || d.estimatedExpenditureKcal > 0);
    return { date: d.date, isToday: d.isToday, balance: tracked ? d.eatenKcal - d.estimatedExpenditureKcal : null };
  });
  const maxAbsBalance = Math.max(1, ...dayBalances.map((d) => (d.balance == null ? 0 : Math.abs(d.balance))));
  const monthLabel = (() => {
    const label = new Date(weekDates[3]).toLocaleDateString('it-IT', { month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

  // Workouts: planned slots this week vs. the ones actually finished (a
  // workout day counts when every exercise is ticked, a cardio day when
  // any activity was logged that day).
  let workoutsPlanned = 0;
  let workoutsDone = 0;
  weekDates.forEach((date, i) => {
    const day = weeklySplit[i];
    if (!day || day.type === 'rest') return;
    workoutsPlanned++;
    if (date > today) return;
    if (day.type === 'workout') {
      const exercises = day.exercises ?? [];
      if (exercises.length > 0 && exercises.every((ex) => isExerciseCompleted(completedExercises, ex.id, date))) workoutsDone++;
    } else if (activityLogEntries.some((e) => e.date === date)) {
      workoutsDone++;
    }
  });
  const trackedMealDays = weekDates.filter((date) => nutritionEntries.some((e) => e.date === date)).length;
  const trackedBalances = dayBalances.filter((d) => d.balance != null).map((d) => d.balance as number);
  const averageBalance = trackedBalances.length > 0 ? trackedBalances.reduce((a, b) => a + b, 0) / trackedBalances.length : 0;

  const infoContent: Record<InfoTopic, { icon: IconName; title: string; body: string }> = {
    burned: {
      icon: 'flame',
      title: 'Calorie bruciate',
      body: `Una stima delle calorie che il tuo corpo ha bruciato oggi: metabolismo basale (BMR) più attività quotidiana (${formatKcal(basalKcal)} kcal), a cui si aggiungono l'allenamento svolto e le attività registrate (${formatKcal(trainingBurnKcal)} kcal). Insieme alle calorie assunte determina il tuo bilancio energetico verso l'obiettivo.`,
    },
    balance: {
      icon: 'target',
      title: balanceKcal >= 0 ? 'Surplus di oggi' : 'Deficit di oggi',
      body: "La differenza tra le calorie assunte e quelle bruciate oggi: positiva è un surplus, negativa un deficit. Il giusto equilibrio dipende dal tuo obiettivo — surplus per mettere massa, deficit per perdere grasso. L'anello mostra quanto pesa ciascun lato sul totale.",
    },
    eaten: {
      icon: 'utensils',
      title: 'Calorie assunte',
      body: `Il totale delle calorie registrate oggi tra i pasti, rispetto all'obiettivo di ${formatKcal(calorieTarget)} kcal del tuo piano alimentare. Restare vicino a questo obiettivo è ciò che determina se sei in deficit, surplus o mantenimento.`,
    },
  };

  return (
    <ScreenScroll contentContainerStyle={styles.page}>
      <View style={styles.headerRow}>
        <Image source={require('@/assets/images/logo-wordmark.png')} style={styles.logo} resizeMode="contain" />
        <Pressable onPress={() => router.push('/profile')} hitSlop={8} style={[styles.avatar, { backgroundColor: theme.text }]}>
          <Icon name="personFilled" size={22} color={theme.background} />
        </Pressable>
      </View>

      <ThemedText style={styles.greeting}>Ciao {currentUser.name} 👋</ThemedText>
      <ThemedText style={styles.subtitle} themeColor="textTertiary">
        Oggi è un ottimo giorno per il tuo obiettivo.
      </ThemedText>

      <ThemedText style={[styles.sectionTitle, { marginTop: 26 }]}>Oggi</ThemedText>
      <FlatCard radius={CARD_RADIUS} style={styles.oggiCard}>
        <View style={styles.oggiRow}>
          <Pressable onPress={() => setInfoTopic('burned')} style={styles.sideCol}>
            <Icon name="flame" size={20} color={theme.accent} />
            <ThemedText style={styles.sideValue}>{formatKcal(burnedKcal)}</ThemedText>
            <ThemedText style={styles.sideLabel} themeColor="textTertiary">
              kcal bruciate
            </ThemedText>
          </Pressable>

          <Pressable onPress={() => setInfoTopic('balance')}>
            <OggiGauge
              burnedKcal={burnedKcal}
              eatenKcal={eatenKcal}
              burnedColor={theme.accent}
              eatenColor={theme.brandGreen}
              value={formatSignedKcal(balanceKcal)}
              caption={balanceKcal >= 0 ? 'surplus' : 'deficit'}
            />
          </Pressable>

          <Pressable onPress={() => setInfoTopic('eaten')} style={styles.sideCol}>
            <Icon name="utensils" size={20} color={theme.brandGreen} />
            <ThemedText style={styles.sideValue}>{formatKcal(eatenKcal)}</ThemedText>
            <ThemedText style={styles.sideLabel} themeColor="textTertiary">
              kcal assunte
            </ThemedText>
          </Pressable>
        </View>
        {scheme === 'light' ? (
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(60,60,70,0)', 'rgba(60,60,70,0.10)']}
            style={styles.oggiFade}
          />
        ) : null}
      </FlatCard>

      <Pressable onPress={() => setRegisterMealOpen(true)} style={[styles.actionButton, styles.actionFirst, { backgroundColor: theme.accent }, glow('#FF6A13', 0.28)]}>
        <Icon name="utensils" size={22} color="#FFFFFF" />
        <ThemedText style={styles.actionLabel}>Registra pasto</ThemedText>
        <Icon name="chevronRight" size={16} color="#FFFFFF" />
      </Pressable>
      <Pressable onPress={() => setRegisterWorkoutOpen(true)} style={[styles.actionButton, { backgroundColor: theme.brandGreen }, glow('#22B35E', 0.2)]}>
        <Icon name="barbell" size={24} color="#FFFFFF" />
        <ThemedText style={styles.actionLabel}>Registra allenamento</ThemedText>
        <Icon name="chevronRight" size={16} color="#FFFFFF" />
      </Pressable>

      <ThemedText style={[styles.sectionTitle, { marginTop: 26 }]}>Questa settimana</ThemedText>
      <FlatCard radius={CARD_RADIUS} style={styles.weekCard}>
        <View style={styles.weekTitleRow}>
          <Icon name="flame" size={17} color={theme.accent} />
          <ThemedText style={styles.weekTitle}>{weeklyGoalKcal >= 0 ? 'Surplus' : 'Deficit'} di questa settimana</ThemedText>
        </View>
        <View style={styles.weekValueRow}>
          <ThemedText style={styles.weekValue}>{formatSignedKcal(weeklySoFarKcal)}</ThemedText>
          <ThemedText style={styles.weekGoal} themeColor="textTertiary">
            /{formatSignedKcal(weeklyGoalKcal)} kcal
          </ThemedText>
        </View>
        <ThemedText style={[styles.weekMessage, { color: theme.brandGreen }]}>{weeklyMessage(weeklyProgress)}</ThemedText>
        <View style={styles.weekBar}>
          <TickProgressBar progress={weeklyProgress} />
        </View>

        <View style={styles.chartRow}>
          {dayBalances.map((d) => {
            const barHeight = d.balance == null ? 0 : Math.max(6, (Math.abs(d.balance) / maxAbsBalance) * 63);
            return (
              <View key={d.date} style={styles.chartCol}>
                {d.balance != null ? (
                  <>
                    <ThemedText style={[styles.barValue, { color: theme.accent }]}>{formatSignedKcal(d.balance)}</ThemedText>
                    <View
                      style={[
                        styles.bar,
                        { height: barHeight, backgroundColor: d.isToday ? theme.accent : theme.accentSoft },
                      ]}
                    />
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={styles.dayLabelsRow}>
          {weekDates.map((date, i) => (
            <ThemedText key={date} style={styles.dayLabel} themeColor="textTertiary" numberOfLines={1}>
              {WEEKDAY_LABELS[i]} {String(dayOfMonth(date)).padStart(2, '0')}
            </ThemedText>
          ))}
        </View>
        <ThemedText style={styles.chartMonth} themeColor="textTertiary">
          {monthLabel}
        </ThemedText>
      </FlatCard>

      <FlatCard radius={CARD_RADIUS} style={styles.statsCard}>
        <StatColumn icon="barbell" label="Allenamenti" value={`${workoutsDone}/${workoutsPlanned}`} />
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <StatColumn icon="utensils" label="Pasti tracciati" value={`${trackedMealDays}/7`} />
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <StatColumn
          icon="barChart"
          label={averageBalance >= 0 ? 'Surplus medio' : 'Deficit medio'}
          value={`${formatSignedKcal(averageBalance)} kcal`}
        />
      </FlatCard>

      <View style={styles.coachWrap}>
        <HomeCoachCard isWorkoutDayIncomplete={isWorkoutDayIncomplete} />
      </View>

      <InfoPopover
        visible={infoTopic != null}
        icon={infoTopic ? infoContent[infoTopic].icon : 'info'}
        title={infoTopic ? infoContent[infoTopic].title : ''}
        body={infoTopic ? infoContent[infoTopic].body : ''}
        onClose={() => setInfoTopic(null)}
      />

      <FoodSearchModal visible={registerMealOpen} slot={defaultSlotForNow()} date={today} onClose={() => setRegisterMealOpen(false)} />

      <LogActivityModal
        visible={registerWorkoutOpen}
        weightKg={latestBody.weightKg}
        onClose={() => setRegisterWorkoutOpen(false)}
        onSave={(activityType, intensity, durationMinutes) => addActivityEntry(activityType, intensity, durationMinutes, latestBody.weightKg)}
      />
    </ScreenScroll>
  );
}

function StatColumn({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.statCol}>
      <Icon name={icon} size={17} color={theme.text} />
      <ThemedText style={styles.statLabel} themeColor="textTertiary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.statValue, value.length > 9 && { fontSize: 15 }]} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 132,
    height: 32,
  },
  avatar: {
    width: 37,
    height: 37,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  oggiCard: {
    paddingTop: 14,
    paddingBottom: 3,
    paddingHorizontal: 0,
  },
  oggiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  oggiFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 44,
  },
  sideCol: {
    width: 90,
    alignItems: 'center',
    gap: 3,
    marginTop: 8,
  },
  sideValue: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sideLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
  },
  actionButton: {
    height: 52,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingLeft: 20,
    paddingRight: 22,
    marginTop: 8,
  },
  actionFirst: {
    marginTop: 10,
  },
  actionLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  weekCard: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  weekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  weekValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 6,
  },
  weekValue: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  weekGoal: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  weekMessage: {
    marginTop: 1,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '700',
  },
  weekBar: {
    marginTop: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    marginTop: 17,
    marginHorizontal: -6,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  barValue: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  bar: {
    width: 22,
    borderRadius: 5,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    marginHorizontal: -6,
    marginTop: 3,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '500',
  },
  chartMonth: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
  },
  statsCard: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
  },
  statDivider: {
    width: 1,
    height: 64,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  coachWrap: {
    marginTop: 20,
  },
});
