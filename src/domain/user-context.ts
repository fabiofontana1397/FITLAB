/**
 * UserContext — the ONE typed description of a person that every planning
 * engine (energy, targets, diet, training, recalibration) and every AI agent
 * works from.
 *
 * Why it exists: onboarding answers are a free-form `Record<string, unknown>`
 * (strings for numbers, option ids, free text), and each consumer used to
 * parse its own slice with its own defaults — which is how the same person got
 * two different calorie targets, an invented 75 kg goal weight, or phantom
 * training days from an old questionnaire. `buildUserContext` is the single
 * parse point: it validates, applies documented defaults, drops answers that
 * don't belong to the chosen mode, and reports every problem in `issues`.
 *
 * Pure TypeScript, no React Native / store imports, so it runs in the app, in
 * the test harness (scripts/agent-tests) and, later, inside Edge Functions.
 */
import { parseNumericAnswer } from '@/lib/questionnaire/parse-answer';
import { ONBOARDING_STEPS, stepsForMode } from '@/lib/questionnaire/schema';

export type Answers = Record<string, unknown>;

export type Goal = 'loseFat' | 'gainMuscle' | 'maintainImprove' | 'gainStrength' | 'improveEndurance' | 'generalHealth';
export type Sex = 'male' | 'female' | 'unspecified';
export type Mode = 'diet' | 'training' | 'both';
export type Skill = 'beginner' | 'intermediate' | 'expert';
export type GymFocus = 'strength' | 'hypertrophy' | 'fatLoss' | 'muscularEndurance' | 'technique';
export type RunFocus = 'endurance' | 'speed' | 'raceTime' | 'fatLoss' | 'raceReady';

/** Allowed ranges of the numeric answers (the app serves adults and teenagers, 16+). */
export const LIMITS = {
  age: { min: 16, max: 75 },
  heightCm: { min: 130, max: 220 },
  weightKg: { min: 35, max: 200 },
} as const;

export type Lifestyle = {
  /** Job activity (answer `jobActivity`). */
  job: 'sedentary' | 'seatedMobile' | 'standing' | 'active' | 'veryHeavy';
  /** Daily steps bucket (answer `dailySteps`). */
  steps: 'lt3000' | '3000-5000' | '5000-8000' | '8000-12000' | 'gt12000' | 'unknown';
  /** Sleep bucket (answer `sleepHoursRange`). */
  sleep: 'lt5' | '5-6' | '6-7' | '7-8' | 'gt8';
};

export type GymProfile = {
  daysPerWeek: number;
  skill: Skill;
  experience: 'never' | '3-12months' | '1-3years' | '3plusYears';
  splitPreference: 'noPreference' | 'fullBody' | 'upperLower' | 'pushPullLegs';
  focus: GymFocus;
};

export type RunProfile = { daysPerWeek: number; focus: RunFocus };

export type TrainingProfile = {
  gym: GymProfile | null;
  running: RunProfile | null;
  /** Days per week the person can realistically train (caps gym + running). */
  availableDays: number;
  /** Typical session length in minutes (midpoint of the chosen bucket). */
  sessionMinutes: number;
  sessionBucket: 'lt30' | '30-45' | '45-60' | '60-90' | 'gt90';
  location: 'gym' | 'home' | 'outdoor' | 'mixed';
  equipment: string[];
};

export type UserContext = {
  mode: Mode;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  goal: Goal;
  /** null = the person did not give a goal weight (never invented). */
  targetWeightKg: number | null;
  lifestyle: Lifestyle;
  /** null when the plan mode has no training part. */
  training: TrainingProfile | null;
  /** Under 18: no calorie deficit, growth comes first. */
  isMinor: boolean;
  /** The raw answers, for the parts that stay free-form (food preferences, limitations). */
  answers: Answers;
  /** Problems found while normalizing (missing / out of range / contradictory). */
  issues: ContextIssue[];
};

export type ContextIssue = { field: string; severity: 'error' | 'warning'; message: string };

const SESSION_MINUTES: Record<TrainingProfile['sessionBucket'], number> = { lt30: 25, '30-45': 37, '45-60': 52, '60-90': 75, gt90: 100 };

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function daysFrom(value: unknown, fallback: number): number {
  if (value === '6+') return 6;
  if (value === 'variable') return 4;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 6) : fallback;
}

/** Sessions per week from a `freq_*` answer. "Once every 2 weeks" / "once a month" are planned as 1 a week — the plan only schedules weekly sessions (minimum effective dose), and the calorie targets follow the plan. */
function frequencyFrom(value: unknown): number {
  if (value === '6+') return 6;
  if (value === 'biweekly' || value === 'monthly') return 1;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 6) : 0;
}

function inRange(field: string, value: number | null, range: { min: number; max: number }, issues: ContextIssue[], label: string): number | null {
  if (value == null) return null;
  if (value < range.min || value > range.max) {
    issues.push({ field, severity: 'error', message: `${label} fuori intervallo (${range.min}–${range.max})` });
  }
  return value;
}

