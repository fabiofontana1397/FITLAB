import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { FoodSearchModal } from '@/components/nutrition/food-search-modal';
import { PeriodTimeline, type TimelinePeriod } from '@/components/training/period-timeline';
import { WeekDayStrip } from '@/components/training/week-day-strip';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { AiCoachCard } from '@/components/ui/ai-coach-card';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Radius, Spacing } from '@/constants/theme';
import { TimingSlow } from '@/constants/motion';
import { useStoreHydrated } from '@/hooks/use-store-hydrated';
import { useTheme } from '@/hooks/use-theme';
import { addDaysISO, currentWeekDates, daysAgoISO, mondayIndex } from '@/lib/mock/dates';
import { findFood } from '@/lib/mock/food-database';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import {
  entriesForSlot,
  macrosForEntry,
  MEAL_SLOTS,
  sumMacros,
  useNutritionStore,
  type MealFoodEntry,
  type MealSlot,
} from '@/store/nutrition-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { isValidDietPlan, usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';

function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

export default function NutritionScreen() {
  const theme = useTheme();
  const currentUser = useUserStore();
  const entries = useNutritionStore((s) => s.entries);
  const seededDates = useNutritionStore((s) => s.seededDates);
  const removeEntry = useNutritionStore((s) => s.removeEntry);
  const seedDayFromPlan = useNutritionStore((s) => s.seedDayFromPlan);
  const unseedDay = useNutritionStore((s) => s.unseedDay);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const generatePlans = usePlanStore((s) => s.generatePlans);
  const onboardingAnswers = useOnboardingStore((s) => s.answers);
  const [activeSlot, setActiveSlot] = useState<MealSlot | null>(null);
  const [editingEntry, setEditingEntry] = useState<MealFoodEntry | null>(null);
  const today = daysAgoISO(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [expandedSlot, setExpandedSlot] = useState<MealSlot | null>(null);

  const planStoreHydrated = useStoreHydrated(usePlanStore);
  const onboardingHydrated = useStoreHydrated(useOnboardingStore);
  const userStoreHydrated = useStoreHydrated(useUserStore);

  useEffect(() => {
    // Persisted stores rehydrate from AsyncStorage asynchronously. Without
    // this gate, a returning user's plan/onboarding answers/profile could
    // still be at their in-memory defaults on first render, generating (and
    // permanently caching) a plan from empty/default data — the dietPlan
    // dependency below would then never change to retrigger it.
    if (!planStoreHydrated || !onboardingHydrated || !userStoreHydrated) return;
    if (isValidDietPlan(dietPlan) || onboardingAnswers.mode === 'training') return;
    generatePlans(onboardingAnswers, {
      dailyCalorieTarget: currentUser.dailyCalorieTarget,
      macroTargetsG: currentUser.macroTargetsG,
    });
    // Only needs to run once per missing/invalid-plan case, not on every keystroke of onboardingAnswers/currentUser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dietPlan, planStoreHydrated, onboardingHydrated, userStoreHydrated]);

  const monthIndex = dietPlan ? currentMonthIndex(dietPlan) : 1;
  const currentMonthData = dietPlan?.months.find((m) => m.monthIndex === monthIndex);

  // Tracking is opt-in (spec request): a date's calorie/macro totals must
  // never populate themselves just from opening it — the user explicitly
  // approves "follow the meal plan for this day" only via the "Segui il
  // piano" switch next to the meals heading below. Unlike Training's day
  // circle (which bulk-toggles workout completion on tap), the week
  // strip's checkmark here is read-only status — whether that day has any
  // logged food — so it isn't wired to a tap action at all.
  const planDayForDate = (date: string) => currentMonthData?.weeklySplit[mondayIndex(new Date(date))];
  const planDayForSelectedDate = planDayForDate(selectedDate);
  const isFollowingPlanToday = seededDates.includes(selectedDate);
  const canFollowPlanToday = !!planDayForSelectedDate;

  const viewedWeekDates = useMemo(() => currentWeekDates(new Date(addDaysISO(today, weekOffset * 7))), [today, weekOffset]);
  const monthYearLabel = useMemo(() => {
    const label = new Date(viewedWeekDates[3]).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [viewedWeekDates]);
  // Whole Monday-to-Monday weeks between the picked date and today — a
  // plain (date-today)/7 day-diff rounds wrong whenever the two dates
  // fall on different weekdays, landing the strip on a week that doesn't
  // even contain the picked date.
  const selectDateFromCalendar = (date: string) => {
    setSelectedDate(date);
    const dateMonday = addDaysISO(date, -mondayIndex(new Date(date)));
    const todayMonday = addDaysISO(today, -mondayIndex(new Date(today)));
    setWeekOffset(Math.round((new Date(dateMonday).getTime() - new Date(todayMonday).getTime()) / (7 * 86400000)));
  };

  const loggedDates = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);

  const dayEntries = entries.filter((e) => e.date === selectedDate);
  const totals = sumMacros(dayEntries);
  const calorieProgress = currentUser.dailyCalorieTarget > 0 ? totals.kcal / currentUser.dailyCalorieTarget : 0;

  const heroEntrance = useSharedValue(0);
  useEffect(() => {
    heroEntrance.value = 0;
    heroEntrance.value = withTiming(1, TimingSlow);
  }, [selectedDate, heroEntrance]);
  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroEntrance.value,
    transform: [{ translateY: (1 - heroEntrance.value) * 14 }],
  }));

  // Blue/green/gold is a common protein/carbs/fats convention (and keeps
  // every macro visualization in the app — this card, the per-meal rows,
  // any future chart — reading as the same three colors rather than a
  // one-off palette per screen).
  const macroRows: { key: 'protein' | 'carbs' | 'fats'; label: string; icon: IconName; color: string; target: number }[] = [
    { key: 'protein', label: 'Proteine', icon: 'protein', color: theme.calorieSurplus, target: currentUser.macroTargetsG.protein },
    { key: 'fats', label: 'Grassi', icon: 'fats', color: theme.warning, target: currentUser.macroTargetsG.fats },
    { key: 'carbs', label: 'Carbo', icon: 'carbs', color: theme.success, target: currentUser.macroTargetsG.carbs },
  ];

  // Mirrors training.tsx's own "current month" block exactly: a fixed
  // 30-day window starting at the plan's generatedAt (not a real calendar
  // month) — here the ring counts days with any logged food against all
  // 30 days in that window, instead of workouts done vs. programmed.
  const planStartDate = dietPlan ? dietPlan.generatedAt.slice(0, 10) : today;
  const monthWindowStart = addDaysISO(planStartDate, (monthIndex - 1) * 30);
  const monthDates = useMemo(() => Array.from({ length: 30 }, (_, i) => addDaysISO(monthWindowStart, i)), [monthWindowStart]);
  const monthDaysTotal = monthDates.length;
  const monthDaysTracked = monthDates.filter((date) => loggedDates.has(date)).length;
  const monthTrackingFraction = monthDaysTotal > 0 ? monthDaysTracked / monthDaysTotal : 0;

  const monthPeriods: TimelinePeriod[] = dietPlan
    ? Array.from({ length: dietPlan.durationMonths }, (_, i) => ({ number: i + 1, isCurrent: i + 1 === monthIndex }))
    : [];

  const mealsSectionTitle =
    selectedDate === today ? 'Pasti di oggi' : `Pasti del ${new Date(selectedDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;

  const MEAL_COLOR: Record<MealSlot, string> = {
    colazione: theme.warning,
    pranzo: theme.success,
    spuntinoMattina: theme.accent,
    spuntinoPomeriggio: theme.accent,
    spuntinoSera: theme.accent,
    cena: theme.calorieSurplus,
  };

  return (
    <ScreenScroll>
      <ScreenHeader eyebrow="Bilancio energetico" title="Nutrizione" />

      {dietPlan ? (
        <FlatCard radius={Radius.large} style={{ padding: Spacing.three, gap: Spacing.three }}>
          <Pressable onPress={() => router.push('/diet-plan')} style={styles.planHeaderRow}>
            <View style={[styles.planIcon, { backgroundColor: theme.accentSoft }]}>
              <Icon name="calendar" size={18} color={theme.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <ThemedText type="smallBold" numberOfLines={1}>
                Piano nutrizionale di {currentUser.name}
              </ThemedText>
              {currentMonthData ? (
                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
                  {dietPlan.durationMonths} mesi • {currentMonthData.title}
                </ThemedText>
              ) : null}
            </View>
            <Icon name="chevronRight" size={18} color={theme.textTertiary} />
          </Pressable>

          <PeriodTimeline label="Mese" periods={monthPeriods} />

          <View style={styles.completionRow}>
            <ProgressRing size={48} strokeWidth={5} progress={monthTrackingFraction} color={theme.accent} trackColor={theme.backgroundElement}>
              <ThemedText type="caption" style={{ fontWeight: '800', color: theme.text }}>
                {monthDaysTracked}/{monthDaysTotal}
              </ThemedText>
            </ProgressRing>
            <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
                Giorni tracciati questo mese
              </ThemedText>
            </View>
            <PrimaryButton
              label="Mostra piano"
              icon="calendar"
              trailingIcon="chevronRight"
              dense
              onPress={() => router.push('/diet-plan')}
              style={styles.showPlanButton}
            />
          </View>
        </FlatCard>
      ) : (
        <FlatCard radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.two }}>
          <ThemedText type="smallBold">Nessun piano generato</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Rifai il questionario in modalità “Piano alimentare” o “Entrambi” per generarne uno.
          </ThemedText>
        </FlatCard>
      )}

      <Animated.View style={heroAnimatedStyle}>
        <FlatCard radius={Radius.xlarge} style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleRow}>
              <Icon name="flame" size={17} color={theme.accent} />
              <ThemedText type="smallBold">Le tue calorie oggi</ThemedText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={styles.heroGoalRow}>
                <Icon name="target" size={11} color={theme.textTertiary} />
                <ThemedText type="caption" themeColor="textSecondary">
                  Obiettivo giornaliero
                </ThemedText>
              </View>
              <ThemedText type="smallBold">{currentUser.dailyCalorieTarget} kcal</ThemedText>
            </View>
          </View>

          <View style={styles.heroBodyRow}>
            <ProgressRing size={104} strokeWidth={10} progress={calorieProgress} color={theme.accent} trackColor={theme.backgroundElement}>
              <ThemedText style={styles.heroKcal}>{Math.round(totals.kcal)}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                kcal
              </ThemedText>
              <ThemedText type="caption" themeColor="textTertiary">
                assunte
              </ThemedText>
            </ProgressRing>

            <View style={styles.heroMacrosStack}>
              {macroRows.map((macro) => {
                const value = totals[macro.key];
                const pct = macro.target ? Math.round((value / macro.target) * 100) : 0;
                return (
                  <View key={macro.key} style={styles.heroMacroRow}>
                    <View style={[styles.heroMacroIcon, { backgroundColor: withAlpha(macro.color, 0.16) }]}>
                      <Icon name={macro.icon} size={15} color={macro.color} />
                    </View>
                    <ThemedText type="caption" style={styles.heroMacroGrams} numberOfLines={1}>
                      {Math.round(value)}g <ThemedText type="caption" themeColor="textTertiary">/ {macro.target}g</ThemedText>
                    </ThemedText>
                    <View style={[styles.heroMacroTrack, { backgroundColor: theme.backgroundElement }]}>
                      <View style={[styles.heroMacroFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: macro.color }]} />
                    </View>
                    <ThemedText type="caption" style={[styles.heroMacroPct, { color: macro.color }]}>
                      {pct}%
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        </FlatCard>
      </Animated.View>

      <WeekDayStrip
        weekDates={viewedWeekDates}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        isDayComplete={(date) => loggedDates.has(date)}
        onToggleDayComplete={() => {}}
        monthYearLabel={monthYearLabel}
        onOpenCalendar={() => setCalendarOpen(true)}
      />

      <View>
        <View style={styles.mealsSectionHeader}>
          <ThemedText type="subtitle">{mealsSectionTitle}</ThemedText>
          {canFollowPlanToday ? (
            <View style={styles.followPlanInline}>
              <ThemedText type="caption" themeColor="textSecondary">
                Segui il piano
              </ThemedText>
              <Switch
                value={isFollowingPlanToday}
                onValueChange={(v) => (v ? seedDayFromPlan(selectedDate, planDayForSelectedDate!.meals) : unseedDay(selectedDate))}
                trackColor={{ false: theme.backgroundElement, true: theme.accent }}
                thumbColor={theme.onAccent}
              />
            </View>
          ) : null}
        </View>

        <View style={{ gap: Spacing.three }}>
          {MEAL_SLOTS.map((meta) => {
            const slotEntries = entriesForSlot(entries, meta.id, selectedDate);
            const slotTotals = sumMacros(slotEntries);
            const expanded = expandedSlot === meta.id;
            const color = MEAL_COLOR[meta.id];

            return (
              <FlatCard key={meta.id} radius={Radius.large} style={styles.mealCard}>
                <Pressable onPress={() => setExpandedSlot(expanded ? null : meta.id)} style={styles.mealRow}>
                  <View style={[styles.mealIcon, { backgroundColor: withAlpha(color, 0.16) }]}>
                    <Icon name={meta.icon} size={20} color={color} />
                  </View>
                  <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                    <ThemedText type="smallBold">{meta.label}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {meta.time}
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <ThemedText type="smallBold">{Math.round(slotTotals.kcal)} kcal</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                      P {Math.round(slotTotals.protein)}g · C {Math.round(slotTotals.carbs)}g · G {Math.round(slotTotals.fats)}g
                    </ThemedText>
                  </View>
                  <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={16} color={theme.textTertiary} />
                </Pressable>

                {expanded ? (
                  <View style={styles.mealExpanded}>
                    <View style={[styles.mealDivider, { backgroundColor: theme.border }]} />
                    {slotEntries.length > 0 ? (
                      <View style={{ gap: Spacing.two }}>
                        {slotEntries.map((entry) => {
                          const food = findFood(entry.foodId);
                          const m = macrosForEntry(entry);
                          return (
                            <View key={entry.id} style={styles.foodItemRow}>
                              <Pressable
                                style={{ flex: 1, gap: 2, minWidth: 0 }}
                                onPress={() => {
                                  setEditingEntry(entry);
                                  setActiveSlot(meta.id);
                                }}>
                                <ThemedText type="smallBold" numberOfLines={1}>
                                  {food?.name ?? entry.foodId}
                                </ThemedText>
                                <ThemedText type="caption" themeColor="textSecondary">
                                  {entry.grams} g
                                </ThemedText>
                              </Pressable>
                              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                <ThemedText type="smallBold">{Math.round(m.kcal)} kcal</ThemedText>
                                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                                  P {Math.round(m.protein)}g · C {Math.round(m.carbs)}g · G {Math.round(m.fats)}g
                                </ThemedText>
                              </View>
                              <Pressable
                                onPress={() => removeEntry(entry.id)}
                                hitSlop={8}
                                style={[styles.foodDeleteButton, { borderColor: theme.border }]}>
                                <Icon name="trash" size={15} color={theme.danger} />
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <ThemedText type="caption" themeColor="textTertiary">
                        Nessun alimento registrato
                      </ThemedText>
                    )}
                    <Pressable
                      onPress={() => {
                        setEditingEntry(null);
                        setActiveSlot(meta.id);
                      }}
                      style={[styles.addFoodButton, { borderColor: theme.border }]}>
                      <Icon name="plus" size={14} color={theme.accent} />
                      <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '700' }}>
                        Aggiungi alimento
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : null}
              </FlatCard>
            );
          })}
        </View>
      </View>

      <AiCoachCard
        headline="Un dubbio sull'alimentazione?"
        body="Chiedi al coach AI consigli su pasti, macro e calorie in base al tuo piano."
      />

      <DayCalendarModal
        visible={calendarOpen}
        selectedDate={selectedDate}
        isDayMarked={(date) => loggedDates.has(date)}
        onSelectDate={selectDateFromCalendar}
        onClose={() => setCalendarOpen(false)}
      />

      <FoodSearchModal
        visible={activeSlot != null}
        slot={activeSlot}
        date={selectedDate}
        editEntry={editingEntry}
        onClose={() => {
          setActiveSlot(null);
          setEditingEntry(null);
        }}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  showPlanButton: {
    flexShrink: 0,
  },
  heroCard: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroKcal: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  // Macros stacked one under another — each row itself ordered icon,
  // grams, progress bar left to right, per spec.
  heroMacrosStack: {
    flex: 1,
    gap: Spacing.two,
  },
  heroMacroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  heroMacroIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMacroGrams: {
    width: 74,
    fontWeight: '800',
  },
  heroMacroTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  heroMacroFill: {
    height: '100%',
    borderRadius: 3,
  },
  heroMacroPct: {
    width: 32,
    textAlign: 'right',
    fontWeight: '800',
  },
  mealsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  followPlanInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mealCard: {
    padding: Spacing.three,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mealIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealExpanded: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  mealDivider: {
    height: StyleSheet.hairlineWidth,
  },
  foodItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  foodDeleteButton: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFoodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
