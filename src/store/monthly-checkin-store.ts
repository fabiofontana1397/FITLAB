import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { fetchMonthlyCheckins, upsertMonthlyCheckin } from '@/lib/api/monthly-checkin';
import { useAuthStore } from '@/store/auth-store';
import { appJsonStorage } from '@/store/storage';

type MonthlyCheckinState = {
  /** Month indices with a completed check-in — month N+1 unlocks once N is here. */
  completedMonths: number[];
  submitCheckin: (monthIndex: number, answers: Record<string, unknown>, weightTrendKg: number | null) => Promise<void>;
  syncFromServer: () => Promise<void>;
  /** Local-only reset on logout — see user-store.ts's clearLocal for why. */
  clearLocal: () => void;
};

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

export const useMonthlyCheckinStore = create<MonthlyCheckinState>()(
  persist(
    (set, get) => ({
      completedMonths: [],
      submitCheckin: async (monthIndex, answers, weightTrendKg) => {
        set({ completedMonths: [...new Set([...get().completedMonths, monthIndex])] });
        const userId = currentUserId();
        if (!userId) return;
        await upsertMonthlyCheckin(userId, monthIndex, answers, weightTrendKg);
      },
      syncFromServer: async () => {
        const userId = currentUserId();
        if (!userId) return;
        try {
          const rows = await fetchMonthlyCheckins(userId);
          set({ completedMonths: rows.map((r) => r.monthIndex) });
        } catch (err) {
          console.warn('monthly-checkin-store syncFromServer failed', err);
        }
      },
      clearLocal: () => set({ completedMonths: [] }),
    }),
    { name: 'fitlab/monthly-checkins', storage: appJsonStorage }
  )
);

/** Highest month index up to which the plan is unlocked purely by check-in
 * completion (independent of elapsed time) — month 1 needs no check-in,
 * month N (N>1) needs one for month N-1. Combine with currentMonthIndex()
 * (plan-progress.ts) for the actual unlock gate: a month must have both
 * elapsed AND its preceding check-in completed. */
export function checkinUnlockedThroughMonth(completedMonths: number[]): number {
  return completedMonths.length > 0 ? Math.max(...completedMonths) + 1 : 1;
}
