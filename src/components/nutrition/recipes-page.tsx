import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { RecipeDeck } from '@/components/nutrition/recipe-deck';
import { ScreenScroll } from '@/components/screen-scroll';
import { TabHeader } from '@/components/tab-header';
import { Layout } from '@/constants/theme';
import { useEnsurePlan } from '@/hooks/use-ensure-plan';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
import { SLOT_KIND, type SlotKind } from '@/lib/planning/fitlab/catalog';
import { cachedRecipeBook, type RecipeCard } from '@/lib/planning/fitlab/recipe-book';
import { inMealOrder } from '@/lib/planning/meal-slots';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { MEAL_SLOTS, useNutritionStore, type MealSlot } from '@/store/nutrition-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';

/**
 * PARKED — not mounted anywhere for now.
 *
 * Ricette: the FitLab recipe pool as a swipeable deck (Tinder-style cards, full recipe in a sheet, "add to tracking").
 * It used to sit behind a Tracking calorie / Ricette switch at the top of Nutrizione; the switch was removed and the
 * page kept here, whole, for a future return. To bring it back, mount `<RecipesPage />` (e.g. again with ModePages
 * and a ModeSwitch in the header, as Nutrizione did before).
 */

/** The meal of the person's day a recipe of each kind goes to: the plan's own meals when there is a plan. */
const DEFAULT_SLOT: Record<SlotKind, MealSlot> = { breakfast: 'colazione', lunch: 'pranzo', dinner: 'cena', snack: 'spuntinoPomeriggio' };

/** Today's targets the recipes are sized on, and what Ricette needs around them. */
function useRecipeTargets() {
  const currentUser = useUserStore();
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const answers = useOnboardingStore((s) => s.answers);
  const today = daysAgoISO(0);
  const month = dietPlan?.months.find((m) => m.monthIndex === (dietPlan ? currentMonthIndex(dietPlan) : 1));
  const planDay = month?.weeklySplit[isoMondayIndex(today)];
  const ownKcal = planDay?.calorieTarget ?? month?.calorieTarget ?? currentUser.dailyCalorieTarget;
  const ownMacros = planDay?.macroTargetsG ?? month?.macroTargetsG ?? currentUser.macroTargetsG;
  // No targets yet (questionnaire not done): the recipes are shown in a standard 2000 kcal portion.
  const personal = ownKcal >= 1000 && ownMacros.protein > 0;
  const kcal = personal ? ownKcal : 2000;
  const macros = personal ? ownMacros : { protein: 120, carbs: 240, fats: 62 };
  const daily = useMemo(() => ({ kcal, protein: macros.protein, carbs: macros.carbs, fats: macros.fats }), [kcal, macros.protein, macros.carbs, macros.fats]);
  return { answers, planDay, personal, daily, today };
}

export function RecipesPage({ header }: { header?: React.ReactNode }) {
  // The page does not scroll: the selector under the card must end above the floating tab bar.
  const tabClearance = useTabBarClearance();
  const [viewport, setViewport] = useState(0);
  const addEntry = useNutritionStore((s) => s.addEntry);
  const { answers, planDay, personal, daily, today } = useRecipeTargets();

  useEnsurePlan('diet');

  // Every recipe sized on today's targets (the same solver as the plan), rebuilt only when they change.
  const cards = useMemo(() => cachedRecipeBook(answers, daily), [answers, daily]);

  const slotFor = (kind: SlotKind): { id: MealSlot; label: string } => {
    const fromPlan = planDay ? inMealOrder(planDay.meals).find((m) => SLOT_KIND[m.slotId as MealSlot] === kind) : undefined;
    if (fromPlan) return { id: fromPlan.slotId as MealSlot, label: fromPlan.label };
    const meta = MEAL_SLOTS.find((m) => m.id === DEFAULT_SLOT[kind])!;
    return { id: meta.id, label: kind === 'snack' ? 'Merenda' : meta.label };
  };

  const add = (card: RecipeCard) => {
    const slot = slotFor(card.kind).id;
    for (const item of card.items) addEntry(slot, item.foodId, item.grams, today);
  };

  return (
    <ScreenScroll
      header={header ?? <TabHeader title="Ricette" />}
      scrollEnabled={false}
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        // Hidden behind a switch the page measures 0: keep the last real height.
        if (h > 0) setViewport((v) => (v === h ? v : h));
      }}
      // An explicit height (the visible area under the header), not `flex: 1`: inside a scroll view Safari does
      // not always resolve a flex height, and the deck then grew past the screen, its selector under the tab bar.
      contentContainerStyle={[styles.page, viewport ? { height: viewport, flexGrow: 0 } : styles.fill, { paddingBottom: tabClearance }]}>
      <RecipeDeck cards={cards} portionLabel={personal ? 'Porzione per te' : 'Porzione standard'} slotLabelFor={(kind) => slotFor(kind).label} onAdd={add} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: Layout.screenGutter,
  },
  // Ricette fits on one screen: the deck takes the height left between the header and the tab bar.
  fill: {
    flex: 1,
  },
});
