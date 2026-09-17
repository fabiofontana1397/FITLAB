export type SplitLabel = 'Full Body' | 'Upper' | 'Lower' | 'Push' | 'Pull' | 'Legs';

/** Split pattern (which day types, in order) for a given weekly gym frequency. */
export const SPLIT_BY_FREQUENCY: Record<number, SplitLabel[]> = {
  1: ['Full Body'],
  2: ['Upper', 'Lower'],
  3: ['Push', 'Pull', 'Legs'],
  4: ['Push', 'Pull', 'Legs', 'Upper'],
  5: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
  6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
};

/** Joint/area a lift loads heavily — used to exclude an exercise when the
 * questionnaire flags pain/injury/limitation there. Not a clinical
 * classification, just enough to steer clear of an obvious conflict
 * (e.g. never assign a squat variation to someone who said their knees
 * hurt). */
export type BodyArea = 'knee' | 'shoulder' | 'lowerBack' | 'wrist' | 'hip';

export type ExerciseDef = {
  id: string;
  name: string;
  /** Conservative starting-load heuristic as a multiple of bodyweight, or null for bodyweight/band exercises. */
  bwMultiplier: number | null;
  areas: BodyArea[];
  /** Free-text keywords (Italian) matched against cannotDoDetails/painDetails/
   * recentInjuriesDetails so a user who names this exercise (or a close
   * synonym) directly gets it excluded even when it doesn't load an area
   * they separately flagged. */
  keywords: string[];
};

/** Each split lists candidates in priority order — the planner takes the
 * first N that survive exclusion filtering (see exercise-constraints.ts),
 * so a low-stress alternative later in the list only appears when it's
 * actually needed as a substitute. */
