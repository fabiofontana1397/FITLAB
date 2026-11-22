import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { buildPlans, previewTrainingWeek } from '@/domain/plan-engine';
import type { ExercisePerformance } from '@/lib/planning/training/types';
import { NEUTRAL_CALIBRATION, recalibrate, type Adherence, type CheckinSignals, type RecalibrationRecord, type RecalibrationResult, type WeightPoint } from '@/domain/recalibration';
import { computeTargets } from '@/domain/targets';
import { supervisionReasons } from '@/domain/nutrition/safety';
import { buildUserContext } from '@/domain/user-context';
import { buildMealSlotsFromAnswers } from '@/lib/planning/meal-slots';
import { deleteDietPlan, deleteTrainingPlan, fetchDietPlan, fetchTrainingPlan, insertPlanVersion, type PlanVersionTrigger, upsertDietPlan, upsertTrainingPlan } from '@/lib/api/plans';
import { fetchPlanStrategy } from '@/lib/api/plan-strategy';
import { DIET_ENGINE_VERSION } from '@/lib/planning/diet-planner';
import { buildCustomDietPlan } from '@/lib/planning/custom-diet';
import { buildTargetsPlan, isTargetsPlan, type MonthDayTargets } from '@/lib/planning/targets-plan';
import { buildCustomTrainingPlan } from '@/lib/planning/custom-workout';
import { TRAINING_ENGINE_VERSION } from '@/lib/planning/training-planner';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { daysAgoISO } from '@/lib/mock/dates';
import { plannedLoadOf } from '@/lib/planning/training/planned-load';
import type { DietDayPlan, DietPlan, TrainingDayPlan, TrainingPlan } from '@/lib/planning/types';
import { applySubstitution as applySubstitutionToPlan, type SubstitutionChange, type SubstitutionRequest } from '@/lib/planning/substitution';
import { logFreeMeal as logFreeMealOnPlan, type FreeMealLog, type FreeMealLogInput } from '@/lib/planning/free-meal';
import { withAuthRetry } from '@/lib/supabase/retry';
import { useAuthStore } from '@/store/auth-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useUserStore } from '@/store/user-store';
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
  /** Logged performance of the month (lib/planning/month-adherence.ts → exercisePerformanceInMonth). */
  performance?: ExercisePerformance[];
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
  /**
   * Puts the person's own card in place of the training plan (even when a plan already exists). The diet is rebuilt
   * around it, since calories follow the training. Returns false when there is no questionnaire/plan to anchor it to.
   */
  /** `own`: the program the person built in the app ("Fai da te"), not one loaded from a photo, file or text. */
  importCustomTraining: (answers: Record<string, unknown>, week: TrainingDayPlan[], currentWeightKg?: number, opts?: { own?: boolean }) => void;
  /** Drops the custom card and builds the app's own plan again. */
  restoreGeneratedTraining: (answers: Record<string, unknown>, currentWeightKg?: number) => Promise<void>;
  /**
   * Puts the person's own diet in place of the nutrition plan (even when a plan already exists). It is followed as
   * written: its own calories where the catalog knows every food, the app's targets otherwise.
   */
  importCustomDiet: (answers: Record<string, unknown>, week: DietDayPlan[], currentWeightKg?: number) => void;
  /**
   * Puts the person's own targets (calories and macros, month by month, no menu) in place of the nutrition plan. A
   * new plan starts today; editing one already of this kind keeps its start date and the months already lived.
   */
  /** Saves the person's own targets: per month, training-day and rest-day ones; `trainingDays` are 0 = Monday. */
  setOwnTargets: (months: MonthDayTargets[], trainingDays: number[]) => void;
  /** Drops the custom diet and builds the app's own plan again, keeping the plan's start date. */
  restoreGeneratedDiet: (answers: Record<string, unknown>, currentWeightKg?: number) => Promise<void>;
  /**
   * Lifts a professional-review freeze. Allowed only when the questionnaire no longer reports a condition that
   * needs supervision (age included) AND the person confirms that a professional has re-assessed the plan.
   * Rebuilds the diet from the current month on; history is kept. Returns the reasons that still block it.
   */
  reactivateNutrition: (answers: Record<string, unknown>, confirmation: { professionalAssessment: boolean }, currentWeightKg?: number) => Promise<string[]>;
  /**
   * Applies one of an item's suggested alternatives (see lib/planning/substitution.ts): the item, the meal, the day
   * and the week are recalculated from the catalog; the alternative must still respect restrictions.
   */
  applySubstitution: (answers: Record<string, unknown>, req: SubstitutionRequest) => { ok: true; change: SubstitutionChange } | { ok: false; reason: string };
  /** Logs what was eaten at a free or eaten-out meal (measured, estimated or calories only, never invented). */
  logFreeMeal: (at: { monthIndex: number; dayIndex: number; slotId: string }, input: FreeMealLogInput) => { ok: true; log: FreeMealLog } | { ok: false; reason: string };
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
          // A custom card or diet is the person's choice: only they replace it (restoreGenerated…), never a rebuild.
          const custom = currentTraining?.source === 'custom' && trigger !== 'onboarding' ? currentTraining : null;
          const customDiet = currentDiet?.source === 'custom' && trigger !== 'onboarding' ? currentDiet : null;
          const carry = (custom || customDiet) && !keepProgress
            ? { calibration: currentDiet?.calibration ?? currentTraining?.calibration, existing: { diet: customDiet, training: custom } }
            : keepProgress ? { calibration: currentDiet?.calibration ?? currentTraining?.calibration, existing: { diet: currentDiet, training: currentTraining }, preserveMonthsBefore: fromMonth } : {};
          // a diet frozen for professional review stays frozen through any rebuild (questionnaire update included):
          // only reactivateNutrition lifts it
          if (currentDiet?.supervision) Object.assign(carry, { existing: { diet: currentDiet, training: (carry as { existing?: { training: TrainingPlan | null } }).existing?.training ?? null } });
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
      importCustomTraining: (answers, week, currentWeightKg, opts) => {
        const { dietPlan, trainingPlan } = get();
        const training = buildCustomTrainingPlan(week, trainingPlan ?? dietPlan, opts);
        const base = buildUserContext(answers);
        const ctx = currentWeightKg ? { ...base, weightKg: currentWeightKg } : base;
        // The diet (if the person has one) follows the new training week; months already lived stay as they were.
        const wantsDiet = answers.mode !== 'training';
        const bundle = buildPlans(ctx, {
          calibration: dietPlan?.calibration ?? training.calibration,
          existing: { diet: wantsDiet ? dietPlan : null, training },
          preserveMonthsBefore: dietPlan ? currentMonthIndex(dietPlan) : undefined,
        });
        const nextTraining = bundle.training ?? training;
        const nextDiet = wantsDiet ? bundle.diet ?? dietPlan : dietPlan;
        set({ trainingPlan: nextTraining, dietPlan: nextDiet });
        persistPlans(wantsDiet ? nextDiet : null, nextTraining, 'regenerate', false);
      },
      restoreGeneratedTraining: async (answers, currentWeightKg) => {
        set({ trainingPlan: null });
        await get().generatePlans(answers, { only: 'training', skipAi: true, currentWeightKg });
        // No training in the person's plan mode: nothing was built, so the custom card must not come back from the server.
        if (!get().trainingPlan) {
          const userId = currentUserId();
          if (userId) deleteTrainingPlan(userId).catch((err) => console.warn('delete trainingPlan failed', err));
        }
      },
      importCustomDiet: (answers, week, currentWeightKg) => {
        const { dietPlan, trainingPlan } = get();
        const base = buildUserContext(answers);
        const ctx = currentWeightKg ? { ...base, weightKg: currentWeightKg } : base;
        const anchor = dietPlan ?? trainingPlan;
        const calibration = dietPlan?.calibration ?? trainingPlan?.calibration ?? NEUTRAL_CALIBRATION;
        const trainingWeek = trainingPlan ? (trainingPlan.months.find((m) => m.monthIndex === currentMonthIndex(trainingPlan)) ?? trainingPlan.months[0])?.weeklySplit ?? null : null;
        const targets = computeTargets(ctx, trainingWeek, calibration);
        const diet = buildCustomDietPlan(week, {
          generatedAt: anchor?.generatedAt,
          durationMonths: anchor?.durationMonths,
          goal: dietPlan?.goal ?? ctx.goal,
          calibration,
          recalibrations: anchor?.recalibrations,
          fallback: { calories: targets.calories, macros: targets.macros },
          trainingWeek,
        });
        set({ dietPlan: diet });
        persistPlans(diet, null, 'regenerate', false);
      },
      setOwnTargets: (months, trainingDays) => {
        const { dietPlan, trainingPlan } = get();
        const editing = isTargetsPlan(dietPlan) ? dietPlan : null;
        const lived = editing ? currentMonthIndex(editing) : 1;
        const diet = buildTargetsPlan(months, {
          goal: dietPlan?.goal ?? buildUserContext(useOnboardingStore.getState().answers).goal,
          trainingDays,
          generatedAt: editing?.generatedAt,
          calibration: dietPlan?.calibration ?? trainingPlan?.calibration,
          recalibrations: dietPlan?.recalibrations ?? trainingPlan?.recalibrations,
          // the months before the current one are history: what was set for them stays
          keepMonths: editing ? editing.months.filter((m) => m.monthIndex < lived) : undefined,
        });
        set({ dietPlan: diet });
        persistPlans(diet, null, 'regenerate', false);
        // The profile's live target follows the month being lived, as after a monthly check-in, so the screens that
        // read it (per-meal targets, summaries) show the same numbers as Home.
        const now = diet.months.find((m) => m.monthIndex === currentMonthIndex(diet)) ?? diet.months[0];
        useUserStore.getState().updateProfile({ dailyCalorieTarget: now.calorieTarget, macroTargetsG: { ...now.macroTargetsG } });
      },
      restoreGeneratedDiet: async (answers, currentWeightKg) => {
        // Marked as the app's own and outdated, so the rebuild replaces every month while the start date and calibration stay.
        const { dietPlan } = get();
        if (dietPlan) set({ dietPlan: { ...dietPlan, source: 'generated', engine: undefined, ownTargets: undefined } });
        await get().generatePlans(answers, { only: 'diet', skipAi: true, keepProgress: dietPlan != null, currentWeightKg });
        // No diet in the person's plan mode: nothing was built, so the custom one must not come back from the server.
        if (!get().dietPlan || get().dietPlan?.source === 'custom') {
          set({ dietPlan: null });
          const userId = currentUserId();
          if (userId) deleteDietPlan(userId).catch((err) => console.warn('delete dietPlan failed', err));
        }
      },
      recalibrateMonth: async (input) => {
        const { dietPlan, trainingPlan } = get();
        const plan = dietPlan ?? trainingPlan;
        if (!plan) throw new Error('Nessun piano da ricalibrare');
        const ctx = { ...buildUserContext(input.answers), weightKg: input.currentWeightKg };
        const calibration = dietPlan?.calibration ?? trainingPlan?.calibration ?? NEUTRAL_CALIBRATION;

        // The targets the person actually followed that month: calories and macros exactly as stored in the plan
        // (the model is only used for the pace and the expenditure, at the current weight).
        const followed = computeTargets(ctx, trainingPlan?.months[input.monthIndex - 1]?.weeklySplit ?? null, calibration);
        const storedMonth = dietPlan?.months.find((m) => m.monthIndex === input.monthIndex);
        const targets = storedMonth ? { ...followed, calories: storedMonth.calorieTarget, macros: storedMonth.macroTargetsG } : followed;
        const history = [...(plan.recalibrations ?? [])].filter((r) => r.monthIndex < input.monthIndex).sort((a, b) => a.monthIndex - b.monthIndex);

        const result = recalibrate({
          ctx,
          monthIndex: input.monthIndex,
          durationMonths: plan.durationMonths,
          targets,
          weights: input.weights,
          adherence: input.adherence,
          checkin: input.checkin,
          calibration,
          performance: input.performance,
          plannedLoad: plannedLoadOf(trainingPlan?.months.find((m) => m.monthIndex === input.monthIndex)),
          weeks: {
            current: trainingPlan?.months[input.monthIndex - 1]?.weeklySplit ?? null,
            next: trainingPlan?.months[input.monthIndex]?.weeklySplit ?? null,
          },
          history,
          slots: buildMealSlotsFromAnswers(input.answers).map((sl) => sl.id),
          frozen: !!dietPlan?.supervision,
          previewNextWeek: (cal) => previewTrainingWeek(ctx, { calibration: cal, existing: trainingPlan, preserveMonthsBefore: input.monthIndex + 1, monthIndex: input.monthIndex + 1 }),
        });

        // Safety engine: a condition reported in this check-in freezes the diet before anything is rebuilt
        // (buildPlans keeps a frozen diet exactly as it is, history included).
        const dietForBuild =
          dietPlan && result.decision.supervision && !dietPlan.supervision && dietPlan.source !== 'custom'
            ? { ...dietPlan, supervision: { status: 'professional_review' as const, reasons: result.decision.interventions.filter((i) => i.kind === 'professional_review').map((i) => i.text), since: new Date().toISOString(), source: 'checkin' as const, monthIndex: input.monthIndex } }
            : dietPlan;
        // a regime confirmed explicitly in the check-in updates the profile; the plan is rebuilt with it
        const regime = result.decision.profileUpdates.dietaryPattern;
        if (regime) useOnboardingStore.getState().setAnswer('dietaryPattern', regime);
        const ctxBuild = regime ? { ...buildUserContext({ ...input.answers, dietaryPattern: regime }), weightKg: input.currentWeightKg } : ctx;
        const bundle = buildPlans(ctxBuild, {
          calibration: result.calibration,
          preserveMonthsBefore: input.monthIndex + 1,
          existing: { diet: dietForBuild, training: trainingPlan },
        });
        const record: RecalibrationRecord = {
          monthIndex: input.monthIndex,
          date: daysAgoISO(0),
          verdict: result.verdict,
          weeklyRateKg: result.weeklyRateKg,
          expectedWeeklyKg: result.expectedWeeklyKg,
          changes: result.changes,
          calibration: result.calibration,
          decision: result.decision,
        };
        // the previous decision gets what really happened after it (memory of the interventions)
        const previous = history.map((r, i) =>
          i === history.length - 1 && r.decision && result.previousOutcome ? { ...r, decision: { ...r.decision, observedOutcome: result.previousOutcome } } : r
        );
        const updatedHistory = [...previous, ...(plan.recalibrations ?? []).filter((r) => r.monthIndex > input.monthIndex), record].sort((a, b) => a.monthIndex - b.monthIndex);
        if (bundle.diet) bundle.diet.recalibrations = updatedHistory;
        if (bundle.training) bundle.training.recalibrations = updatedHistory;

        set({ dietPlan: bundle.diet ?? dietPlan, trainingPlan: bundle.training ?? trainingPlan });
        persistPlans(bundle.diet, bundle.training, 'monthly_checkin', false);
        return result;
      },
      reactivateNutrition: async (answers, confirmation, currentWeightKg) => {
        const { dietPlan } = get();
        const ctx = buildUserContext(answers);
        const still = supervisionReasons(ctx);
        if (!confirmation.professionalAssessment) still.push('manca la conferma della valutazione di un professionista');
        if (still.length > 0) return still;
        const unfrozen = dietPlan ? { ...dietPlan, supervision: undefined } : null;
        set({ dietPlan: unfrozen });
        await get().generatePlans(answers, { only: 'diet', skipAi: true, keepProgress: unfrozen != null, fromMonth: unfrozen ? currentMonthIndex(unfrozen) : undefined, currentWeightKg });
        return [];
      },
      applySubstitution: (answers, req) => {
        const { dietPlan } = get();
        if (!dietPlan) return { ok: false, reason: 'nessun piano nutrizionale' };
        const ctx = buildUserContext(answers);
        const res = applySubstitutionToPlan(dietPlan, req, { answers, sex: ctx.sex, adapt: dietPlan.calibration?.diet });
        if (!res.ok) return res;
        set({ dietPlan: res.plan });
        persistPlans(res.plan, null, 'adaptation', false);
        return { ok: true, change: res.change };
      },
      logFreeMeal: (at, input) => {
        const { dietPlan } = get();
        if (!dietPlan) return { ok: false, reason: 'nessun piano nutrizionale' };
        const res = logFreeMealOnPlan(dietPlan, at, input);
        if (!res.ok) return res;
        set({ dietPlan: res.plan });
        persistPlans(res.plan, null, 'adaptation', false);
        return { ok: true, log: res.log };
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
  if (plan.source !== 'custom' && plan.engine !== TRAINING_ENGINE_VERSION) return false; // built by an older generator (e.g. one scheme for every exercise)
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
  // a diet frozen for professional review is kept as it is: never rebuilt
  if (plan?.supervision) return true;
  if (!plan || !plan.calibration) return false;
  // The person's own diet has no Fit Lab dishes: it only needs its week of meals.
  if (plan.source === 'custom') return plan.months.length > 0 && plan.months.every((month) => Array.isArray(month.weeklySplit) && month.weeklySplit.length > 0);
  if (plan.engine !== DIET_ENGINE_VERSION) return false; // built by an older generator
  // plans built before the Fit Lab dishes (no recipe on a prescribed meal) are rebuilt
  return plan.months.every((month) => Array.isArray(month.weeklySplit) && month.weeklySplit.length > 0 && month.weeklySplit.every((day) => day.meals.every((meal) => meal.isFreeMeal || meal.recipe)));
}

