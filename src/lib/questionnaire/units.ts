/**
 * Display units for the onboarding pickers.
 *
 * The questionnaire's canonical answers never change: `heightCm` is always
 * centimetres and `currentWeightKg`/`targetWeightKg` are always kilograms —
 * that is what `domain/user-context.ts` parses and what the backend stores.
 * A unit toggle only changes what the ruler *draws*; the stored number is
 * converted back on every commit, and switching units on its own never
 * writes an answer (so toggling kg → lb → kg can't walk the value away
 * through repeated rounding).
 */

export type MassUnit = 'kg' | 'lb';
export type LengthUnit = 'cm' | 'ftin';

const LB_PER_KG = 2.2046226218487757;
const CM_PER_INCH = 2.54;

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const cmToInches = (cm: number) => cm / CM_PER_INCH;
export const inchesToCm = (inches: number) => inches * CM_PER_INCH;

/** Rounds to `step`'s precision — the ruler's ticks are the only values a drag can land on. */
export function roundToStep(value: number, step: number): number {
  const decimals = Math.max(0, String(step).split('.')[1]?.length ?? 0);
  return Number((Math.round(value / step) * step).toFixed(decimals));
}

/** "5' 11"" — feet/inches are shown as one label, never as two editable fields. */
export function formatFeetInches(cm: number): string {
  const totalInches = Math.round(cmToInches(cm));
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}' ${inches}"`;
}

export function formatMass(kg: number, unit: MassUnit): string {
  return unit === 'kg' ? kg.toFixed(1).replace('.', ',') : kgToLb(kg).toFixed(1).replace('.', ',');
}

export function formatLength(cm: number, unit: LengthUnit): string {
  return unit === 'cm' ? String(Math.round(cm)) : formatFeetInches(cm);
}

export const massUnitLabel: Record<MassUnit, string> = { kg: 'kg', lb: 'lb' };
export const lengthUnitLabel: Record<LengthUnit, string> = { cm: 'cm', ftin: 'ft/in' };
