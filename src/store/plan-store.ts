import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { buildPlans } from '@/domain/plan-engine';
import { NEUTRAL_CALIBRATION, recalibrate, type Adherence, type CheckinSignals, type RecalibrationRecord, type RecalibrationResult, type WeightPoint } from '@/domain/recalibration';
import { computeTargets } from '@/domain/targets';
import { buildUserContext } from '@/domain/user-context';
import { deleteDietPlan, deleteTrainingPlan, fetchDietPlan, fetchTrainingPlan, insertPlanVersion, type PlanVersionTrigger, upsertDietPlan, upsertTrainingPlan } from '@/lib/api/plans';
import { fetchPlanStrategy } from '@/lib/api/plan-strategy';
import { DIET_ENGINE_VERSION } from '@/lib/planning/diet-planner';
import { TRAINING_ENGINE_VERSION } from '@/lib/planning/training-planner';
import { daysAgoISO } from '@/lib/mock/dates';
import type { DietPlan, TrainingPlan } from '@/lib/planning/types';
import { withAuthRetry } from '@/lib/supabase/retry';
import { useAuthStore } from '@/store/auth-store';
import { appJsonStorage } from '@/store/storage';

// Bump whenever the planning logic changes materially — recorded on every
// plan_versions row (algorithm_version) so a stored plan can always be traced
// back to the generation logic that produced it (spec §12 bis, §4.2).
const ALGORITHM_VERSION = 'engine-2026-10-v3';

type GenerateOptions = {
  trigger?: PlanVersionTrigger;
  /** Latest weight, when regenerating long after onboarding. Defaults to the questionnaire weight. */
  currentWeightKg?: number;
  /** Replace only this plan and leave the other untouched (the tabs' safety net). */
  only?: 'diet' | 'training';
  /** Skip the AI strategy call (slow): the plan is built from the deterministic defaults right away. */
  skipAi?: boolean;
  /** Rebuild with the current engine but keep the plan's start date, calibration and check-in history (an outdated plan upgraded in place). */
  keepProgress?: boolean;
  /** With keepProgress: months before this one are already lived and stay exactly as they are (an answer edited from Profilo). */
  fromMonth?: number;
};

export type RecalibrateMonthInput = {
  answers: Record<string, unknown>;
  /** The month that just ended. */
  monthIndex: number;
  currentWeightKg: number;
  weights: WeightPoint[];
  adherence: Adherence;
  checkin: CheckinSignals;
};

type PlanState = {
  dietPlan: DietPlan | null;
  trainingPlan: TrainingPlan | null;
  isGenerating: boolean;
  /** True once the server copy of the plans has been pulled this session (not persisted). Plans must never be built before it: a late sync would overwrite them with the stale server version. */
  hasSynced: boolean;
  /** Builds both plans together from the questionnaire answers (domain/plan-engine.ts). */
  generatePlans: (answers: Record<string, unknown>, options?: GenerateOptions) => Promise<void>;
  /**
   * Monthly recalibration (domain/recalibration.ts): looks at what really
   * happened in the month that just ended and reworks BOTH plans from the next
   * month on. Months already lived are never touched.
   */
  recalibrateMonth: (input: RecalibrateMonthInput) => Promise<RecalibrationResult>;
  syncFromServer: () => Promise<void>;
  /** Local-only reset on logout — see user-store.ts's clearLocal for why. */
  clearLocal: () => void;
};

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

function persistPlans(diet: DietPlan | null, training: TrainingPlan | null, trigger: PlanVersionTrigger, deleteMissing: boolean) {
  const userId = currentUserId();
  if (!userId) return;
  if (diet) {
    upsertDietPlan(userId, diet).catch((err) => console.warn('persist dietPlan failed', err));
    insertPlanVersion(userId, 'diet', trigger, ALGORITHM_VERSION).catch((err) => console.warn('insertPlanVersion (diet) failed', err));
  } else if (deleteMissing) {
    deleteDietPlan(userId).catch((err) => console.warn('persist dietPlan failed', err));
  }
  if (training) {
    upsertTrainingPlan(userId, training).catch((err) => console.warn('persist trainingPlan failed', err));
    insertPlanVersion(userId, 'training', trigger, ALGORITHM_VERSION).catch((err) => console.warn('insertPlanVersion (training) failed', err));
  } else if (deleteMissing) {
    deleteTrainingPlan(userId).catch((err) => console.warn('persist trainingPlan failed', err));
  }
}

/**
 * Holds the generated multi-month diet/training plans. Kept separate from
 * the day-to-day logging stores (nutrition-store, training-store) — this is
 * a prospective plan to view/export, not a log of what actually happened.
 *
 * Plans always come from ONE place: domain/plan-engine.ts `buildPlans`. The
 * AI strategy (generate-plan-strategy Edge Function) only contributes the
 * split, set/rep scheme and the monthly focus texts; calories and macros come
 * from the unified energy model, so the diet follows the training. If the AI
 * call fails the deterministic defaults are used — onboarding never blocks on it.
 */
