import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { appJsonStorage } from '@/store/storage';

type FavoriteFoodsState = {
  /** Food ids the person starred, the most recently starred first. */
  ids: string[];
  toggle: (foodId: string) => void;
};

/**
 * The foods starred in "Aggiungi alimento" (the "Preferiti" list). Kept on the
 * device only, like the other lightweight preferences (it is not synced).
 */
export const useFavoriteFoodsStore = create<FavoriteFoodsState>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (foodId) => set((state) => ({ ids: state.ids.includes(foodId) ? state.ids.filter((id) => id !== foodId) : [foodId, ...state.ids] })),
    }),
    { name: 'fitlab/favorite-foods', storage: appJsonStorage }
  )
);
