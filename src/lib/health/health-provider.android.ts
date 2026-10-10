// Android: Health Connect, Google's health store (react-native-health-connect).
// It is where Google Fit, Samsung Health, Fitbit and most Android watches write
// their data, so one connection covers them all. The native module only exists
// in the app's own build: in Expo Go it is reported as unavailable.
import Constants, { ExecutionEnvironment } from 'expo-constants';

import { localDay, startOfDay, type HealthDay, type HealthProvider } from './types';

type HealthConnect = typeof import('react-native-health-connect');

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let module: HealthConnect | null | undefined;
function healthConnect(): HealthConnect | null {
  if (module !== undefined) return module;
  if (isExpoGo) return (module = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    module = require('react-native-health-connect') as HealthConnect;
  } catch (err) {
    console.warn('Health Connect not available', err);
    module = null;
  }
  return module;
}

let initialized = false;
async function ready(hc: HealthConnect): Promise<boolean> {
  if (!initialized) initialized = await hc.initialize();
  return initialized;
}

const PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
  { accessType: 'read', recordType: 'BasalMetabolicRate' },
] as const;

export const healthProvider: HealthProvider = {
  availability: async () => {
    if (isExpoGo) return { available: false, provider: 'healthConnect', reason: 'expoGo' };
    const hc = healthConnect();
    if (!hc) return { available: false, provider: 'healthConnect', reason: 'unsupported' };
    const status = await hc.getSdkStatus();
    if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE) return { available: false, provider: 'healthConnect', reason: 'notInstalled' };
    if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return { available: false, provider: 'healthConnect', reason: 'updateRequired' };
    return { available: true, provider: 'healthConnect' };
  },

  requestAccess: async () => {
    const hc = healthConnect();
    if (!hc || !(await ready(hc))) return false;
    const granted = await hc.requestPermission([...PERMISSIONS]);
    return granted.some((p) => 'recordType' in p && (p.recordType === 'Steps' || p.recordType === 'ActiveCaloriesBurned' || p.recordType === 'TotalCaloriesBurned'));
  },

  readDays: async (from, to) => {
    const hc = healthConnect();
    if (!hc || !(await ready(hc))) return [];
    const timeRangeFilter = { operator: 'between' as const, startTime: startOfDay(from).toISOString(), endTime: to.toISOString() };
    const timeRangeSlicer = { period: 'DAYS' as const, length: 1 };
    const byDay = new Map<string, HealthDay>();
    const put = (startTime: string, key: 'steps' | 'activeKcal' | 'basalKcal' | 'totalKcal', value: number | undefined) => {
      if (value == null || !(value > 0)) return;
      const day = localDay(new Date(startTime));
      byDay.set(day, { ...(byDay.get(day) ?? { date: day }), [key]: Math.round(value) } as HealthDay);
    };

    // Each type on its own: one the person did not allow must not hide the others.
    const [steps, active, total, basal] = await Promise.allSettled([
      hc.aggregateGroupByPeriod({ recordType: 'Steps', timeRangeFilter, timeRangeSlicer }),
      hc.aggregateGroupByPeriod({ recordType: 'ActiveCaloriesBurned', timeRangeFilter, timeRangeSlicer }),
      hc.aggregateGroupByPeriod({ recordType: 'TotalCaloriesBurned', timeRangeFilter, timeRangeSlicer }),
      hc.aggregateGroupByPeriod({ recordType: 'BasalMetabolicRate', timeRangeFilter, timeRangeSlicer }),
    ]);
    if (steps.status === 'fulfilled') for (const g of steps.value) put(g.startTime, 'steps', g.result.COUNT_TOTAL);
    if (active.status === 'fulfilled') for (const g of active.value) put(g.startTime, 'activeKcal', g.result.ACTIVE_CALORIES_TOTAL?.inKilocalories);
    if (total.status === 'fulfilled') for (const g of total.value) put(g.startTime, 'totalKcal', g.result.ENERGY_TOTAL?.inKilocalories);
    if (basal.status === 'fulfilled') for (const g of basal.value) put(g.startTime, 'basalKcal', g.result.BASAL_CALORIES_TOTAL?.inKilocalories);

    // Many Android sources only write the total: resting = total − active when no basal is recorded,
    // active = total − resting when only the basal is.
    return [...byDay.values()].map((d) => {
      const { totalKcal, ...day } = d as HealthDay & { totalKcal?: number };
      if (totalKcal != null) {
        if (day.basalKcal == null && day.activeKcal != null && totalKcal > day.activeKcal) day.basalKcal = totalKcal - day.activeKcal;
        else if (day.activeKcal == null && day.basalKcal != null && totalKcal > day.basalKcal) day.activeKcal = totalKcal - day.basalKcal;
      }
      return day;
    });
  },

  openSettings: () => healthConnect()?.openHealthConnectSettings(),
};
