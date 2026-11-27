import { setStatusBarStyle } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { openPopup } from '@/lib/open-popup';
import { FoodSearchModal } from '@/components/nutrition/food-search-modal';
import { MealCard } from '@/components/nutrition/meal-card';
import { HEADER_LIST_TOP, ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { Icon } from '@/components/ui/icon';
import { TabHeader } from '@/components/tab-header';
import { ProgressRing } from '@/components/ui/progress-ring';
import { TickProgressBar } from '@/components/ui/tick-progress-bar';
import { useEnsurePlan } from '@/hooks/use-ensure-plan';
import { Colors, Layout } from '@/constants/theme';
import { ColorSchemeOverride } from '@/hooks/color-scheme-override';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useIsSelectedTab } from '@/hooks/use-is-selected-tab';
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
/** The hero's black: deep black on the light page, a lifted near-black on the black page so it still reads as a box. */
const HERO_LIGHT = '#111214';
const HERO_DARK = '#1A1B1F';
const HERO_PADDING_TOP = 6;

/** Italian thousands-separated magnitude ("2.254"), hand-rolled for the
 * same reason as Home's: toLocaleString('it-IT') doesn't reliably group on
 * Hermes / minimal-ICU web builds. */
function formatKcal(n: number): string {
  return Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Nutrizione: the day's calorie tracking. The FitLab recipe book (Ricette) is parked for now in
 * `components/nutrition/recipes-page.tsx`: kept in the repo, not mounted. */
export default function NutritionScreen() {
  return <CalorieTracking />;
}

function CalorieTracking() {
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
    interpolate(scrollOffset.value, [ringsTop.value - 30, ringsTop.value + 40], [0, 1], 'clamp')
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

  // The meals the person actually has (from the plan); a user without a menu (no plan, or only their own calorie and
  // macro targets) sees the six generic slots.
  const mealSlots = planDayForSelectedDate && planDayForSelectedDate.meals.length > 0
    ? inMealOrder(planDayForSelectedDate.meals).map((m) => {
        const meta = MEAL_SLOTS.find((x) => x.id === m.slotId);
        return { id: m.slotId as MealSlot, label: m.label, icon: meta?.icon ?? ('mealSnack' as const) };
      })
    : MEAL_SLOTS;

  const mealsHeading =
    selectedDate === today
      ? 'Pasti di oggi'
      : `Pasti del ${new Date(selectedDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;


  const dayEntries = entries.filter((e) => e.date === selectedDate);
  const totals = sumMacros(dayEntries);
  const calorieRatio = calorieTarget > 0 ? totals.kcal / calorieTarget : 0;

  // Macro colours from the dark palette: they sit on the black hero in both schemes.
  const macroRings = [
    { key: 'protein' as const, label: 'P', color: Colors.dark.accent, target: macroTargets.protein },
    { key: 'carbs' as const, label: 'C', color: Colors.dark.brandGreen, target: macroTargets.carbs },
    { key: 'fats' as const, label: 'G', color: Colors.dark.brandYellow, target: macroTargets.fats },
  ];
  const heroColor = useColorScheme() === 'dark' ? HERO_DARK : HERO_LIGHT;
  useHeroStatusBar();

  return (
    <ScreenScroll
      reveal
      header={
        <ColorSchemeOverride.Provider value="dark">
          <TabHeader title="Nutrizione" onCalendarPress={() => openPopup(() => setCalendarOpen(true))} />
        </ColorSchemeOverride.Provider>
      }
      topSurface={heroColor}
      pinned={
        <ColorSchemeOverride.Provider value="dark">
          <PinnedMacroRings rings={macroRings} totals={totals} calorieTarget={calorieTarget} />
        </ColorSchemeOverride.Provider>
      }
      pinnedProgress={pinnedProgress}
      scrollOffset={scrollOffset}
      contentContainerStyle={styles.page}>
      {/* The day's calories and macros on a full-width black hero that runs up under the header to the top edge. */}
      <ColorSchemeOverride.Provider value="dark">
        <View style={[styles.hero, { backgroundColor: heroColor }]}>
          {/* Pulling the page down past the top keeps the black behind the hero, never a light gap. */}
          <View style={[styles.heroOverscroll, { backgroundColor: heroColor }]} />
          <CalorieHero
            scrollOffset={scrollOffset}
            title={selectedDate === today ? 'Calorie di oggi' : 'Calorie del giorno'}
            totals={totals}
            calorieTarget={calorieTarget}
            calorieRatio={calorieRatio}
            rings={macroRings}
            onRingsLayout={(y) => ringsTop.set(HERO_PADDING_TOP + y)}
          />
        </View>
      </ColorSchemeOverride.Provider>

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
    <View style={styles.pinnedCard}>
      <View style={styles.pinnedKcalRow}>
        <ThemedText style={styles.pinnedKcal}>
          {formatKcal(totals.kcal)}
          <ThemedText style={styles.pinnedKcalTarget} themeColor="textTertiary">
            {' '}/ {formatKcal(calorieTarget)} kcal
          </ThemedText>
        </ThemedText>
        <View style={styles.pinnedKcalBar}>
          <TickProgressBar progress={calorieTarget > 0 ? totals.kcal / calorieTarget : 0} height={7} ticks={false} color={theme.brandGreen} />
        </View>
      </View>
      <View style={styles.pinnedRingsRow}>
        {rings.map((macro) => (
          <View key={macro.key} style={styles.pinnedRingCol}>
            <ProgressRing
              size={46}
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
    </View>
  );
}

/** While Nutrizione is the open tab the status bar is drawn in white, over the black header, in both schemes. */
function useHeroStatusBar() {
  const focused = useIsSelectedTab();
  const scheme = useColorScheme();
  useEffect(() => {
    if (!focused) return;
    setStatusBarStyle('light', true);
    return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark', true);
  }, [focused, scheme]);
}

/**
 * The hero's content, drawn with the dark palette: the day's calories large on the left with the goal beside them,
 * the green bar, and the three macro rings.
 */
function CalorieHero({
  title,
  totals,
  calorieTarget,
  calorieRatio,
  rings,
  onRingsLayout,
  scrollOffset,
}: {
  scrollOffset: SharedValue<number>;
  title: string;
  totals: Record<MacroRing['key'] | 'kcal', number>;
  calorieTarget: number;
  calorieRatio: number;
  rings: MacroRing[];
  onRingsLayout: (y: number) => void;
}) {
  const theme = useTheme();
  // As the page scrolls the content drifts down a little slower than the hero and dims, so it sinks under the
  // header softly instead of being cut by it; pulled past the top it stays put.
  const [height, setHeight] = useState(260);
  const parallaxStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollOffset.value);
    return {
      opacity: interpolate(y, [0, height * 0.75], [1, 0], 'clamp'),
      transform: [{ translateY: y * 0.22 }, { scale: interpolate(y, [0, height], [1, 0.97], 'clamp') }],
    };
  });
  return (
    <Animated.View style={parallaxStyle} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <View style={styles.heroHead}>
        <View style={styles.cardTitleRow}>
          <Icon name="flameLine" size={20} color={theme.textSecondary} strokeWidth={1.5} />
          <ThemedText style={styles.heroLabel} themeColor="textSecondary">
            {title}
          </ThemedText>
        </View>
      </View>

      <View style={styles.bigNumberRow}>
        <ThemedText style={styles.bigNumber}>{formatKcal(totals.kcal)}</ThemedText>
        <ThemedText style={styles.bigNumberSuffix} themeColor="textSecondary">
          / {formatKcal(calorieTarget)} kcal
        </ThemedText>
      </View>

      <View style={styles.calorieBar}>
        <TickProgressBar progress={calorieRatio} height={8} ticks={false} color={theme.brandGreen} />
      </View>

      <View style={styles.ringsRow} onLayout={(e) => onRingsLayout(e.nativeEvent.layout.y)}>
        {rings.map((macro) => (
          <View key={macro.key} style={styles.ringCol}>
            <ProgressRing
              size={66}
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
    </Animated.View>
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
  // Full width: it steps out of the page gutter and up to meet the header, which shares its colour.
  hero: {
    marginHorizontal: -SCREEN_PADDING,
    marginTop: -HEADER_LIST_TOP,
    paddingHorizontal: SCREEN_PADDING + 4,
    paddingTop: HERO_PADDING_TOP,
    paddingBottom: 22,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    borderCurve: 'continuous',
  },
  heroOverscroll: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -800,
    height: 800,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bigNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 6,
  },
  bigNumber: {
    fontSize: 56,
    lineHeight: 62,
    fontWeight: '800',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  bigNumberSuffix: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  calorieBar: {
    marginTop: 12,
  },
  ringsRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  ringCol: {
    flex: 1,
    alignItems: 'center',
  },
  ringValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  ringLabel: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
  },
  ringTarget: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  pinnedCard: {
    paddingHorizontal: 4,
    gap: 8,
  },
  pinnedKcalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pinnedKcal: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  pinnedKcalTarget: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
  },
  pinnedKcalBar: {
    flex: 1,
  },
  pinnedRingsRow: {
    flexDirection: 'row',
  },
  pinnedRingCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pinnedRingValue: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  pinnedRingLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
  },
  mealsHeader: {
    marginTop: 18,
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
