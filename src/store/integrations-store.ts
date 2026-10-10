import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { appJsonStorage } from '@/store/storage';

export type IntegrationId = 'appleHealth' | 'healthConnect' | 'garmin' | 'fitbit' | 'whoop' | 'strava';

/** The kinds of data a wearable / health app can feed into FITLAB. */
export type IntegrationData = 'steps' | 'weight' | 'workouts' | 'sleep' | 'heartRate';

type IntegrationsState = {
  /** Providers the person turned on, with the data they allowed and when. */
  linked: Partial<Record<IntegrationId, { data: IntegrationData[]; since: string }>>;
  link: (id: IntegrationId, data: IntegrationData[]) => void;
  unlink: (id: IntegrationId) => void;
  clearLocal: () => void;
};

/**
 * Which health apps / wearables the person chose to connect from Profilo, and
 * what each one may share. The actual data sync needs the native SDKs
 * (HealthKit, Health Connect) and the vendors' cloud APIs (Garmin, Fitbit,
 * Whoop, Strava): this store is the consent those syncs will read.
 */
export const useIntegrationsStore = create<IntegrationsState>()(
  persist(
    (set, get) => ({
      linked: {},
      link: (id, data) => set({ linked: { ...get().linked, [id]: { data, since: new Date().toISOString() } } }),
      unlink: (id) => {
        const linked = { ...get().linked };
        delete linked[id];
        set({ linked });
      },
      clearLocal: () => set({ linked: {} }),
    }),
    { name: 'fitlab/integrations', storage: appJsonStorage }
  )
);
