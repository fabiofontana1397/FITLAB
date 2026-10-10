import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { EnergyDetailsPopup } from '@/components/home/energy-details-popup';
import { OggiGauge } from '@/components/home/oggi-gauge';
import { HomeCoachCard } from '@/components/home/home-coach-card';
import { FoodSearchModal } from '@/components/nutrition/food-search-modal';
import { MealPickerModal } from '@/components/nutrition/meal-picker-modal';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { ProfileAvatarButton } from '@/components/ui/profile-avatar-button';
import { InfoPopover } from '@/components/ui/info-popover';
import { LogActivityModal } from '@/components/training/log-activity-modal';
import { sumActivityKcalForDate, useWeeklyEnergy } from '@/hooks/use-weekly-energy';
import { useTheme } from '@/hooks/use-theme';
import { latestSnapshot } from '@/lib/mock/body';
import { currentWeekDates, dayOfMonth, daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
import { dayEnergy } from '@/domain/energy';
import { useUserContext } from '@/hooks/use-user-context';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useBodyStore } from '@/store/body-store';
import { useNutritionStore, sumMacros, type MealSlot } from '@/store/nutrition-store';
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

/** Soft colored glow under a filled button, like the Figma's. */
function glow(color: string, alpha: number) {
  return Platform.select({
    web: { boxShadow: '0px 6px 14px ' + color + Math.round(alpha * 255).toString(16).padStart(2, '0') },
    default: { shadowColor: color, shadowOpacity: alpha, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  });
}

type InfoTopic = 'burned' | 'eaten' | 'notifications';

export default function HomeScreen() {
  const theme = useTheme();
  const currentUser = useUserStore();
  const ctx = useUserContext();
  const today = daysAgoISO(0);

  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const nutritionEntries = useNutritionStore((s) => s.entries);
  const bodyEntries = useBodyStore((s) => s.entries);
  const activityLogEntries = useActivityLogStore((s) => s.entries);
  const addActivityEntry = useActivityLogStore((s) => s.addEntry);

  const [infoTopic, setInfoTopic] = useState<InfoTopic | null>(null);
  const [registerMealOpen, setRegisterMealOpen] = useState(false);
  const [registerWorkoutOpen, setRegisterWorkoutOpen] = useState(false);
  const [mealSlot, setMealSlot] = useState<MealSlot | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [detailsFocus, setDetailsFocus] = useState<'day' | 'week' | null>(null);
  const [viewDate, setViewDate] = useState(today);

  const latestBody = latestSnapshot(bodyEntries);

  // The "Registra pasto" popup hands the chosen meal to "Registra alimento".
  // On iOS a Modal can't present while another is still dismissing.
  const pickMeal = (slot: MealSlot) => {
    setRegisterMealOpen(false);
    if (Platform.OS === 'ios') setTimeout(() => setMealSlot(slot), 350);
    else setMealSlot(slot);
  };

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
  // That day's own target (training days eat more than rest days), then the month's average, then the profile.
  const calorieTarget = dietMonth?.weeklySplit[isoMondayIndex(viewDate)]?.calorieTarget ?? dietMonth?.calorieTarget ?? currentUser.dailyCalorieTarget;
  const todaysTotals = sumMacros(nutritionEntries.filter((e) => e.date === viewDate));

  // The shown day's estimated expenditure from the unified energy model: resting + everyday activity
  // + the planned session scaled by how much was done + manually logged activities.
  const energy = dayEnergy(ctx, weeklySplit[isoMondayIndex(viewDate)] ?? null, viewExerciseCompletionFraction, sumActivityKcalForDate(activityLogEntries, viewDate));
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
    notifications: {
      icon: 'bell',
      title: 'Notifiche',
      body: 'Non hai nuove notifiche. Qui troverai promemoria su pasti, allenamenti e check-in.',
    },
  };

  const viewDateObj = new Date(viewDate);
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const datePill = `${capitalize(viewDateObj.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', ''))} ${viewDateObj.getDate()} ${capitalize(
    viewDateObj.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')
  )}`;
  const dailyGoalKcal = weeklyGoalKcal / 7;
  const weekPill = weeklyProgress >= 1 ? 'Obiettivo raggiunto! 🎯' : weeklyProgress >= 0.6 ? 'Ci sei quasi!' : weeklyProgress >= 0.25 ? 'Stai andando bene' : 'Ogni giorno conta';

  return (
    <ScreenScroll contentContainerStyle={styles.page}>
      <View style={styles.headerRow}>
        <Image source={require('@/assets/images/logo-wordmark.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.headerIcons}>
          <Pressable
            onPress={() => setInfoTopic('notifications')}
            hitSlop={8}
            accessibilityLabel="Notifiche"
            style={[styles.bell, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
            <Icon name="bell" size={19} color={theme.text} />
          </Pressable>
          <ProfileAvatarButton size={36} />
        </View>
      </View>

      <View style={styles.greetingRow}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.greeting}>Ciao {currentUser.name} 👋</ThemedText>
          <ThemedText style={styles.subtitle} themeColor="textTertiary">
            Sei sulla strada giusta!
          </ThemedText>
        </View>
        <Pressable
          onPress={() => setCalendarOpen(true)}
          accessibilityLabel="Apri calendario"
          style={[styles.datePill, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
          <Icon name="calendar" size={16} color={theme.text} />
          <ThemedText style={styles.datePillText}>{datePill}</ThemedText>
        </Pressable>
      </View>

      <FlatCard radius={CARD_RADIUS} style={styles.oggiCard}>
        <View style={styles.cardTitleRow}>
          <ThemedText style={styles.cardTitle}>
            {viewDate === today ? 'Calorie di oggi' : `Calorie del ${viewDateObj.getDate()} ${viewDateObj.toLocaleDateString('it-IT', { month: 'long' })}`}
          </ThemedText>
          <Pressable onPress={() => setDetailsFocus('day')} hitSlop={8} style={styles.linkRow}>
            <ThemedText style={[styles.linkText, { color: theme.accent }]}>Dettagli</ThemedText>
            <Icon name="chevronRight" size={13} color={theme.accent} />
          </Pressable>
        </View>

        <Pressable onPress={() => setDetailsFocus('day')} style={styles.gaugeWrap}>
          <OggiGauge
            burnedKcal={burnedKcal}
            eatenKcal={eatenKcal}
            burnedColor={theme.accent}
            eatenColor={theme.brandGreen}
            value={formatSignedKcal(balanceKcal)}
            caption={balanceKcal >= 0 ? 'in surplus' : 'in deficit'}
          />
        </Pressable>

        <View style={styles.oggiRow}>
          <Pressable onPress={() => setInfoTopic('burned')} style={styles.sideCol}>
            <Icon name="flame" size={22} color={theme.accent} />
            <ThemedText style={styles.sideValue}>{formatKcal(burnedKcal)}</ThemedText>
            <ThemedText style={styles.sideLabel} themeColor="textTertiary">
              bruciate
            </ThemedText>
          </Pressable>
          <View style={[styles.sideDivider, { backgroundColor: theme.border }]} />
          <Pressable onPress={() => setDetailsFocus('day')} style={styles.sideCol}>
            <Icon name="target" size={22} color={theme.textSecondary} />
            <ThemedText style={styles.sideLabel} themeColor="textTertiary">
              Obiettivo
            </ThemedText>
            <ThemedText style={styles.sideValue}>{formatSignedKcal(dailyGoalKcal)} kcal</ThemedText>
          </Pressable>
          <View style={[styles.sideDivider, { backgroundColor: theme.border }]} />
          <Pressable onPress={() => setInfoTopic('eaten')} style={styles.sideCol}>
            <Icon name="utensils" size={22} color={theme.brandGreen} />
            <ThemedText style={styles.sideValue}>{formatKcal(eatenKcal)}</ThemedText>
            <ThemedText style={styles.sideLabel} themeColor="textTertiary">
              assunte
            </ThemedText>
          </Pressable>
        </View>
      </FlatCard>

      <View style={styles.actionsRow}>
        <ActionTile
          colors={['#FF8A1F', '#FF5E00']}
          glowColor="#FF6A13"
          icon="utensils"
          iconColor="#FF6A13"
          label={'Registra\npasto'}
          onPress={() => setRegisterMealOpen(true)}
        />
        <ActionTile
          colors={['#34C77B', '#1FA85B']}
          glowColor="#22B35E"
          icon="barbell"
          iconColor="#1FA85B"
          label={'Registra\nallenamento'}
          onPress={() => setRegisterWorkoutOpen(true)}
        />
      </View>

      <ThemedText style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Questa settimana</ThemedText>
      <FlatCard radius={CARD_RADIUS} style={styles.weekCard}>
        <View style={styles.weekTitleRow}>
          <View style={styles.weekTitleLeft}>
            <Icon name="target" size={22} color={theme.accent} />
            <ThemedText style={styles.weekTitle}>{weeklyGoalKcal >= 0 ? 'Surplus' : 'Deficit'} settimanale</ThemedText>
          </View>
          <Pressable onPress={() => setDetailsFocus('week')} hitSlop={8} style={styles.linkRow}>
            <ThemedText style={[styles.linkText, { color: theme.accent }]}>Dettagli</ThemedText>
            <Icon name="chevronRight" size={13} color={theme.accent} />
          </Pressable>
        </View>
        <View style={styles.weekValueRow}>
          <View style={styles.weekValueLeft}>
            <ThemedText style={styles.weekValue}>{formatSignedKcal(weeklySoFarKcal)}</ThemedText>
            <ThemedText style={styles.weekGoal} themeColor="textTertiary">
              /{formatSignedKcal(weeklyGoalKcal)} kcal
            </ThemedText>
          </View>
          <View style={[styles.weekPill, { backgroundColor: withAlpha(theme.brandGreen, 0.14) }]}>
            <ThemedText style={[styles.weekPillText, { color: theme.brandGreen }]}>{weekPill}</ThemedText>
          </View>
        </View>
        <View style={[styles.weekTrack, { backgroundColor: theme.accentSoft }]}>
          <View style={[styles.weekFill, { width: `${Math.round(weeklyProgress * 100)}%`, backgroundColor: theme.accent }]} />
        </View>

        <View style={styles.chartRow}>
          {dayBalances.map((d) => {
            const tracked = d.balance != null;
            const barHeight = tracked ? Math.max(14, (Math.abs(d.balance as number) / maxAbsBalance) * 62) : 14;
            return (
              <View key={d.date} style={styles.chartCol}>
                {tracked ? (
                  <ThemedText style={[styles.barValue, { color: theme.accent }]}>{formatSignedKcal(d.balance as number)}</ThemedText>
                ) : null}
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
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

      <FlatCard radius={CARD_RADIUS} style={styles.statsCard}>
        <StatColumn
          icon="barbell"
          iconColor={theme.brandGreen}
          label="Allenamenti"
          value={`${workoutsDone}/${workoutsPlanned}`}
          valueColor={theme.brandGreen}
          progress={workoutsPlanned > 0 ? workoutsDone / workoutsPlanned : 0}
          barColor={theme.brandGreen}
        />
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <StatColumn
          icon="utensils"
          iconColor={theme.accent}
          label="Pasti tracciati"
          value={`${trackedMealDays}/7`}
          valueColor={theme.accent}
          progress={trackedMealDays / 7}
          barColor={theme.accent}
        />
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <StatColumn
          icon="barChart"
          iconColor={theme.text}
          label={weeklyGoalKcal >= 0 ? 'Surplus medio' : 'Deficit medio'}
          value={`${formatSignedKcal(averageBalance)} kcal`}
          valueColor={theme.text}
          target={{ goal: dailyGoalKcal, actual: averageBalance }}
        />
      </FlatCard>

      <View style={styles.coachWrap}>
        <HomeCoachCard isWorkoutDayIncomplete={isWorkoutDayIncomplete} />
      </View>

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
        isDayMarked={(date) => nutritionEntries.some((e) => e.date === date)}
        onSelectDate={setViewDate}
        onClose={() => setCalendarOpen(false)}
      />

      <MealPickerModal visible={registerMealOpen} date={viewDate} onClose={() => setRegisterMealOpen(false)} onPick={pickMeal} />
      <FoodSearchModal visible={mealSlot != null} slot={mealSlot} date={viewDate} onClose={() => setMealSlot(null)} />

      <LogActivityModal
        visible={registerWorkoutOpen}
        weightKg={latestBody.weightKg}
        onClose={() => setRegisterWorkoutOpen(false)}
        onSave={(activityType, intensity, durationMinutes) => addActivityEntry(activityType, intensity, durationMinutes, latestBody.weightKg)}
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
  iconColor,
  label,
  onPress,
}: {
  colors: readonly [string, string];
  glowColor: string;
  icon: IconName;
  iconColor: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.actionWrap, glow(glowColor, 0.28)]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionTile}>
        <View style={styles.actionIcon}>
          <Icon name={icon} size={22} color={iconColor} />
        </View>
        <ThemedText style={styles.actionLabel}>{label}</ThemedText>
        <Icon name="chevronRight" size={15} color="#FFFFFF" />
      </LinearGradient>
    </Pressable>
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
          <View style={[styles.statFill, { width: `${Math.round(Math.min(Math.max(progress ?? 0, 0), 1) * 100)}%`, backgroundColor: barColor }]} />
        )}
      </View>
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
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  greeting: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  datePillText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
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
    lineHeight: 28,
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
    marginTop: 18,
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
  gaugeWrap: {
    alignItems: 'center',
    marginTop: 4,
  },
  oggiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  sideCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  sideDivider: {
    width: 1,
    height: 58,
  },
  sideValue: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sideLabel: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  actionWrap: {
    flex: 1,
    borderRadius: 20,
  },
  actionTile: {
    height: 76,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
  },
  weekCard: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  weekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  weekTitle: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
  },
  weekValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  weekValueLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexShrink: 1,
  },
  weekValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
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
    borderRadius: 12,
  },
  weekPillText: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '700',
  },
  weekTrack: {
    marginTop: 12,
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
  },
  weekFill: {
    height: '100%',
    borderRadius: 7,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 96,
    marginTop: 14,
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
  },
  bar: {
    width: 26,
    borderRadius: 6,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '500',
  },
  chartMonth: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
  },
  statsCard: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 6,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  statIconBox: {
    height: 24,
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statTrack: {
    alignSelf: 'stretch',
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 3,
  },
  statFill: {
    height: '100%',
    borderRadius: 3,
  },
  targetTick: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
  },
  actualMarker: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    width: 5,
    marginLeft: -2.5,
    borderRadius: 3,
  },
  coachWrap: {
    marginTop: 20,
  },
});
