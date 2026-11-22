/**
 * Allenamento spot: a single workout for one area (glutes, chest, core…), outside the weekly plan.
 *
 * Every focus has a few sessions for the gym and for home; the one shown rotates with the day, so each day has its
 * own "workout of the day". The exercises come from the engine's catalog (same names, cues and GIFs as the plan) and
 * follow the same evidence-based rules: compound first, then isolation, 2–3 reps in reserve, rests sized on the kind
 * of exercise. Starting loads use the plan's load engine (estimated, always to calibrate) and later sessions use the
 * person's own logged sets. Duration and calories are estimated from the sets and rests and the activity's MET, the
 * same estimate used when the workout is logged. Plain data, no React Native import.
 */
import { estimateActivityKcal, type ActivityIntensity, type ActivityType } from '@/lib/nutrition/activity-log';

import type { TrainingExerciseEntry } from '../types';
import { CATALOG_BY_ID, MUSCLE_SHORT, type CatalogExercise, type Equipment, type MuscleGroup } from './catalog';
import { initialLoad } from './loads';
import type { Level } from './profile';

export type SpotFocus = 'glutes' | 'legs' | 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'total';
export type SpotPlace = 'gym' | 'home';

/** [catalog id, sets, reps ("8-10", or "40 s" for a hold), rest in seconds] */
type Item = [string, number, string, number];
type Template = { title: string; note: string; intensity: ActivityIntensity; activity: ActivityType; items: Item[] };

export const SPOT_FOCUS: { value: SpotFocus; label: string; blurb: string }[] = [
  { value: 'glutes', label: 'Glutei', blurb: 'Spinta d’anca e affondi' },
  { value: 'legs', label: 'Gambe', blurb: 'Quadricipiti e femorali' },
  { value: 'chest', label: 'Petto', blurb: 'Spinte e croci' },
  { value: 'back', label: 'Schiena', blurb: 'Trazioni e rematori' },
  { value: 'shoulders', label: 'Spalle', blurb: 'Deltoidi su tre lati' },
  { value: 'arms', label: 'Braccia', blurb: 'Bicipiti e tricipiti' },
  { value: 'core', label: 'Addome', blurb: 'Core e stabilità' },
  { value: 'total', label: 'Total body', blurb: 'Tutto il corpo in circuito' },
];

