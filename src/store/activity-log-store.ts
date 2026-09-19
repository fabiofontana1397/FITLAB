import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { deleteActivityLog, fetchActivityLog, insertActivityLog, type LoggedActivity } from '@/lib/api/activity-log';
import { estimateActivityKcal, type ActivityIntensity, type ActivityType } from '@/lib/nutrition/activity-log';
import { daysAgoISO } from '@/lib/mock/dates';
import { useAuthStore } from '@/store/auth-store';
import { appJsonStorage } from '@/store/storage';

type ActivityLogState = {
  entries: LoggedActivity[];
  addEntry: (activityType: ActivityType, intensity: ActivityIntensity, durationMinutes: number, weightKg: number, date?: string) => void;
  removeEntry: (id: string) => void;
  syncFromServer: () => Promise<void>;
  clearLocal: () => void;
};

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

export const useActivityLogStore = create<ActivityLogState>()(
  persist(
    (set, get) => ({
      entries: [],
      addEntry: (activityType, intensity, durationMinutes, weightKg, date = daysAgoISO(0)) => {
        const estimatedKcal = estimateActivityKcal(activityType, intensity, durationMinutes, weightKg);
        const optimisticId = `activity-${Date.now()}`;
        set((state) => ({
          entries: [...state.entries, { id: optimisticId, date, activityType, durationMinutes, intensity, estimatedKcal }],
        }));
        const userId = currentUserId();
        if (!userId) return;
        insertActivityLog(userId, { date, activityType, durationMinutes, intensity, estimatedKcal })
          .then((saved) => {
            set((state) => ({ entries: state.entries.map((e) => (e.id === optimisticId ? saved : e)) }));
          })
          .catch((err) => console.warn('insertActivityLog failed', err));
      },
      removeEntry: (id) => {
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
        const userId = currentUserId();
        if (userId) deleteActivityLog(userId, id).catch((err) => console.warn('deleteActivityLog failed', err));
      },
      syncFromServer: async () => {
        const userId = currentUserId();
        if (!userId) return;
        try {
          const entries = await fetchActivityLog(userId);
          set({ entries });
        } catch (err) {
          console.warn('activity-log-store syncFromServer failed', err);
        }
      },
      clearLocal: () => set({ entries: [] }),
    }),
    { name: 'fitlab/activity-log', storage: appJsonStorage }
  )
);
