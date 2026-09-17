import { deriveExerciseExclusions, selectExercises } from './exercise-constraints';
import {
  FOCUS_SCHEME,
  GYM_EXERCISES,
  HOME_EXERCISES,
  RUNNING_SESSIONS,
  SPLIT_BY_FREQUENCY,
  suggestedLoadFor,
  WEEKDAY_LABELS,
  WEEKDAY_PATTERN,
  type SplitLabel,
} from './exercise-library';
import { computePlanDurationMonths } from './plan-duration';
import type { TrainingStrategy } from './strategy-types';
import type { PlanPhaseKind, TrainingDayPlan, TrainingExerciseEntry, TrainingMonthPlan, TrainingPlan } from './types';

/** How many exercises a session can reasonably fit — matched to the
 * questionnaire's actual sessionDuration answer instead of always 4. */
function exerciseCountForDuration(value: unknown): number {
  switch (value) {
    case 'lt30':
      return 3;
    case '30-45':
      return 4;
    case '45-60':
      return 5;
    case '60-90':
      return 6;
    case 'gt90':
      return 6;
    default:
      return 4;
  }
}

export type TrainingPlanInput = { answers: Record<string, unknown>; strategy?: TrainingStrategy | null };

// SplitLabel is a closed set that indexes GYM_EXERCISES/HOME_EXERCISES
// directly (exercisePool[splitLabel]) — an AI-produced strategy is
// free-form text, not guaranteed to stay within that vocabulary (observed
// in practice: a real response once used "Upper A"/"Lower A" instead of
// "Upper"/"Lower"), and an invalid label would crash the lookup. Filter to
// only the labels the catalog actually has, so a strategy with any
// out-of-vocabulary label falls back to the deterministic default instead
// of throwing.
const VALID_SPLIT_LABELS = new Set<SplitLabel>(['Full Body', 'Upper', 'Lower', 'Push', 'Pull', 'Legs']);
function sanitizeSplitLabels(labels: string[] | undefined): SplitLabel[] {
  if (!labels) return [];
  return labels.filter((l): l is SplitLabel => VALID_SPLIT_LABELS.has(l as SplitLabel));
}