export const GYM_EXERCISES: Record<SplitLabel, ExerciseDef[]> = {
  'Full Body': [
    { id: 'back-squat', name: 'Back squat', bwMultiplier: 0.75, areas: ['knee', 'hip', 'lowerBack'], keywords: ['squat'] },
    { id: 'panca-piana', name: 'Panca piana', bwMultiplier: 0.5, areas: ['shoulder', 'wrist'], keywords: ['panca piana', 'panca', 'distensioni su panca', 'bench press'] },
    { id: 'rematore-bilanciere', name: 'Rematore con bilanciere', bwMultiplier: 0.4, areas: ['lowerBack'], keywords: ['rematore'] },
    { id: 'plank', name: 'Plank', bwMultiplier: null, areas: [], keywords: ['plank'] },
    { id: 'leg-press', name: 'Leg press', bwMultiplier: 1.0, areas: ['knee'], keywords: ['leg press', 'pressa'] },
    { id: 'chest-press-machine', name: 'Chest press macchina', bwMultiplier: null, areas: ['shoulder'], keywords: ['chest press'] },
  ],
  Upper: [
    { id: 'panca-piana', name: 'Panca piana', bwMultiplier: 0.5, areas: ['shoulder', 'wrist'], keywords: ['panca piana', 'panca', 'distensioni su panca', 'bench press'] },
    { id: 'trazioni-sbarra', name: 'Trazioni alla sbarra', bwMultiplier: null, areas: ['shoulder'], keywords: ['trazioni', 'pull-up', 'pullup', 'lat machine'] },
    { id: 'military-press', name: 'Military press', bwMultiplier: 0.35, areas: ['shoulder'], keywords: ['military press', 'shoulder press', 'lento avanti'] },
    { id: 'curl-bicipiti', name: 'Curl bicipiti', bwMultiplier: 0.15, areas: [], keywords: ['curl bicipiti', 'curl'] },
    { id: 'chest-press-machine', name: 'Chest press macchina', bwMultiplier: null, areas: ['shoulder'], keywords: ['chest press'] },
    { id: 'lat-machine', name: 'Lat machine', bwMultiplier: null, areas: [], keywords: ['lat machine', 'lat pulldown'] },
  ],
  Lower: [
    { id: 'back-squat', name: 'Back squat', bwMultiplier: 0.75, areas: ['knee', 'hip', 'lowerBack'], keywords: ['squat'] },
    { id: 'romanian-deadlift', name: 'Romanian deadlift', bwMultiplier: 0.6, areas: ['lowerBack', 'hip'], keywords: ['stacco rumeno', 'romanian deadlift', 'rdl', 'stacco'] },
    { id: 'leg-press', name: 'Leg press', bwMultiplier: 1.0, areas: ['knee'], keywords: ['leg press', 'pressa'] },
    { id: 'affondi', name: 'Affondi', bwMultiplier: 0.15, areas: ['knee', 'hip'], keywords: ['affondi', 'affondo', 'lunge'] },
    { id: 'hip-thrust', name: 'Hip thrust', bwMultiplier: 0.5, areas: ['hip'], keywords: ['hip thrust'] },
    { id: 'leg-curl-machine', name: 'Leg curl machine', bwMultiplier: null, areas: ['knee'], keywords: ['leg curl'] },
    { id: 'abductor-machine', name: 'Abductor machine', bwMultiplier: null, areas: ['hip'], keywords: ['abductor', 'abduttori'] },
    { id: 'polpacci-macchina', name: 'Polpacci alla macchina', bwMultiplier: null, areas: [], keywords: ['polpacci'] },
  ],
  Push: [
    { id: 'panca-piana', name: 'Panca piana', bwMultiplier: 0.5, areas: ['shoulder', 'wrist'], keywords: ['panca piana', 'panca', 'distensioni su panca', 'bench press'] },
    { id: 'military-press', name: 'Military press', bwMultiplier: 0.35, areas: ['shoulder'], keywords: ['military press', 'shoulder press', 'lento avanti'] },
    { id: 'dip-parallele', name: 'Dip alle parallele', bwMultiplier: null, areas: ['shoulder', 'wrist'], keywords: ['dip', 'parallele'] },
    { id: 'alzate-laterali', name: 'Alzate laterali', bwMultiplier: 0.05, areas: ['shoulder'], keywords: ['alzate laterali', 'lateral raise'] },
    { id: 'chest-press-machine', name: 'Chest press macchina', bwMultiplier: null, areas: ['shoulder'], keywords: ['chest press'] },
    { id: 'push-up', name: 'Push-up', bwMultiplier: null, areas: ['shoulder', 'wrist'], keywords: ['push-up', 'push up', 'piegamenti'] },
  ],
  Pull: [
    { id: 'stacco-da-terra', name: 'Stacco da terra', bwMultiplier: 0.9, areas: ['lowerBack', 'hip', 'knee'], keywords: ['stacco da terra', 'deadlift', 'stacco'] },
    { id: 'trazioni-zavorrate', name: 'Trazioni zavorrate', bwMultiplier: null, areas: ['shoulder'], keywords: ['trazioni zavorrate', 'trazioni', 'weighted pull'] },
    { id: 'rematore-bilanciere', name: 'Rematore con bilanciere', bwMultiplier: 0.4, areas: ['lowerBack'], keywords: ['rematore'] },
    { id: 'curl-bicipiti', name: 'Curl bicipiti', bwMultiplier: 0.15, areas: [], keywords: ['curl bicipiti', 'curl'] },
    { id: 'lat-machine', name: 'Lat machine', bwMultiplier: null, areas: [], keywords: ['lat machine', 'lat pulldown'] },
    { id: 'rematore-manubrio', name: 'Rematore con manubrio', bwMultiplier: 0.12, areas: ['lowerBack'], keywords: ['rematore con manubrio'] },
  ],
  Legs: [
    { id: 'back-squat', name: 'Back squat', bwMultiplier: 0.75, areas: ['knee', 'hip', 'lowerBack'], keywords: ['squat'] },
    { id: 'romanian-deadlift', name: 'Romanian deadlift', bwMultiplier: 0.6, areas: ['lowerBack', 'hip'], keywords: ['stacco rumeno', 'romanian deadlift', 'rdl', 'stacco'] },
    { id: 'leg-press', name: 'Leg press', bwMultiplier: 1.0, areas: ['knee'], keywords: ['leg press', 'pressa'] },
    { id: 'affondi', name: 'Affondi', bwMultiplier: 0.15, areas: ['knee', 'hip'], keywords: ['affondi', 'affondo', 'lunge'] },
    { id: 'hip-thrust', name: 'Hip thrust', bwMultiplier: 0.5, areas: ['hip'], keywords: ['hip thrust'] },
    { id: 'leg-curl-machine', name: 'Leg curl machine', bwMultiplier: null, areas: ['knee'], keywords: ['leg curl'] },
    { id: 'abductor-machine', name: 'Abductor machine', bwMultiplier: null, areas: ['hip'], keywords: ['abductor', 'abduttori'] },
    { id: 'polpacci-macchina', name: 'Polpacci alla macchina', bwMultiplier: null, areas: [], keywords: ['polpacci'] },
  ],
};

