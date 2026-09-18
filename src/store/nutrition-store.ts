import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { deleteMealEntry, fetchMealEntries, fetchSeededDates, insertMealEntries, insertMealEntry, insertSeededDate, updateMealEntry } from '@/lib/api/nutrition';
import type { IconName } from '@/components/ui/icon';
import { addDaysISO, daysAgoISO } from '@/lib/mock/dates';
import { findFood } from '@/lib/mock/food-database';
import type { UserProfile } from '@/lib/mock/types';
import { sharePctFor } from '@/lib/nutrition/meal-distribution';
import { withAuthRetry } from '@/lib/supabase/retry';
import { useAuthStore } from '@/store/auth-store';
import { appJsonStorage } from '@/store/storage';

export type MealSlot =
  | 'colazione'
  | 'spuntinoMattina'
  | 'pranzo'
  | 'spuntinoPomeriggio'
  | 'cena'
  | 'spuntinoSera';

const ALL_SLOT_IDS: MealSlot[] = ['colazione', 'spuntinoMattina', 'pranzo', 'spuntinoPomeriggio', 'cena', 'spuntinoSera'];

// sharePct here is derived from the same MEAL_WEIGHTS meal-slots.ts uses to
// build the generated plan (lib/nutrition/meal-distribution.ts) — this UI
// always shows all 6 fixed slots (unlike the generated plan, which only
// includes the slots a user's questionnaire answers call for), so it
// normalizes against the full 6-slot set rather than a per-user subset.
export const MEAL_SLOTS: { id: MealSlot; label: string; time: string; sharePct: number; icon: IconName }[] = [
  { id: 'colazione', label: 'Colazione', time: '07:30', sharePct: sharePctFor('colazione', ALL_SLOT_IDS), icon: 'mealSun' },
  { id: 'spuntinoMattina', label: 'Spuntino mattina', time: '10:30', sharePct: sharePctFor('spuntinoMattina', ALL_SLOT_IDS), icon: 'mealSnack' },
  { id: 'pranzo', label: 'Pranzo', time: '13:15', sharePct: sharePctFor('pranzo', ALL_SLOT_IDS), icon: 'mealMidday' },
  { id: 'spuntinoPomeriggio', label: 'Spuntino pomeriggio', time: '17:00', sharePct: sharePctFor('spuntinoPomeriggio', ALL_SLOT_IDS), icon: 'mealSnack' },
  { id: 'cena', label: 'Cena', time: '20:00', sharePct: sharePctFor('cena', ALL_SLOT_IDS), icon: 'mealMoon' },
  { id: 'spuntinoSera', label: 'Spuntino sera', time: '22:00', sharePct: sharePctFor('spuntinoSera', ALL_SLOT_IDS), icon: 'mealSnack' },
];

export type MealFoodEntry = {
  id: string;
  date: string;
  slot: MealSlot;
  foodId: string;
  grams: number;
};

export type Macros = { kcal: number; protein: number; carbs: number; fats: number };

