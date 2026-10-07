import { useEffect, useRef } from 'react';

import { useStoreHydrated } from '@/hooks/use-store-hydrated';
import { latestSnapshot } from '@/lib/mock/body';
import { useAppStore } from '@/store/app-store';
import { useBodyStore } from '@/store/body-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { isValidDietPlan, isValidTrainingPlan, usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';

/**
 * Safety net for the Nutrition / Training tabs: if the person finished
 * onboarding but the plan they need is missing or from an older engine
 * version, build ONLY that plan (never touching the other one).
 *
 * It waits until the local stores are rehydrated AND onboarding is really
 * complete (profile targets present), so it can never generate a plan from
 * empty or default data — the failure that used to produce 0-kcal plans for
 * people who abandoned the questionnaire halfway.
 */
export function useEnsurePlan(kind: 'diet' | 'training'): void {
  const plan = usePlanStore((s) => (kind === 'diet' ? s.dietPlan : s.trainingPlan));
  const otherPlan = usePlanStore((s) => (kind === 'diet' ? s.trainingPlan : s.dietPlan));
  const generatePlans = usePlanStore((s) => s.generatePlans);
  const isGenerating = usePlanStore((s) => s.isGenerating);
  const hasSynced = usePlanStore((s) => s.hasSynced);
  const answers = useOnboardingStore((s) => s.answers);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const calorieTarget = useUserStore((s) => s.dailyCalorieTarget);
  const bodyEntries = useBodyStore((s) => s.entries);

  const planHydrated = useStoreHydrated(usePlanStore);
  const onboardingHydrated = useStoreHydrated(useOnboardingStore);
  const userHydrated = useStoreHydrated(useUserStore);
  const attempted = useRef(false);

  useEffect(() => {
    if (!planHydrated || !onboardingHydrated || !userHydrated) return;
    if (!hasSynced || !hasOnboarded || calorieTarget <= 0 || isGenerating || attempted.current) return;
    const mode = answers.mode as string | undefined;
    if (mode === (kind === 'diet' ? 'training' : 'diet')) return; // this plan was never requested
    const valid = kind === 'diet' ? isValidDietPlan(plan as never) : isValidTrainingPlan(plan as never);
    if (valid) return;
    attempted.current = true; // one attempt per mount: a failed build must not loop
    const weight = latestSnapshot(bodyEntries).weightKg;
    // Both plans come from the same engine run so the diet always matches the training. Only when the other
    // plan is healthy (or was never requested) is it left untouched.
    const otherKind = kind === 'diet' ? 'training' : 'diet';
    const otherRequested = mode !== otherKind;
    const otherValid = !otherRequested || (otherKind === 'diet' ? isValidDietPlan(otherPlan as never) : isValidTrainingPlan(otherPlan as never));
    void generatePlans(answers, { only: otherValid ? kind : undefined, skipAi: true, keepProgress: plan != null, currentWeightKg: weight > 0 ? weight : undefined });
  }, [plan, otherPlan, kind, hasSynced, planHydrated, onboardingHydrated, userHydrated, hasOnboarded, calorieTarget, isGenerating, answers, bodyEntries, generatePlans]);
}
