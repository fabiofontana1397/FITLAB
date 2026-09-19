import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { daysAgoISO } from '@/lib/mock/dates';
import {
  evaluateNutritionAdaptation,
  fetchLatestInitialEstimate,
  insertNutritionTargetHistory,
  type AdaptationDecision,
} from '@/lib/api/nutrition-targets';
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
  age: 0,
  goal: 'generalHealth',
  sports: [],
  heightCm: 0,
  targetWeightKg: 0,
  dailyCalorieTarget: 0,
  macroTargetsG: { protein: 0, carbs: 0, fats: 0 },
  hydrationTargetMl: 0,
};

// spec §0.3/§4.1 bis, "initial_estimate vs current_target": the
// questionnaire's one-time computation is a snapshot, never mutated again
// once written to nutrition_target_history — `dailyCalorieTarget`/
// `macroTargetsG` above are the `current_target` half, the one
// reviewNutritionTarget (Adaptive Nutrition Engine) is allowed to nudge.
type InitialEstimate = { calories: number; macroTargetsG: { protein: number; carbs: number; fats: number }; effectiveDate: string } | null;

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

export type FinalizeOnboardingInput = {
  goal: Goal;
  sports: Sport[];
  sex: Sex;
  age: number;
  heightCm: number;
  targetWeightKg: number;
  dailyCalorieTarget: number;
  macroTargetsG: { protein: number; carbs: number; fats: number };
  hydrationTargetMl: number;
};

type UserState = UserProfile & {
  /** The questionnaire's one-time `initial_estimate` (spec §0.3/§4.1 bis) —
   * null until finalizeOnboarding runs at least once, or until
   * syncFromServer resolves it from nutrition_target_history. Compare
   * against dailyCalorieTarget/macroTargetsG (the live `current_target`) to
   * see how far the Adaptive Nutrition Engine has actually nudged the plan. */
  initialEstimate: InitialEstimate;
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
   * Adaptive Nutrition Engine review (spec §4.1 bis, §14 "POST
   * /adaptation/evaluate") — client-triggered (e.g. "Rivedi il mio target"
   * in Profilo), not a background job. Invokes the adaptation-evaluate
   * Edge Function, which does the actual work server-side against
   * RLS-scoped body_metrics/meal_entries: computes the trend, decides
   * whether to nudge dailyCalorieTarget/macroTargetsG, and — if so — is
   * the one that persists the new profile, a nutrition_target_history row,
   * and a plan_versions row (trigger:'adaptation'). This store just
   * applies whatever profile update comes back and returns the decision so
   * the UI can show why something did or didn't change.
   */
  reviewNutritionTarget: () => Promise<AdaptationDecision>;
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_PROFILE,
      initialEstimate: null,
      finalizeOnboarding: (input) => {
        const effectiveDate = daysAgoISO(0);
        set({ ...input, initialEstimate: { calories: input.dailyCalorieTarget, macroTargetsG: input.macroTargetsG, effectiveDate } });
        const userId = currentUserId();
        if (!userId) return;
        upsertProfile(userId, get()).catch((err) => console.warn('upsertProfile failed', err));
        // A fresh baseline every time the questionnaire is (re)completed —
        // never overwrites a previous one, same philosophy as
        // body-store.ts's resetStartingWeight — so the history stays a real
        // audit trail of every "the estimate started here" moment.
        insertNutritionTargetHistory(userId, {
          effectiveDate,
          calories: input.dailyCalorieTarget,
          proteinG: input.macroTargetsG.protein,
          carbsG: input.macroTargetsG.carbs,
          fatsG: input.macroTargetsG.fats,
          source: 'initial_estimate',
        }).catch((err) => console.warn('insertNutritionTargetHistory (initial_estimate) failed', err));
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
          const [profile, initialEstimateRow] = await Promise.all([
            withAuthRetry(() => fetchProfile(userId)),
            withAuthRetry(() => fetchLatestInitialEstimate(userId)),
          ]);
          if (profile) set(profile);
          if (initialEstimateRow) {
            set({
              initialEstimate: {
                calories: initialEstimateRow.calories,
                macroTargetsG: { protein: initialEstimateRow.proteinG, carbs: initialEstimateRow.carbsG, fats: initialEstimateRow.fatsG },
                effectiveDate: initialEstimateRow.effectiveDate,
              },
            });
          }
        } catch (err) {
          console.warn('user-store syncFromServer failed', err);
        }
      },
      clearLocal: () => set({ ...DEFAULT_PROFILE, initialEstimate: null }),
      reviewNutritionTarget: async () => {
        const { decision, updatedProfile } = await evaluateNutritionAdaptation();
        if (updatedProfile) {
          set({ dailyCalorieTarget: updatedProfile.dailyCalorieTarget, macroTargetsG: updatedProfile.macroTargetsG });
        }
        return decision;
      },
    }),
    { name: 'fitlab/user', storage: appJsonStorage }
  )
);