export const HOME_EXERCISES: Record<SplitLabel, ExerciseDef[]> = {
  'Full Body': [
    { id: 'squat-manubri', name: 'Squat con manubri', bwMultiplier: 0.15, areas: ['knee', 'hip'], keywords: ['squat'] },
    { id: 'push-up', name: 'Push-up', bwMultiplier: null, areas: ['shoulder', 'wrist'], keywords: ['push-up', 'push up', 'piegamenti'] },
    { id: 'rematore-manubrio', name: 'Rematore con manubrio', bwMultiplier: 0.12, areas: ['lowerBack'], keywords: ['rematore con manubrio'] },
    { id: 'plank', name: 'Plank', bwMultiplier: null, areas: [], keywords: ['plank'] },
    { id: 'hip-thrust', name: 'Hip thrust', bwMultiplier: 0.3, areas: ['hip'], keywords: ['hip thrust'] },
    { id: 'shoulder-press-manubri', name: 'Shoulder press con manubri', bwMultiplier: 0.08, areas: ['shoulder'], keywords: ['shoulder press'] },
  ],
  Upper: [
    { id: 'push-up', name: 'Push-up', bwMultiplier: null, areas: ['shoulder', 'wrist'], keywords: ['push-up', 'push up', 'piegamenti'] },
    { id: 'rematore-elastico', name: 'Rematore con elastico', bwMultiplier: null, areas: ['lowerBack'], keywords: ['rematore con elastico'] },
    { id: 'shoulder-press-manubri', name: 'Shoulder press con manubri', bwMultiplier: 0.08, areas: ['shoulder'], keywords: ['shoulder press'] },
    { id: 'curl-manubri', name: 'Curl con manubri', bwMultiplier: 0.06, areas: [], keywords: ['curl'] },
    { id: 'trazioni-lat-elastico', name: 'Trazioni o lat pulldown con elastico', bwMultiplier: null, areas: ['shoulder'], keywords: ['trazioni', 'lat pulldown'] },
    { id: 'face-pull-elastico', name: 'Face pull con elastico', bwMultiplier: null, areas: ['shoulder'], keywords: ['face pull'] },
  ],
  Lower: [
    { id: 'squat-manubri', name: 'Squat con manubri', bwMultiplier: 0.15, areas: ['knee', 'hip'], keywords: ['squat'] },
    { id: 'affondi-manubri', name: 'Affondi', bwMultiplier: 0.1, areas: ['knee', 'hip'], keywords: ['affondi', 'affondo', 'lunge'] },
    { id: 'hip-thrust', name: 'Hip thrust', bwMultiplier: 0.3, areas: ['hip'], keywords: ['hip thrust'] },
    { id: 'polpacci-piedi', name: 'Polpacci in piedi', bwMultiplier: 0.1, areas: [], keywords: ['polpacci'] },
    { id: 'stacco-rumeno-manubri', name: 'Stacco rumeno con manubri', bwMultiplier: 0.2, areas: ['lowerBack', 'hip'], keywords: ['stacco rumeno'] },
    { id: 'clamshell-elastico', name: 'Clamshell con elastico', bwMultiplier: null, areas: ['hip'], keywords: ['clamshell'] },
  ],
  Push: [
    { id: 'push-up', name: 'Push-up', bwMultiplier: null, areas: ['shoulder', 'wrist'], keywords: ['push-up', 'push up', 'piegamenti'] },
    { id: 'shoulder-press-manubri', name: 'Shoulder press con manubri', bwMultiplier: 0.08, areas: ['shoulder'], keywords: ['shoulder press'] },
    { id: 'dip-sedia', name: 'Dip su sedia', bwMultiplier: null, areas: ['shoulder', 'wrist'], keywords: ['dip'] },
    { id: 'alzate-laterali-manubri', name: 'Alzate laterali con manubri', bwMultiplier: 0.03, areas: ['shoulder'], keywords: ['alzate laterali'] },
  ],
  Pull: [
    { id: 'rematore-manubrio', name: 'Rematore con manubrio', bwMultiplier: 0.12, areas: ['lowerBack'], keywords: ['rematore con manubrio'] },
    { id: 'trazioni-lat-elastico', name: 'Trazioni o lat pulldown con elastico', bwMultiplier: null, areas: ['shoulder'], keywords: ['trazioni', 'lat pulldown'] },
    { id: 'face-pull-elastico', name: 'Face pull con elastico', bwMultiplier: null, areas: ['shoulder'], keywords: ['face pull'] },
    { id: 'curl-manubri', name: 'Curl con manubri', bwMultiplier: 0.06, areas: [], keywords: ['curl'] },
    { id: 'rematore-elastico', name: 'Rematore con elastico', bwMultiplier: null, areas: ['lowerBack'], keywords: ['rematore con elastico'] },
  ],
  Legs: [
    { id: 'squat-manubri', name: 'Squat con manubri', bwMultiplier: 0.15, areas: ['knee', 'hip'], keywords: ['squat'] },
    { id: 'affondi-manubri', name: 'Affondi', bwMultiplier: 0.1, areas: ['knee', 'hip'], keywords: ['affondi', 'affondo', 'lunge'] },
    { id: 'hip-thrust', name: 'Hip thrust', bwMultiplier: 0.3, areas: ['hip'], keywords: ['hip thrust'] },
    { id: 'stacco-rumeno-manubri', name: 'Stacco rumeno con manubri', bwMultiplier: 0.2, areas: ['lowerBack', 'hip'], keywords: ['stacco rumeno'] },
    { id: 'polpacci-piedi', name: 'Polpacci in piedi', bwMultiplier: 0.1, areas: [], keywords: ['polpacci'] },
    { id: 'clamshell-elastico', name: 'Clamshell con elastico', bwMultiplier: null, areas: ['hip'], keywords: ['clamshell'] },
  ],
};

