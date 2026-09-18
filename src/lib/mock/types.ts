export type Sport = 'gym' | 'functional' | 'running' | 'swimming' | 'tennis' | 'cycling' | 'other';

export type Goal = 'loseFat' | 'gainMuscle' | 'maintainImprove' | 'gainStrength' | 'improveEndurance' | 'generalHealth';

export type Sex = 'male' | 'female' | 'unspecified';

export type UserProfile = {
  name: string;
  sex: Sex;
  /** Precise age in years (questionnaire v2) — replaces the earlier
   * ageRange bucket ("25-34"). */
  age: number;
  goal: Goal;
  sports: Sport[];
  heightCm: number;
  targetWeightKg: number;
  dailyCalorieTarget: number;
  macroTargetsG: { protein: number; carbs: number; fats: number };
  hydrationTargetMl: number;
};

export type BodyMetricSource = 'onboarding' | 'manual' | 'import';

export type BodyMetricSnapshot = {
  date: string;
  weightKg: number;
  bodyFatPct: number;
  muscleMassKg: number;
  shouldersCm: number;
  chestCm: number;
  bicepsCm: number;
  waistCm: number;
  hipsCm: number;
  thighCm: number;
  restingHeartRate: number;
  sleepHours: number;
  /** Where this row came from — 'onboarding' rows are baseline candidates
   * (see isBaseline). Optional/undefined for rows written before this
   * column existed. */
  source?: BodyMetricSource;
  /** True for a row created by resetStartingWeight (onboarding) — marks a
   * fresh starting point without deleting prior history, so accountStartDate
   * (see Home) can anchor on the most recent baseline instead of the very
   * first ever entry. Optional/undefined for rows written before this
   * column existed (pre-baseline accounts fall back to entries[0]). */
  isBaseline?: boolean;
};

export type InsightTone = 'positive' | 'warning' | 'neutral';

export type Insight = {
  id: string;
  tone: InsightTone;
  headline: string;
  body: string;
};
