import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { deleteDietPlan, deleteTrainingPlan, fetchDietPlan, fetchTrainingPlan, insertPlanVersion, type PlanVersionTrigger, upsertDietPlan, upsertTrainingPlan } from '@/lib/api/plans';
import { fetchPlanStrategy } from '@/lib/api/plan-strategy';
import { generateDietPlan } from '@/lib/planning/diet-planner';
import { computePlanDurationMonths } from '@/lib/planning/plan-duration';
import { generateTrainingPlan } from '@/lib/planning/training-planner';
import type { DietPlan, TrainingPlan } from '@/lib/planning/types';
import { withAuthRetry } from '@/lib/supabase/retry';
import { useAuthStore } from '@/store/auth-store';
import { appJsonStorage } from '@/store/storage';

// Bump whenever the deterministic planners' logic changes materially —
// recorded on every plan_versions row (algorithm_version) so a stored plan
// can always be traced back to the generation logic that produced it (spec
// §12 bis, §4.2).
const ALGORITHM_VERSION = 'planner-2026-09-19-p0';

type PlanState = {
  dietPlan: DietPlan | null;
  trainingPlan: TrainingPlan | null;
  isGenerating: boolean;
  generatePlans: (
    answers: Record<string, unknown>,
    targets: { dailyCalorieTarget: number; macroTargetsG: { protein: number; carbs: number; fats: number } },
    trigger?: PlanVersionTrigger
  ) => Promise<void>;
  /**
   * Monthly check-in regeneration (spec §0.4, punto 2): rebuilds only the
   * months from `fromMonthIndex` onward, using the ADJUSTED calorie/macro
   * target but the SAME original questionnaire answers — months already
   * lived through are copied verbatim (see DietPlanInput.preserveMonthsBefore),
   * so this is never a from-scratch plan.
   */
  regenerateFromMonth: (
    fromMonthIndex: number,
    answers: Record<string, unknown>,
    adjustedTargets: { dailyCalorieTarget: number; macroTargetsG: { protein: number; carbs: number; fats: number } }
  ) => Promise<void>;
  syncFromServer: () => Promise<void>;
  /** Local-only reset on logout — see user-store.ts's clearLocal for why. */
  clearLocal: () => void;
};

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

/**
 * Holds the generated multi-month diet/training plans. Kept separate from
 * the day-to-day logging stores (nutrition-store, training-store) — this is
 * a prospective plan to view/export, not a log of what actually happened.
 *
 * generatePlans first tries to get a real AI-grounded strategy (split
 * choice, set/rep scheme, calorie/macro periodization — see
 * lib/planning/strategy-types.ts) from the generate-plan-strategy Edge
 * Function, which reasons from the two reference PDFs plus authoritative
 * web search. If that's unavailable for any reason (no Claude key
 * configured, network error, timeout), it falls back to the original
 * deterministic tables — onboarding never blocks on the AI call. Once
 * generated, both plans persist to Postgres (best-effort, background);
 * syncFromServer pulls them back down on sign-in/app start so a returning
 * user (or a different device) sees their real plan without regenerating.
 */
