import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { healthProvider } from '@/lib/health/health-provider';
import type { HealthAvailability, HealthDay, HealthProviderId } from '@/lib/health/types';
import { appJsonStorage } from '@/store/storage';

/** How far back a sync reads: enough for the calibration (domain/health-calibration.ts) and the weekly views. */
const SYNC_DAYS = 28;
/** A foreground sync is skipped when the last one is more recent than this. */
const MIN_SYNC_INTERVAL_MS = 10 * 60 * 1000;

type HealthState = {
  /** The connected health store, or null. */
  provider: HealthProviderId | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  /** Measured days by local date (YYYY-MM-DD). */
  days: Record<string, HealthDay>;
  isSyncing: boolean;
  lastError: string | null;
  availability: () => Promise<HealthAvailability>;
  /** Asks the system permission and, when granted, reads the last weeks right away. */
  connect: () => Promise<{ ok: boolean; message?: string }>;
  disconnect: () => void;
  sync: (options?: { force?: boolean }) => Promise<void>;
  /** Local-only reset on logout — see user-store.ts's clearLocal for why. */
  clearLocal: () => void;
};

const UNAVAILABLE_MESSAGE: Record<Extract<HealthAvailability, { available: false }>['reason'], string> = {
  web: 'Disponibile nell’app su iPhone e Android: dal browser non si può leggere un’app salute.',
  expoGo: 'Serve l’app FITLAB installata (build dell’app): Expo Go non può accedere ai dati salute.',
  notInstalled: 'Installa Health Connect dal Play Store, poi riprova.',
  updateRequired: 'Aggiorna Health Connect dal Play Store, poi riprova.',
  unsupported: 'Questo dispositivo non mette a disposizione i dati salute.',
};

export function unavailableMessage(a: HealthAvailability): string | null {
  return a.available ? null : UNAVAILABLE_MESSAGE[a.reason];
}

/**
 * Steps and calories (active and resting) read from Apple Salute / Health
 * Connect, one entry per day. Device-local: the data stays on the phone, like
 * the health store it comes from. Feeds the energy model through
 * hooks/use-health-energy.ts.
 */
export const useHealthStore = create<HealthState>()(
  persist(
    (set, get) => ({
      provider: null,
      connectedAt: null,
      lastSyncAt: null,
      days: {},
      isSyncing: false,
      lastError: null,
      availability: () => healthProvider.availability(),
      connect: async () => {
        try {
          const availability = await healthProvider.availability();
          if (!availability.available) return { ok: false, message: unavailableMessage(availability) ?? undefined };
          const granted = await healthProvider.requestAccess();
          if (!granted) return { ok: false, message: 'Accesso non concesso: puoi attivarlo dalle impostazioni dell’app salute.' };
          set({ provider: availability.provider, connectedAt: new Date().toISOString(), lastError: null });
          await get().sync({ force: true });
          return { ok: true };
        } catch (err) {
          console.warn('health connect failed', err);
          return { ok: false, message: 'Collegamento non riuscito. Riprova tra poco.' };
        }
      },
      disconnect: () => set({ provider: null, connectedAt: null, lastSyncAt: null, days: {}, lastError: null }),
      sync: async ({ force = false } = {}) => {
        const { provider, lastSyncAt, isSyncing } = get();
        if (!provider || isSyncing) return;
        if (!force && lastSyncAt && Date.now() - new Date(lastSyncAt).getTime() < MIN_SYNC_INTERVAL_MS) return;
        set({ isSyncing: true });
        try {
          const to = new Date();
          const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - (SYNC_DAYS - 1));
          const fresh = await healthProvider.readDays(from, to);
          const days = { ...get().days };
          for (const d of fresh) days[d.date] = d;
          // Keep a rolling window: older days no longer feed anything.
          const oldest = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 60);
          for (const date of Object.keys(days)) if (new Date(date) < oldest) delete days[date];
          set({ days, lastSyncAt: new Date().toISOString(), lastError: null });
        } catch (err) {
          console.warn('health sync failed', err);
          set({ lastError: 'Sincronizzazione non riuscita' });
        } finally {
          set({ isSyncing: false });
        }
      },
      clearLocal: () => set({ provider: null, connectedAt: null, lastSyncAt: null, days: {}, isSyncing: false, lastError: null }),
    }),
    {
      name: 'fitlab/health',
      storage: appJsonStorage,
      partialize: (s) => ({ provider: s.provider, connectedAt: s.connectedAt, lastSyncAt: s.lastSyncAt, days: s.days }),
    }
  )
);