function freqNum(value: unknown): number {
  if (value === '6+') return 6;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function availableDaysNum(value: unknown): number {
  if (value === '6+') return 6;
  if (value === 'variable') return 4;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

function phaseForMonth(monthIndex: number, totalMonths: number): PlanPhaseKind {
  if (monthIndex === 1) return 'adattamento';
  if (monthIndex === totalMonths) return 'consolidamento';
  return 'progressione';
}

function phaseTitle(phase: PlanPhaseKind): string {
  if (phase === 'adattamento') return 'Adattamento e tecnica';
  if (phase === 'consolidamento') return 'Consolidamento';
  return 'Sovraccarico progressivo';
}

function phaseNote(phase: PlanPhaseKind): string {
  if (phase === 'adattamento') {
    return 'Carichi gestibili e cura della tecnica per costruire una base solida e sicura.';
  }
  if (phase === 'consolidamento') {
    return 'Il carico si è stabilizzato: da qui il programma si mantiene e si aggiorna ogni mese sui tuoi progressi.';
  }
  return 'Il carico aumenta gradualmente (più peso, ripetizioni o volume) rispetto al mese precedente: è il motore della crescita.';
}

/**
 * Builds a month-by-month program covering whichever of gym/running the
 * user practices (the app's only two "trainable" activities — see
 * TRAINABLE_ACTIVITIES in lib/questionnaire/schema.ts). Returns null when
 * neither was selected, since there's nothing to build a program for.
 */
export function generateTrainingPlan(input: TrainingPlanInput): TrainingPlan | null {
  const { answers, strategy } = input;
  const activities = Array.isArray(answers.activitiesPracticed) ? (answers.activitiesPracticed as string[]) : [];
  const practicesGym = activities.includes('gym');
  const practicesRunning = activities.includes('running');
  if (!practicesGym && !practicesRunning) return null;

  const durationMonths = computePlanDurationMonths(answers);
  const totalAvailable = availableDaysNum(answers.availableDays);
  const bodyweightKg = Number(answers.currentWeightKg) || 75;

  let gymDays = practicesGym ? freqNum(answers.freq_gym) || 3 : 0;
  let runDays = practicesRunning ? freqNum(answers.freq_running) || 2 : 0;
  const totalWanted = gymDays + runDays;
  if (totalWanted > totalAvailable && totalWanted > 0) {
    gymDays = Math.max(practicesGym ? 1 : 0, Math.round((gymDays / totalWanted) * totalAvailable));
    runDays = Math.max(practicesRunning ? 1 : 0, totalAvailable - gymDays);
  }
  gymDays = Math.min(gymDays, 6);
  runDays = Math.min(runDays, 6 - gymDays);

  const exercisePool = answers.trainingLocation === 'home' ? HOME_EXERCISES : GYM_EXERCISES;
  const exclusions = deriveExerciseExclusions(answers);
  const exerciseCount = exerciseCountForDuration(answers.sessionDuration);
  const sanitizedStrategySplits = sanitizeSplitLabels(strategy?.splitLabels);
  const splitLabels: SplitLabel[] =
    sanitizedStrategySplits.length > 0
      ? sanitizedStrategySplits
      : gymDays > 0
        ? (SPLIT_BY_FREQUENCY[gymDays] ?? SPLIT_BY_FREQUENCY[3])
        : [];

  const focusGym = typeof answers.focus_gym === 'string' ? answers.focus_gym : 'hypertrophy';
  const focusRunning = typeof answers.focus_running === 'string' ? answers.focus_running : 'endurance';
  const gymScheme = strategy?.gymScheme ?? FOCUS_SCHEME[focusGym] ?? FOCUS_SCHEME.hypertrophy;
  const runSessions = strategy?.runSessions ?? RUNNING_SESSIONS[focusRunning] ?? RUNNING_SESSIONS.endurance;

  const combinedDays = Math.max(gymDays + runDays, 1);
  const dayIndices = WEEKDAY_PATTERN[combinedDays] ?? WEEKDAY_PATTERN[3];
  const gymSlots = dayIndices.slice(0, gymDays);
  const runSlots = dayIndices.slice(gymDays, gymDays + runDays);

  const months: TrainingMonthPlan[] = [];
  for (let monthIndex = 1; monthIndex <= durationMonths; monthIndex++) {
    const phase = phaseForMonth(monthIndex, durationMonths);
    const scheme = phase === 'adattamento' ? gymScheme.adattamento : gymScheme.later;
    const runList = phase === 'adattamento' ? runSessions.adattamento : runSessions.later;

    const week: TrainingDayPlan[] = WEEKDAY_LABELS.map((weekday) => ({ weekday, type: 'rest', title: 'Riposo' }));

    gymSlots.forEach((dayIdx, i) => {
      const splitLabel = splitLabels[i % splitLabels.length];
      const selected = selectExercises(exercisePool[splitLabel], exerciseCount, exclusions);
      const exercises: TrainingExerciseEntry[] = selected.map((def) => ({
        id: def.id,
        name: def.name,
        sets: scheme.sets,
        reps: scheme.reps,
        restSec: scheme.restSec,
        tempo: scheme.tempo,
        suggestedKg: suggestedLoadFor(def, bodyweightKg, phase === 'adattamento'),
      }));
      week[dayIdx] = { weekday: WEEKDAY_LABELS[dayIdx], type: 'workout', title: splitLabel, exercises };
    });

    runSlots.forEach((dayIdx, i) => {
      const session = runList[i % runList.length];
      week[dayIdx] = { weekday: WEEKDAY_LABELS[dayIdx], type: 'cardio', title: 'Corsa', note: session };
    });

    const monthlyFocus = strategy?.monthlyFocus?.find((m) => m.monthIndex === monthIndex);
    months.push({
      monthIndex,
      phase,
      title: monthlyFocus?.title ?? `Mese ${monthIndex} · ${phaseTitle(phase)}`,
      focusNote: monthlyFocus?.focusNote ?? phaseNote(phase),
      weeklySplit: week,
    });
  }

  return { generatedAt: new Date().toISOString(), durationMonths, months };
}