type NutritionState = {
  entries: MealFoodEntry[];
  /** Dates already pre-filled from the diet plan (see seedDayFromPlan) — kept
   * so a day the user has since emptied out on purpose never gets re-filled. */
  seededDates: string[];
  addEntry: (slot: MealSlot, foodId: string, grams: number, date?: string) => void;
  updateEntry: (id: string, foodId: string, grams: number) => void;
  removeEntry: (id: string) => void;
  seedDayFromPlan: (date: string, dayMeals: { slotId: string; items: { foodId: string; grams: number }[] }[]) => void;
  syncFromServer: () => Promise<void>;
  /** Local-only reset on logout — see user-store.ts's clearLocal for why. */
  clearLocal: () => void;
};

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set, get) => ({
      entries: [],
      seededDates: [],
      addEntry: (slot, foodId, grams, date = daysAgoISO(0)) => {
        const entry: MealFoodEntry = { id: `${foodId}-${Date.now()}`, date, slot, foodId, grams };
        set((state) => ({ entries: [...state.entries, entry] }));
        const userId = currentUserId();
        if (userId) insertMealEntry(userId, entry).catch((err) => console.warn('insertMealEntry failed', err));
      },
      updateEntry: (id, foodId, grams) => {
        set((state) => ({ entries: state.entries.map((e) => (e.id === id ? { ...e, foodId, grams } : e)) }));
        const userId = currentUserId();
        if (userId) updateMealEntry(userId, id, foodId, grams).catch((err) => console.warn('updateMealEntry failed', err));
      },
      removeEntry: (id) => {
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
        const userId = currentUserId();
        if (userId) deleteMealEntry(userId, id).catch((err) => console.warn('deleteMealEntry failed', err));
      },
      seedDayFromPlan: (date, dayMeals) => {
        if (get().seededDates.includes(date)) return;
        const newEntries: MealFoodEntry[] = dayMeals.flatMap((meal) =>
          meal.items.map((item, i) => ({
            id: `plan-${date}-${meal.slotId}-${i}`,
            date,
            slot: meal.slotId as MealSlot,
            foodId: item.foodId,
            grams: item.grams,
          }))
        );
        set((state) => ({ entries: [...state.entries, ...newEntries], seededDates: [...state.seededDates, date] }));
        const userId = currentUserId();
        if (userId) {
          insertMealEntries(userId, newEntries).catch((err) => console.warn('insertMealEntries failed', err));
          insertSeededDate(userId, date).catch((err) => console.warn('insertSeededDate failed', err));
        }
      },
      syncFromServer: async () => {
        const userId = currentUserId();
        if (!userId) return;
        try {
          const [entries, seededDates] = await Promise.all([
            withAuthRetry(() => fetchMealEntries(userId)),
            withAuthRetry(() => fetchSeededDates(userId)),
          ]);
          // Server is canonical once it has any data; a brand-new account
          // with zero rows keeps the local state instead of wiping it.
          if (entries.length > 0 || seededDates.length > 0) {
            set({ entries, seededDates });
          }
        } catch (err) {
          console.warn('nutrition-store syncFromServer failed', err);
        }
      },
      clearLocal: () => set({ entries: [], seededDates: [] }),
    }),
    { name: 'fitlab/nutrition', storage: appJsonStorage }
  )
);

export function macrosForEntry(entry: MealFoodEntry): Macros {
  const food = findFood(entry.foodId);
  if (!food) return { kcal: 0, protein: 0, carbs: 0, fats: 0 };
  const ratio = entry.grams / 100;
  return {
    kcal: food.kcal100 * ratio,
    protein: food.protein100 * ratio,
    carbs: food.carbs100 * ratio,
    fats: food.fats100 * ratio,
  };
}

export function sumMacros(entries: MealFoodEntry[]): Macros {
  return entries.reduce(
    (acc, entry) => {
      const m = macrosForEntry(entry);
      return { kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fats: acc.fats + m.fats };
    },
    { kcal: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

export function entriesForSlot(entries: MealFoodEntry[], slot: MealSlot, date: string): MealFoodEntry[] {
  return entries.filter((e) => e.slot === slot && e.date === date);
}

export function targetsForSlot(slot: MealSlot, profile: Pick<UserProfile, 'dailyCalorieTarget' | 'macroTargetsG'>): Macros {
  const meta = MEAL_SLOTS.find((s) => s.id === slot)!;
  return {
    kcal: profile.dailyCalorieTarget * meta.sharePct,
    protein: profile.macroTargetsG.protein * meta.sharePct,
    carbs: profile.macroTargetsG.carbs * meta.sharePct,
    fats: profile.macroTargetsG.fats * meta.sharePct,
  };
}

export function hasEntriesOnDate(entries: MealFoodEntry[], date: string): boolean {
  return entries.some((e) => e.date === date);
}

export type LoggingStreakInfo = { streak: number; gapDays: number };

/** Consecutive days (up to and including `referenceISO`) with at least one logged food.
 * If today itself has nothing logged yet, reports how many days since the last logged day instead. */
export function loggingStreakInfo(entries: MealFoodEntry[], referenceISO: string = daysAgoISO(0)): LoggingStreakInfo {
  const loggedDates = new Set(entries.map((e) => e.date));

  let streak = 0;
  let cursor = referenceISO;
  while (loggedDates.has(cursor)) {
    streak++;
    cursor = addDaysISO(cursor, -1);
  }

  if (streak > 0) return { streak, gapDays: 0 };

  for (let i = 1; i <= 30; i++) {
    if (loggedDates.has(addDaysISO(referenceISO, -i))) {
      return { streak: 0, gapDays: i };
    }
  }
  return { streak: 0, gapDays: 30 };
}
