import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { registerExternalFoods, type FoodItem } from '@/lib/mock/food-database';
import { appJsonStorage } from '@/store/storage';

/** The FatSecret foods this device has met (searched, scanned or logged), kept so findFood() resolves them offline and synchronously. */
type State = {
  foods: Record<string, FoodItem>;
  remember: (foods: FoodItem[]) => void;
};

export const useExternalFoodsStore = create<State>()(
  persist(
    (set) => ({
      foods: {},
      remember: (foods) => {
        registerExternalFoods(foods);
        set((s) => {
          const next = { ...s.foods };
          for (const f of foods) next[f.id] = f;
          return { foods: next };
        });
      },
    }),
    {
      name: 'fitlab/external-foods',
      storage: appJsonStorage,
      onRehydrateStorage: () => (state) => {
        if (state) registerExternalFoods(Object.values(state.foods));
      },
    }
  )
);