export function buildUserContext(answers: Answers): UserContext {
  const issues: ContextIssue[] = [];
  const mode = oneOf<Mode>(answers.mode, ['diet', 'training', 'both'], 'both');

  const age = inRange('age', parseNumericAnswer(answers.age), LIMITS.age, issues, 'Età');
  const heightCm = inRange('heightCm', parseNumericAnswer(answers.heightCm), LIMITS.heightCm, issues, 'Altezza');
  const weightKg = inRange('currentWeightKg', parseNumericAnswer(answers.currentWeightKg), LIMITS.weightKg, issues, 'Peso');
  for (const [field, value] of [['age', age], ['heightCm', heightCm], ['currentWeightKg', weightKg]] as const) {
    if (value == null) issues.push({ field, severity: 'error', message: 'Dato mancante' });
  }
  const goal = oneOf<Goal>(answers.goal, ['loseFat', 'gainMuscle', 'maintainImprove', 'gainStrength', 'improveEndurance', 'generalHealth'], 'generalHealth');
  if (answers.goal === undefined) issues.push({ field: 'goal', severity: 'error', message: 'Obiettivo mancante' });

  let targetWeightKg = inRange('targetWeightKg', parseNumericAnswer(answers.targetWeightKg), LIMITS.weightKg, issues, 'Peso obiettivo');
  if (targetWeightKg != null && weightKg != null) {
    if (goal === 'loseFat' && targetWeightKg >= weightKg) {
      issues.push({ field: 'targetWeightKg', severity: 'warning', message: 'Obiettivo "perdere grasso" ma peso obiettivo non inferiore al peso attuale' });
    }
    if ((goal === 'gainMuscle' || goal === 'gainStrength') && targetWeightKg <= weightKg) {
      issues.push({ field: 'targetWeightKg', severity: 'warning', message: 'Obiettivo di aumento ma peso obiettivo non superiore al peso attuale' });
    }
    // A goal weight on the wrong side of the current weight is not a goal: ignore it rather than plan against it.
    if ((goal === 'loseFat' && targetWeightKg >= weightKg) || ((goal === 'gainMuscle' || goal === 'gainStrength') && targetWeightKg <= weightKg)) {
      targetWeightKg = null;
    }
  }

  const lifestyle: Lifestyle = {
    job: oneOf(answers.jobActivity, ['sedentary', 'seatedMobile', 'standing', 'active', 'veryHeavy'], 'sedentary'),
    steps: oneOf(answers.dailySteps, ['lt3000', '3000-5000', '5000-8000', '8000-12000', 'gt12000', 'unknown'], 'unknown'),
    sleep: oneOf(answers.sleepHoursRange, ['lt5', '5-6', '6-7', '7-8', 'gt8'], '6-7'),
  };

  let training: TrainingProfile | null = null;
  if (mode !== 'diet') {
    const activities = Array.isArray(answers.activitiesPracticed) ? (answers.activitiesPracticed as string[]) : [];
    const bucket = oneOf<TrainingProfile['sessionBucket']>(answers.sessionDuration, ['lt30', '30-45', '45-60', '60-90', 'gt90'], '45-60');
    const gym: GymProfile | null = activities.includes('gym')
      ? {
          daysPerWeek: frequencyFrom(answers.freq_gym),
          skill: oneOf<Skill>(answers.gymSkillLevel, ['beginner', 'intermediate', 'expert'], 'beginner'),
          experience: oneOf(answers.gymExperience, ['never', '3-12months', '1-3years', '3plusYears'], 'never'),
          splitPreference: oneOf(answers.gymSplitPreference, ['noPreference', 'fullBody', 'upperLower', 'pushPullLegs'], 'noPreference'),
          focus: oneOf<GymFocus>(answers.focus_gym, ['strength', 'hypertrophy', 'fatLoss', 'muscularEndurance', 'technique'], 'hypertrophy'),
        }
      : null;
    const running: RunProfile | null = activities.includes('running')
      ? { daysPerWeek: frequencyFrom(answers.freq_running), focus: oneOf<RunFocus>(answers.focus_running, ['endurance', 'speed', 'raceTime', 'fatLoss', 'raceReady'], 'endurance') }
      : null;
    for (const [id, value] of [['freq_gym', answers.freq_gym], ['freq_running', answers.freq_running]] as const) {
      if (value === 'biweekly' || value === 'monthly') issues.push({ field: id, severity: 'warning', message: 'Meno di una volta a settimana: nel piano diventa 1 seduta a settimana' });
    }
    training = {
      gym,
      running,
      availableDays: daysFrom(answers.availableDays, 3),
      sessionMinutes: SESSION_MINUTES[bucket],
      sessionBucket: bucket,
      location: oneOf(answers.trainingLocation, ['gym', 'home', 'outdoor', 'mixed'], 'gym'),
      equipment: Array.isArray(answers.equipment) ? (answers.equipment as string[]) : [],
    };
    if (!gym && !running) issues.push({ field: 'activitiesPracticed', severity: 'warning', message: 'Nessuna attività selezionata: nessun piano di allenamento' });
  }

  return {
    mode,
    sex: oneOf<Sex>(answers.sex, ['male', 'female', 'unspecified'], 'unspecified'),
    age: age ?? 30,
    heightCm: heightCm ?? 170,
    weightKg: weightKg ?? 70,
    goal,
    targetWeightKg,
    lifestyle,
    training,
    isMinor: (age ?? 30) < 18,
    answers,
    issues,
  };
}

/**
 * Drops the answers that do not belong to the chosen mode — e.g. the training
 * answers left over from an earlier questionnaire when the person now asks for a
 * diet only. Called when the questionnaire is confirmed so stale answers can
 * never leak into targets, plans or the AI.
 */
export function cleanAnswersForMode(answers: Record<string, unknown>): Record<string, unknown> {
  const mode = oneOf<Mode>(answers.mode, ['diet', 'training', 'both'], 'both');
  const allowed = new Set<string>(['mode']);
  for (const step of stepsForMode(mode)) for (const q of step.questions) allowed.add(q.id);
  const all = new Set(ONBOARDING_STEPS.flatMap((st) => st.questions.map((q) => q.id)));
  const keepTrainingDynamic = mode !== 'diet';
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (value === undefined) continue;
    const dynamic = key.startsWith('freq_') || key.startsWith('focus_');
    if (dynamic ? keepTrainingDynamic : allowed.has(key) || !all.has(key)) out[key] = value;
  }
  return out;
}
