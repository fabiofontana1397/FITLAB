import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { deleteBodyPhoto, fetchBodyMetrics, fetchBodyPhotos, replaceAllBodyMetrics, upsertBodyMetric, uploadBodyPhoto } from '@/lib/api/body';
import { daysAgoISO } from '@/lib/mock/dates';
import type { BodyMetricSnapshot } from '@/lib/mock/types';
import { withAuthRetry } from '@/lib/supabase/retry';
import { useAuthStore } from '@/store/auth-store';
import { appJsonStorage } from '@/store/storage';

// A real new account has no history yet — this is the "no previous entry
// to carry fields over from" fallback, not fabricated data (every field is
// zero/neutral, never a plausible-looking invented measurement).
const EMPTY_SNAPSHOT: Omit<BodyMetricSnapshot, 'date'> = {
  weightKg: 0,
  bodyFatPct: 0,
  muscleMassKg: 0,
  shouldersCm: 0,
  chestCm: 0,
  bicepsCm: 0,
  waistCm: 0,
  hipsCm: 0,
  thighCm: 0,
  restingHeartRate: 0,
  sleepHours: 0,
};

// The fixed shot list a progress-photo session should cover — see the
// instructions card on the Corpo screen. Front/back get a relaxed AND a
// flexed shot; sides are relaxed only.
export type BodyPhotoPose = 'frontRelaxed' | 'sideRightRelaxed' | 'sideLeftRelaxed' | 'backRelaxed' | 'frontFlexed' | 'backFlexed';

export type BodyPhoto = {
  id: string;
  uri: string;
  date: string;
  pose: BodyPhotoPose;
};

export const POSE_LABELS: Record<BodyPhotoPose, string> = {
  frontRelaxed: 'Frontale',
  sideRightRelaxed: 'Laterale dx',
  sideLeftRelaxed: 'Laterale sx',
  backRelaxed: 'Posteriore',
  frontFlexed: 'Frontale flesso',
  backFlexed: 'Posteriore flesso',
};

export const POSE_ORDER: BodyPhotoPose[] = ['frontRelaxed', 'sideRightRelaxed', 'sideLeftRelaxed', 'backRelaxed', 'frontFlexed', 'backFlexed'];

type BodyState = {
  entries: BodyMetricSnapshot[];
  photos: BodyPhoto[];
  addWeightEntry: (weightKg: number, date?: string) => void;
  resetStartingWeight: (weightKg: number, date?: string) => void;
  addMeasurement: (partial: Partial<Omit<BodyMetricSnapshot, 'date'>>, date?: string) => void;
  addPhoto: (uri: string, pose: BodyPhotoPose, date?: string) => void;
  removePhoto: (id: string) => void;
  // Server-authoritative refresh — called on sign-in/app start (see
  // src/app/_layout.tsx). This is optimistic-local/server-wins, NOT a
  // durable offline mutation queue: a mutation made while offline or if
  // the app is killed mid-upload can be silently dropped by the next
  // sync. Acceptable for quick, redoable actions (a weight entry, a
  // photo) in this pass; a real mutation queue is a legitimate later ask.
  syncFromServer: () => Promise<void>;
  /** Local-only reset on logout — see user-store.ts's clearLocal for why. */
  clearLocal: () => void;
};

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

export const useBodyStore = create<BodyState>()(
  persist(
    (set, get) => ({
      entries: [],
      photos: [],

      addWeightEntry: (weightKg, date = daysAgoISO(0)) => {
        set((state) => {
          const last = state.entries[state.entries.length - 1] ?? EMPTY_SNAPSHOT;
          const existingIndex = state.entries.findIndex((e) => e.date === date);
          const nextEntry: BodyMetricSnapshot = { ...last, date, weightKg };
          if (existingIndex >= 0) {
            const entries = [...state.entries];
            entries[existingIndex] = { ...entries[existingIndex], weightKg };
            return { entries };
          }
          return { entries: [...state.entries, nextEntry] };
        });
        const userId = currentUserId();
        const saved = get().entries.find((e) => e.date === date);
        if (userId && saved) upsertBodyMetric(userId, saved).catch((err) => console.warn('upsertBodyMetric failed', err));
      },

      // Called from onboarding: a real first-time user has no history yet, so this
      // replaces whatever's there (a stale/leftover entry) with a single fresh one
      // instead of grafting a user-entered weight onto unrelated old data.
      resetStartingWeight: (weightKg, date = daysAgoISO(0)) => {
        set((state) => {
          const template = state.entries[state.entries.length - 1] ?? EMPTY_SNAPSHOT;
          return { entries: [{ ...template, date, weightKg }] };
        });
        const userId = currentUserId();
        const saved = get().entries[0];
        if (userId && saved) replaceAllBodyMetrics(userId, saved).catch((err) => console.warn('replaceAllBodyMetrics failed', err));
      },

      addMeasurement: (partial, date = daysAgoISO(0)) => {
        set((state) => {
          const last = state.entries[state.entries.length - 1] ?? EMPTY_SNAPSHOT;
          const existingIndex = state.entries.findIndex((e) => e.date === date);
          if (existingIndex >= 0) {
            const entries = [...state.entries];
            entries[existingIndex] = { ...entries[existingIndex], ...partial };
            return { entries };
          }
          return { entries: [...state.entries, { ...last, ...partial, date }] };
        });
        const userId = currentUserId();
        const saved = get().entries.find((e) => e.date === date);
        if (userId && saved) upsertBodyMetric(userId, saved).catch((err) => console.warn('upsertBodyMetric failed', err));
      },

      addPhoto: (uri, pose, date = daysAgoISO(0)) => {
        const optimisticId = `photo-${Date.now()}`;
        set((state) => ({
          photos: [...state.photos, { id: optimisticId, uri, date, pose }],
        }));
        const userId = currentUserId();
        if (!userId) return;
        uploadBodyPhoto(userId, uri, pose, date)
          .then((saved) => {
            // Patch the optimistic local entry with the resolved signed
            // URL + real id once the upload/insert resolve.
            set((state) => ({
              photos: state.photos.map((p) => (p.id === optimisticId ? saved : p)),
            }));
          })
          .catch((err) => console.warn('uploadBodyPhoto failed', err));
      },

      removePhoto: (id) => {
        const photo = get().photos.find((p) => p.id === id);
        set((state) => ({ photos: state.photos.filter((p) => p.id !== id) }));
        const userId = currentUserId();
        if (userId && photo) deleteBodyPhoto(userId, id).catch((err) => console.warn('deleteBodyPhoto failed', err));
      },

      syncFromServer: async () => {
        const userId = currentUserId();
        if (!userId) return;
        try {
          const [entries, photos] = await Promise.all([
            withAuthRetry(() => fetchBodyMetrics(userId)),
            withAuthRetry(() => fetchBodyPhotos(userId)),
          ]);
          // Server is canonical once it has any data; a brand-new account
          // with zero rows keeps whatever's already local (normally also
          // empty) instead of forcing a redundant overwrite.
          set({
            entries: entries.length > 0 ? entries : get().entries,
            photos,
          });
        } catch (err) {
          console.warn('body-store syncFromServer failed', err);
        }
      },
      clearLocal: () => set({ entries: [], photos: [] }),
    }),
    { name: 'fitlab/body', storage: appJsonStorage }
  )
);