export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      dietPlan: null,
      trainingPlan: null,
      isGenerating: false,
      generatePlans: async (answers, targets, trigger = 'regenerate') => {
        const mode = answers.mode as string | undefined;
        set({ isGenerating: true });
        const durationMonths = computePlanDurationMonths(answers);
        const strategy = await fetchPlanStrategy(answers, targets.dailyCalorieTarget, targets.macroTargetsG, durationMonths);

        const dietPlan = mode === 'training' ? null : generateDietPlan({ answers, ...targets, strategy: strategy?.diet });
        const trainingPlan = mode === 'diet' ? null : generateTrainingPlan({ answers, strategy: strategy?.training });
        set({ dietPlan, trainingPlan, isGenerating: false });

        const userId = currentUserId();
        if (userId) {
          if (dietPlan) {
            upsertDietPlan(userId, dietPlan).catch((err) => console.warn('persist dietPlan failed', err));
            insertPlanVersion(userId, 'diet', trigger, ALGORITHM_VERSION).catch((err) => console.warn('insertPlanVersion (diet) failed', err));
          } else {
            deleteDietPlan(userId).catch((err) => console.warn('persist dietPlan failed', err));
          }
          if (trainingPlan) {
            upsertTrainingPlan(userId, trainingPlan).catch((err) => console.warn('persist trainingPlan failed', err));
            insertPlanVersion(userId, 'training', trigger, ALGORITHM_VERSION).catch((err) => console.warn('insertPlanVersion (training) failed', err));
          } else {
            deleteTrainingPlan(userId).catch((err) => console.warn('persist trainingPlan failed', err));
          }
        }
      },
      regenerateFromMonth: async (fromMonthIndex, answers, adjustedTargets) => {
        const { dietPlan, trainingPlan } = get();
        const mode = answers.mode as string | undefined;

        const nextDietPlan =
          mode === 'training' || !dietPlan
            ? dietPlan
            : {
                ...generateDietPlan({
                  answers,
                  ...adjustedTargets,
                  strategy: null,
                  preserveMonthsBefore: fromMonthIndex,
                  existingMonths: dietPlan.months,
                }),
                // Regenerating must never reset the plan's own start date —
                // currentMonthIndex()/monthProgress() (plan-progress.ts) anchor
                // month-unlock timing on it, and this is a mid-plan update,
                // not a new plan.
                generatedAt: dietPlan.generatedAt,
              };
        const nextTrainingPlan =
          mode === 'diet' || !trainingPlan
            ? trainingPlan
            : {
                ...generateTrainingPlan({ answers, strategy: null, preserveMonthsBefore: fromMonthIndex, existingMonths: trainingPlan.months })!,
                generatedAt: trainingPlan.generatedAt,
              };

        set({ dietPlan: nextDietPlan, trainingPlan: nextTrainingPlan });

        const userId = currentUserId();
        if (!userId) return;
        if (nextDietPlan) {
          upsertDietPlan(userId, nextDietPlan).catch((err) => console.warn('persist dietPlan (monthly regen) failed', err));
          insertPlanVersion(userId, 'diet', 'monthly_checkin', ALGORITHM_VERSION).catch((err) => console.warn('insertPlanVersion (diet) failed', err));
        }
        if (nextTrainingPlan) {
          upsertTrainingPlan(userId, nextTrainingPlan).catch((err) => console.warn('persist trainingPlan (monthly regen) failed', err));
          insertPlanVersion(userId, 'training', 'monthly_checkin', ALGORITHM_VERSION).catch((err) => console.warn('insertPlanVersion (training) failed', err));
        }
      },
      syncFromServer: async () => {
        const userId = currentUserId();
        if (!userId) return;
        try {
          const [dietPlan, trainingPlan] = await Promise.all([
            withAuthRetry(() => fetchDietPlan(userId)),
            withAuthRetry(() => fetchTrainingPlan(userId)),
          ]);
          // Only overwrite local state with what the server actually has —
          // a plan that hasn't been generated yet (new account, still mid-
          // onboarding) must not wipe a plan just generated locally moments
          // ago in the same session.
          if (dietPlan) set({ dietPlan });
          if (trainingPlan) set({ trainingPlan });
        } catch (err) {
          console.warn('plan-store syncFromServer failed', err);
        }
      },
      clearLocal: () => set({ dietPlan: null, trainingPlan: null, isGenerating: false }),
    }),
    { name: 'fitlab/plans', storage: appJsonStorage, partialize: (state) => ({ dietPlan: state.dietPlan, trainingPlan: state.trainingPlan }) }
  )
);

/**
 * True if every workout exercise in the plan has the fields the current
 * code expects (`id`, `suggestedKg`). Plans generated before those fields
 * existed persist forever otherwise — zustand's persist `version`/`migrate`
 * can't catch this retroactively, since it only fires when the *stored*
 * blob already carries a numeric version to compare against (every plan
 * saved before versioning existed has none at all). Callers should treat
 * an invalid plan the same as a missing one and regenerate it.
 */
export function isValidTrainingPlan(plan: TrainingPlan | null): boolean {
  if (!plan) return false;
  return plan.months.every((month) =>
    month.weeklySplit.every(
      (day) =>
        day.type !== 'workout' ||
        (day.exercises ?? []).every(
          (ex) => typeof ex.id === 'string' && ex.id.length > 0 && typeof ex.tempo === 'string' && ex.tempo.length > 0
        )
    )
  );
}

/**
 * Same idea as isValidTrainingPlan, for the diet plan: months generated
 * before it moved from one repeated "sample day" to a real day-by-day
 * weeklySplit only have the old `sampleDay` field, and would throw
 * ("weeklySplit is undefined") the moment a screen renders them. Callers
 * should treat an invalid plan the same as a missing one and regenerate it.
 */
export function isValidDietPlan(plan: DietPlan | null): boolean {
  if (!plan) return false;
  return plan.months.every((month) => Array.isArray(month.weeklySplit) && month.weeklySplit.length > 0);
}
