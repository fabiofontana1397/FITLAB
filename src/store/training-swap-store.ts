import { create } from "zustand";
import { persist } from "zustand/middleware";

import { isoMondayIndex } from "@/lib/mock/dates";
import { appJsonStorage } from "@/store/storage";

type TrainingSwapState = {
  /** date → the date whose planned session is done on it. Absent = its own. */
  swaps: Record<string, string>;
  /** Exchange the sessions planned on two days of the plan's week. */
  swapDays: (a: string, b: string) => void;
  clearLocal: () => void;
};

/**
 * The user moving a session to another day of the week ("anticipate Thursday's
 * chest to today, today's shoulders to Thursday"). The plan itself is never
 * edited: each date just says which weekday's session it runs.
 */
export const useTrainingSwapStore = create<TrainingSwapState>()(
  persist(
    (set) => ({
      swaps: {},
      swapDays: (a, b) =>
        set((s) => {
          const next = { ...s.swaps };
          const sourceA = next[a] ?? a;
          const sourceB = next[b] ?? b;
          for (const [date, source] of [
            [a, sourceB],
            [b, sourceA],
          ] as const) {
            if (source === date) delete next[date];
            else next[date] = source;
          }
          return { swaps: next };
        }),
      clearLocal: () => set({ swaps: {} }),
    }),
    { name: "fitlab/training-swaps", storage: appJsonStorage, version: 0 },
  ),
);

/** Index into a month's weeklySplit for `date`, honouring a moved session. */
export function planIndexFor(
  date: string,
  swaps: Record<string, string>,
): number {
  return isoMondayIndex(swaps[date] ?? date);
}
