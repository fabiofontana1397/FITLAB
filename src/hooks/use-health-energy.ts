import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import type { MeasuredDay } from '@/domain/energy';
import { calibrateEnergy, type CalibrationResult } from '@/domain/health-calibration';
import { useUserContext } from '@/hooks/use-user-context';
import { daysAgoISO, isoMondayIndex } from '@/lib/mock/dates';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { useHealthStore } from '@/store/health-store';
import { usePlanStore } from '@/store/plan-store';
import { isExerciseCompleted, useTrainingProgressStore } from '@/store/training-progress-store';

export type HealthEnergy = {
  connected: boolean;
  /** Personal corrections for the energy model (empty until enough days are measured). */
  calibration: CalibrationResult | null;
  /** What the health app recorded on a date, ready for dayEnergy(); null when nothing was. */
  measuredFor: (date: string) => MeasuredDay | null;
  /** Steps recorded on a date, or null. */
  stepsFor: (date: string) => number | null;
};

/**
 * The health-app data as the energy model consumes it: the calibration learned
 * from the past weeks (resting kcal, workout factor) and each day's measurement.
 * Without a connected health app everything is null and the model stays a pure estimate.
 */
export function useHealthEnergy(): HealthEnergy {
  const provider = useHealthStore((s) => s.provider);
  const days = useHealthStore((s) => s.days);
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const completed = useTrainingProgressStore((s) => s.completed);
  const ctx = useUserContext();
  const today = daysAgoISO(0);

  const calibration = useMemo(() => {
    if (!provider) return null;
    const month = trainingPlan?.months.find((m) => m.monthIndex === currentMonthIndex(trainingPlan));
    const plannedFor = (date: string) => {
      const session = month?.weeklySplit[isoMondayIndex(date)];
      const exercises = session?.type === 'workout' ? (session.exercises ?? []) : [];
      const done = exercises.filter((ex) => isExerciseCompleted(completed, ex.id, date)).length;
      return { session, completion: exercises.length > 0 ? done / exercises.length : 0 };
    };
    return calibrateEnergy(Object.values(days), ctx, plannedFor, today);
  }, [provider, days, trainingPlan, completed, ctx, today]);

  const measuredFor = useCallback(
    (date: string): MeasuredDay | null => {
      const d = provider ? days[date] : undefined;
      if (!d || (d.steps == null && d.activeKcal == null && d.basalKcal == null)) return null;
      return { steps: d.steps, activeKcal: d.activeKcal, basalKcal: d.basalKcal, complete: date < today };
    },
    [provider, days, today]
  );

  const stepsFor = useCallback((date: string) => (provider ? (days[date]?.steps ?? null) : null), [provider, days]);

  return { connected: provider != null, calibration, measuredFor, stepsFor };
}

/** Reads fresh health data when the app opens and every time it comes back to the foreground. */
export function useHealthSync(): void {
  const provider = useHealthStore((s) => s.provider);
  const sync = useHealthStore((s) => s.sync);

  useEffect(() => {
    if (!provider) return;
    void sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => sub.remove();
  }, [provider, sync]);
}
