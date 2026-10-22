import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { appJsonStorage } from '@/store/storage';

export type AppearanceMode = 'system' | 'light' | 'dark';

type AppState = {
  hasOnboarded: boolean;
  /** True while the user deliberately redoes the questionnaire from Profile. The profile
   * on the server still has a calorie target, so without this flag the sync would read
   * it as "onboarding done" and bounce them straight back out. */
  redoingQuestionnaire: boolean;
  appearance: AppearanceMode;
  startQuestionnaireRedo: () => void;
  completeOnboarding: () => void;
  setHasOnboarded: (value: boolean) => void;
  setAppearance: (mode: AppearanceMode) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      hasOnboarded: false,
      redoingQuestionnaire: false,
      appearance: 'system',
      startQuestionnaireRedo: () => set({ hasOnboarded: false, redoingQuestionnaire: true }),
      completeOnboarding: () => set({ hasOnboarded: true, redoingQuestionnaire: false }),
      setHasOnboarded: (value) => set({ hasOnboarded: value }),
      setAppearance: (mode) => set({ appearance: mode }),
    }),
    { name: 'fitlab/app', storage: appJsonStorage }
  )
);
