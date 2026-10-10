/** The phone's health store the app can read from: Apple Salute (HealthKit) on iPhone, Health Connect (Google) on Android. */
export type HealthProviderId = 'appleHealth' | 'healthConnect';

/** One calendar day (local time, YYYY-MM-DD) as recorded by the health app. */
export type HealthDay = {
  date: string;
  steps?: number;
  /** Calories burned moving (walking, workouts…). */
  activeKcal?: number;
  /** Calories burned at rest (basal metabolism). */
  basalKcal?: number;
};

export type HealthAvailability =
  | { available: true; provider: HealthProviderId }
  | {
      available: false;
      provider: HealthProviderId | null;
      /** web: no health store in a browser · expoGo: needs the app's own build · notInstalled / updateRequired: Health Connect missing or outdated · unsupported: the device has no health store. */
      reason: 'web' | 'expoGo' | 'notInstalled' | 'updateRequired' | 'unsupported';
    };

export type HealthProvider = {
  availability: () => Promise<HealthAvailability>;
  /** Shows the system permission sheet; true when access was granted (on iPhone Apple never tells whether reading was allowed, so true = the sheet was answered). */
  requestAccess: () => Promise<boolean>;
  /** Daily totals for every day from `from` to `to` (both local dates, inclusive). */
  readDays: (from: Date, to: Date) => Promise<HealthDay[]>;
  /** Opens the system screen where the person manages what the app can read. */
  openSettings?: () => void;
};

/** Local YYYY-MM-DD of a date. */
export function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local midnight at the start of `d`'s day. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
