// Client-only: gathers what the app knows about the person into the snapshot the
// local coach reads (local-coach.ts stays pure so it can be tested outside the app).
import { weightTrendKgPerWeek } from '@/domain/recalibration';
import { buildUserContext } from '@/domain/user-context';
import { addDaysISO, daysAgoISO } from '@/lib/mock/dates';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { useBodyStore } from '@/store/body-store';
import { useMonthlyCheckinStore } from '@/store/monthly-checkin-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';

import { buildClientContext } from './build-client-context';
import type { CoachFacts } from './local-coach';

const TREND_WINDOW_DAYS = 56;

export function buildCoachFacts(): CoachFacts {
  const base = buildClientContext();
  const today = daysAgoISO(0);

  const weighIns = useBodyStore
    .getState()
    .entries.filter((e) => e.weightKg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const recent = weighIns.filter((e) => e.date >= addDaysISO(today, -TREND_WINDOW_DAYS));
  const ctx = buildUserContext(useOnboardingStore.getState().answers);

  const { dietPlan, trainingPlan } = usePlanStore.getState();
  const plan = dietPlan ?? trainingPlan;
  const endedMonth = plan ? currentMonthIndex(plan) - 1 : 0;
  const checkinDue = endedMonth >= 1 && !useMonthlyCheckinStore.getState().completedMonths.includes(endedMonth) ? endedMonth : null;

  return {
    ...base,
    weight: {
      currentKg: weighIns.length > 0 ? weighIns[weighIns.length - 1].weightKg : null,
      startKg: weighIns.length > 0 ? weighIns[0].weightKg : null,
      targetKg: ctx.targetWeightKg,
      trendKgPerWeek: weightTrendKgPerWeek(recent.map((e) => ({ date: e.date, kg: e.weightKg }))),
      weighIns: weighIns.length,
      lastWeighInDate: weighIns.length > 0 ? weighIns[weighIns.length - 1].date : null,
    },
    checkinDue,
  };
}
