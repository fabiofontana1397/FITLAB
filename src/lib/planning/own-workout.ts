import { WEEKDAY_LABELS } from './exercise-library';
import { CATALOG, CATALOG_BY_ID, MUSCLE_SHORT, type CatalogExercise, type MuscleGroup } from './training/catalog';
import type { TrainingDayPlan, TrainingExerciseEntry, TrainingPlan } from './types';

/**
 * "Fai da te" for training: the person picks the training days and, for each one, the exercises with sets,
 * reps and rest. The result is a normal week of the app (same Allenamento tab, session screen, GIFs), followed
 * as written like a loaded card.
 */

export type OwnExercise = { key: string; id: string; name: string; sets: string; reps: string; rest: string };
export type OwnDay = { title: string; exercises: OwnExercise[] };
/** Training days by weekday index (0 = Lunedì). */
export type OwnWeek = Record<number, OwnDay>;

export const WEEKDAY_FULL = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const DEFAULT_TEMPO = '2-0-2';

/** Groups of the picker, in the order people think of them. */
export const PICKER_GROUPS: { id: string; label: string; muscles: MuscleGroup[] }[] = [
  { id: 'chest', label: 'Petto', muscles: ['chest'] },
  { id: 'back', label: 'Schiena', muscles: ['lats', 'upperBack'] },
  { id: 'shoulders', label: 'Spalle', muscles: ['frontDelts', 'sideDelts', 'rearDelts'] },
  { id: 'legs', label: 'Gambe', muscles: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'] },
  { id: 'arms', label: 'Braccia', muscles: ['biceps', 'triceps', 'forearms'] },
  { id: 'core', label: 'Core', muscles: ['abs'] },
];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Catalog exercises matching the search text and the group: names that start with the text first ("panca" → the
 * bench presses before "Curl su panca inclinata"), then names that contain it, then keyword matches; by name within each.
 */
export function searchExercises(query: string, groupId: string | null): CatalogExercise[] {
  const q = normalize(query);
  const group = PICKER_GROUPS.find((g) => g.id === groupId);
  const rank = (e: CatalogExercise): number => {
    if (!q) return 0;
    const name = normalize(e.name);
    if (name.startsWith(q)) return 0;
    if (name.includes(q)) return 1;
    return e.keywords.some((k) => normalize(k).includes(q)) ? 2 : -1;
  };
  return CATALOG.filter((e) => !group || group.muscles.includes(e.primary))
    .map((e) => ({ e, r: rank(e) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.e.name.localeCompare(b.e.name, 'it'))
    .map((x) => x.e);
}

export function muscleLabel(id: string): string | null {
  const e = CATALOG_BY_ID.get(id);
  return e ? MUSCLE_SHORT[e.primary] : null;
}

/** A sensible starting scheme, which the person then changes: heavier for multi-joint lifts, longer sets for small muscles. */
export function defaultScheme(e: CatalogExercise | null): { sets: string; reps: string; rest: string } {
  if (e?.timed) return { sets: '3', reps: '30 s', rest: '60' };
  if (!e || e.kind === 'compound') return { sets: '4', reps: '8', rest: '120' };
  if (e.kind === 'core') return { sets: '3', reps: '15', rest: '60' };
  return { sets: '3', reps: '12', rest: '75' };
}

let seq = 0;
const nextKey = () => `x${Date.now().toString(36)}${(seq++).toString(36)}`;

export function exerciseFromCatalog(e: CatalogExercise): OwnExercise {
  return { key: nextKey(), id: e.id, name: e.name, ...defaultScheme(e) };
}

/** An exercise the catalog does not have, typed by the person. */
export function exerciseFromName(name: string): OwnExercise {
  const clean = name.trim().replace(/\s+/g, ' ');
  return { key: nextKey(), id: `custom-${normalize(clean).replace(/ /g, '-') || 'esercizio'}`, name: clean.charAt(0).toUpperCase() + clean.slice(1), ...defaultScheme(null) };
}

/** The week of a program the person built before, to edit it (the month being lived). */
export function ownWeekFromPlan(plan: Pick<TrainingPlan, 'months'>, monthIndex: number): OwnWeek {
  const month = plan.months.find((m) => m.monthIndex === monthIndex) ?? plan.months[0];
  const week: OwnWeek = {};
  month?.weeklySplit.forEach((d, i) => {
    if (d.type !== 'workout') return;
    const index = WEEKDAY_LABELS.indexOf(d.weekday);
    week[index >= 0 ? index : i] = {
      title: d.title,
      exercises: (d.exercises ?? []).map((x) => ({ key: nextKey(), id: x.id, name: x.name, sets: String(x.sets), reps: x.reps, rest: String(x.restSec) })),
    };
  });
  return week;
}

export const DEFAULT_OWN_WEEK = (): OwnWeek => ({ 0: { title: 'Allenamento A', exercises: [] }, 2: { title: 'Allenamento B', exercises: [] }, 4: { title: 'Allenamento C', exercises: [] } });

export type OwnIssue = { day: number | null; text: string };

/** What stops the program from being saved. */
export function validateOwnWeek(week: OwnWeek): OwnIssue[] {
  const days = Object.keys(week).map(Number);
  if (days.length === 0) return [{ day: null, text: 'Scegli almeno un giorno di allenamento.' }];
  const issues: OwnIssue[] = [];
  for (const d of days.sort((a, b) => a - b)) {
    const day = week[d];
    if (day.exercises.length === 0) {
      issues.push({ day: d, text: `${WEEKDAY_FULL[d]}: aggiungi almeno un esercizio.` });
      continue;
    }
    for (const x of day.exercises) {
      const sets = Number(x.sets);
      if (!Number.isInteger(sets) || sets < 1 || sets > 10) issues.push({ day: d, text: `${WEEKDAY_FULL[d]}, ${x.name}: le serie vanno da 1 a 10.` });
      if (!/\d/.test(x.reps)) issues.push({ day: d, text: `${WEEKDAY_FULL[d]}, ${x.name}: indica le ripetizioni (es. 8 o 8-10).` });
      const rest = Number(x.rest);
      if (!Number.isFinite(rest) || rest < 0 || rest > 600) issues.push({ day: d, text: `${WEEKDAY_FULL[d]}, ${x.name}: il recupero va da 0 a 600 secondi.` });
    }
  }
  return issues;
}

/** The full week (seven days, rest where nothing is planned) in the shape of the app's plans. */
export function buildOwnWeek(week: OwnWeek): TrainingDayPlan[] {
  return WEEKDAY_LABELS.map((weekday, i): TrainingDayPlan => {
    const day = week[i];
    if (!day) return { weekday, type: 'rest', title: 'Riposo' };
    return {
      weekday,
      type: 'workout',
      title: day.title.trim() || `Allenamento ${WEEKDAY_FULL[i]}`,
      exercises: day.exercises.map((x): TrainingExerciseEntry => {
        const cat = CATALOG_BY_ID.get(x.id);
        return {
          id: x.id,
          name: x.name,
          sets: Number(x.sets),
          reps: x.reps.trim(),
          restSec: Number(x.rest),
          suggestedKg: null,
          tempo: DEFAULT_TEMPO,
          ...(cat ? { loadIncrementKg: cat.increment } : {}),
        };
      }),
    };
  });
}
