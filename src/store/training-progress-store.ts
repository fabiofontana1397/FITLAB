import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  deleteCompletedExercise,
  deleteGeneratedPlanLog,
  fetchCompletedExercises,
  fetchGeneratedPlanLogs,
  insertCompletedExercise,
  insertGeneratedPlanLog,
} from '@/lib/api/training-progress';
import { daysAgoISO } from '@/lib/mock/dates';
import { useAuthStore } from '@/store/auth-store';
import { appJsonStorage } from '@/store/storage';

export type LoggedSet = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  reps: number;
  weightKg: number;
};

export type CompletedExercise = { exerciseId: string; date: string };

type TrainingProgressState = {
  sets: LoggedSet[];
  completed: CompletedExercise[];
  logSet: (exerciseId: string, exerciseName: string, reps: number, weightKg: number, date?: string) => void;
  removeSet: (id: string) => void;
  toggleCompleted: (exerciseId: string, date: string) => void;
  syncFromServer: () => Promise<void>;
};

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

/**
 * Actual logged sets against the *generated* training plan's exercises
 * (see lib/planning/training-planner.ts) — kept separate from
 * training-store.ts, which still backs the older static Push/Pull/Legs
 * templates used by the dashboard's "Piano di oggi". This is what proves
 * real progressive overload over the life of the generated plan.
 */
export const useTrainingProgressStore = create<TrainingProgressState>()(
  persist(
    (set, get) => ({
      sets: [],
      completed: [],
      logSet: (exerciseId, exerciseName, reps, weightKg, date = daysAgoISO(0)) => {
        const log: LoggedSet = { id: `${exerciseId}-${Date.now()}`, exerciseId, exerciseName, date, reps, weightKg };
        set((state) => ({ sets: [...state.sets, log] }));
        const userId = currentUserId();
        if (userId) insertGeneratedPlanLog(userId, log).catch((err) => console.warn('insertGeneratedPlanLog failed', err));
      },
      removeSet: (id) => {
        set((state) => ({ sets: state.sets.filter((s) => s.id !== id) }));
        const userId = currentUserId();
        if (userId) deleteGeneratedPlanLog(userId, id).catch((err) => console.warn('deleteGeneratedPlanLog failed', err));
      },
      toggleCompleted: (exerciseId, date) => {
        const existedBefore = get().completed.some((c) => c.exerciseId === exerciseId && c.date === date);
        set((state) => {
          const exists = state.completed.some((c) => c.exerciseId === exerciseId && c.date === date);
          return {
            completed: exists
              ? state.completed.filter((c) => !(c.exerciseId === exerciseId && c.date === date))
              : [...state.completed, { exerciseId, date }],
          };
        });
        const userId = currentUserId();
        if (userId) {
          const action = existedBefore ? deleteCompletedExercise(userId, exerciseId, date) : insertCompletedExercise(userId, exerciseId, date);
          action.catch((err) => console.warn('toggleCompleted sync failed', err));
        }
      },
      syncFromServer: async () => {
        const userId = currentUserId();
        if (!userId) return;
        try {
          const [sets, completed] = await Promise.all([fetchGeneratedPlanLogs(userId), fetchCompletedExercises(userId)]);
          if (sets.length > 0 || completed.length > 0) set({ sets, completed });
        } catch (err) {
          console.warn('training-progress-store syncFromServer failed', err);
        }
      },
    }),
    { name: 'fitbro/training-progress', storage: appJsonStorage }
  )
);

export function setsForExerciseOnDate(sets: LoggedSet[], exerciseId: string, date: string): LoggedSet[] {
  return sets.filter((s) => s.exerciseId === exerciseId && s.date === date);
}

/** Top (max weight) logged set per date for one exercise, chronological — feeds the mini progression chart. */
export function historyForExercise(sets: LoggedSet[], exerciseId: string): { date: string; weightKg: number }[] {
  const byDate = new Map<string, number>();
  for (const s of sets) {
    if (s.exerciseId !== exerciseId) continue;
    byDate.set(s.date, Math.max(byDate.get(s.date) ?? 0, s.weightKg));
  }
  return [...byDate.entries()]
    .map(([date, weightKg]) => ({ date, weightKg }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Most recently logged weight for an exercise, across all dates — used to prefill the next set. */
export function latestWeightForExercise(sets: LoggedSet[], exerciseId: string): number | null {
  const history = historyForExercise(sets, exerciseId);
  return history.length > 0 ? history[history.length - 1].weightKg : null;
}

export function isExerciseCompleted(completed: CompletedExercise[], exerciseId: string, date: string): boolean {
  return completed.some((c) => c.exerciseId === exerciseId && c.date === date);
}
