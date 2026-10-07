import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { deleteOnboardingAnswers, fetchOnboardingAnswers, upsertOnboardingAnswers } from '@/lib/api/onboarding';
import { withAuthRetry } from '@/lib/supabase/retry';
import { useAuthStore } from '@/store/auth-store';
import { appJsonStorage } from '@/store/storage';

export type AnswerValue = string | string[] | number | undefined;

type OnboardingAnswersState = {
  answers: Record<string, AnswerValue>;
  setAnswer: (id: string, value: AnswerValue) => void;
  /** Replaces the whole blob (e.g. with the answers cleaned for the chosen mode). */
  replaceAnswers: (answers: Record<string, AnswerValue>) => void;
  reset: () => void;
  syncFromServer: () => Promise<void>;
  /** Local-only reset on logout (no server call, unlike `reset`) — see
   * user-store.ts's clearLocal for why. */
  clearLocal: () => void;
};

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

/**
 * Free-form store for the long-tail questionnaire (schema.ts). Answers are
 * kept as an untyped id → value map rather than exploding UserProfile with
 * 70+ fields; only the handful that actually drive app behaviour (goal,
 * sports, height, weight targets, calorie/macro targets) get promoted into
 * `user-store.ts` when onboarding finishes.
 */
export const useOnboardingStore = create<OnboardingAnswersState>()(
  persist(
    (set, get) => ({
      answers: {},
      setAnswer: (id, value) => {
        const answers = { ...get().answers, [id]: value };
        set({ answers });
        const userId = currentUserId();
        if (userId) upsertOnboardingAnswers(userId, answers).catch((err) => console.warn('upsertOnboardingAnswers failed', err));
      },
      replaceAnswers: (answers) => {
        set({ answers });
        const userId = currentUserId();
        if (userId) upsertOnboardingAnswers(userId, answers).catch((err) => console.warn('upsertOnboardingAnswers failed', err));
      },
      reset: () => {
        set({ answers: {} });
        const userId = currentUserId();
        if (userId) deleteOnboardingAnswers(userId).catch((err) => console.warn('deleteOnboardingAnswers failed', err));
      },
      syncFromServer: async () => {
        const userId = currentUserId();
        if (!userId) return;
        try {
          const answers = await withAuthRetry(() => fetchOnboardingAnswers(userId));
          if (answers && Object.keys(answers).length > 0) {
            set({ answers });
            // Having answers on the server does NOT mean onboarding was completed (they
            // are saved question by question): completion is decided by the profile — see
            // user-store.ts syncFromServer.
          }
        } catch (err) {
          console.warn('onboarding-store syncFromServer failed', err);
        }
      },
      clearLocal: () => set({ answers: {} }),
    }),
    { name: 'fitlab/onboarding-answers', storage: appJsonStorage }
  )
);
