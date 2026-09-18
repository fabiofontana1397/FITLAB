import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { insertPlanVersion } from '@/lib/api/plans';
import { fetchProfile, upsertProfile } from '@/lib/api/profile';
import { insertNutritionTargetHistory } from '@/lib/api/nutrition-targets';
import type { AdaptationDecision } from '@/lib/nutrition/adaptive-engine';
import { evaluateAdaptation } from '@/lib/nutrition/adaptive-engine';
import { daysAgoISO } from '@/lib/mock/dates';
import type { Goal, Sex, Sport, UserProfile } from '@/lib/mock/types';
import { withAuthRetry } from '@/lib/supabase/retry';
import { useAuthStore } from '@/store/auth-store';
import { useBodyStore } from '@/store/body-store';
import { sumMacros, useNutritionStore } from '@/store/nutrition-store';
import { appJsonStorage } from '@/store/storage';

const NUTRITION_ADAPTIVE_ENGINE_VERSION = 'adaptive-engine-2026-09-19-p0';

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
  /**
   * Adaptive Nutrition Engine review (spec §4.1 bis) — client-triggered
   * (e.g. a "Rivedi il mio target" action in Profilo), not a background
   * job. Aggregates the user's own logged weight (body-store) and intake
   * (nutrition-store) into daily series, asks evaluateAdaptation for a
   * decision, and — only if it proposes a change — nudges
   * dailyCalorieTarget/macroTargetsG by a small bounded step, persists the
   * new profile, and records both a nutrition_target_history row and a
   * plan_versions row (trigger:'adaptation') so the correction is
   * auditable. Returns the decision either way so the UI can show why
   * nothing changed.
   */
  reviewNutritionTarget: () => Promise<AdaptationDecision>;
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
      reviewNutritionTarget: async () => {
        const profile = get();
        const weightSeries = useBodyStore
          .getState()
          .entries.filter((e) => e.weightKg > 0)
          .map((e) => ({ date: e.date, weightKg: e.weightKg }));

        const nutritionEntries = useNutritionStore.getState().entries;
        const dates = [...new Set(nutritionEntries.map((e) => e.date))];
        const intakeSeries = dates
          .map((date) => ({ date, kcal: sumMacros(nutritionEntries.filter((e) => e.date === date)).kcal }))
          .filter((p) => p.kcal > 0)
          .sort((a, b) => a.date.localeCompare(b.date));

        const decision = evaluateAdaptation({ goal: profile.goal, weightSeries, intakeSeries });
        if (decision.action === 'none') return decision;

        const delta = decision.action === 'increase' ? decision.deltaKcal : -decision.deltaKcal;
        const newCalorieTarget = Math.max(profile.dailyCalorieTarget + delta, 1200);
        // Keep protein fixed (it's set from bodyweight, not from the
        // calorie budget) and absorb the whole adjustment in carbs, with
        // fats held constant — the smallest-surface-area change that
        // still respects the macro logic in lib/nutrition/targets.ts.
        const newCarbsG = Math.max(
          Math.round((newCalorieTarget - profile.macroTargetsG.protein * 4 - profile.macroTargetsG.fats * 9) / 4),
          0
        );
        const newMacros = { ...profile.macroTargetsG, carbs: newCarbsG };

        set({ dailyCalorieTarget: newCalorieTarget, macroTargetsG: newMacros });

        const userId = currentUserId();
        if (userId) {
          upsertProfile(userId, get()).catch((err) => console.warn('upsertProfile (adaptation) failed', err));
          insertNutritionTargetHistory(userId, {
            effectiveDate: daysAgoISO(0),
            calories: newCalorieTarget,
            proteinG: newMacros.protein,
            carbsG: newMacros.carbs,
            fatsG: newMacros.fats,
            source: 'adaptation',
            reason: decision.reason,
          }).catch((err) => console.warn('insertNutritionTargetHistory failed', err));
          insertPlanVersion(userId, 'diet', 'adaptation', NUTRITION_ADAPTIVE_ENGINE_VERSION).catch((err) =>
            console.warn('insertPlanVersion (adaptation) failed', err)
          );
        }

        return decision;
      },
    }),
    { name: 'fitlab/user', storage: appJsonStorage }
  )
);
