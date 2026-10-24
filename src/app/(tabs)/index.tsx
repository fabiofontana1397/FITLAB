import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { EnergyDetailsPopup } from '@/components/home/energy-details-popup';
import { CalorieRing } from '@/components/home/calorie-ring';
import { IntakePaceChart } from '@/components/home/intake-pace-chart';
import { TodayTasksCard, type TodayTask } from '@/components/home/today-tasks-card';
import { HomeCoachCard } from '@/components/home/home-coach-card';
import { QuickWeightSheet } from '@/components/body/quick-weight-sheet';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { LiquidGlassButton } from '@/components/glass/liquid-glass';
import { AnimatedFill, GrowBar } from '@/components/motion/animated-fill';
import { PressableScale } from '@/components/motion/pressable-scale';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { QuickAction } from '@/components/ui/quick-action';
import { ProfileAvatarButton } from '@/components/ui/profile-avatar-button';
import { LoggedActivitiesCard } from '@/components/training/logged-activities-card';
import { LogActivityModal } from '@/components/training/log-activity-modal';
import { InfoPopover } from '@/components/ui/info-popover';
import { FoodSearchModal } from '@/components/nutrition/food-search-modal';
import { MealPickerModal } from '@/components/nutrition/meal-picker-modal';
import { Radius, Spacing } from '@/constants/theme';
import { useHealthEnergy } from '@/hooks/use-health-energy';
import { sumActivityKcalForDate, useWeeklyEnergy } from '@/hooks/use-weekly-energy';
import { useTheme } from '@/hooks/use-theme';
import { currentWeekDates, dayOfMonth, daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
import { dayEnergy } from '@/domain/energy';
import { useUserContext } from '@/hooks/use-user-context';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useBodyStore } from '@/store/body-store';
import { latestSnapshot } from '@/lib/mock/body';
import { MEAL_SLOTS, useNutritionStore, sumMacros, type MealSlot } from '@/store/nutrition-store';
import { usePlanStore } from '@/store/plan-store';
import { isExerciseCompleted, useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

const SCREEN_PADDING = 20;
const CARD_RADIUS = 28;

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

type InfoTopic = 'burned' | 'eaten';

export default function HomeScreen() {
  const theme = useTheme();
  const currentUser = useUserStore();
  const ctx = useUserContext();
  const today = daysAgoISO(0);
  const { width } = useWindowDimensions();

  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const nutritionEntries = useNutritionStore((s) => s.entries);
  const activityLogEntries = useActivityLogStore((s) => s.entries);
  const addActivityEntry = useActivityLogStore((s) => s.addEntry);
  const bodyEntries = useBodyStore((s) => s.entries);
  const addWeightEntry = useBodyStore((s) => s.addWeightEntry);
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [registerMealOpen, setRegisterMealOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [mealSlot, setMealSlot] = useState<MealSlot | null>(null);

  // On iOS a Modal can't present (or navigation run) while another is still dismissing.
  const afterModal = (fn: () => void) => (Platform.OS === 'ios' ? setTimeout(fn, 350) : fn());
  // "Registra pasto": pick the meal, then the food; once saved, land on Nutrizione where it shows up.
  const pickMeal = (slot: MealSlot) => {
    setRegisterMealOpen(false);
    afterModal(() => setMealSlot(slot));
  };

  const [infoTopic, setInfoTopic] = useState<InfoTopic | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [detailsFocus, setDetailsFocus] = useState<'day' | 'week' | null>(null);
  const [viewDate, setViewDate] = useState(today);

  // The active month's weekly split: the same weekday-indexed lookup the
  // Training tab uses, so Home and Training agree on what's planned.
  const trainingMonth = trainingPlan?.months.find((m) => m.monthIndex === currentMonthIndex(trainingPlan));
  const weeklySplit = trainingMonth?.weeklySplit ?? [];
  const exercisesOn = (date: string) => {
    const planDay = weeklySplit[isoMondayIndex(date)];
    return planDay?.type === 'workout' ? (planDay.exercises ?? []) : [];
  };
  const todayExercises = exercisesOn(today);
  const todayDoneCount = todayExercises.filter((ex) => isExerciseCompleted(completedExercises, ex.id, today)).length;
  const isWorkoutDayIncomplete = todayExercises.length > 0 && todayDoneCount < todayExercises.length;
  // The "Oggi" card follows the day picked with the calendar icon (today by
  // default). 0 on any non-workout day — only a real workout earns exercise
  // calories.
  const viewExercises = exercisesOn(viewDate);
  const viewDoneCount = viewExercises.filter((ex) => isExerciseCompleted(completedExercises, ex.id, viewDate)).length;
  const viewExerciseCompletionFraction = viewExercises.length > 0 ? viewDoneCount / viewExercises.length : 0;

  // The generated diet plan's own calorie target for the active month
  // (it can differ month to month) takes priority over the static profile.
  const dietMonth = dietPlan?.months.find((m) => m.monthIndex === currentMonthIndex(dietPlan));
  const health = useHealthEnergy();
  // That day's own target (training days eat more than rest days), then the month's average, then the profile.
  const calorieTarget = dietMonth?.weeklySplit[isoMondayIndex(viewDate)]?.calorieTarget ?? dietMonth?.calorieTarget ?? currentUser.dailyCalorieTarget;
  const todaysTotals = sumMacros(nutritionEntries.filter((e) => e.date === viewDate));

  // The shown day's estimated expenditure from the unified energy model: resting + everyday activity
  // + the planned session scaled by how much was done + manually logged activities.
  const energy = dayEnergy(ctx, weeklySplit[isoMondayIndex(viewDate)] ?? null, viewExerciseCompletionFraction, sumActivityKcalForDate(activityLogEntries, viewDate), {
    calibration: health.calibration,
    measured: health.measuredFor(viewDate),
  });
  const basalKcal = energy.resting + energy.everyday;
  const trainingBurnKcal = energy.exercise;
  const burnedKcal = energy.total;
  const eatenKcal = todaysTotals.kcal;
  const balanceKcal = eatenKcal - burnedKcal;

  // Current calendar week (Mon–Sun) from the shared pipeline, so Home,
  // Progressi and Nutrizione can never disagree on the numbers.
  const { weekDaysWithActivity, weekEstimatedExpenditureSoFar, weeklyGoalKcal } = useWeeklyEnergy();
  const weekDates = currentWeekDates(new Date());

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
    eaten: {
      icon: 'utensils',
      title: 'Calorie assunte',
      body: `Il totale delle calorie registrate oggi tra i pasti, rispetto all'obiettivo di ${formatKcal(calorieTarget)} kcal del tuo piano alimentare. Restare vicino a questo obiettivo è ciò che determina se sei in deficit, surplus o mantenimento.`,
    },
  };

  const viewDateObj = new Date(viewDate);
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const isToday = viewDate === today;
  // "Venerdì 23 ottobre" — the date line above the greeting.
  const dateLine = capitalize(viewDateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const firstName = (currentUser.name ?? '').trim().split(' ')[0];

  // Days in a row with something registered (a meal or an activity),
  // counted back from today — a day still untouched doesn't break a streak
  // that is alive until tonight.
  const dayHasActivity = (date: string) =>
    nutritionEntries.some((e) => e.date === date) || activityLogEntries.some((e) => e.date === date);
  let streakDays = 0;
  for (let i = 0; i < 180; i++) {
    const date = daysAgoISO(i);
    if (dayHasActivity(date)) streakDays++;
    else if (i > 0) break;
  }

  // The shown day's meals, from the generated plan when there is one: their
  // times and planned calories are what the intake chart paces against.
  const planMealsToday = dietMonth?.weeklySplit[isoMondayIndex(viewDate)]?.meals ?? [];
  const kcalInSlot = (slotId: string) => sumMacros(nutritionEntries.filter((e) => e.date === viewDate && e.slot === slotId)).kcal;
  const plannedTotalKcal = planMealsToday.reduce((sum, meal) => sum + meal.totalKcal, 0);
  const intakeSlots =
    planMealsToday.length > 0 && plannedTotalKcal > 0
      ? planMealsToday.map((meal) => ({
          time: meal.time,
          eatenKcal: kcalInSlot(meal.slotId),
          share: meal.totalKcal / plannedTotalKcal,
        }))
      // MEAL_SLOTS' `sharePct` is already a fraction of the day (see
      // sharePctFor), which is exactly what the chart paces against.
      : MEAL_SLOTS.map((slot) => ({ time: slot.time, eatenKcal: kcalInSlot(slot.id), share: slot.sharePct }));

  // "Pasti registrati 2/4": against the plan's own meals when it has them,
  // otherwise the three main ones.
  const expectedSlotIds = planMealsToday.length > 0 ? planMealsToday.map((meal) => meal.slotId) : ['colazione', 'pranzo', 'cena'];
  const mealsLogged = expectedSlotIds.filter((slotId) => nutritionEntries.some((e) => e.date === viewDate && e.slot === slotId)).length;

  const isTrainingDay = viewExercises.length > 0;
  const tasks: TodayTask[] = [
    {
      icon: 'utensils',
      label: 'Pasti registrati',
      done: mealsLogged,
      total: Math.max(expectedSlotIds.length, 1),
      onPress: () => setRegisterMealOpen(true),
      actionLabel: 'Registra un pasto',
    },
    isTrainingDay
      ? {
          icon: 'barbell',
          label: 'Allenamento',
          done: viewDoneCount,
          total: viewExercises.length,
          onPress: () => router.navigate('/training'),
          actionLabel: "Apri l'allenamento",
        }
      : {
          icon: 'moon',
          label: 'Allenamento',
          done: 1,
          total: 1,
          note: 'Riposo',
          onPress: () => setLogActivityOpen(true),
          actionLabel: 'Registra un\u2019attività',
        },
  ];

  const remainingKcal = calorieTarget - eatenKcal;
  const ringSize = width < 400 ? 142 : 168;
  const dailyGoalKcal = weeklyGoalKcal / 7;
  const weekPill = weeklyProgress >= 1 ? 'Obiettivo raggiunto' : weeklyProgress >= 0.6 ? 'Ci sei quasi' : weeklyProgress >= 0.25 ? 'Stai andando bene' : 'Ogni giorno conta';

  return (
    <ScreenScroll reveal contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <PressableScale
            onPress={() => setCalendarOpen(true)}
            haptic="tap"
            scaleTo={0.97}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Scegli il giorno"
            style={styles.datePress}>
            <ThemedText type="caption" themeColor="textTertiary" style={styles.dateLine}>
              {dateLine}
            </ThemedText>
            <Icon name="chevronDown" size={12} color={theme.textTertiary} />
          </PressableScale>
          <View style={styles.headerIcons}>
            <LiquidGlassButton
              onPress={() => router.push('/notification-settings' as Href)}
              hitSlop={8}
              scaleTo={0.9}
              accessibilityLabel="Notifiche"
              size={38}>
              <Icon name="bell" size={18} color={theme.text} />
            </LiquidGlassButton>
            <ProfileAvatarButton size={38} />
          </View>
        </View>
        <ThemedText style={styles.greeting}>
          {greeting}{firstName ? `, ${firstName}` : ''}
        </ThemedText>
        {streakDays > 0 ? (
          <View style={[styles.streakChip, { backgroundColor: theme.accentSoft }]}>
            <Icon name="flame" size={14} color={theme.accent} />
            <ThemedText type="caption" style={{ color: theme.accentText }}>
              {streakDays} {streakDays === 1 ? 'giorno di fila' : 'giorni di fila'}
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="caption" themeColor="textSecondary">
            Registra la giornata per iniziare la tua serie.
          </ThemedText>
        )}
      </View>

      <TodayTasksCard tasks={tasks} radius={CARD_RADIUS} />

      <FlatCard radius={CARD_RADIUS} style={styles.calorieCard}>
        <View style={styles.calorieHead}>
          <View style={[styles.dayBadge, { backgroundColor: isTrainingDay ? theme.accentSoft : theme.backgroundElement }]}>
            <Icon name={isTrainingDay ? 'barbell' : 'moon'} size={13} color={isTrainingDay ? theme.accent : theme.textSecondary} />
            <ThemedText type="caption" style={{ color: isTrainingDay ? theme.accentText : theme.textSecondary }}>
              {isTrainingDay ? 'Giorno di allenamento' : 'Giorno di riposo'}
            </ThemedText>
          </View>
          <Pressable onPress={() => setDetailsFocus('day')} hitSlop={8} style={styles.linkRow} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>
              Dettagli
            </ThemedText>
            <Icon name="chevronRight" size={13} color={theme.accentText} />
          </Pressable>
        </View>

        <ThemedText type="title" style={styles.cardTitle}>
          {isToday ? 'Calorie di oggi' : `Calorie del ${viewDateObj.getDate()} ${viewDateObj.toLocaleDateString('it-IT', { month: 'long' })}`}
        </ThemedText>

        <View style={styles.calorieBody}>
          <Pressable onPress={() => setInfoTopic('eaten')} accessibilityRole="button" accessibilityLabel="Calorie assunte">
            <CalorieRing
              size={ringSize}
              progress={calorieTarget > 0 ? eatenKcal / calorieTarget : 0}
              value={formatKcal(eatenKcal)}
              caption="kcal assunte"
              footnote={remainingKcal >= 0 ? `${formatKcal(remainingKcal)} rimanenti` : `${formatKcal(-remainingKcal)} oltre`}
            />
          </Pressable>

          <View style={styles.kpiCol}>
            <MetricRow label="Obiettivo" value={`${formatKcal(calorieTarget)} kcal`} />
            <MetricRow
              label="Rimanenti"
              value={`${formatKcal(Math.abs(remainingKcal))} kcal`}
              valueColor={remainingKcal >= 0 ? theme.text : theme.accentText}
            />
            <MetricRow label="Bruciate" value={`${formatKcal(burnedKcal)} kcal`} onPress={() => setInfoTopic('burned')} />
            <MetricRow
              label={balanceKcal >= 0 ? 'Surplus' : 'Deficit'}
              value={`${formatSignedKcal(balanceKcal)} kcal`}
              valueColor={theme.text}
              onPress={() => setDetailsFocus('day')}
            />
          </View>
        </View>

        <View style={[styles.breakdown, { borderTopColor: theme.border }]}>
          <BreakdownRow label="Metabolismo e attività quotidiana" value={`${formatKcal(basalKcal)} kcal`} />
          <BreakdownRow label="Allenamento e attività registrate" value={`${formatKcal(trainingBurnKcal)} kcal`} />
        </View>
      </FlatCard>

      <FlatCard radius={CARD_RADIUS} style={styles.chartCard}>
        <IntakePaceChart slots={intakeSlots} targetKcal={calorieTarget} />
      </FlatCard>

      <View style={styles.quickGrid}>
        <QuickAction icon="utensils" label="Registra pasto" hint="Colazione, pranzo, cena" tone="accent" onPress={() => setRegisterMealOpen(true)} />
        <QuickAction icon="barbell" label="Registra allenamento" hint="Attività e durata" tone="green" onPress={() => setLogActivityOpen(true)} />
        <QuickAction icon="scale" label="Registra peso" hint={`Ultimo: ${latestSnapshot(bodyEntries).weightKg || ctx.weightKg} kg`} onPress={() => setWeightOpen(true)} />
        <QuickAction icon="nutrition" label="Piano alimentare" hint="La tua dieta" onPress={() => router.push('/diet-plan' as Href)} />
        <QuickAction icon="training" label="Scheda allenamento" hint="Il tuo programma" onPress={() => router.push('/training-plan' as Href)} />
      </View>

      <View>
        <SectionHeader title="Questa settimana" action="Riepilogo" onActionPress={() => router.push('/weekly-summary' as Href)} />
        <FlatCard radius={CARD_RADIUS} style={styles.weekCard}>
          <View style={styles.weekTitleRow}>
            <View style={styles.weekTitleLeft}>
              <ThemedText type="subtitle">{weeklyGoalKcal >= 0 ? 'Surplus' : 'Deficit'} settimanale</ThemedText>
            </View>
            <Pressable onPress={() => setDetailsFocus('week')} hitSlop={8} style={styles.linkRow} accessibilityRole="button">
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                Dettagli
              </ThemedText>
              <Icon name="chevronRight" size={13} color={theme.accentText} />
            </Pressable>
          </View>
          <View style={styles.weekValueRow}>
            <View style={styles.weekValueLeft}>
              <ThemedText style={styles.weekValue}>{formatSignedKcal(weeklySoFarKcal)}</ThemedText>
              <ThemedText style={styles.weekGoal} themeColor="textTertiary">
                /{formatSignedKcal(weeklyGoalKcal)} kcal
              </ThemedText>
            </View>
            <View style={[styles.weekPill, { backgroundColor: theme.successSoft }]}>
              <ThemedText type="caption" style={{ color: theme.success }}>
                {weekPill}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.weekTrack, { backgroundColor: theme.backgroundElement }]}>
            <AnimatedFill progress={weeklyProgress} delay={120} style={[styles.weekFill, { backgroundColor: theme.accent }]} />
          </View>

          <View style={styles.chartRow}>
            {dayBalances.map((d, i) => {
              const tracked = d.balance != null;
              const barHeight = tracked ? Math.max(14, (Math.abs(d.balance as number) / maxAbsBalance) * 62) : 14;
              return (
                <View key={d.date} style={styles.chartCol}>
                  {tracked ? (
                    <ThemedText style={[styles.barValue, { color: theme.textSecondary }]}>{formatSignedKcal(d.balance as number)}</ThemedText>
                  ) : null}
                  <GrowBar
                    height={barHeight}
                    delay={200 + i * 45}
                    style={[
                      styles.bar,
                      {
                        backgroundColor: !tracked ? theme.backgroundElement : d.isToday ? theme.accent : withAlpha(theme.accent, 0.28),
                      },
                    ]}
                  />
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
      </View>

      <FlatCard radius={CARD_RADIUS} style={styles.statsCard}>
        <StatColumn
          icon="barbell"
          iconColor={theme.success}
          label="Allenamenti"
          value={`${workoutsDone}/${workoutsPlanned}`}
          valueColor={theme.text}
          progress={workoutsPlanned > 0 ? workoutsDone / workoutsPlanned : 0}
          barColor={theme.success}
        />
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <StatColumn
          icon="utensils"
          iconColor={theme.accent}
          label="Pasti tracciati"
          value={`${trackedMealDays}/7`}
          valueColor={theme.text}
          progress={trackedMealDays / 7}
          barColor={theme.accent}
        />
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <StatColumn
          icon="barChart"
          iconColor={theme.textSecondary}
          label={weeklyGoalKcal >= 0 ? 'Surplus medio' : 'Deficit medio'}
          value={`${formatSignedKcal(averageBalance)} kcal`}
          valueColor={theme.text}
          target={{ goal: dailyGoalKcal, actual: averageBalance }}
        />
      </FlatCard>

      <HomeCoachCard isWorkoutDayIncomplete={isWorkoutDayIncomplete} />

      <LoggedActivitiesCard date={viewDate} />

      <LogActivityModal
        visible={logActivityOpen}
        weightKg={ctx.weightKg}
        onClose={() => setLogActivityOpen(false)}
        // logged on the day shown on Home (today if a future day is picked)
        onSave={(activityType, intensity, durationMinutes) => {
          addActivityEntry(activityType, intensity, durationMinutes, ctx.weightKg, viewDate > today ? today : viewDate);
          // Once logged, land on Training where the workout shows up.
          afterModal(() => router.navigate('/training'));
        }}
      />

      <QuickWeightSheet
        visible={weightOpen}
        currentWeightKg={latestSnapshot(bodyEntries).weightKg || ctx.weightKg}
        onClose={() => setWeightOpen(false)}
        onSave={(weightKg) => addWeightEntry(weightKg, viewDate > today ? today : viewDate)}
      />

      <MealPickerModal visible={registerMealOpen} date={viewDate} onClose={() => setRegisterMealOpen(false)} onPick={pickMeal} />
      <FoodSearchModal
        visible={mealSlot != null}
        slot={mealSlot}
        date={viewDate}
        onClose={() => setMealSlot(null)}
        onSaved={() => afterModal(() => router.navigate('/nutrition'))}
      />

      <EnergyDetailsPopup
        visible={detailsFocus != null}
        focus={detailsFocus ?? 'day'}
        onClose={() => setDetailsFocus(null)}
        goal={currentUser.goal}
        planPhaseTitle={dietMonth?.title}
        calorieTarget={calorieTarget}
        burnedKcal={burnedKcal}
        eatenKcal={eatenKcal}
        balanceKcal={balanceKcal}
        weeklyGoalKcal={weeklyGoalKcal}
        weeklySoFarKcal={weeklySoFarKcal}
        weeklyProgress={weeklyProgress}
        averageBalanceKcal={averageBalance}
        trackedDays={trackedBalances.length}
        daysLeft={weekDaysWithActivity.filter((d) => !d.hasHappened && !d.isToday).length}
        isToday={isToday}
      />

      <InfoPopover
        visible={infoTopic != null}
        icon={infoTopic ? infoContent[infoTopic].icon : 'info'}
        title={infoTopic ? infoContent[infoTopic].title : ''}
        body={infoTopic ? infoContent[infoTopic].body : ''}
        onClose={() => setInfoTopic(null)}
      />

      <DayCalendarModal
        visible={calendarOpen}
        selectedDate={viewDate}
        isDayMarked={(date) => nutritionEntries.some((e) => e.date === date)}
        onSelectDate={setViewDate}
        onClose={() => setCalendarOpen(false)}
      />
    </ScreenScroll>
  );
}

function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

/** One line of the calorie card's right-hand column: grey label, bold
 * value, and (where it opens one) the explanation behind it. */
function MetricRow({ label, value, valueColor, onPress }: { label: string; value: string; valueColor?: string; onPress?: () => void }) {
  const theme = useTheme();
  const content = (
    <>
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.metricValue, { color: valueColor ?? theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
    </>
  );
  if (!onPress) return <View style={styles.metricRow}>{content}</View>;
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityLabel={label} style={styles.metricRow}>
      {content}
    </Pressable>
  );
}

/** A line of the target's make-up under the ring. */
function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.breakdownRow}>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.breakdownLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

/** One column of the weekly stats card, as in the reference: icon, grey
 * label, bold colored value and a bar underneath. The bar is either plain
 * progress (workouts, tracked meals) or, for the average deficit, a track
 * with the plan's daily target at its centre and a marker for where the
 * actual average sits relative to it. */
function StatColumn({
  icon,
  iconColor,
  label,
  value,
  valueColor,
  progress,
  barColor,
  target,
}: {
  icon: IconName;
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
  progress?: number;
  barColor?: string;
  target?: { goal: number; actual: number };
}) {
  const theme = useTheme();
  // Half the track spans ±max(|goal|, 300) kcal around the target.
  const markerPct = target ? 50 + Math.min(Math.max((target.actual - target.goal) / Math.max(Math.abs(target.goal), 300), -1), 1) * 50 : 50;
  return (
    <View style={styles.statCol}>
      <View style={styles.statIconBox}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <ThemedText style={styles.statLabel} themeColor="textTertiary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.statValue, { color: valueColor }, value.length > 7 && { fontSize: 15 }]} numberOfLines={1}>
        {value}
      </ThemedText>
      <View style={[styles.statTrack, { backgroundColor: theme.backgroundElement }]}>
        {target ? (
          <>
            <View style={[styles.targetTick, { backgroundColor: theme.textTertiary }]} />
            <View style={[styles.actualMarker, { left: `${markerPct}%`, backgroundColor: theme.accent }]} />
          </>
        ) : (
          <AnimatedFill progress={progress ?? 0} delay={160} style={[styles.statFill, { backgroundColor: barColor }]} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: SCREEN_PADDING,
    gap: Spacing.four,
  },
  header: {
    gap: 6,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  datePress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  dateLine: {
    letterSpacing: 0.2,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  greeting: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  streakChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  calorieCard: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  calorieHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  cardTitle: {
    marginTop: -4,
  },
  calorieBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  kpiCol: {
    flex: 1,
    gap: Spacing.two,
  },
  metricRow: {
    gap: 1,
  },
  metricValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  breakdown: {
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  breakdownLabel: {
    flexShrink: 1,
  },
  chartCard: {
    padding: Spacing.four,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  weekCard: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  weekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  weekTitleLeft: {
    flexShrink: 1,
  },
  weekValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  weekValueLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  weekValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  weekGoal: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  weekPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  weekTrack: {
    height: 6,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  weekFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
    height: 96,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  barValue: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600',
  },
  bar: {
    width: '100%',
    maxWidth: 26,
    borderRadius: 8,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: -6,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 12,
  },
  chartMonth: {
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
    marginTop: -6,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statTrack: {
    height: 5,
    width: '100%',
    borderRadius: Radius.pill,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  statFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  targetTick: {
    position: 'absolute',
    left: '50%',
    width: 2,
    height: '100%',
    opacity: 0.5,
  },
  actualMarker: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: -3.5,
  },
});
