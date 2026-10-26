import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearTransition } from 'react-native-reanimated';

import { FoodSearchModal } from '@/components/nutrition/food-search-modal';
import { MealCard } from '@/components/nutrition/meal-card';
import { mealSlotColor } from '@/components/nutrition/meal-picker-modal';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { DayCalendarModal } from '@/components/ui/day-calendar-modal';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { IosSwitch } from '@/components/ui/ios-switch';
import { TabHeader } from '@/components/tab-header';
import { ProgressRing } from '@/components/ui/progress-ring';
import { TickProgressBar } from '@/components/ui/tick-progress-bar';
import { useEnsurePlan } from '@/hooks/use-ensure-plan';
import { Layout, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
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
import { hapticSelection, hapticToggle } from '@/lib/haptics';

const SCREEN_PADDING = Layout.screenGutter;
const CARD_RADIUS = Radius.large;
const CARD_PADDING = 14;
// Opening a meal grows its card (and slides the ones below) instead of snapping.
const MEAL_CARD_TRANSITION = LinearTransition.springify().damping(24).stiffness(220).mass(0.9);

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
  const removeEntry = useNutritionStore((s) => s.removeEntry);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const [activeSlot, setActiveSlot] = useState<MealSlot | null>(null);
  const [editingEntry, setEditingEntry] = useState<MealFoodEntry | null>(null);
  const today = daysAgoISO(0);
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Every meal opens showing its foods; tapping a meal's header folds it.
  const [foldedSlots, setFoldedSlots] = useState<MealSlot[]>([]);

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
    <ScreenScroll reveal header={<TabHeader title="Nutrizione" onCalendarPress={() => setCalendarOpen(true)} />} contentContainerStyle={styles.page}>
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

      <View style={styles.mealsHeader}>
        <ThemedText style={styles.sectionTitle}>{mealsHeading}</ThemedText>
      </View>

      {planDayForSelectedDate ? (
        <View style={[styles.followRow, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
          <ThemedText style={styles.followText}>
            {selectedDate === today ? 'Inserisci la dieta di oggi nei pasti' : 'Inserisci la dieta di questo giorno nei pasti'}
          </ThemedText>
          <IosSwitch
            value={isFollowingPlan}
            onValueChange={(on) => {
              hapticToggle(on);
              if (on) seedDayFromPlan(selectedDate, planDayForSelectedDate.meals);
              else unseedDay(selectedDate);
            }}
          />
        </View>
      ) : null}

      <View style={styles.mealsList}>
        {mealSlots.map((meta) => {
          const slotEntries = entriesForSlot(entries, meta.id, selectedDate);
          return (
            <MealCard
              key={meta.id}
              label={meta.label}
              time={meta.time}
              icon={meta.icon}
              color={mealSlotColor(theme, meta.id)}
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
                hapticToggle(false);
                removeEntry(entry.id);
              }}
              onAddFood={() => {
                setEditingEntry(null);
                setActiveSlot(meta.id);
              }}
              layout={MEAL_CARD_TRANSITION}
            />
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
    fontSize: 13,
    lineHeight: 17,
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
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  mealsList: {
    gap: 12,
  },
  followRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  followText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
});
