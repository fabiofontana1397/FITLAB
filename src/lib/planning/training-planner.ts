import type { UserContext } from '@/domain/user-context';

import { deriveExerciseExclusions, filterByEquipment, selectExercises } from './exercise-constraints';
import {
  FOCUS_SCHEME,
  GYM_EXERCISES,
  HOME_EXERCISES,
  resolveSplitLabels,
  roundLoad,
  RUNNING_SESSIONS,
  suggestedLoadFor,
  WEEKDAY_LABELS,
  type ExerciseDef,
  type SetScheme,
  type SplitLabel,
} from './exercise-library';
import { resolveSchedule } from './training-days';
import type { TrainingStrategy } from './strategy-types';
import type { PlanPhaseKind, TrainingDayPlan, TrainingExerciseEntry, TrainingMonthPlan, TrainingPlan } from './types';

/** How many exercises a session can reasonably fit for the typical session length. */
function exerciseCountForDuration(bucket: string): number {
  switch (bucket) {
    case 'lt30':
      return 3;
    case '30-45':
      return 4;
    case '45-60':
      return 5;
    case '60-90':
    case 'gt90':
      return 6;
    default:
      return 4;
  }
}

export type TrainingPlanInput = {
  ctx: UserContext;
  durationMonths: number;
  strategy?: TrainingStrategy | null;
  /** Monthly recalibration: months before this index are copied verbatim from
   * `existingMonths` (a month already lived through never changes). */
  preserveMonthsBefore?: number;
  existingMonths?: TrainingMonthPlan[];
  /** Recalibration knobs — see lib/planning/recalibration.ts. */
  tuning?: TrainingTuning;
};

/** What the monthly recalibration can change in the next months' training. */
export type TrainingTuning = {
  /** Extra sets per exercise on top of the scheme (−1, 0, +1). */
  setsDelta?: number;
  /** Multiplier on suggested loads (e.g. 0.95 to ease off, 1.05 to push). */
  loadFactor?: number;
  /** Month index from which the tuning applies. */
  fromMonth?: number;
};

// SplitLabel is a closed set that indexes the exercise catalogs directly — an
// AI-produced strategy is free-form text, so keep only labels the catalog has.
const VALID_SPLIT_LABELS = new Set<SplitLabel>(['Full Body', 'Upper', 'Lower', 'Push', 'Pull', 'Legs']);
function sanitizeSplitLabels(labels: string[] | undefined): SplitLabel[] {
  if (!labels) return [];
  return labels.filter((l): l is SplitLabel => VALID_SPLIT_LABELS.has(l as SplitLabel));
}

/** Month 1 is a technique/ramp-up month only for beginners; the last month consolidates. */
function phaseForMonth(monthIndex: number, totalMonths: number, skipAdattamento: boolean): PlanPhaseKind {
  if (monthIndex === 1 && !skipAdattamento) return 'adattamento';
  if (monthIndex === totalMonths && totalMonths > 1) return 'consolidamento';
  return 'progressione';
}

function phaseTitle(phase: PlanPhaseKind): string {
  if (phase === 'adattamento') return 'Adattamento e tecnica';
  if (phase === 'consolidamento') return 'Consolidamento';
  return 'Sovraccarico progressivo';
}

function phaseNote(phase: PlanPhaseKind): string {
  if (phase === 'adattamento') return 'Carichi gestibili e cura della tecnica per costruire una base solida e sicura.';
  if (phase === 'consolidamento') return 'Il carico si stabilizza: consolidi quello che hai costruito prima del prossimo ciclo.';
  return 'Ogni mese il carico sale gradualmente (più peso o più serie) e a rotazione cambiano alcuni esercizi: è il motore della crescita.';
}

/** Rotates the tail of a priority-ordered pool so the key lifts stay and the accessories change. */
function rotateAccessories(pool: ExerciseDef[], steps: number, keep = 2): ExerciseDef[] {
  if (pool.length <= keep + 1 || steps === 0) return pool;
  const head = pool.slice(0, keep);
  const tail = pool.slice(keep);
  const k = steps % tail.length;
  return [...head, ...tail.slice(k), ...tail.slice(0, k)];
}

/**
 * Builds a month-by-month program covering whichever of gym/running the
 * person practices. Returns null when neither was selected.
 *
 * Progression (this is what makes the months different):
 *  - "progressione" months: suggested loads rise ~4% per month (cap +20%),
 *    one extra set from the third progression month, and every 2 months the
 *    accessory exercises rotate (the two key lifts per session stay);
 *  - "consolidamento": loads/sets hold at the last progression level.
 */
