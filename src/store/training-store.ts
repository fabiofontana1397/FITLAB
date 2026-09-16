import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { fetchStaticTemplateLogs, insertStaticTemplateLog } from '@/lib/api/training';
import { daysAgoISO } from '@/lib/mock/dates';
import type { Sport } from '@/lib/mock/types';
import { withAuthRetry } from '@/lib/supabase/retry';
import { useAuthStore } from '@/store/auth-store';
import { appJsonStorage } from '@/store/storage';

export type ExerciseTemplate = {
  id: string;
  name: string;
  targetSets: number;
  targetReps: string;
  restSec: number;
};

export type WorkoutTemplate = {
  id: string;
  title: string;
  dayLabel: string;
  exercises: ExerciseTemplate[];
};

export type PlanDay =
  | { type: 'workout'; templateId: string }
  | { type: 'cardio'; label: string; sport: Sport; durationMin: number }
  | { type: 'rest' };

/** Index 0 = Monday ... 6 = Sunday. */
export type WeeklyPlan = PlanDay[];

export type ExerciseSetLog = {
  id: string;
  date: string;
  templateId: string;
  exerciseId: string;
  reps: number;
  weightKg: number;
};

export const TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'push',
    title: 'Push Day — Petto / Spalle / Tricipiti',
    dayLabel: 'Push',
    exercises: [
      { id: 'panca-piana', name: 'Panca piana', targetSets: 4, targetReps: '6-8', restSec: 150 },
      { id: 'military-press', name: 'Military press', targetSets: 3, targetReps: '8-10', restSec: 120 },
      { id: 'dip-parallele', name: 'Dip alle parallele', targetSets: 3, targetReps: '10-12', restSec: 90 },
      { id: 'alzate-laterali', name: 'Alzate laterali', targetSets: 3, targetReps: '12-15', restSec: 60 },
    ],
  },
  {
    id: 'pull',
    title: 'Pull Day — Schiena / Bicipiti',
    dayLabel: 'Pull',
    exercises: [
      { id: 'stacco-da-terra', name: 'Stacco da terra', targetSets: 4, targetReps: '5-6', restSec: 180 },
      { id: 'trazioni-zavorrate', name: 'Trazioni zavorrate', targetSets: 3, targetReps: '6-8', restSec: 120 },
      { id: 'rematore-bilanciere', name: 'Rematore con bilanciere', targetSets: 3, targetReps: '8-10', restSec: 90 },
      { id: 'curl-bicipiti', name: 'Curl bicipiti', targetSets: 3, targetReps: '10-12', restSec: 60 },
    ],
  },
  {
    id: 'legs',
    title: 'Leg Day',
    dayLabel: 'Legs',
    exercises: [
      { id: 'back-squat', name: 'Back squat', targetSets: 4, targetReps: '5-6', restSec: 180 },
      { id: 'romanian-deadlift', name: 'Romanian deadlift', targetSets: 3, targetReps: '8-10', restSec: 120 },
      { id: 'leg-press', name: 'Leg press', targetSets: 3, targetReps: '10-12', restSec: 90 },
      { id: 'affondi', name: 'Affondi', targetSets: 3, targetReps: '12 per gamba', restSec: 90 },
    ],
  },
];

const DEFAULT_PLAN: WeeklyPlan = [
  { type: 'workout', templateId: 'push' }, // Lun
  { type: 'workout', templateId: 'pull' }, // Mar
  { type: 'workout', templateId: 'legs' }, // Mer
  { type: 'rest' }, // Gio
  { type: 'workout', templateId: 'push' }, // Ven
  { type: 'cardio', label: 'Corsa lunga', sport: 'running', durationMin: 55 }, // Sab
  { type: 'rest' }, // Dom
];

