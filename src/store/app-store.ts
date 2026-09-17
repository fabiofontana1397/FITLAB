import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { appJsonStorage } from '@/store/storage';

export type AppearanceMode = 'system' | 'light' | 'dark';

type AppState = {
  hasOnboarded: boolean;
  appearance: AppearanceMode;
  completeOnboarding: () => void;
  setHasOnboarded: (value: boolean) => void;
  setAppearance: (mode: AppearanceMode) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      hasOnboarded: false,
      appearance: 'system',
      completeOnboarding: () => set({ hasOnboarded: true }),
      setHasOnboarded: (value) => set({ hasOnboarded: value }),
      setAppearance: (mode) => set({ appearance: mode }),
    }),
    { name: 'fitlab/app', storage: appJsonStorage }
  )
);
