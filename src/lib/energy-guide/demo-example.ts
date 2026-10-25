/**
 * The worked example behind the "Come leggere il grafico" carousel.
 *
 * Demonstration values only: nothing here is read from, or written to, the
 * user's stores. The example runs through the very functions Home uses —
 * `dayEnergy` for what was burned, `calorieBalance` / `readBalance` /
 * `balanceCaption` for the balance — so what the carousel shows is the
 * real chart's arithmetic, just on a made-up day.
 */
import { BALANCE_SCALE, balanceCaption, calorieBalance, readBalance, type BalanceReading } from '@/domain/calorie-balance';
import { dayEnergy, type DayEnergy } from '@/domain/energy';
import type { UserContext } from '@/domain/user-context';

/** A made-up person, for the expenditure model. */
const DEMO_PERSON: Pick<UserContext, 'sex' | 'age' | 'heightCm' | 'weightKg' | 'lifestyle' | 'training'> = {
  sex: 'male',
  age: 32,
  heightCm: 178,
  weightKg: 75,
  lifestyle: { job: 'seatedMobile', steps: '5000-8000', sleep: '7-8' },
  training: {
    gym: { daysPerWeek: 3, skill: 'intermediate', experience: '1-3years', splitPreference: 'fullBody', focus: 'hypertrophy' },
    running: null,
    availableDays: 3,
    sessionMinutes: 52,
    sessionBucket: '45-60',
    location: 'gym',
    equipment: [],
  },
};

/** The day of the example is a gym day, with the session done in full. */
const DEMO_SESSION = { type: 'workout' as const };

/** What the viewer can change in the example. */
export type DemoValues = {
  /** Calories from the day's food and drinks. */
  eatenKcal: number;
  /** Extra movement on top of the planned session (a walk, a bike ride…), like a logged activity on Home. */
  extraActivityKcal: number;
};

export const DEMO_CONFIG = {
  initial: { eatenKcal: 2400, extraActivityKcal: 150 } satisfies DemoValues,
  /** Daily balance goal of the example (a fat-loss plan): negative = deficit. */
  dailyGoalKcal: -300,
  /**
   * Within this many kcal of zero the example reads "in equilibrio". The same
   * reading convention as Home's (BALANCE_SCALE), not a physiological limit.
   */
  toleranceKcal: BALANCE_SCALE.toleranceKcal,
  eaten: { min: 500, max: 4500, step: 100 },
  extraActivity: { min: 0, max: 1200, step: 50 },
  /** The three presets, as a balance (intake − burned) to land on. */
  presets: { deficit: -400, even: 0, surplus: 350 },
} as const;

export type DemoPreset = keyof typeof DEMO_CONFIG.presets;

export type DemoDay = {
  eatenKcal: number;
  energy: DayEnergy;
  burnedKcal: number;
  /** Resting energy (BMR): the body's vital functions at rest. */
  basalKcal: number;
  /** Everything else the day burned: everyday movement, the session and any extra activity. */
  movementKcal: number;
  /** The part of movementKcal that came from training and logged activities. */
  trainingKcal: number;
  balanceKcal: number;
  goalKcal: number;
  toleranceKcal: number;
  reading: BalanceReading;
  caption: string;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

export function clampDemoValues(values: DemoValues): DemoValues {
  const { eaten, extraActivity } = DEMO_CONFIG;
  return {
    eatenKcal: clamp(Math.round(values.eatenKcal), eaten.min, eaten.max),
    extraActivityKcal: clamp(Math.round(values.extraActivityKcal), extraActivity.min, extraActivity.max),
  };
}

/** Every number the four charts show, derived from the example's values in one place. */
export function buildDemoDay(values: DemoValues, toleranceKcal: number = DEMO_CONFIG.toleranceKcal): DemoDay {
  const { eatenKcal, extraActivityKcal } = clampDemoValues(values);
  const energy = dayEnergy(DEMO_PERSON, DEMO_SESSION, 1, extraActivityKcal);
  const burnedKcal = energy.total;
  const goalKcal = DEMO_CONFIG.dailyGoalKcal;
  const reading = readBalance({ eatenKcal, burnedKcal, goalKcal, toleranceKcal });
  return {
    eatenKcal,
    energy,
    burnedKcal,
    basalKcal: energy.resting,
    // Derived from the total rather than summed again, so nothing is counted twice:
    // basal + movement is always exactly the total.
    movementKcal: burnedKcal - energy.resting,
    trainingKcal: energy.exercise,
    balanceKcal: calorieBalance(eatenKcal, burnedKcal),
    goalKcal,
    toleranceKcal,
    reading,
    caption: balanceCaption(reading),
  };
}

/** The example's values moved to a preset balance; the movement is kept, only the intake changes. */
export function applyDemoPreset(values: DemoValues, preset: DemoPreset): DemoValues {
  const { burnedKcal } = buildDemoDay(values);
  return clampDemoValues({ ...values, eatenKcal: burnedKcal + DEMO_CONFIG.presets[preset] });
}

/** One press of a stepper: snapped to the step grid (so a preset's odd value steps back onto round numbers), within its limits. */
export function stepValue(value: number, direction: 1 | -1, { min, max, step }: { min: number; max: number; step: number }): number {
  const next = direction > 0 ? Math.floor(value / step) * step + step : Math.ceil(value / step) * step - step;
  return clamp(next, min, max);
}
