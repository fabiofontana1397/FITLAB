import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { deleteOnboardingAnswers, fetchOnboardingAnswers, upsertOnboardingAnswers } from '@/lib/api/onboarding';
import { withAuthRetry } from '@/lib/supabase/retry';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { appJsonStorage } from '@/store/storage';

export type AnswerValue = string | string[] | number | undefined;

type OnboardingAnswersState = {
  answers: Record<string, AnswerValue>;
  setAnswer: (id: string, value: AnswerValue) => void;
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
            // Multi-device gap: hasOnboarded is otherwise local-only
            // (app-store.ts), so a second device with a real, already-
            // onboarded account would wrongly redirect back into the
            // questionnaire. The server having answers at all is proof
            // onboarding was already completed somewhere.
            if (!useAppStore.getState().hasOnboarded) useAppStore.getState().setHasOnboarded(true);
          }
        } catch (err) {
          console.warn('onboarding-store syncFromServer failed', err);
        }
      },
      clearLocal: () => set({ answers: {} }),
    }),
    { name: 'fitbro/onboarding-answers', storage: appJsonStorage }
  )
);