type TrainingState = {
  templates: WorkoutTemplate[];
  plan: WeeklyPlan;
  logs: ExerciseSetLog[];
  logSet: (templateId: string, exerciseId: string, reps: number, weightKg: number, date?: string) => void;
  syncFromServer: () => Promise<void>;
  /** Local-only reset on logout — see user-store.ts's clearLocal for why.
   * templates/plan are static app config, not user data, so they stay. */
  clearLocal: () => void;
};

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => ({
      templates: TEMPLATES,
      plan: DEFAULT_PLAN,
      logs: [],
      logSet: (templateId, exerciseId, reps, weightKg, date = daysAgoISO(0)) => {
        const log: ExerciseSetLog = { id: `${exerciseId}-${date}-${Date.now()}`, date, templateId, exerciseId, reps, weightKg };
        set((state) => ({ logs: [...state.logs, log] }));
        const userId = currentUserId();
        if (userId) insertStaticTemplateLog(userId, log).catch((err) => console.warn('insertStaticTemplateLog failed', err));
      },
      syncFromServer: async () => {
        const userId = currentUserId();
        if (!userId) return;
        try {
          const logs = await withAuthRetry(() => fetchStaticTemplateLogs(userId));
          set({ logs });
        } catch (err) {
          console.warn('training-store syncFromServer failed', err);
        }
      },
      clearLocal: () => set({ logs: [] }),
    }),
    { name: 'fitbro/training', storage: appJsonStorage, partialize: (state) => ({ templates: state.templates, plan: state.plan, logs: state.logs }) }
  )
);

export function templateById(templates: WorkoutTemplate[], id: string): WorkoutTemplate | undefined {
  return templates.find((t) => t.id === id);
}

export function setsForExerciseOnDate(
  logs: ExerciseSetLog[],
  exerciseId: string,
  date: string
): ExerciseSetLog[] {
  return logs.filter((l) => l.exerciseId === exerciseId && l.date === date);
}

/** Top (max weight) set per session date for one exercise, chronological. */
export function exerciseTopSetHistory(logs: ExerciseSetLog[], exerciseId: string): { date: string; weightKg: number }[] {
  const byDate = new Map<string, number>();
  for (const log of logs) {
    if (log.exerciseId !== exerciseId) continue;
    byDate.set(log.date, Math.max(byDate.get(log.date) ?? 0, log.weightKg));
  }
  return [...byDate.entries()]
    .map(([date, weightKg]) => ({ date, weightKg }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function isTemplateLoggedOnDate(logs: ExerciseSetLog[], templateId: string, date: string): boolean {
  return logs.some((l) => l.templateId === templateId && l.date === date);
}

export type KeyLiftProgress = { exerciseId: string; name: string; firstKg: number; lastKg: number; deltaPct: number };

export function keyLiftProgress(logs: ExerciseSetLog[], templates: WorkoutTemplate[]): KeyLiftProgress[] {
  const keyExerciseIds = ['panca-piana', 'back-squat', 'stacco-da-terra'];
  const results: KeyLiftProgress[] = [];
  for (const exerciseId of keyExerciseIds) {
    const history = exerciseTopSetHistory(logs, exerciseId);
    if (history.length < 2) continue;
    const name = templates.flatMap((t) => t.exercises).find((e) => e.id === exerciseId)?.name ?? exerciseId;
    const firstKg = history[0].weightKg;
    const lastKg = history[history.length - 1].weightKg;
    results.push({ exerciseId, name, firstKg, lastKg, deltaPct: firstKg ? ((lastKg - firstKg) / firstKg) * 100 : 0 });
  }
  return results;
}

/** Planned workout-days (gym or cardio) vs days with at least one log, over the trailing `days`. */
export function planAdherence(plan: WeeklyPlan, logs: ExerciseSetLog[], days = 14) {
  let planned = 0;
  let done = 0;
  for (let i = 0; i < days; i++) {
    const date = daysAgoISO(i);
    const weekday = new Date(date).getDay();
    const planIndex = (weekday + 6) % 7;
    const planDay = plan[planIndex];
    if (planDay.type === 'rest') continue;
    planned += 1;
    if (planDay.type === 'workout' && isTemplateLoggedOnDate(logs, planDay.templateId, date)) {
      done += 1;
    } else if (planDay.type === 'cardio') {
      // Cardio days are tracked outside the set-logger; count today as pending, past days as assumed done
      // to avoid penalizing a metric we can't (yet) verify from set logs.
      if (date !== daysAgoISO(0)) done += 1;
    }
  }
  return { planned, done };
}