/** Last-resort exercise when every candidate for a split got excluded
 * (e.g. every leg exercise loads the knee and the user flagged knee pain)
 * — always safe to include rather than leaving the day with too few
 * exercises. */
export const SAFE_FALLBACK_EXERCISE: ExerciseDef = { id: 'plank', name: 'Plank', bwMultiplier: null, areas: [], keywords: ['plank'] };

export type SetScheme = { sets: number; reps: string; restSec: number; tempo: string };

/** Sets/reps/rest/tempo per gym focus goal, adattamento vs. later phases (progressione/consolidamento share one scheme).
 * Tempo is "eccentric-isometric-concentric" in seconds, e.g. "3-0-1" = 3s negativa, 0s isometria, 1s spinta. */
export const FOCUS_SCHEME: Record<string, { adattamento: SetScheme; later: SetScheme }> = {
  strength: {
    adattamento: { sets: 3, reps: '10-12', restSec: 90, tempo: '3-1-1' },
    later: { sets: 5, reps: '3-5', restSec: 180, tempo: '3-1-1' },
  },
  hypertrophy: {
    adattamento: { sets: 3, reps: '12', restSec: 75, tempo: '3-0-1' },
    later: { sets: 4, reps: '8-12', restSec: 90, tempo: '3-0-1' },
  },
  fatLoss: {
    adattamento: { sets: 3, reps: '15', restSec: 45, tempo: '2-0-1' },
    later: { sets: 3, reps: '12-15', restSec: 45, tempo: '2-0-1' },
  },
  muscularEndurance: {
    adattamento: { sets: 3, reps: '15', restSec: 45, tempo: '2-0-1' },
    later: { sets: 4, reps: '15-20', restSec: 45, tempo: '2-0-1' },
  },
  technique: {
    adattamento: { sets: 3, reps: '10', restSec: 90, tempo: '3-1-1' },
    later: { sets: 3, reps: '10', restSec: 90, tempo: '3-1-1' },
  },
};

/** Weekly running session types per focus goal, adattamento vs. later phases. Cycled if there are more run days than entries. */
export const RUNNING_SESSIONS: Record<string, { adattamento: string[]; later: string[] }> = {
  endurance: {
    adattamento: ['Corsa facile 30 min', 'Corsa facile 35 min', 'Lungo lento 45 min'],
    later: ['Corsa facile 35-40 min', 'Corsa a ritmo medio 30 min', 'Lungo lento 60-70 min'],
  },
  speed: {
    adattamento: ['Corsa facile 30 min + allunghi', 'Corsa facile 30 min'],
    later: ['Ripetute 6-8×400m rec. 90s', 'Corsa facile 30 min', 'Corsa a ritmo medio 25 min'],
  },
  raceTime: {
    adattamento: ['Corsa facile 30 min', 'Corsa a ritmo medio 25 min'],
    later: ['Ripetute 5×1000m rec. 2 min', 'Corsa a ritmo gara 20 min', 'Lungo 50 min'],
  },
  fatLoss: {
    adattamento: ['Corsa facile 30 min', 'Corsa facile 35 min'],
    later: ['Corsa facile 35 min', 'Corsa a ritmo medio 30 min', 'Lungo lento 50 min'],
  },
  raceReady: {
    adattamento: ['Corsa facile 30 min', 'Corsa a ritmo medio 25 min'],
    later: ['Variazioni di ritmo 35 min', 'Corsa facile 30 min', 'Lungo specifico 60-90 min'],
  },
};

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

/** Reasonably spaced weekday indices (0=Mon) for a given number of active days/week. */
export const WEEKDAY_PATTERN: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** Rounds a suggested load to a plate/dumbbell-friendly step. */
export function roundLoad(raw: number): number {
  const step = raw >= 20 ? 2.5 : raw >= 5 ? 1 : 0.5;
  return Math.round(raw / step) * step;
}

export function suggestedLoadFor(exercise: ExerciseDef, bodyweightKg: number, isAdattamento: boolean): number | null {
  if (exercise.bwMultiplier == null) return null;
  const raw = bodyweightKg * exercise.bwMultiplier * (isAdattamento ? 0.85 : 1);
  return roundLoad(raw);
}
