/**
 * Manual activity logging (§ "Aggiungi allenamento" request) — separate
 * from the generated training plan's own completion tracking
 * (training-progress-store.ts): this covers ANY session the user did,
 * planned or not, so the estimated-expenditure model (targets.ts, spec §5
 * bis) isn't limited to "did you finish today's plan workout".
 */
export type ActivityType = 'gym' | 'running' | 'cycling' | 'swimming' | 'walking' | 'functional' | 'tennis' | 'other';
export type ActivityIntensity = 'low' | 'moderate' | 'high';

export const ACTIVITY_TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'gym', label: 'Palestra (pesi)' },
  { value: 'running', label: 'Corsa' },
  { value: 'cycling', label: 'Ciclismo' },
  { value: 'swimming', label: 'Nuoto' },
  { value: 'walking', label: 'Camminata' },
  { value: 'functional', label: 'Functional/CrossFit' },
  { value: 'tennis', label: 'Tennis/Padel' },
  { value: 'other', label: 'Altro' },
];

export const ACTIVITY_INTENSITY_OPTIONS: { value: ActivityIntensity; label: string }[] = [
  { value: 'low', label: 'Leggera' },
  { value: 'moderate', label: 'Moderata' },
  { value: 'high', label: 'Intensa' },
];

// MET (metabolic equivalent) ballpark per activity/intensity — Compendium
// of Physical Activities territory, the same kind of estimate
// exerciseContributionKcal (targets.ts) already uses for the plan-based
// contribution, not a personalized/measured value.
const MET_TABLE: Record<ActivityType, Record<ActivityIntensity, number>> = {
  gym: { low: 3, moderate: 5, high: 6 },
  running: { low: 7, moderate: 9.8, high: 12.8 },
  cycling: { low: 4, moderate: 8, high: 10 },
  swimming: { low: 6, moderate: 8, high: 10 },
  walking: { low: 2.8, moderate: 3.5, high: 4.5 },
  functional: { low: 5, moderate: 8, high: 10 },
  tennis: { low: 5, moderate: 7, high: 8 },
  other: { low: 3, moderate: 5, high: 7 },
};

export function estimateActivityKcal(activityType: ActivityType, intensity: ActivityIntensity, durationMinutes: number, weightKg: number): number {
  const met = MET_TABLE[activityType][intensity];
  return Math.round(met * weightKg * (durationMinutes / 60));
}