const LIBRARY: Record<SpotFocus, Record<SpotPlace, Template[]>> = {
  glutes: {
    gym: [
      { title: 'Glutei: forza e forma', note: 'Hip thrust pesante, poi lavoro in allungamento e gluteo medio.', intensity: 'moderate', activity: 'gym', items: [['hip-thrust', 4, '8-10', 120], ['bulgarian-split-squat', 3, '10-12', 90], ['stacco-rumeno-manubri', 3, '10-12', 90], ['abductor-machine', 3, '15-20', 60], ['kb-swing', 3, '15', 60]] },
      { title: 'Glutei: volume', note: 'Più ripetizioni e recuperi brevi per un pump completo.', intensity: 'moderate', activity: 'gym', items: [['hip-thrust', 4, '12-15', 90], ['stacco-una-gamba', 3, '10-12', 75], ['affondi-manubri', 3, '12', 75], ['leg-curl-machine', 3, '12-15', 60], ['abductor-machine', 3, '20', 45]] },
    ],
    home: [
      { title: 'Glutei a corpo libero', note: 'Ponte, affondi e gluteo medio: serve solo un elastico.', intensity: 'moderate', activity: 'gym', items: [['hip-thrust-corpo-libero', 4, '15-20', 60], ['affondi', 3, '12', 60], ['squat-corpo-libero', 3, '15-20', 60], ['clamshell-elastico', 3, '20', 45], ['hip-thrust-corpo-libero', 2, '30 s', 45]] },
      { title: 'Glutei con manubri', note: 'Manubri e una panca o una sedia stabile.', intensity: 'moderate', activity: 'gym', items: [['stacco-rumeno-manubri', 4, '10-12', 75], ['goblet-squat', 3, '12-15', 75], ['bulgarian-split-squat', 3, '10', 75], ['hip-thrust-corpo-libero', 3, '20', 45], ['clamshell-elastico', 3, '20', 45]] },
    ],
  },
  legs: {
    gym: [
      { title: 'Gambe complete', note: 'Spinta, catena posteriore e polpacci.', intensity: 'high', activity: 'gym', items: [['leg-press', 4, '8-10', 120], ['stacco-rumeno-manubri', 3, '8-10', 120], ['bulgarian-split-squat', 3, '10', 90], ['leg-extension', 3, '12-15', 60], ['leg-curl-machine', 3, '12-15', 60], ['polpacci-piedi', 3, '15', 45]] },
      { title: 'Quadricipiti in evidenza', note: 'Accosciate profonde e lavoro isolato.', intensity: 'high', activity: 'gym', items: [['goblet-squat', 4, '10-12', 90], ['leg-press', 3, '12-15', 90], ['affondi-manubri', 3, '12', 75], ['leg-extension', 3, '15', 60], ['polpacci-piedi', 4, '15', 45]] },
    ],
    home: [
      { title: 'Gambe a corpo libero', note: 'Tempo lento in discesa per sentire il lavoro senza carichi.', intensity: 'moderate', activity: 'gym', items: [['squat-corpo-libero', 4, '15-20', 60], ['affondi', 3, '12', 60], ['hip-thrust-corpo-libero', 3, '15', 45], ['polpacci-piedi', 3, '20', 30], ['squat-corpo-libero', 2, '40 s', 45]] },
      { title: 'Gambe con manubri', note: 'Una coppia di manubri basta.', intensity: 'moderate', activity: 'gym', items: [['goblet-squat', 4, '10-12', 75], ['stacco-rumeno-manubri', 3, '10-12', 75], ['affondi-manubri', 3, '10', 75], ['polpacci-piedi', 3, '20', 30]] },
    ],
  },
  chest: {
    gym: [
      { title: 'Petto: spinta e allungamento', note: 'Una spinta pesante, una inclinata e croci in allungamento.', intensity: 'moderate', activity: 'gym', items: [['panca-manubri', 4, '8-10', 120], ['panca-inclinata-manubri', 3, '10-12', 90], ['croci-cavi', 3, '12-15', 60], ['chest-press-machine', 2, '12-15', 60], ['pushdown-cavo', 3, '12-15', 45]] },
      { title: 'Petto alle macchine', note: 'Macchine e cavi: stabili, facili da spingere a fondo.', intensity: 'moderate', activity: 'gym', items: [['chest-press-machine', 4, '10-12', 90], ['panca-inclinata-manubri', 3, '10', 90], ['pec-deck', 3, '12-15', 60], ['croci-cavi', 3, '15', 45]] },
    ],
    home: [
      { title: 'Petto a corpo libero', note: 'Push-up in tre varianti di difficoltà.', intensity: 'moderate', activity: 'gym', items: [['push-up', 4, '10-15', 75], ['pike-push-up', 3, '8-10', 75], ['dip-sedia', 3, '10-12', 60], ['push-up', 2, '30 s', 60], ['plank', 2, '40 s', 45]] },
      { title: 'Petto con manubri', note: 'Manubri e una panca, oppure a terra.', intensity: 'moderate', activity: 'gym', items: [['panca-manubri', 4, '10-12', 90], ['croci-manubri', 3, '12', 60], ['push-up', 3, '12-15', 60], ['french-press-manubrio', 3, '12', 45]] },
    ],
  },
  back: {
    gym: [
      { title: 'Schiena: ampiezza e spessore', note: 'Tirate verticali e orizzontali, poi deltoidi posteriori.', intensity: 'moderate', activity: 'gym', items: [['lat-machine', 4, '8-10', 120], ['pulley', 3, '10-12', 90], ['rematore-manubrio', 3, '10', 90], ['face-pull', 3, '15', 45], ['curl-manubri', 3, '10-12', 45]] },
      { title: 'Schiena ai cavi', note: 'Tensione costante e scapole che lavorano.', intensity: 'moderate', activity: 'gym', items: [['lat-machine-neutra', 4, '10-12', 90], ['chest-supported-row', 3, '10-12', 90], ['pulley', 3, '12', 75], ['face-pull', 3, '15-20', 45]] },
    ],
    home: [
      { title: 'Schiena con elastici', note: 'Un elastico fissato in alto e uno in basso.', intensity: 'moderate', activity: 'gym', items: [['trazioni-lat-elastico', 4, '12-15', 60], ['rematore-elastico', 4, '12-15', 60], ['ytw-prono', 3, '8', 45], ['face-pull-elastico', 3, '15', 45], ['curl-elastico', 3, '15', 45]] },
      { title: 'Schiena con manubri', note: 'Rematori su una panca o un appoggio stabile.', intensity: 'moderate', activity: 'gym', items: [['rematore-manubrio', 4, '10-12', 75], ['chest-supported-row', 3, '12', 75], ['ytw-prono', 3, '8', 45], ['alzate-posteriori-manubri', 3, '15', 45]] },
    ],
  },
  shoulders: {
    gym: [
      { title: 'Spalle 3D', note: 'Spinta, alzate laterali e deltoide posteriore.', intensity: 'moderate', activity: 'gym', items: [['shoulder-press-manubri', 4, '8-10', 120], ['alzate-laterali', 4, '12-15', 60], ['alzate-laterali-cavo', 3, '15', 45], ['reverse-fly-machine', 3, '15', 45], ['face-pull', 3, '15', 45]] },
      { title: 'Spalle alle macchine', note: 'Più volume sul laterale, dove si vede la spalla.', intensity: 'moderate', activity: 'gym', items: [['shoulder-press-machine', 3, '10-12', 90], ['alzate-laterali-cavo', 4, '12-15', 45], ['alzate-laterali', 3, '15-20', 45], ['reverse-fly-machine', 3, '15', 45]] },
    ],
    home: [
      { title: 'Spalle con manubri', note: 'Manubri leggeri e tecnica pulita.', intensity: 'moderate', activity: 'gym', items: [['shoulder-press-manubri', 4, '10-12', 90], ['alzate-laterali', 4, '15', 45], ['alzate-posteriori-manubri', 3, '15', 45], ['pike-push-up', 3, '8-10', 60]] },
      { title: 'Spalle con elastico', note: 'Un solo elastico, ripetizioni lente.', intensity: 'low', activity: 'gym', items: [['pike-push-up', 4, '8-10', 75], ['alzate-laterali-elastico', 4, '15-20', 45], ['face-pull-elastico', 3, '15-20', 45], ['ytw-prono', 3, '8', 45]] },
    ],
  },
  arms: {
    gym: [
      { title: 'Braccia: bicipiti e tricipiti', note: 'In alternanza, recuperi brevi.', intensity: 'low', activity: 'gym', items: [['curl-manubri', 3, '10-12', 60], ['pushdown-cavo', 3, '10-12', 60], ['curl-panca-inclinata', 3, '10-12', 60], ['french-press-cavo', 3, '12', 60], ['hammer-curl', 3, '12', 45], ['dip-parallele', 2, '8-12', 75]] },
      { title: 'Braccia ai cavi', note: 'Tensione costante su tutta l’escursione.', intensity: 'low', activity: 'gym', items: [['curl-cavo', 4, '12', 45], ['pushdown-cavo', 4, '12', 45], ['french-press-cavo', 3, '12-15', 45], ['hammer-curl', 3, '12', 45]] },
    ],
    home: [
      { title: 'Braccia con manubri', note: 'Curl e estensioni sopra la testa.', intensity: 'low', activity: 'gym', items: [['curl-manubri', 4, '10-12', 60], ['french-press-manubrio', 4, '10-12', 60], ['hammer-curl', 3, '12', 45], ['dip-sedia', 3, '12-15', 45]] },
      { title: 'Braccia con elastico', note: 'Elastico e una sedia.', intensity: 'low', activity: 'gym', items: [['curl-elastico', 4, '15', 45], ['estensioni-elastico', 4, '15', 45], ['dip-sedia', 3, '12-15', 45], ['push-up', 2, '10', 60]] },
    ],
  },
  core: {
    gym: [
      { title: 'Core forte', note: 'Flessione, anti-estensione e anti-rotazione.', intensity: 'low', activity: 'gym', items: [['crunch-cavo', 4, '12-15', 45], ['leg-raise', 3, '10-12', 60], ['pallof-press', 3, '12', 45], ['plank', 3, '45 s', 45], ['dead-bug', 3, '10', 45]] },
      { title: 'Addome ai cavi', note: 'Carico progressivo anche sull’addome.', intensity: 'low', activity: 'gym', items: [['crunch-cavo', 4, '10-12', 45], ['pallof-press', 4, '12', 45], ['leg-raise', 3, '10', 60], ['plank', 2, '60 s', 45]] },
    ],
    home: [
      { title: 'Addome a corpo libero', note: 'Dieci minuti di qualità, nessun attrezzo.', intensity: 'low', activity: 'gym', items: [['dead-bug', 3, '10', 30], ['plank', 3, '40 s', 30], ['hip-thrust-corpo-libero', 3, '15', 30], ['dead-bug', 2, '12', 30], ['plank', 2, '30 s', 30]] },
      { title: 'Core e postura', note: 'Stabilità del tronco e schiena alta.', intensity: 'low', activity: 'gym', items: [['plank', 3, '45 s', 30], ['ytw-prono', 3, '8', 30], ['dead-bug', 3, '12', 30], ['hip-thrust-corpo-libero', 3, '15', 30]] },
    ],
  },
  total: {
    gym: [
      { title: 'Total body in sala', note: 'Un esercizio per ogni grande schema motorio.', intensity: 'high', activity: 'gym', items: [['goblet-squat', 3, '10-12', 75], ['panca-manubri', 3, '10', 75], ['lat-machine', 3, '10-12', 75], ['stacco-rumeno-manubri', 3, '10', 75], ['shoulder-press-manubri', 3, '10', 60], ['kb-swing', 3, '15', 45]] },
      { title: 'Circuito metabolico', note: 'Recuperi brevi: il cuore lavora quanto i muscoli.', intensity: 'moderate', activity: 'functional', items: [['kb-swing', 4, '15', 30], ['goblet-squat', 4, '12', 30], ['push-up', 4, '12', 30], ['rematore-manubrio', 4, '12', 30], ['plank', 3, '40 s', 30]] },
    ],
    home: [
      { title: 'Total body a casa', note: 'Circuito a corpo libero, recuperi brevi.', intensity: 'moderate', activity: 'functional', items: [['squat-corpo-libero', 4, '20', 30], ['push-up', 4, '12', 30], ['affondi', 4, '12', 30], ['rematore-elastico', 3, '15', 45], ['plank', 3, '40 s', 30]] },
      { title: 'Total body con manubri', note: 'Manubri e poco spazio.', intensity: 'moderate', activity: 'functional', items: [['goblet-squat', 4, '12', 45], ['panca-manubri', 3, '12', 45], ['rematore-manubrio', 3, '12', 45], ['affondi-manubri', 3, '10', 45], ['dead-bug', 3, '10', 30]] },
    ],
  },
};

