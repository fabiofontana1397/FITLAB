// iPhone: Apple Salute through HealthKit (@kingstinct/react-native-healthkit).
// The native module only exists in the app's own build (EAS / dev client): in
// Expo Go it is loaded lazily and reported as unavailable instead of crashing.
import Constants, { ExecutionEnvironment } from 'expo-constants';

import { localDay, startOfDay, type HealthDay, type HealthProvider } from './types';

type HealthKit = typeof import('@kingstinct/react-native-healthkit');

const STEPS = 'HKQuantityTypeIdentifierStepCount';
const ACTIVE = 'HKQuantityTypeIdentifierActiveEnergyBurned';
const BASAL = 'HKQuantityTypeIdentifierBasalEnergyBurned';
const READ = [STEPS, ACTIVE, BASAL] as const;

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let module: HealthKit | null | undefined;
function healthKit(): HealthKit | null {
  if (module !== undefined) return module;
  if (isExpoGo) return (module = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    module = require('@kingstinct/react-native-healthkit') as HealthKit;
  } catch (err) {
    console.warn('HealthKit not available', err);
    module = null;
  }
  return module;
}

export const healthProvider: HealthProvider = {
  availability: async () => {
    if (isExpoGo) return { available: false, provider: 'appleHealth', reason: 'expoGo' };
    const hk = healthKit();
    if (!hk || !hk.isHealthDataAvailable()) return { available: false, provider: 'appleHealth', reason: 'unsupported' };
    return { available: true, provider: 'appleHealth' };
  },

  requestAccess: async () => {
    const hk = healthKit();
    if (!hk) return false;
    return hk.requestAuthorization({ toRead: READ });
  },

  readDays: async (from, to) => {
    const hk = healthKit();
    if (!hk) return [];
    const anchor = startOfDay(from);
    const filter = { date: { startDate: anchor, endDate: to } };
    const byDay = new Map<string, HealthDay>();
    const put = (date: Date | undefined, key: 'steps' | 'activeKcal' | 'basalKcal', value: number | undefined) => {
      if (!date || value == null) return;
      const day = localDay(date);
      byDay.set(day, { ...(byDay.get(day) ?? { date: day }), [key]: Math.round(value) });
    };

    // Each type on its own: one the person did not allow must not hide the others.
    const [steps, active, basal] = await Promise.allSettled([
      hk.queryStatisticsCollectionForQuantity(STEPS, ['cumulativeSum'], anchor, { day: 1 }, { filter, unit: 'count' }),
      hk.queryStatisticsCollectionForQuantity(ACTIVE, ['cumulativeSum'], anchor, { day: 1 }, { filter, unit: 'kcal' }),
      hk.queryStatisticsCollectionForQuantity(BASAL, ['cumulativeSum'], anchor, { day: 1 }, { filter, unit: 'kcal' }),
    ]);
    if (steps.status === 'fulfilled') for (const s of steps.value) put(s.startDate, 'steps', s.sumQuantity?.quantity);
    if (active.status === 'fulfilled') for (const s of active.value) put(s.startDate, 'activeKcal', s.sumQuantity?.quantity);
    if (basal.status === 'fulfilled') for (const s of basal.value) put(s.startDate, 'basalKcal', s.sumQuantity?.quantity);
    return [...byDay.values()];
  },
};
