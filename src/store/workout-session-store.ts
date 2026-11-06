import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { appJsonStorage } from '@/store/storage';

/**
 * The guided workout in progress ("Inizia allenamento"), kept so leaving the
 * session with the X is not the end of it: the card says "Riprendi" and the
 * session reopens exactly where it was, with no 3-2-1 countdown again.
 * Everything here is plain JSON so it survives the app being closed.
 */
export type ActiveWorkoutSession = {
  /** The day the sets are logged against (the session is for that day's workout). */
  date: string;
  title: string;
  startedAt: number;
  /** Workout time banked before the current run segment, in ms. */
  elapsedMs: number;
  /** When the current run segment began; null while paused. */
  runSince: number | null;
  /** Last time this snapshot was written (to bound a segment that was never closed). */
  savedAt: number;
  exIndex: number;
  /** Sets done per exercise id. */
  doneMap: Record<string, number>;
  loads: Record<string, number | null>;
  phase: 'ready' | 'resting';
  restTotal: number;
  restEndsAt: number | null;
  /** Seconds of rest left while frozen (paused or left). */
  pausedLeft: number | null;
  restAfter: { name: string; set: number } | null;
};

type WorkoutSessionState = {
  active: ActiveWorkoutSession | null;
  save: (session: ActiveWorkoutSession) => void;
  clear: () => void;
};

export const useWorkoutSessionStore = create<WorkoutSessionState>()(
  persist(
    (set) => ({
      active: null,
      save: (session) => set({ active: session }),
      clear: () => set({ active: null }),
    }),
    { name: 'fitlab/workout-session', storage: appJsonStorage, version: 0 }
  )
);

/** Workout time of a saved session in ms, counting a segment that was left running up to its last save. */
export function savedElapsedMs(session: ActiveWorkoutSession): number {
  return session.runSince != null ? session.elapsedMs + Math.max(0, session.savedAt - session.runSince) : session.elapsedMs;
}
