import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { FoodSearchModal } from '@/components/nutrition/food-search-modal';
import { MealPickerModal, mealSlotColor } from '@/components/nutrition/meal-picker-modal';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { ProfileAvatarButton } from '@/components/ui/profile-avatar-button';
import { ProgressRing } from '@/components/ui/progress-ring';
import { TickProgressBar } from '@/components/ui/tick-progress-bar';
import { useEnsurePlan } from '@/hooks/use-ensure-plan';
import { useTheme } from '@/hooks/use-theme';
import { daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
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
import { usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';

const SCREEN_PADDING = 20;
const CARD_RADIUS = 20;
const CARD_PADDING = 14;

function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

/** Italian thousands-separated magnitude ("2.254"), hand-rolled for the
 * same reason as Home's: toLocaleString('it-IT') doesn't reliably group on
 * Hermes / minimal-ICU web builds. */
function formatKcal(n: number): string {
  return Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function macroLine(m: { protein: number; carbs: number; fats: number }): string {
  return `P ${Math.round(m.protein)}g / C ${Math.round(m.carbs)}g / G ${Math.round(m.fats)}g`;
}

/** The calorie card's nudge, driven by how many of the day's meals have at
 * least one food logged: invite to start, push to finish, praise when done. */
function trackingMessage(
  meals: { label: string; logged: boolean }[],
  ratio: number,
): { text: string; tone: 'start' | 'progress' | 'done' | 'over' } {
  const missing = meals.filter((m) => !m.logged);
  if (ratio > 1.05) return { text: "Hai superato l'obiettivo", tone: 'over' };
  if (missing.length === 0) return { text: 'Tutto tracciato, complimenti!', tone: 'done' };
  if (missing.length === meals.length) return { text: 'Registra il primo pasto', tone: 'start' };
  if (missing.length === 1) return { text: `Manca solo ${missing[0].label.toLowerCase()}`, tone: 'progress' };
  return { text: `Ancora ${missing.length} pasti, dai!`, tone: 'progress' };
}

export default function NutritionScreen() {
  const theme = useTheme();
  const currentUser = useUserStore();
  const entries = useNutritionStore((s) => s.entries);
  const seededDates = useNutritionStore((s) => s.seededDates);
  const seedDayFromPlan = useNutritionStore((s) => s.seedDayFromPlan);
  const unseedDay = useNutritionStore((s) => s.unseedDay);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const [activeSlot, setActiveSlot] = useState<MealSlot | null>(null);
  const [editingEntry, setEditingEntry] = useState<MealFoodEntry | null>(null);
  const today = daysAgoISO(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedSlot, setExpandedSlot] = useState<MealSlot | null>('colazione');

  useEnsurePlan('diet');

  const monthIndex = dietPlan ? currentMonthIndex(dietPlan) : 1;
  const currentMonthData = dietPlan?.months.find((m) => m.monthIndex === monthIndex);

  // The generated plan's own targets for the active month take priority
  // over the static profile defaults — same rule Home follows, so the two
  // screens never show different "obiettivo" numbers.
  // Tracking is opt-in (spec request): a date's totals never populate
  // themselves just from opening it — the user explicitly approves "follow
  // the meal plan for this day" with the switch below.
  const planDayForSelectedDate = currentMonthData?.weeklySplit[isoMondayIndex(selectedDate)];

  // The day's own target (training days eat more than rest days), then the month's average, then the profile.
  const calorieTarget = planDayForSelectedDate?.calorieTarget ?? currentMonthData?.calorieTarget ?? currentUser.dailyCalorieTarget;
  const macroTargets = planDayForSelectedDate?.macroTargetsG ?? currentMonthData?.macroTargetsG ?? currentUser.macroTargetsG;

  // The meals the person actually has (from the plan); only a user without a diet plan sees the six generic slots.
  const mealSlots = planDayForSelectedDate
    ? planDayForSelectedDate.meals.map((m) => {
        const meta = MEAL_SLOTS.find((x) => x.id === m.slotId);
        return { id: m.slotId as MealSlot, label: m.label, time: m.time, icon: meta?.icon ?? ('mealSnack' as const) };
      })
    : MEAL_SLOTS;
  const isFollowingPlan = seededDates.includes(selectedDate);

  const mealsHeading =
    selectedDate === today
      ? 'Pasti di oggi'
      : `Pasti del ${new Date(selectedDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;

  // Picking a meal in the "Registra pasto" popup hands over to "Registra
  // alimento". On iOS a Modal can't present while another is still
  // dismissing, so wait a beat there.
  const pickMeal = (slot: MealSlot) => {
    setPickerOpen(false);
    setEditingEntry(null);
    if (Platform.OS === 'ios') setTimeout(() => setActiveSlot(slot), 350);
    else setActiveSlot(slot);
  };

  const loggedDates = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);

  const dayEntries = entries.filter((e) => e.date === selectedDate);
  const totals = sumMacros(dayEntries);
  const calorieRatio = calorieTarget > 0 ? totals.kcal / calorieTarget : 0;
  const message = trackingMessage(
    mealSlots.map((m) => ({ label: m.label, logged: dayEntries.some((e) => e.slot === m.id) })),
    calorieRatio,
  );
  const messageColor =
    message.tone === 'over' ? theme.accent : message.tone === 'done' ? theme.brandGreen : message.tone === 'start' ? theme.accent : theme.brandYellow;
  const messageIcon = message.tone === 'done' ? 'trophy' : message.tone === 'over' ? 'alert' : message.tone === 'start' ? 'plus' : 'flame';

  const macroRings = [
    { key: 'protein' as const, label: 'Proteine', color: theme.accent, target: macroTargets.protein },
    { key: 'carbs' as const, label: 'Carboidrati', color: theme.brandGreen, target: macroTargets.carbs },
    { key: 'fats' as const, label: 'Grassi', color: theme.brandYellow, target: macroTargets.fats },
  ];

  return (
    <ScreenScroll contentContainerStyle={styles.page}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.pageTitle}>Nutrizione</ThemedText>
        <View style={styles.headerIcons}>
          <Pressable
            onPress={() => router.push('/diet-plan')}
            hitSlop={8}
            accessibilityLabel="Piano alimentare"
            style={[styles.circleButton, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
            <Icon name="calendar" size={19} color={theme.text} />
          </Pressable>
          <ProfileAvatarButton size={38} />
        </View>
      </View>

      <FlatCard radius={CARD_RADIUS} style={styles.calorieCard}>
        <View style={styles.cardTitleRow}>
          <Icon name="flame" size={16} color={theme.accent} />
          <ThemedText style={styles.cardTitle}>{selectedDate === today ? 'Calorie di oggi' : 'Calorie del giorno'}</ThemedText>
          <View style={[styles.statusPill, { backgroundColor: withAlpha(messageColor, 0.14) }]}>
            <Icon name={messageIcon} size={12} color={messageColor} />
            <ThemedText style={[styles.statusText, { color: messageColor }]} numberOfLines={1}>
              {message.text}
            </ThemedText>
          </View>
        </View>

        <View style={styles.bigNumberRow}>
          <ThemedText style={styles.bigNumber}>{formatKcal(totals.kcal)}</ThemedText>
          <ThemedText style={styles.bigNumberSuffix} themeColor="textTertiary">
            / {formatKcal(calorieTarget)} kcal
          </ThemedText>
        </View>

        <View style={styles.calorieBar}>
          <TickProgressBar progress={calorieRatio} ticks={false} />
        </View>

        <ThemedText style={[styles.cardTitle, styles.macroHeading]}>Macronutrienti</ThemedText>
        <View style={styles.ringsRow}>
          {macroRings.map((macro) => (
            <View key={macro.key} style={styles.ringCol}>
              <ProgressRing
                size={81}
                strokeWidth={5}
                progress={macro.target > 0 ? totals[macro.key] / macro.target : 0}
                color={macro.color}
                trackColor={theme.backgroundElement}>
                <ThemedText style={styles.ringValue}>{Math.round(totals[macro.key])} g</ThemedText>
              </ProgressRing>
              <ThemedText style={styles.ringLabel}>{macro.label}</ThemedText>
              <ThemedText style={styles.ringTarget} themeColor="textSecondary">
                / {Math.round(macro.target)} g
              </ThemedText>
            </View>
          ))}
        </View>
      </FlatCard>

      <Pressable onPress={() => setPickerOpen(true)} style={[styles.registerButton, { backgroundColor: theme.accent }]}>
        <View style={styles.registerPlus}>
          <Icon name="plus" size={20} color="#FFFFFF" />
        </View>
        <ThemedText style={styles.registerLabel}>Registra pasto</ThemedText>
        <Icon name="chevronRight" size={16} color="#FFFFFF" />
      </Pressable>

      <View style={styles.mealsHeader}>
        <ThemedText style={styles.sectionTitle}>{mealsHeading}</ThemedText>
        <Pressable onPress={() => setCalendarOpen(true)} hitSlop={8} accessibilityLabel="Apri calendario">
          <ThemedText style={[styles.link, { color: theme.accent }]}>Vedi calendario ›</ThemedText>
        </Pressable>
      </View>

      {planDayForSelectedDate ? (
        <Pressable
          onPress={() => (isFollowingPlan ? unseedDay(selectedDate) : seedDayFromPlan(selectedDate, planDayForSelectedDate.meals))}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isFollowingPlan }}
          style={[styles.followRow, { backgroundColor: theme.backgroundElevated, borderColor: isFollowingPlan ? theme.accent : theme.border }]}>
          <View
            style={[
              styles.checkbox,
              isFollowingPlan ? { backgroundColor: theme.accent, borderColor: theme.accent } : { borderColor: theme.textTertiary },
            ]}>
            {isFollowingPlan ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
          </View>
          <ThemedText style={styles.followText}>
            {selectedDate === today ? 'Inserisci la dieta di oggi nei pasti' : 'Inserisci la dieta di questo giorno nei pasti'}
          </ThemedText>
        </Pressable>
      ) : null}

      <View style={styles.mealsList}>
        {mealSlots.map((meta) => {
          const slotEntries = entriesForSlot(entries, meta.id, selectedDate);
          const slotTotals = sumMacros(slotEntries);
          const expanded = expandedSlot === meta.id;
          const color = mealSlotColor(theme, meta.id);

          return (
            <FlatCard key={meta.id} radius={CARD_RADIUS} style={styles.mealCard}>
              <Pressable onPress={() => setExpandedSlot(expanded ? null : meta.id)} style={styles.mealHeaderRow}>
                <View style={[styles.mealIcon, { backgroundColor: withAlpha(color, 0.14) }]}>
                  <Icon name={meta.icon} size={15} color={color} />
                </View>
                <View style={styles.mealTitleCol}>
                  <ThemedText style={styles.mealName}>{meta.label}</ThemedText>
                  <ThemedText style={styles.mealTime} themeColor="textTertiary">
                    {meta.time}
                  </ThemedText>
                </View>
                <View style={styles.mealTotalsCol}>
                  <ThemedText style={[styles.mealKcal, { color: theme.accent }]}>{Math.round(slotTotals.kcal)} kcal</ThemedText>
                  <ThemedText style={styles.mealMacros} themeColor="textTertiary">
                    {macroLine(slotTotals)}
                  </ThemedText>
                </View>
              </Pressable>

              {expanded ? (
                <View>
                  <View style={[styles.divider, { backgroundColor: theme.borderStrong }]} />
                  {slotEntries.map((entry) => {
                    const food = findFood(entry.foodId);
                    const m = macrosForEntry(entry);
                    return (
                      <Pressable
                        key={entry.id}
                        style={styles.foodRow}
                        onPress={() => {
                          setEditingEntry(entry);
                          setActiveSlot(meta.id);
                        }}>
                        <View style={styles.foodLeft}>
                          <ThemedText style={styles.foodName} numberOfLines={1}>
                            {food?.name ?? entry.foodId}
                          </ThemedText>
                          <ThemedText style={styles.foodGrams} themeColor="textSecondary">
                            {entry.grams} g
                          </ThemedText>
                        </View>
                        <View style={styles.foodRight}>
                          <ThemedText style={styles.foodKcal}>{Math.round(m.kcal)} kcal</ThemedText>
                          <ThemedText style={styles.mealMacros} themeColor="textTertiary">
                            {macroLine(m)}
                          </ThemedText>
                        </View>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => {
                      setEditingEntry(null);
                      setActiveSlot(meta.id);
                    }}
                    style={[styles.addFoodButton, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
                    <ThemedText style={[styles.addFoodText, { color: theme.accent }]}>+ Aggiungi alimento</ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </FlatCard>
          );
        })}
      </View>

      <DayCalendarModal
        visible={calendarOpen}
        selectedDate={selectedDate}
        isDayMarked={(date) => loggedDates.has(date)}
        onSelectDate={setSelectedDate}
        onClose={() => setCalendarOpen(false)}
      />

      <MealPickerModal visible={pickerOpen} date={selectedDate} onClose={() => setPickerOpen(false)} onPick={pickMeal} />

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
  page: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  // Type scale: page title 28 > section title 19 > card title 15.
  pageTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  registerButton: {
    marginTop: 12,
    height: 56,
    borderRadius: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...Platform.select({
      web: { boxShadow: '0px 6px 14px #FF6A1347' },
      default: { shadowColor: '#FF6A13', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
    }),
  },
  registerPlus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  registerLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  calorieCard: {
    padding: CARD_PADDING,
    paddingBottom: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  statusPill: {
    marginLeft: 'auto',
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  bigNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 10,
  },
  bigNumber: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  bigNumberSuffix: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  statusText: {
    flexShrink: 1,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '700',
  },
  calorieBar: {
    marginTop: 11,
  },
  macroHeading: {
    marginTop: 16,
  },
  ringsRow: {
    flexDirection: 'row',
    marginTop: 12,
    marginHorizontal: -CARD_PADDING,
  },
  ringCol: {
    flex: 1,
    alignItems: 'center',
  },
  ringValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  ringLabel: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  ringTarget: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  mealsHeader: {
    marginTop: 20,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  mealsList: {
    gap: 12,
  },
  mealCard: {
    paddingHorizontal: CARD_PADDING,
    paddingTop: 20,
    paddingBottom: 12,
  },
  mealHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  mealIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  mealName: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  mealTime: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '500',
  },
  mealTotalsCol: {
    alignItems: 'flex-end',
  },
  mealKcal: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  mealMacros: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginTop: 12,
    marginBottom: 6,
    opacity: 0.6,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 5,
  },
  foodLeft: {
    flex: 1,
    minWidth: 0,
  },
  foodName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  foodGrams: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  foodRight: {
    alignItems: 'flex-end',
  },
  foodKcal: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  addFoodButton: {
    marginTop: 8,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFoodText: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '700',
  },
  followRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
  },
});
