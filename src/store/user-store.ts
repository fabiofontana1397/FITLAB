import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { fetchProfile, upsertProfile } from '@/lib/api/profile';
import type { Goal, Sex, Sport, UserProfile } from '@/lib/mock/types';
import { withAuthRetry } from '@/lib/supabase/retry';
import { useAuthStore } from '@/store/auth-store';
import { appJsonStorage } from '@/store/storage';

// Placeholder shown only until the real `profiles` row is either written
// (finalizeOnboarding, a real first-time user) or read back (syncFromServer,
// a returning user on a new device) — never meant to be seen as real data.
const DEFAULT_PROFILE: UserProfile = {
  name: '',
  sex: 'unspecified',
  ageRange: '',
  goal: 'generalHealth',
  sports: [],
  heightCm: 0,
  targetWeightKg: 0,
  dailyCalorieTarget: 0,
  macroTargetsG: { protein: 0, carbs: 0, fats: 0 },
  hydrationTargetMl: 0,
};

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

export type FinalizeOnboardingInput = {
  goal: Goal;
  sports: Sport[];
  sex: Sex;
  ageRange: string;
  heightCm: number;
  targetWeightKg: number;
  dailyCalorieTarget: number;
  macroTargetsG: { protein: number; carbs: number; fats: number };
  hydrationTargetMl: number;
};

type UserState = UserProfile & {
  finalizeOnboarding: (input: FinalizeOnboardingInput) => void;
  updateProfile: (partial: Partial<UserProfile>) => void;
  // Server-authoritative refresh on sign-in (see src/app/_layout.tsx) — the
  // profiles row is created server-side at signup (handle_new_user
  // trigger), but was never read back into this store, so a device that
  // reaches Home without running finalizeOnboarding itself (e.g. a second
  // device, already onboarded elsewhere) showed DEFAULT_PROFILE forever.
  syncFromServer: () => Promise<void>;
  /** Local-only reset on logout — no server call, unlike a user-initiated
   * data deletion. Without this, a different account signing in on the
   * same device would see the previous account's cached profile until (if
   * ever) syncFromServer happens to overwrite every field. */
  clearLocal: () => void;
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PROFILE,
      finalizeOnboarding: (input) => {
        set(input);
        const userId = currentUserId();
        if (userId) upsertProfile(userId, get()).catch((err) => console.warn('upsertProfile failed', err));
      },
      updateProfile: (partial) => {
        set(partial);
        const userId = currentUserId();
        if (userId) upsertProfile(userId, get()).catch((err) => console.warn('upsertProfile failed', err));
      },
      syncFromServer: async () => {
        const userId = currentUserId();
        if (!userId) return;
        try {
          const profile = await withAuthRetry(() => fetchProfile(userId));
          if (profile) set(profile);
        } catch (err) {
          console.warn('user-store syncFromServer failed', err);
        }
      },
      clearLocal: () => set(DEFAULT_PROFILE),
    }),
    { name: 'fitbro/user', storage: appJsonStorage }
  )
);