const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Bilanciere',
  rack: 'Rack',
  bench: 'Panca',
  dumbbells: 'Manubri',
  machines: 'Macchine',
  cables: 'Cavi',
  kettlebell: 'Kettlebell',
  bands: 'Elastici',
  pullupBar: 'Sbarra',
  dipBars: 'Parallele',
};

const TEMPO: Record<CatalogExercise['tempo'], string> = {
  heavyCompound: '2-0-1-0',
  compound: '2-0-1-0',
  stretch: '3-1-1-0',
  squeeze: '2-0-1-1',
  machine: '2-0-1-0',
  bodyweight: '3-0-1-0',
  isometric: 'isometria',
};

export type SpotWorkout = {
  /** Stable for the day: focus, place, variant. */
  id: string;
  focus: SpotFocus;
  place: SpotPlace;
  focusLabel: string;
  title: string;
  note: string;
  exercises: TrainingExerciseEntry[];
  minutes: number;
  kcal: number;
  activity: ActivityType;
  intensity: ActivityIntensity;
  muscles: string[];
  equipment: string[];
  totalSets: number;
};

export type SpotProfile = { weightKg: number; sex: string; age: number; level: Level };

const isHold = (reps: string) => /\bs\b/.test(reps);
const topReps = (reps: string) => {
  const m = reps.match(/(\d+)(?:\s*-\s*(\d+))?/);
  return m ? Number(m[2] ?? m[1]) : 10;
};

