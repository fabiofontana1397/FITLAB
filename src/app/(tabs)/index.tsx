import { LinearGradient } from 'expo-linear-gradient';
import { openPopup } from '@/lib/open-popup';
import { planIndexFor, useTrainingSwapStore } from '@/store/training-swap-store';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { EnergyDetailsPopup } from '@/components/home/energy-details-popup';
import { EnergyBars } from '@/components/home/energy-bars';
import { goalBandCopy } from '@/components/home/goal-band-copy';
import { GoalRing } from '@/components/home/goal-ring';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { AnimatedFill, GrowBar } from '@/components/motion/animated-fill';
import { PressableScale } from '@/components/motion/pressable-scale';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { TodayTiles, type TodayWorkout } from '@/components/home/today-tiles';
import { WeekStrip, type WeekStripDay } from '@/components/home/week-strip';
import { TabHeader } from '@/components/tab-header';
import { LogActivityModal } from '@/components/training/log-activity-modal';
import { WorkoutSessionModal } from '@/components/training/workout-session-modal';
import { InfoPopover } from '@/components/ui/info-popover';
import { FoodSearchModal } from '@/components/nutrition/food-search-modal';
import { MealPickerModal } from '@/components/nutrition/meal-picker-modal';
import { useEnsurePlan } from '@/hooks/use-ensure-plan';
import { useElapsedHours } from '@/hooks/use-elapsed-hours';
import { useHealthEnergy } from '@/hooks/use-health-energy';
import { sumActivityKcalForDate, useWeeklyEnergy } from '@/hooks/use-weekly-energy';
import { useTheme } from '@/hooks/use-theme';
import { currentWeekDates, dayOfMonth, daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
import { balanceCaption as captionFor, calorieBalance, goalBand, readBalance } from '@/domain/calorie-balance';
import { dayEnergy, sessionMinutes } from '@/domain/energy';
import { Brand, Layout, OnBrand, Radius } from '@/constants/theme';
import { useUserContext } from '@/hooks/use-user-context';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useNutritionStore, sumMacros, type MealSlot } from '@/store/nutrition-store';
import { usePlanStore } from '@/store/plan-store';
import { isExerciseCompleted, useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';
import { savedElapsedMs, useWorkoutSessionStore } from '@/store/workout-session-store';
import { hapticTap } from '@/lib/haptics';

const SCREEN_PADDING = Layout.screenGutter;
const CARD_RADIUS = Radius.large;

function clamp01(n: number): number {
  return Math.min(Math.max(n, 0), 1);
}

/** Soft colored glow under a filled button, like the Figma's. */
function glow(color: string, alpha: number) {
  return Platform.select({
    web: { boxShadow: '0px 6px 14px ' + color + Math.round(alpha * 255).toString(16).padStart(2, '0') },
    default: { shadowColor: color, shadowOpacity: alpha, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  });
}

type InfoTopic = 'burned' | 'eaten';

/** "12:34" for the workout time of a session in progress. */
function sessionClock(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const theme = useTheme();
  const currentUser = useUserStore();
  const ctx = useUserContext();
  const today = daysAgoISO(0);

  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const nutritionEntries = useNutritionStore((s) => s.entries);
  const activityLogEntries = useActivityLogStore((s) => s.entries);
  const addActivityEntry = useActivityLogStore((s) => s.addEntry);
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  // The guided session ("Inizia allenamento"), started from the day's tile; one left with the X resumes from there.
  const [sessionOpen, setSessionOpen] = useState(false);
  const activeSession = useWorkoutSessionStore((s) => s.active);
  const [registerMealOpen, setRegisterMealOpen] = useState(false);
  const [mealSlot, setMealSlot] = useState<MealSlot | null>(null);
  // Home's energy figures read both plans, so it builds a missing or outdated plan itself instead of waiting
  // for the person to open Allenamento, Nutrizione or Piani.
  useEnsurePlan('training');
  useEnsurePlan('diet');

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
  // The calorie card (gauge and its "Dettagli") opens the chart guide: a sheet like Profilo and Notifiche.
  const openGuide = () => {
    hapticTap();
    router.push('/energy-guide' as Href);
  };

  // The active month's weekly split: the same weekday-indexed lookup the
  // Training tab uses, so Home and Training agree on what's planned.
  const trainingMonth = trainingPlan?.months.find((m) => m.monthIndex === currentMonthIndex(trainingPlan));
  const weeklySplit = trainingMonth?.weeklySplit ?? [];
  const swaps = useTrainingSwapStore((s) => s.swaps);
  const exercisesOn = (date: string) => {
    const planDay = weeklySplit[planIndexFor(date, swaps)];
    return planDay?.type === 'workout' ? (planDay.exercises ?? []) : [];
  };
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
  const elapsedHours = useElapsedHours();
  // That day's own target (training days eat more than rest days), then the month's average, then the profile.
  const calorieTarget = dietMonth?.weeklySplit[isoMondayIndex(viewDate)]?.calorieTarget ?? dietMonth?.calorieTarget ?? currentUser.dailyCalorieTarget;
  const todaysTotals = sumMacros(nutritionEntries.filter((e) => e.date === viewDate));
  // The day's macro targets, resolved like the Nutrizione tab does: the day's own, then the month's, then the profile's.
  const macroTargets = dietMonth?.weeklySplit[isoMondayIndex(viewDate)]?.macroTargetsG ?? dietMonth?.macroTargetsG ?? currentUser.macroTargetsG;

  // What the training plan holds for the day shown. Only today's session starts from Home (as on Allenamento).
  const viewPlanDay = weeklySplit[planIndexFor(viewDate, swaps)];
  const viewWorkoutDone = viewExercises.length > 0 && viewDoneCount >= viewExercises.length;
  const sessionInProgress = activeSession != null && activeSession.date === viewDate && !viewWorkoutDone;
  const todayWorkout: TodayWorkout = !trainingPlan
    ? { kind: 'none' }
    : viewPlanDay?.type === 'workout'
      ? {
          kind: 'workout',
          title: viewPlanDay.title,
          minutes: sessionMinutes(viewPlanDay, ctx),
          exercisesDone: viewDoneCount,
          exercisesTotal: viewExercises.length,
          resumeLabel: sessionInProgress ? sessionClock(savedElapsedMs(activeSession)) : undefined,
          onStart: viewDate === today && !viewWorkoutDone ? () => setSessionOpen(true) : undefined,
        }
      : viewPlanDay?.type === 'cardio'
        ? { kind: 'cardio', title: viewPlanDay.title }
        : { kind: 'rest' };

  // The shown day's estimated expenditure from the unified energy model: resting + everyday activity
  // + the planned session scaled by how much was done + manually logged activities.
  const energy = dayEnergy(ctx, weeklySplit[planIndexFor(viewDate, swaps)] ?? null, viewExerciseCompletionFraction, sumActivityKcalForDate(activityLogEntries, viewDate), {
    calibration: health.calibration,
    measured: health.measuredFor(viewDate),
    // Today the resting + everyday kcal accrue hour by hour; past days are complete.
    elapsedHours: viewDate === today ? elapsedHours : undefined,
  });
  // The same day lived to its end with the planned session done: what the burned bar fills towards.
  const fullDay = dayEnergy(ctx, weeklySplit[planIndexFor(viewDate, swaps)] ?? null, 1, sumActivityKcalForDate(activityLogEntries, viewDate), {
    calibration: health.calibration,
    measured: health.measuredFor(viewDate),
  });
  const basalKcal = energy.resting + energy.everyday;
  const trainingBurnKcal = energy.exercise;
  const burnedKcal = energy.total;
  const eatenKcal = todaysTotals.kcal;
  const balanceKcal = calorieBalance(eatenKcal, burnedKcal);
  // A day that hasn't happened yet has nothing to read: the gauge stays grey and every figure empty.
  const isFutureDay = viewDate > today;

  // Current calendar week (Mon–Sun) from the shared pipeline, so Home,
  // Progressi and Nutrizione can never disagree on the numbers.
  const { weekDaysWithActivity, weekEstimatedExpenditureSoFar, weeklyGoalKcal } = useWeeklyEnergy();
  const weekDates = currentWeekDates(new Date());
  // The day strip follows the day picked (with the strip itself or the calendar), so it shows that day's week; the cards around keep the current one.
  const { weekDaysWithActivity: stripWeek } = useWeeklyEnergy(viewDate);

  const eatenSoFarThisWeek = weekDaysWithActivity.filter((d) => d.hasHappened).reduce((sum, d) => sum + d.eatenKcal, 0);
  const weeklySoFarKcal = eatenSoFarThisWeek - weekEstimatedExpenditureSoFar;
  const weeklyProgress = weeklyGoalKcal !== 0 ? clamp01(weeklySoFarKcal / weeklyGoalKcal) : 0;

  const dayBalances = weekDaysWithActivity.map((d) => {
    const tracked = d.hasHappened && (d.eatenKcal > 0 || d.estimatedExpenditureKcal > 0);
    return { date: d.date, isToday: d.isToday, balance: tracked ? d.eatenKcal - d.estimatedExpenditureKcal : null };
  });
  const maxAbsBalance = Math.max(1, ...dayBalances.map((d) => (d.balance == null ? 0 : Math.abs(d.balance))));
  const trackedBalances = dayBalances.filter((d) => d.balance != null).map((d) => d.balance as number);
  const averageBalance = trackedBalances.length > 0 ? trackedBalances.reduce((a, b) => a + b, 0) / trackedBalances.length : 0;
  const monthLabel = (() => {
    const label = new Date(weekDates[3]).toLocaleDateString('it-IT', { month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();


  const infoContent: Record<InfoTopic, { icon: IconName; title: string; body: string }> = {
    burned: {
      icon: 'flame',
      title: 'Calorie bruciate',
      body: `Una stima delle calorie che il tuo corpo ha bruciato oggi: metabolismo basale (BMR) più attività quotidiana (${formatKcal(basalKcal)} kcal), a cui si aggiungono l'allenamento svolto e le attività registrate (${formatKcal(trainingBurnKcal)} kcal). Basale e attività quotidiana si sommano un po' alla volta dall'ora della tua colazione a quella della cena: a cena trovi il conto della giornata intera. Insieme alle calorie assunte determina il tuo bilancio energetico verso l'obiettivo.`,
    },
    eaten: {
      icon: 'utensils',
      title: 'Calorie assunte',
      body: `Il totale delle calorie registrate oggi tra i pasti, rispetto all'obiettivo di ${formatKcal(calorieTarget)} kcal del tuo piano alimentare. Restare vicino a questo obiettivo è ciò che determina se sei in deficit, surplus o mantenimento.`,
    },
  };

  const viewDateObj = new Date(viewDate);
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const viewDateLabel = capitalize(new Date(viewDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }));
  const stripDays: WeekStripDay[] = stripWeek.map((d, i) => ({
    date: d.date,
    label: WEEKDAY_LABELS[i].charAt(0),
    dayOfMonth: dayOfMonth(d.date),
    isToday: d.isToday,
    hasHappened: d.date <= today,
    burnedKcal: d.estimatedExpenditureKcal,
    eatenKcal: d.eatenKcal,
    targetKcal: d.targetKcal,
    fullDayBurnedKcal: d.fullDayExpenditureKcal,
  }));
  const dailyGoalKcal = weeklyGoalKcal / 7;
  // The gauge's semi-ring reads today's balance against the same daily goal the "Obiettivo" column shows.
  const balanceReading = readBalance({ eatenKcal: isFutureDay ? 0 : eatenKcal, burnedKcal: isFutureDay ? 0 : burnedKcal, goalKcal: dailyGoalKcal });
  const balanceCaption = captionFor(balanceReading);
  // The goal bar reads the same balance against the goal itself; the gap from the plan splits into intake (vs. the day's calorie target) and burned.
  const band = goalBand({
    reading: balanceReading,
    eatenKcal: isFutureDay ? 0 : eatenKcal,
    burnedKcal: isFutureDay ? 0 : burnedKcal,
    plannedEatenKcal: calorieTarget,
    dayComplete: viewDate < today,
  });
  const bandCopy = goalBandCopy(band, { hasMeals: eatenKcal > 0, future: isFutureDay });
  const balanceA11y = isFutureDay
    ? 'Giorno non ancora iniziato: nessun dato.'
    : balanceReading.status === 'missing'
      ? `Nessun pasto registrato. Bruciate ${formatKcal(burnedKcal)} kcal. Obiettivo ${formatSignedKcal(dailyGoalKcal)} kcal.`
      : `Bilancio ${formatSignedKcal(balanceKcal)} kcal, ${balanceCaption}. Obiettivo ${formatSignedKcal(dailyGoalKcal)} kcal. Bruciate ${formatKcal(burnedKcal)}, assunte ${formatKcal(eatenKcal)} kcal.`;

  return (
    <ScreenScroll reveal header={<TabHeader title={`Ciao ${currentUser.name}`} subtitle={viewDateLabel} onCalendarPress={() => openPopup(() => setCalendarOpen(true))} />} contentContainerStyle={styles.page}>
      <View style={styles.weekStrip}>
        <WeekStrip days={stripDays} selectedDate={viewDate} goalKcal={dailyGoalKcal} onSelect={setViewDate} />
      </View>

      <FlatCard radius={CARD_RADIUS} style={styles.oggiCard}>
        <View style={styles.cardTitleRow}>
          <ThemedText style={styles.cardTitle}>
            {viewDate === today ? 'Calorie di oggi' : `Calorie del ${viewDateObj.getDate()} ${viewDateObj.toLocaleDateString('it-IT', { month: 'long' })}`}
          </ThemedText>
          <Pressable onPress={openGuide} hitSlop={8} style={styles.linkRow} accessibilityRole="button" accessibilityLabel="Dettagli: come leggere il grafico">
            <ThemedText style={[styles.linkText, { color: theme.accent }]}>Dettagli</ThemedText>
            <Icon name="chevronRight" size={13} color={theme.accent} />
          </Pressable>
        </View>

        <GoalRing
          compact
          band={band}
          copy={bandCopy}
          inactive={isFutureDay}
          value={isFutureDay ? '—' : formatSignedKcal(balanceKcal)}
          goalText={isFutureDay ? '—' : `${formatSignedKcal(dailyGoalKcal)} kcal`}
          onPress={openGuide}
          onGoalPress={() => setDetailsFocus('day')}
          accessibilityLabel={balanceA11y}
        />

      </FlatCard>

      <View style={styles.actionsRow}>
        <ActionTile
          colors={Brand.accentGradientSoft}
          glowColor={Brand.accentGlow}
          icon="utensils"
          label={'Registra\npasto'}
          onPress={() => openPopup(() => setRegisterMealOpen(true))}
        />
        <ActionTile
          colors={Brand.successGradient}
          glowColor={Brand.successGlow}
          icon="barbell"
          label={'Registra\nallenamento'}
          onPress={() => openPopup(() => setLogActivityOpen(true))}
        />
      </View>

      {/* Assunte and bruciate: two tiles side by side, below the two register buttons, like the ones under them. */}
      <EnergyBars
        eatenKcal={isFutureDay ? 0 : eatenKcal}
        eatenTargetKcal={calorieTarget > 0 ? calorieTarget : fullDay.total}
        basalKcal={isFutureDay ? 0 : basalKcal}
        basalDayKcal={fullDay.resting + fullDay.everyday}
        exerciseKcal={isFutureDay ? 0 : trainingBurnKcal}
        exerciseDayKcal={fullDay.exercise}
        inactive={isFutureDay}
        running={viewDate === today}
        onEatenPress={() => setInfoTopic('eaten')}
        onBurnedPress={() => setInfoTopic('burned')}
      />

      {/* The day's progress, side by side: macros against the plan, and the plan's session with its start. */}
      <TodayTiles
        isToday={viewDate === today}
        inactive={isFutureDay}
        macros={{
          protein: { eaten: todaysTotals.protein, target: macroTargets.protein },
          carbs: { eaten: todaysTotals.carbs, target: macroTargets.carbs },
          fats: { eaten: todaysTotals.fats, target: macroTargets.fats },
        }}
        onMacrosPress={() => router.navigate('/nutrition')}
        workout={todayWorkout}
        onWorkoutPress={() =>
          todayWorkout.kind === 'none'
            ? router.navigate('/plans')
            : todayWorkout.kind === 'rest'
              ? router.navigate('/training')
              : router.push({ pathname: '/workout-detail', params: { date: viewDate } })
        }
      />

      <FlatCard radius={CARD_RADIUS} style={styles.weekCard}>
        <View style={styles.weekTitleRow}>
          <View style={styles.weekTitleLeft}>
            <View style={styles.weekIcon}>
              <Icon name="crosshair" size={17} color={theme.text} />
            </View>
            <ThemedText style={styles.weekTitle}>Obiettivo {weeklyGoalKcal >= 0 ? 'surplus' : 'deficit'} settimanale</ThemedText>
          </View>
          <Pressable onPress={() => router.push('/weekly-guide' as Href)} hitSlop={8} style={styles.linkRow} accessibilityRole="button" accessibilityLabel="Dettagli: come leggere il grafico della settimana">
            <ThemedText style={[styles.linkText, { color: theme.accent }]}>Dettagli</ThemedText>
            <Icon name="chevronRight" size={13} color={theme.accent} />
          </Pressable>
        </View>
        {/* This week's balance so far against the week's goal, read like Assunte: the figure, "/ goal kcal", and a bar towards it. */}
        <View style={styles.weekHero}>
          <View style={styles.weekGoalRow}>
            <ThemedText style={styles.weekGoalValue}>{formatSignedKcal(weeklySoFarKcal)}</ThemedText>
            <ThemedText style={styles.weekGoalUnit} themeColor="textTertiary">
              / {formatSignedKcal(weeklyGoalKcal)} kcal
            </ThemedText>
          </View>
          <View style={[styles.weekTrack, { backgroundColor: withAlpha(theme.accent, 0.18) }]}>
            <AnimatedFill progress={weeklyProgress} delay={160} style={[styles.weekFill, { backgroundColor: theme.accent }]} />
          </View>
        </View>

        <View style={styles.chartRow}>
          {dayBalances.map((d, i) => {
            const tracked = d.balance != null;
            const barHeight = tracked ? Math.max(14, (Math.abs(d.balance as number) / maxAbsBalance) * 62) : 14;
            return (
              <View key={d.date} style={styles.chartCol}>
                {tracked ? (
                  <ThemedText style={[styles.barValue, { color: theme.accent }]}>{formatSignedKcal(d.balance as number)}</ThemedText>
                ) : null}
                <GrowBar
                  height={barHeight}
                  delay={200 + i * 45}
                  style={[
                    styles.bar,
                    {
                      backgroundColor: !tracked ? theme.backgroundElement : d.isToday ? theme.accent : withAlpha(theme.accent, 0.22),
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


      {sessionOpen && viewPlanDay?.type === 'workout' ? (
        <WorkoutSessionModal visible onClose={() => setSessionOpen(false)} title={viewPlanDay.title} exercises={viewPlanDay.exercises ?? []} date={today} />
      ) : null}

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
        burnedKcal={isFutureDay ? 0 : burnedKcal}
        eatenKcal={isFutureDay ? 0 : eatenKcal}
        balanceKcal={isFutureDay ? 0 : balanceKcal}
        weeklyGoalKcal={weeklyGoalKcal}
        weeklySoFarKcal={weeklySoFarKcal}
        weeklyProgress={weeklyProgress}
        averageBalanceKcal={averageBalance}
        trackedDays={trackedBalances.length}
        daysLeft={weekDaysWithActivity.filter((d) => !d.hasHappened && !d.isToday).length}
        isToday={viewDate === today}
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
        showGoalStatus
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

/** One of the two big gradient buttons under the calorie card: white icon
 * tile, two-line label, chevron. */
function ActionTile({
  colors,
  glowColor,
  icon,
  label,
  onPress,
}: {
  colors: readonly [string, string];
  glowColor: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  // On the narrowest phones the chevron makes way so the two-line label keeps its room.
  const narrow = useWindowDimensions().width < 360;
  return (
    <PressableScale onPress={onPress} haptic="press" accessibilityRole="button" style={[styles.actionWrap, glow(glowColor, 0.28)]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionTile}>
        <View style={styles.actionIcon}>
          <Icon name={icon} size={24} color={OnBrand.text} />
        </View>
        <ThemedText style={[styles.actionLabel, narrow && { fontSize: 12 }]}>{label}</ThemedText>
        {narrow ? null : <Icon name="chevronRight" size={15} color={OnBrand.text} />}
      </LinearGradient>
    </PressableScale>
  );
}

/** One column of the weekly stats card, as in the reference: icon, grey
 * label, bold colored value and a bar underneath. The bar is either plain
 * progress (workouts, tracked meals) or, for the average deficit, a track
 * with the plan's daily target at its centre and a marker for where the
 * actual average sits relative to it. */
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
  headerText: {
    flex: 1,
    marginHorizontal: 12,
  },
  weekStrip: {
    // Tucked up under the header: the day cells carry their own vertical padding.
    marginTop: -6,
    marginBottom: 0,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  greeting: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionRow: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  linkText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  oggiCard: {
    marginTop: 10,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  // Pill-shaped: a short bar whose ends are half circles (radius = half the height), with a round icon disc at its start.
  actionWrap: {
    flex: 1,
    borderRadius: 26,
  },
  actionTile: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    paddingRight: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    color: OnBrand.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  weekCard: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  weekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  weekHero: {
    marginTop: 12,
    marginBottom: 4,
    gap: 2,
  },
  weekGoalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  weekGoalValue: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  weekGoalUnit: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  weekTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  weekFill: {
    height: 6,
    borderRadius: 3,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 88,
    marginTop: 12,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  barValue: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bar: {
    width: 22,
    borderRadius: 5,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  chartMonth: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
});