export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      dietPlan: null,
      trainingPlan: null,
      isGenerating: false,
      hasSynced: false,
      generatePlans: async (answers, options = {}) => {
        const { trigger = 'regenerate', currentWeightKg, only, skipAi = false, keepProgress = false, fromMonth } = options;
        set({ isGenerating: true });
        try {
          const base = buildUserContext(answers);
          const ctx = currentWeightKg ? { ...base, weightKg: currentWeightKg } : base;
          const { dietPlan: currentDiet, trainingPlan: currentTraining } = get();
          const carry = keepProgress ? { calibration: currentDiet?.calibration ?? currentTraining?.calibration, existing: { diet: currentDiet, training: currentTraining }, preserveMonthsBefore: fromMonth } : {};
          const deterministic = buildPlans(ctx, carry);
          const first = deterministic.monthTargets[0];
          const strategy = skipAi ? null : await fetchPlanStrategy(answers, first.calories, first.macros, deterministic.durationMonths);
          const bundle = strategy ? buildPlans(ctx, { strategy, ...carry }) : deterministic;

          const replaceDiet = !only || only === 'diet';
          const replaceTraining = !only || only === 'training';
          set({ dietPlan: replaceDiet ? bundle.diet : currentDiet, trainingPlan: replaceTraining ? bundle.training : currentTraining });
          persistPlans(replaceDiet ? bundle.diet : null, replaceTraining ? bundle.training : null, trigger, !only);
        } catch (err) {
          console.warn('generatePlans failed', err);
        } finally {
          set({ isGenerating: false });
        }
      },
      recalibrateMonth: async (input) => {
        const { dietPlan, trainingPlan } = get();
        const plan = dietPlan ?? trainingPlan;
        if (!plan) throw new Error('Nessun piano da ricalibrare');
        const ctx = { ...buildUserContext(input.answers), weightKg: input.currentWeightKg };
        const calibration = dietPlan?.calibration ?? trainingPlan?.calibration ?? NEUTRAL_CALIBRATION;

        // The targets the person actually followed that month (calories as stored in the plan).
        const followed = computeTargets(ctx, trainingPlan?.months[input.monthIndex - 1]?.weeklySplit ?? null, calibration);
        const storedMonth = dietPlan?.months.find((m) => m.monthIndex === input.monthIndex);
        const targets = storedMonth ? { ...followed, calories: storedMonth.calorieTarget, macros: storedMonth.macroTargetsG } : followed;

        const result = recalibrate({
          ctx,
          monthIndex: input.monthIndex,
          durationMonths: plan.durationMonths,
          targets,
          weights: input.weights,
          adherence: input.adherence,
          checkin: input.checkin,
          calibration,
        });

        const bundle = buildPlans(ctx, {
          calibration: result.calibration,
          preserveMonthsBefore: input.monthIndex + 1,
          existing: { diet: dietPlan, training: trainingPlan },
        });
        const record: RecalibrationRecord = {
          monthIndex: input.monthIndex,
          date: daysAgoISO(0),
          verdict: result.verdict,
          weeklyRateKg: result.weeklyRateKg,
          expectedWeeklyKg: result.expectedWeeklyKg,
          changes: result.changes,
          calibration: result.calibration,
        };
        const history = [...(plan.recalibrations ?? []).filter((r) => r.monthIndex !== input.monthIndex), record];
        if (bundle.diet) bundle.diet.recalibrations = history;
        if (bundle.training) bundle.training.recalibrations = history;

        set({ dietPlan: bundle.diet ?? dietPlan, trainingPlan: bundle.training ?? trainingPlan });
        persistPlans(bundle.diet, bundle.training, 'monthly_checkin', false);
        return result;
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
        } finally {
          set({ hasSynced: true });
        }
      },
      clearLocal: () => set({ dietPlan: null, trainingPlan: null, isGenerating: false, hasSynced: false }),
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
  if (!plan || !plan.calibration) return false;
  if (plan.engine !== TRAINING_ENGINE_VERSION) return false; // built by an older generator (e.g. one scheme for every exercise)
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
  if (!plan || !plan.calibration) return false;
  if (plan.engine !== DIET_ENGINE_VERSION) return false; // built by an older generator
  // plans built before the Fit Lab dishes (no recipe on a prescribed meal) are rebuilt
  return plan.months.every((month) => Array.isArray(month.weeklySplit) && month.weeklySplit.length > 0 && month.weeklySplit.every((day) => day.meals.every((meal) => meal.isFreeMeal || meal.recipe)));
}