/** Days since 1 Jan 2020 of an ISO date: the rotation key, so the workout changes every day and is the same all day. */
function dayNumber(dateISO: string): number {
  return Math.floor(Date.parse(`${dateISO.slice(0, 10)}T12:00:00Z`) / 86400000);
}

/** Minutes of a session: 5 min warm-up, each set's work (≈3.5 s per rep, or the hold), the rests between sets, a minute to set up each exercise. */
function minutesOf(items: { sets: number; reps: string; restSec: number }[]): number {
  let sec = 5 * 60;
  for (const it of items) {
    const work = isHold(it.reps) ? topReps(it.reps) : topReps(it.reps) * 3.5;
    sec += it.sets * work + Math.max(it.sets - 1, 0) * it.restSec + 60;
  }
  return Math.max(10, Math.round(sec / 60 / 5) * 5);
}

/** The workout of the day for a focus and a place, sized on the person (loads, a set less for a beginner). */
export function spotWorkoutOfDay(focus: SpotFocus, place: SpotPlace, dateISO: string, profile: SpotProfile): SpotWorkout {
  const templates = LIBRARY[focus][place];
  const variant = ((dayNumber(dateISO) % templates.length) + templates.length) % templates.length;
  const t = templates[variant];
  const muscles = new Set<MuscleGroup>();
  const equipment = new Set<string>();

  const exercises: TrainingExerciseEntry[] = t.items.flatMap(([id, sets0, reps, restSec], i) => {
    const e = CATALOG_BY_ID.get(id);
    if (!e) return [];
    const sets = profile.level === 'beginner' ? Math.max(2, sets0 - 1) : sets0;
    const hold = isHold(reps);
    const rir = e.kind === 'isolation' || e.kind === 'core' ? 1 : 2;
    const load = hold ? { kg: null } : initialLoad({ e, profile: { bodyweightKg: profile.weightKg, sex: profile.sex, level: profile.level, age: profile.age }, repsMax: topReps(reps), rir, monthsIn: 0, calibrating: true });
    muscles.add(e.primary);
    for (const q of e.equipment) equipment.add(EQUIPMENT_LABEL[q]);
    const range = reps.match(/(\d+)\s*-\s*(\d+)/);
    return [
      {
        // the same exercise twice in a session (a burn-out set) needs its own id
        id: t.items.findIndex(([x]) => x === id) === i ? e.id : `${e.id}-${i + 1}`,
        name: e.name,
        sets,
        reps,
        restSec,
        suggestedKg: load.kg,
        tempo: hold ? 'isometria' : TEMPO[e.tempo],
        repsMin: range ? Number(range[1]) : undefined,
        repsMax: range ? Number(range[2]) : undefined,
        rir,
        rpe: 10 - rir,
        loadStatus: load.kg == null ? 'bodyweight' : 'calibrate',
        primaryMuscle: MUSCLE_SHORT[e.primary],
        cues: e.cues,
      },
    ];
  });

  const minutes = minutesOf(exercises);
  return {
    id: `${focus}-${place}-${variant}`,
    focus,
    place,
    focusLabel: SPOT_FOCUS.find((f) => f.value === focus)!.label,
    title: t.title,
    note: t.note,
    exercises,
    minutes,
    kcal: estimateActivityKcal(t.activity, t.intensity, minutes, profile.weightKg),
    activity: t.activity,
    intensity: t.intensity,
    muscles: [...muscles].map((m) => MUSCLE_SHORT[m]),
    equipment: equipment.size > 0 ? [...equipment] : ['Corpo libero'],
    totalSets: exercises.reduce((s, x) => s + x.sets, 0),
  };
}
