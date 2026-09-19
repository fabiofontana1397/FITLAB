import { deriveExerciseExclusions, filterByEquipment, selectExercises } from './exercise-constraints';
import {
  FOCUS_SCHEME,
  GYM_EXERCISES,
  HOME_EXERCISES,
  resolveSplitLabels,
  RUNNING_SESSIONS,
  suggestedLoadFor,
  WEEKDAY_LABELS,
  WEEKDAY_PATTERN,
  type ExerciseDef,
  type SplitLabel,
} from './exercise-library';
import { computePlanDurationMonths } from './plan-duration';
import { parseNumericAnswer } from '@/lib/questionnaire/parse-answer';
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

export type TrainingPlanInput = {
  answers: Record<string, unknown>;
  strategy?: TrainingStrategy | null;
  /** See DietPlanInput's field of the same name (diet-planner.ts) — same
   * monthly check-in regeneration mechanism, spec §0.4 punto 2. */
  preserveMonthsBefore?: number;
  existingMonths?: TrainingMonthPlan[];
};

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

/**
 * `skipAdattamento` (spec request): an intermediate/expert lifter doesn't
 * need a technique/ramp-up month — starting them there both undersells
 * their actual capability (lighter load, higher-rep "adattamento" scheme)
 * and reads as if the app assumed they were a beginner. Only a true
 * beginner (or a user who didn't answer gymSkillLevel at all) gets month 1
 * as 'adattamento'; everyone else goes straight to 'progressione'.
 */
function phaseForMonth(monthIndex: number, totalMonths: number, skipAdattamento: boolean): PlanPhaseKind {
  if (monthIndex === 1 && !skipAdattamento) return 'adattamento';
  if (monthIndex === totalMonths) return 'consolidamento';
  return 'progressione';
}

function isExperiencedLifter(gymSkillLevel: unknown): boolean {
  return gymSkillLevel === 'intermediate' || gymSkillLevel === 'expert';
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
  const { answers, strategy, preserveMonthsBefore, existingMonths } = input;
  const activities = Array.isArray(answers.activitiesPracticed) ? (answers.activitiesPracticed as string[]) : [];
  const practicesGym = activities.includes('gym');
  const practicesRunning = activities.includes('running');
  if (!practicesGym && !practicesRunning) return null;

  const durationMonths = computePlanDurationMonths(answers);
  const totalAvailable = availableDaysNum(answers.availableDays);
  const bodyweightKg = parseNumericAnswer(answers.currentWeightKg) ?? 75;

  let gymDays = practicesGym ? freqNum(answers.freq_gym) || 3 : 0;
  let runDays = practicesRunning ? freqNum(answers.freq_running) || 2 : 0;
  const totalWanted = gymDays + runDays;
  if (totalWanted > totalAvailable && totalWanted > 0) {
    gymDays = Math.max(practicesGym ? 1 : 0, Math.round((gymDays / totalWanted) * totalAvailable));
    runDays = Math.max(practicesRunning ? 1 : 0, totalAvailable - gymDays);
  }
  gymDays = Math.min(gymDays, 6);
  runDays = Math.min(runDays, 6 - gymDays);

  // Equipment filtering only applies at home — a gym is assumed to have
  // full equipment access (the questionnaire doesn't even ask the
  // equipment question outside trainingLocation=home). Filtering per split
  // up front (rather than inside the month loop) so it's computed once.
  const isHome = answers.trainingLocation === 'home';
  const basePool = isHome ? HOME_EXERCISES : GYM_EXERCISES;
  const exercisePool: Record<SplitLabel, ExerciseDef[]> = isHome
    ? (Object.fromEntries(
        (Object.entries(basePool) as [SplitLabel, ExerciseDef[]][]).map(([split, list]) => [split, filterByEquipment(list, answers.equipment)])
      ) as Record<SplitLabel, ExerciseDef[]>)
    : basePool;
  const wholeCatalog = Object.values(exercisePool).flat();
  const exclusions = deriveExerciseExclusions(answers);
  const exerciseCount = exerciseCountForDuration(answers.sessionDuration);
  const sanitizedStrategySplits = sanitizeSplitLabels(strategy?.splitLabels);
  const splitLabels: SplitLabel[] =
    sanitizedStrategySplits.length > 0 ? sanitizedStrategySplits : gymDays > 0 ? resolveSplitLabels(gymDays, answers.gymSkillLevel) : [];

  const focusGym = typeof answers.focus_gym === 'string' ? answers.focus_gym : 'hypertrophy';
  const focusRunning = typeof answers.focus_running === 'string' ? answers.focus_running : 'endurance';
  const gymScheme = strategy?.gymScheme ?? FOCUS_SCHEME[focusGym] ?? FOCUS_SCHEME.hypertrophy;
  const runSessions = strategy?.runSessions ?? RUNNING_SESSIONS[focusRunning] ?? RUNNING_SESSIONS.endurance;

  const combinedDays = Math.max(gymDays + runDays, 1);
  const dayIndices = WEEKDAY_PATTERN[combinedDays] ?? WEEKDAY_PATTERN[3];
  const gymSlots = dayIndices.slice(0, gymDays);
  const runSlots = dayIndices.slice(gymDays, gymDays + runDays);

  const skipAdattamento = isExperiencedLifter(answers.gymSkillLevel);
  let needsManualReview = existingMonths?.some((m) => m.weeklySplit.some((d) => d.exercises?.some((ex) => ex.needsManualReview))) ?? false;
  const months: TrainingMonthPlan[] = [];
  for (let monthIndex = 1; monthIndex <= durationMonths; monthIndex++) {
    if (preserveMonthsBefore != null && monthIndex < preserveMonthsBefore) {
      const existing = existingMonths?.find((m) => m.monthIndex === monthIndex);
      if (existing) {
        months.push(existing);
        continue;
      }
    }
    const phase = phaseForMonth(monthIndex, durationMonths, skipAdattamento);
    const scheme = phase === 'adattamento' ? gymScheme.adattamento : gymScheme.later;
    const runList = phase === 'adattamento' ? runSessions.adattamento : runSessions.later;

    const week: TrainingDayPlan[] = WEEKDAY_LABELS.map((weekday) => ({ weekday, type: 'rest', title: 'Riposo' }));

    gymSlots.forEach((dayIdx, i) => {
      const splitLabel = splitLabels[i % splitLabels.length];
      const { exercises: selected, usedSafeFallback } = selectExercises(exercisePool[splitLabel], exerciseCount, exclusions, wholeCatalog);
      if (usedSafeFallback) needsManualReview = true;
      const exercises: TrainingExerciseEntry[] = selected.map((def) => ({
        id: def.id,
        name: def.name,
        sets: scheme.sets,
        reps: scheme.reps,
        restSec: scheme.restSec,
        tempo: scheme.tempo,
        suggestedKg: suggestedLoadFor(def, bodyweightKg, phase === 'adattamento', answers.gymExperience),
        needsManualReview: usedSafeFallback,
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

  return { generatedAt: new Date().toISOString(), durationMonths, months, needsManualReview };
}