export function generateTrainingPlan(input: TrainingPlanInput): TrainingPlan | null {
  const { ctx, durationMonths, strategy, preserveMonthsBefore, existingMonths, tuning } = input;
  const t = ctx.training;
  if (!t || (!t.gym && !t.running)) return null;
  const answers = ctx.answers;

  const { gymSlots, runSlots } = resolveSchedule(ctx);
  const gymDays = gymSlots.length;

  // Equipment filtering only applies at home; outdoors/mixed trainees get the
  // bodyweight-and-light-equipment catalog rather than barbell/machine work.
  const lightCatalog = t.location === 'home' || t.location === 'outdoor' || t.location === 'mixed';
  const basePool = lightCatalog ? HOME_EXERCISES : GYM_EXERCISES;
  const bodyweightOrBands = (e: ExerciseDef) => !e.equipment || e.equipment.length === 0 || e.equipment.includes('bands');
  const exercisePool = {} as Record<SplitLabel, ExerciseDef[]>;
  for (const split of Object.keys(basePool) as SplitLabel[]) {
    const list = basePool[split];
    if (t.location === 'home') exercisePool[split] = filterByEquipment(list, t.equipment);
    else if (lightCatalog) exercisePool[split] = list.filter(bodyweightOrBands);
    else exercisePool[split] = list;
  }
  const wholeCatalog = Object.values(exercisePool).flat();
  const exclusions = deriveExerciseExclusions(answers);
  const exerciseCount = exerciseCountForDuration(t.sessionBucket);

  const gym = t.gym;
  const hasExplicitSplitPreference = !!gym && gym.splitPreference !== 'noPreference';
  const sanitizedStrategySplits = sanitizeSplitLabels(strategy?.splitLabels);
  const splitLabels: SplitLabel[] =
    gymDays === 0 || !gym
      ? []
      : hasExplicitSplitPreference
        ? resolveSplitLabels(gymDays, gym.skill, gym.splitPreference)
        : sanitizedStrategySplits.length > 0
          ? sanitizedStrategySplits
          : resolveSplitLabels(gymDays, gym.skill);

  const gymScheme = strategy?.gymScheme ?? FOCUS_SCHEME[gym?.focus ?? 'hypertrophy'] ?? FOCUS_SCHEME.hypertrophy;
  const runSessions = strategy?.runSessions ?? RUNNING_SESSIONS[t.running?.focus ?? 'endurance'] ?? RUNNING_SESSIONS.endurance;

  const skipAdattamento = !!gym && gym.skill !== 'beginner';
  let needsManualReview = existingMonths?.some((m) => m.weeklySplit.some((d) => d.exercises?.some((ex) => ex.needsManualReview))) ?? false;
  const months: TrainingMonthPlan[] = [];
  let progressionIndex = -1; // 0 for the first progression month
  for (let monthIndex = 1; monthIndex <= durationMonths; monthIndex++) {
    const phase = phaseForMonth(monthIndex, durationMonths, skipAdattamento);
    if (phase === 'progressione') progressionIndex++;
    if (preserveMonthsBefore != null && monthIndex < preserveMonthsBefore) {
      const existing = existingMonths?.find((m) => m.monthIndex === monthIndex);
      if (existing) {
        months.push(existing);
        continue;
      }
    }
    const level = Math.max(progressionIndex, 0);
    const baseScheme: SetScheme = phase === 'adattamento' ? gymScheme.adattamento : gymScheme.later;
    const tuningActive = tuning != null && monthIndex >= (tuning.fromMonth ?? 1);
    const volumeBoost = phase !== 'adattamento' && level >= 2 && baseScheme.sets < 5 ? 1 : 0;
    const sets = Math.min(Math.max(baseScheme.sets + volumeBoost + (tuningActive ? (tuning?.setsDelta ?? 0) : 0), 2), 6);
    const loadFactor = (phase === 'adattamento' ? 1 : 1 + Math.min(level * 0.04, 0.2)) * (tuningActive ? (tuning?.loadFactor ?? 1) : 1);
    const runList = phase === 'adattamento' ? runSessions.adattamento : runSessions.later;
    const rotation = Math.floor(level / 2);

    const week: TrainingDayPlan[] = WEEKDAY_LABELS.map((weekday) => ({ weekday, type: 'rest', title: 'Riposo' }));

    gymSlots.forEach((dayIdx, i) => {
      const splitLabel = splitLabels[i % splitLabels.length];
      const pool = rotateAccessories(exercisePool[splitLabel], rotation);
      const { exercises: selected, usedSafeFallback } = selectExercises(pool, exerciseCount, exclusions, wholeCatalog);
      if (usedSafeFallback) needsManualReview = true;
      const exercises: TrainingExerciseEntry[] = selected.map((def) => {
        const base = suggestedLoadFor(def, ctx.weightKg, phase === 'adattamento', gym?.experience);
        return {
          id: def.id,
          name: def.name,
          sets,
          reps: baseScheme.reps,
          restSec: baseScheme.restSec,
          tempo: baseScheme.tempo,
          suggestedKg: base == null ? null : roundLoad(base * loadFactor),
          needsManualReview: usedSafeFallback,
        };
      });
      week[dayIdx] = { weekday: WEEKDAY_LABELS[dayIdx], type: 'workout', title: splitLabel, exercises };
    });

    runSlots.forEach((dayIdx, i) => {
      week[dayIdx] = { weekday: WEEKDAY_LABELS[dayIdx], type: 'cardio', title: 'Corsa', note: runList[i % runList.length] };
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

/** Month 1's week for a context, used to size energy targets before the full plan exists. */
export function provisionalTrainingWeek(ctx: UserContext): TrainingDayPlan[] | null {
  const plan = generateTrainingPlan({ ctx, durationMonths: 4 });
  return plan?.months[0].weeklySplit ?? null;
}
