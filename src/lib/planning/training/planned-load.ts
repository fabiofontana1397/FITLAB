import type { TrainingMonthPlan } from '../types';
/** What the month just lived asked of the person (engine v5): estimated fatigue, double-session days, runs. */
export function plannedLoadOf(month: TrainingMonthPlan | undefined): { fatigueStatus?: string; doubles?: number; runs?: number } | undefined {
  if (!month) return undefined;
  return {
    fatigueStatus: month.fatigue?.status,
    doubles: month.weeklySplit.filter((d) => d.type === 'workout' && d.extraRun).length,
    runs: month.weeklySplit.filter((d) => d.type === 'cardio' || (d.type === 'workout' && d.extraRun)).length,
  };
}
