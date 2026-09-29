import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { GlassSurface } from '@/components/glass/glass-surface';
import { FoodSearchModal } from '@/components/nutrition/food-search-modal';
import { NutritionWeekStrip } from '@/components/nutrition/nutrition-week-strip';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ProgressRing } from '@/components/ui/progress-ring';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { WeeklyBurnChart } from '@/components/ui/weekly-burn-chart';
import { Radius, Spacing } from '@/constants/theme';
import { TimingSlow } from '@/constants/motion';
import { useStoreHydrated } from '@/hooks/use-store-hydrated';
import { useTheme } from '@/hooks/use-theme';
import { useWeeklyEnergy } from '@/hooks/use-weekly-energy';
import { addDaysISO, currentWeekDates, daysAgoISO, formatDayMonth, formatShortDay, isToday, mondayIndex } from '@/lib/mock/dates';
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

type NutritionTab = 'pasti' | 'macro' | 'grafico';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Oggi, 25 Set" / "Ieri, 24 Set" / "Lun, 22 Set" — the compact day label
 * in the header, mirroring the reference design's single-line date nav. */
function dayLabel(iso: string): string {
  const [day, month] = formatDayMonth(iso).split(' ');
  const monthLabel = capitalize(month);
  if (isToday(iso)) return `Oggi, ${day} ${monthLabel}`;
  if (iso === addDaysISO(daysAgoISO(0), -1)) return `Ieri, ${day} ${monthLabel}`;
  return `${capitalize(formatShortDay(iso))}, ${day} ${monthLabel}`;
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
  const [selectedDate, setSelectedDate] = useState(daysAgoISO(0));
  const [showWeekStrip, setShowWeekStrip] = useState(false);
  const [activeTab, setActiveTab] = useState<NutritionTab>('pasti');
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
  // approves "follow the meal plan for this day" per date via the switch
  // below, same principle as the training side's completion checkboxes.
  // Without an explicit approval, a day stays blank and only what the user
  // logs by hand (or approves here) ever counts toward Home's rings/charts.
  const planDayForSelectedDate = currentMonthData?.weeklySplit[mondayIndex(new Date(selectedDate))];
  const isFollowingPlanToday = seededDates.includes(selectedDate);
  const canFollowPlanToday = !!planDayForSelectedDate;

  const toggleFollowPlan = (value: boolean) => {
    if (!planDayForSelectedDate) return;
    if (value) seedDayFromPlan(selectedDate, planDayForSelectedDate.meals);
    else unseedDay(selectedDate);
  };

  const weekDates = useMemo(() => currentWeekDates(new Date(selectedDate)), [selectedDate]);
  const loggedDates = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);

  const dayEntries = entries.filter((e) => e.date === selectedDate);
  const totals = sumMacros(dayEntries);
  const calorieProgress = currentUser.dailyCalorieTarget > 0 ? totals.kcal / currentUser.dailyCalorieTarget : 0;
  const calorieDeltaKcal = Math.round(totals.kcal - currentUser.dailyCalorieTarget);

  const heroEntrance = useSharedValue(0);
  useEffect(() => {
    heroEntrance.value = 0;
    heroEntrance.value = withTiming(1, TimingSlow);
  }, [selectedDate, heroEntrance]);
  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroEntrance.value,
    transform: [{ translateY: (1 - heroEntrance.value) * 14 }],
  }));

  // Protein=calorieSurplus(blue)/carbs=success(green)/fats=warning(gold) —
  // the same three theme-safe tokens used for the weekly burn chart
  // elsewhere, reused here so each macro reads as a distinct, consistent
  // color across the whole app rather than a one-off palette.
  const macroRows: { key: 'protein' | 'carbs' | 'fats'; label: string; color: string; target: number }[] = [
    { key: 'protein', label: 'Proteine', color: theme.calorieSurplus, target: currentUser.macroTargetsG.protein },
    { key: 'carbs', label: 'Carboidrati', color: theme.success, target: currentUser.macroTargetsG.carbs },
    { key: 'fats', label: 'Grassi', color: theme.warning, target: currentUser.macroTargetsG.fats },
  ];

  const { weekDaysWithActivity } = useWeeklyEnergy();

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <ThemedText type="display">Nutrizione</ThemedText>
          <Pressable onPress={() => setShowWeekStrip((v) => !v)} hitSlop={8}>
            <GlassSurface level="card" radius={Radius.pill} style={styles.calendarButton}>
              <View style={styles.calendarButtonInner}>
                <Icon name="calendar" size={19} color={theme.text} />
              </View>
            </GlassSurface>
          </Pressable>
        </View>
        <Pressable onPress={() => setSelectedDate((d) => addDaysISO(d, -1))} style={styles.dayNavRow} hitSlop={8}>
          <Icon name="arrowBack" size={16} color={theme.textSecondary} />
          <ThemedText type="smallBold" themeColor="textSecondary">
            {dayLabel(selectedDate)}
          </ThemedText>
        </Pressable>
      </View>

      {showWeekStrip ? (
        <NutritionWeekStrip dates={weekDates} loggedDates={loggedDates} selectedDate={selectedDate} onSelect={setSelectedDate} />
      ) : null}

      <Animated.View style={heroAnimatedStyle}>
        <View style={styles.heroCard}>
          <ProgressRing
            size={128}
            strokeWidth={12}
            progress={calorieProgress}
            color={theme.accent}
            trackColor="rgba(255,255,255,0.14)">
            <ThemedText style={styles.heroKcal}>{Math.round(totals.kcal)}</ThemedText>
            <ThemedText style={styles.heroKcalUnit}>kcal</ThemedText>
            <ThemedText style={[styles.heroDelta, { color: calorieDeltaKcal > 0 ? theme.warning : theme.success }]}>
              {calorieDeltaKcal > 0 ? '+' : ''}
              {calorieDeltaKcal}
            </ThemedText>
          </ProgressRing>

          <View style={styles.heroMacros}>
            {macroRows.map((macro) => {
              const value = totals[macro.key];
              const pct = macro.target ? Math.round((value / macro.target) * 100) : 0;
              return (
                <View key={macro.key} style={styles.heroMacroRow}>
                  <View style={styles.heroMacroTopRow}>
                    <View style={styles.heroMacroLabelRow}>
                      <View style={[styles.heroMacroDot, { backgroundColor: macro.color }]} />
                      <ThemedText style={styles.heroMacroLabel}>{macro.label}</ThemedText>
                    </View>
                    <ThemedText style={[styles.heroMacroPct, { color: macro.color }]}>{pct}%</ThemedText>
                  </View>
                  <ThemedText style={styles.heroMacroValue}>
                    {Math.round(value)}g / {macro.target}g
                  </ThemedText>
                  <View style={styles.heroMacroTrack}>
                    <View style={[styles.heroMacroFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: macro.color }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </Animated.View>

      <SegmentedControl
        options={[
          { value: 'pasti', label: 'Pasti' },
          { value: 'macro', label: 'Macro' },
          { value: 'grafico', label: 'Grafico' },
        ]}
        value={activeTab}
        onChange={(v) => setActiveTab(v as NutritionTab)}
      />

      {activeTab === 'pasti' ? (
        <View style={{ gap: Spacing.three }}>
          {dietPlan ? (
            <Pressable onPress={() => router.push('/diet-plan')}>
              <GlassSurface level="card" radius={Radius.large} style={styles.planRow}>
                <View style={[styles.planIcon, { backgroundColor: theme.accentSoft }]}>
                  <Icon name="calendar" size={18} color={theme.accent} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText type="smallBold">Piano alimentare</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Il tuo piano per oggi
                  </ThemedText>
                </View>
                <Icon name="chevronRight" size={18} color={theme.textTertiary} />
              </GlassSurface>
            </Pressable>
          ) : null}

          {canFollowPlanToday ? (
            <GlassSurface level="card" radius={Radius.large} style={styles.followPlanRow}>
              <ThemedText type="caption" themeColor="textSecondary" style={{ flex: 1 }}>
                Segui il piano alimentare per oggi
              </ThemedText>
              <Switch
                value={isFollowingPlanToday}
                onValueChange={toggleFollowPlan}
                trackColor={{ false: theme.backgroundElement, true: theme.accent }}
                thumbColor={theme.onAccent}
              />
            </GlassSurface>
          ) : null}

          <View>
            <SectionHeader title="Pasti di oggi" />
            <View style={{ gap: Spacing.three }}>
              {MEAL_SLOTS.map((meta) => {
                const slotEntries = entriesForSlot(entries, meta.id, selectedDate);
                const slotTotals = sumMacros(slotEntries);
                const hasLogged = slotTotals.kcal > 0;
                const expanded = expandedSlot === meta.id;

                return (
                  <GlassSurface key={meta.id} level="card" radius={Radius.large} style={styles.mealCard}>
                    <Pressable onPress={() => setExpandedSlot(expanded ? null : meta.id)} style={styles.mealRow}>
                      <View style={[styles.mealIcon, { backgroundColor: theme.accentSoft }]}>
                        <Icon name={meta.icon} size={18} color={theme.accent} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <ThemedText type="smallBold">{meta.label}</ThemedText>
                        <ThemedText type="caption" themeColor="textSecondary">
                          {Math.round(slotTotals.kcal)} kcal
                        </ThemedText>
                      </View>
                      {hasLogged ? (
                        <Icon name="checkCircle" size={22} color={theme.success} />
                      ) : (
                        <View style={[styles.emptyCircle, { borderColor: theme.border }]} />
                      )}
                      <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={16} color={theme.textTertiary} />
                    </Pressable>

                    {expanded ? (
                      <View style={styles.mealExpanded}>
                        <View style={[styles.mealDivider, { backgroundColor: theme.border }]} />
                        {slotEntries.length > 0 ? (
                          <View style={{ gap: Spacing.one }}>
                            {slotEntries.map((entry) => {
                              const food = findFood(entry.foodId);
                              const m = macrosForEntry(entry);
                              return (
                                <View key={entry.id} style={styles.foodRow}>
                                  <Pressable
                                    style={{ flex: 1 }}
                                    onPress={() => {
                                      setEditingEntry(entry);
                                      setActiveSlot(meta.id);
                                    }}>
                                    <ThemedText type="caption">
                                      {food?.name ?? entry.foodId} · {entry.grams}g
                                    </ThemedText>
                                  </Pressable>
                                  <ThemedText type="caption" themeColor="textSecondary">
                                    {Math.round(m.kcal)} kcal
                                  </ThemedText>
                                  <Pressable onPress={() => removeEntry(entry.id)} hitSlop={8}>
                                    <Icon name="close" size={14} color={theme.textTertiary} />
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
                  </GlassSurface>
                );
              })}
            </View>
          </View>
        </View>
      ) : activeTab === 'macro' ? (
        <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.four }}>
          <ThemedText type="smallBold">Macro di oggi</ThemedText>
          {macroRows.map((macro) => {
            const value = totals[macro.key];
            const pct = macro.target ? Math.round((value / macro.target) * 100) : 0;
            return (
              <View key={macro.key} style={{ gap: Spacing.two }}>
                <View style={styles.macroDetailTopRow}>
                  <View style={styles.heroMacroLabelRow}>
                    <View style={[styles.heroMacroDot, { backgroundColor: macro.color }]} />
                    <ThemedText type="smallBold">{macro.label}</ThemedText>
                  </View>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {Math.round(value)}g / {macro.target}g · {pct}%
                  </ThemedText>
                </View>
                <View style={[styles.macroDetailTrack, { backgroundColor: theme.backgroundElement }]}>
                  <View style={[styles.macroDetailFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: macro.color }]} />
                </View>
              </View>
            );
          })}
        </GlassSurface>
      ) : (
        <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.three }}>
          <ThemedText type="smallBold">Andamento calorico settimanale</ThemedText>
          <WeeklyBurnChart
            days={weekDaysWithActivity.map((d) => ({
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
      )}

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
  header: {
    gap: Spacing.two,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarButton: {
    width: 40,
    height: 40,
  },
  calendarButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  // Deliberately always dark regardless of the app's own light/dark
  // setting, same convention as Home's AI Coach card — a distinct "hero
  // metric" surface rather than a plain themed one.
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    backgroundColor: '#15161A',
    borderRadius: Radius.xlarge,
    padding: Spacing.four,
  },
  heroKcal: {
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroKcalUnit: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -2,
  },
  heroDelta: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  heroMacros: {
    flex: 1,
    gap: Spacing.three,
  },
  heroMacroRow: {
    gap: 4,
  },
  heroMacroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroMacroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMacroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroMacroLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  heroMacroPct: {
    fontSize: 12,
    fontWeight: '800',
  },
  heroMacroValue: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  heroMacroTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  heroMacroFill: {
    height: '100%',
    borderRadius: 2,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
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
    width: 36,
    height: 36,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  mealExpanded: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  mealDivider: {
    height: StyleSheet.hairlineWidth,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  macroDetailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macroDetailTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  macroDetailFill: {
    height: '100%',
    borderRadius: 4,
  },
});
