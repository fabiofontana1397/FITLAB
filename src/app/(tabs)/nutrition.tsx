import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { interpolate, useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { openPopup } from '@/lib/open-popup';
import { FoodSearchModal } from '@/components/nutrition/food-search-modal';
import { MealCard } from '@/components/nutrition/meal-card';
import { HEADER_LIST_TOP, ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { TabHeader } from '@/components/tab-header';
import { ProgressRing } from '@/components/ui/progress-ring';
import { TickProgressBar } from '@/components/ui/tick-progress-bar';
import { useEnsurePlan } from '@/hooks/use-ensure-plan';
import { Layout, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
import { inMealOrder } from '@/lib/planning/meal-slots';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import {
  entriesForSlot,
  MEAL_SLOTS,
  sumMacros,
  useNutritionStore,
  type MealFoodEntry,
  type MealSlot,
} from '@/store/nutrition-store';
import { usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';
import { hapticSelection } from '@/lib/haptics';

const SCREEN_PADDING = Layout.screenGutter;
const CARD_RADIUS = Radius.large;
const CARD_PADDING = 14;

/** Italian thousands-separated magnitude ("2.254"), hand-rolled for the
 * same reason as Home's: toLocaleString('it-IT') doesn't reliably group on
 * Hermes / minimal-ICU web builds. */
function formatKcal(n: number): string {
  return Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export default function NutritionScreen() {
  const theme = useTheme();
  const currentUser = useUserStore();
  const entries = useNutritionStore((s) => s.entries);
  const removeEntry = useNutritionStore((s) => s.removeEntry);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const [activeSlot, setActiveSlot] = useState<MealSlot | null>(null);
  const [editingEntry, setEditingEntry] = useState<MealFoodEntry | null>(null);
  const today = daysAgoISO(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Every meal opens showing its foods; tapping a meal's header folds it.
  const [foldedSlots, setFoldedSlots] = useState<MealSlot[]>([]);

  // Scrolling down, the macro rings stay pinned under the header (compact); back at the top the full card,
  // calories included, is the only one showing again. The compact copy comes in just as the card's rings
  // reach the header, so they read as staying put.
  const scrollOffset = useSharedValue(0);
  const ringsTop = useSharedValue(1e9);
  const pinnedProgress = useDerivedValue(() =>
    interpolate(scrollOffset.value, [ringsTop.value - 8, ringsTop.value + 20], [0, 1], 'clamp')
  );

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
    ? inMealOrder(planDayForSelectedDate.meals).map((m) => {
        const meta = MEAL_SLOTS.find((x) => x.id === m.slotId);
        return { id: m.slotId as MealSlot, label: m.label, time: m.time, icon: meta?.icon ?? ('mealSnack' as const) };
      })
    : MEAL_SLOTS;

  const mealsHeading =
    selectedDate === today
      ? 'Pasti di oggi'
      : `Pasti del ${new Date(selectedDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;


  const dayEntries = entries.filter((e) => e.date === selectedDate);
  const totals = sumMacros(dayEntries);
  const calorieRatio = calorieTarget > 0 ? totals.kcal / calorieTarget : 0;

  const macroRings = [
    { key: 'protein' as const, label: 'Proteine', color: theme.accent, target: macroTargets.protein },
    { key: 'carbs' as const, label: 'Carboidrati', color: theme.brandGreen, target: macroTargets.carbs },
    { key: 'fats' as const, label: 'Grassi', color: theme.brandYellow, target: macroTargets.fats },
  ];

  return (
    <ScreenScroll
      reveal
      header={<TabHeader title="Nutrizione" onCalendarPress={() => openPopup(() => setCalendarOpen(true))} />}
      pinned={<PinnedMacroRings rings={macroRings} totals={totals} calorieTarget={calorieTarget} />}
      pinnedProgress={pinnedProgress}
      scrollOffset={scrollOffset}
      contentContainerStyle={styles.page}>
      <FlatCard radius={CARD_RADIUS} style={styles.calorieCard}>
        <View style={styles.calorieHeadRow}>
          <View style={styles.cardTitleRow}>
            <Icon name="flame" size={18} color={theme.accent} />
            <ThemedText style={styles.calorieTitle}>{selectedDate === today ? 'Calorie di oggi' : 'Calorie del giorno'}</ThemedText>
          </View>
          <View style={styles.bigNumberRow}>
            <ThemedText style={styles.bigNumber}>{formatKcal(totals.kcal)}</ThemedText>
            <ThemedText style={styles.bigNumberSuffix} themeColor="textTertiary">
              / {formatKcal(calorieTarget)} kcal
            </ThemedText>
          </View>
        </View>

        <View style={styles.calorieBar}>
          <TickProgressBar progress={calorieRatio} height={8} ticks={false} />
        </View>

        <View
          style={styles.ringsRow}
          onLayout={(e) => {
            // The card is the page's first section: its top sits at the list's top padding (+ its 1px border).
            ringsTop.set(HEADER_LIST_TOP + 1 + e.nativeEvent.layout.y);
          }}>
          {macroRings.map((macro) => (
            <View key={macro.key} style={styles.ringCol}>
              <ProgressRing
                size={58}
                strokeWidth={5}
                progress={macro.target > 0 ? totals[macro.key] / macro.target : 0}
                color={macro.color}
                trackColor={theme.backgroundElement}>
                <ThemedText style={styles.ringValue}>{Math.round(totals[macro.key])} g</ThemedText>
              </ProgressRing>
              <ThemedText style={styles.ringLabel}>
                {macro.label}{' '}
                <ThemedText style={styles.ringTarget} themeColor="textSecondary">
                  / {Math.round(macro.target)} g
                </ThemedText>
              </ThemedText>
            </View>
          ))}
        </View>
      </FlatCard>

      <View style={styles.mealsHeader}>
        <ThemedText style={styles.sectionTitle}>{mealsHeading}</ThemedText>
      </View>

      <View style={styles.mealsList}>
        {mealSlots.map((meta) => {
          const slotEntries = entriesForSlot(entries, meta.id, selectedDate);
          return (
            <MealCard
              key={meta.id}
              label={meta.label}
              time={meta.time}
              icon={meta.icon}
              entries={slotEntries}
              totals={sumMacros(slotEntries)}
              expanded={!foldedSlots.includes(meta.id)}
              onToggle={() => {
                hapticSelection();
                setFoldedSlots((folded) => (folded.includes(meta.id) ? folded.filter((id) => id !== meta.id) : [...folded, meta.id]));
              }}
              onEditEntry={(entry) => {
                setEditingEntry(entry);
                setActiveSlot(meta.id);
              }}
              onDeleteEntry={(entry) => {
                removeEntry(entry.id);
              }}
              onAddFood={() => {
                setEditingEntry(null);
                setActiveSlot(meta.id);
              }}
            />
          );
        })}
      </View>

      <DayCalendarModal
        visible={calendarOpen}
        selectedDate={selectedDate}
        showGoalStatus
        onSelectDate={setSelectedDate}
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

type MacroRing = { key: 'protein' | 'carbs' | 'fats'; label: string; color: string; target: number };

/** The three macro rings in a compact strip, pinned under the header while the full card is scrolled away. */
function PinnedMacroRings({
  rings,
  totals,
  calorieTarget,
}: {
  rings: MacroRing[];
  totals: Record<MacroRing['key'] | 'kcal', number>;
  calorieTarget: number;
}) {
  const theme = useTheme();
  return (
    <FlatCard radius={CARD_RADIUS} style={styles.pinnedCard}>
      <View style={styles.pinnedKcalRow}>
        <ThemedText style={styles.pinnedKcal}>
          {formatKcal(totals.kcal)}
          <ThemedText style={styles.pinnedKcalTarget} themeColor="textTertiary">
            {' '}/ {formatKcal(calorieTarget)} kcal
          </ThemedText>
        </ThemedText>
        <View style={styles.pinnedKcalBar}>
          <TickProgressBar progress={calorieTarget > 0 ? totals.kcal / calorieTarget : 0} height={6} ticks={false} />
        </View>
      </View>
      <View style={styles.pinnedRingsRow}>
        {rings.map((macro) => (
          <View key={macro.key} style={styles.pinnedRingCol}>
            <ProgressRing
              size={40}
              strokeWidth={4}
              progress={macro.target > 0 ? totals[macro.key] / macro.target : 0}
              color={macro.color}
              trackColor={theme.backgroundElement}>
              <ThemedText style={styles.pinnedRingValue}>{Math.round(totals[macro.key])}</ThemedText>
            </ProgressRing>
            <ThemedText style={styles.pinnedRingLabel}>{macro.label}</ThemedText>
          </View>
        ))}
      </View>
    </FlatCard>
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
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  calorieCard: {
    paddingHorizontal: CARD_PADDING,
    paddingTop: 12,
    paddingBottom: 10,
  },
  calorieHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calorieTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  bigNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  bigNumber: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  bigNumberSuffix: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  calorieBar: {
    marginTop: 8,
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
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  ringLabel: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  ringTarget: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  pinnedCard: {
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 8,
    gap: 6,
  },
  pinnedKcalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pinnedKcal: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  pinnedKcalTarget: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  pinnedKcalBar: {
    flex: 1,
  },
  pinnedRingsRow: {
    flexDirection: 'row',
    marginHorizontal: -CARD_PADDING,
  },
  pinnedRingCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pinnedRingValue: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  pinnedRingLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  mealsHeader: {
    marginTop: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  mealsList: {
    gap: 10,
  },
});
