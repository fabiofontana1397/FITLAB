export type SplitLabel = 'Full Body' | 'Upper' | 'Lower' | 'Push' | 'Pull' | 'Legs';

/** Split pattern (which day types, in order) for a given weekly gym
 * frequency — the intermediate/expert default: enough per-session volume
 * per movement pattern to be worth the lower per-muscle frequency. */
export const SPLIT_BY_FREQUENCY: Record<number, SplitLabel[]> = {
  1: ['Full Body'],
  2: ['Upper', 'Lower'],
  3: ['Push', 'Pull', 'Legs'],
  4: ['Push', 'Pull', 'Legs', 'Upper'],
  5: ['Push', 'Pull', 'Legs', 'Upper', 'Lower'],
  6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
};

/** Beginner-appropriate split at the same frequencies — a true novice's
 * limiting factor is motor-pattern learning and neural adaptation, not
 * per-session volume tolerance, so more frequent exposure to the same
 * movement patterns (Upper/Lower or Full Body) beats a PPL-style split
 * that spreads each pattern across only 1-2 sessions/week (standard
 * introductory-programming principle, not this app inventing a new one). */
const SPLIT_BY_FREQUENCY_BEGINNER: Record<number, SplitLabel[]> = {
  1: ['Full Body'],
  2: ['Upper', 'Lower'],
  3: ['Full Body', 'Full Body', 'Full Body'],
  4: ['Upper', 'Lower', 'Upper', 'Lower'],
  5: ['Upper', 'Lower', 'Full Body', 'Upper', 'Lower'],
  6: ['Upper', 'Lower', 'Upper', 'Lower', 'Upper', 'Lower'],
};

const SPLIT_PATTERN_BY_PREFERENCE: Record<string, SplitLabel[]> = {
  fullBody: ['Full Body'],
  upperLower: ['Upper', 'Lower'],
  pushPullLegs: ['Push', 'Pull', 'Legs'],
};

/** Cycles a short pattern (e.g. ['Push','Pull','Legs']) out to exactly
 * `days` entries — a user training 5 days on a 3-day PPL pattern gets
 * Push/Pull/Legs/Push/Pull, not just the first 3 days filled. */
function repeatPattern(pattern: SplitLabel[], days: number): SplitLabel[] {
  return Array.from({ length: days }, (_, i) => pattern[i % pattern.length]);
}

/** Resolves the deterministic split fallback used when the AI strategy
 * didn't supply valid split labels — spec §4.3's "esperienza + frequenza +
 * ... → split" proposal: skillLevel now genuinely changes the split
 * instead of frequency alone deciding it (`gymSkillLevel`/`gymExperience`
 * were collected by the questionnaire but never read by any planner). An
 * explicit `gymSplitPreference` (real sala-pesi question, not a generic
 * one) wins over the experience-based default when the user has one. */
export function resolveSplitLabels(gymDays: number, gymSkillLevel: unknown, gymSplitPreference?: unknown): SplitLabel[] {
  const preferredPattern = typeof gymSplitPreference === 'string' ? SPLIT_PATTERN_BY_PREFERENCE[gymSplitPreference] : undefined;
  if (preferredPattern) return repeatPattern(preferredPattern, gymDays);

  const isBeginner = gymSkillLevel === 'beginner';
  const table = isBeginner ? SPLIT_BY_FREQUENCY_BEGINNER : SPLIT_BY_FREQUENCY;
  return table[gymDays] ?? table[3];
}

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
  /** Equipment (from the questionnaire's `equipment` multi-select) required
   * to do this variant, e.g. ['dumbbells']. Empty/omitted = no equipment
   * needed (bodyweight). Only meaningful for HOME_EXERCISES — a gym is
   * assumed to have full equipment access, so GYM_EXERCISES leaves this
   * unset and it's never filtered on. See exercise-constraints.ts's
   * filterByEquipment. */
  equipment?: string[];
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
    { id: 'squat-manubri', name: 'Squat con manubri', bwMultiplier: 0.15, areas: ['knee', 'hip'], keywords: ['squat'], equipment: ['dumbbells'] },
    { id: 'push-up', name: 'Push-up', bwMultiplier: null, areas: ['shoulder', 'wrist'], keywords: ['push-up', 'push up', 'piegamenti'], equipment: [] },
    { id: 'rematore-manubrio', name: 'Rematore con manubrio', bwMultiplier: 0.12, areas: ['lowerBack'], keywords: ['rematore con manubrio'], equipment: ['dumbbells'] },
    { id: 'plank', name: 'Plank', bwMultiplier: null, areas: [], keywords: ['plank'], equipment: [] },
    { id: 'hip-thrust', name: 'Hip thrust', bwMultiplier: 0.3, areas: ['hip'], keywords: ['hip thrust'], equipment: [] },
    { id: 'shoulder-press-manubri', name: 'Shoulder press con manubri', bwMultiplier: 0.08, areas: ['shoulder'], keywords: ['shoulder press'], equipment: ['dumbbells'] },
  ],
  Upper: [
    { id: 'push-up', name: 'Push-up', bwMultiplier: null, areas: ['shoulder', 'wrist'], keywords: ['push-up', 'push up', 'piegamenti'], equipment: [] },
    { id: 'rematore-elastico', name: 'Rematore con elastico', bwMultiplier: null, areas: ['lowerBack'], keywords: ['rematore con elastico'], equipment: ['bands'] },
    { id: 'shoulder-press-manubri', name: 'Shoulder press con manubri', bwMultiplier: 0.08, areas: ['shoulder'], keywords: ['shoulder press'], equipment: ['dumbbells'] },
    { id: 'curl-manubri', name: 'Curl con manubri', bwMultiplier: 0.06, areas: [], keywords: ['curl'], equipment: ['dumbbells'] },
    { id: 'trazioni-lat-elastico', name: 'Trazioni o lat pulldown con elastico', bwMultiplier: null, areas: ['shoulder'], keywords: ['trazioni', 'lat pulldown'], equipment: ['bands'] },
    { id: 'face-pull-elastico', name: 'Face pull con elastico', bwMultiplier: null, areas: ['shoulder'], keywords: ['face pull'], equipment: ['bands'] },
  ],
  Lower: [
    { id: 'squat-manubri', name: 'Squat con manubri', bwMultiplier: 0.15, areas: ['knee', 'hip'], keywords: ['squat'], equipment: ['dumbbells'] },
    { id: 'affondi-manubri', name: 'Affondi', bwMultiplier: 0.1, areas: ['knee', 'hip'], keywords: ['affondi', 'affondo', 'lunge'], equipment: [] },
    { id: 'hip-thrust', name: 'Hip thrust', bwMultiplier: 0.3, areas: ['hip'], keywords: ['hip thrust'], equipment: [] },
    { id: 'polpacci-piedi', name: 'Polpacci in piedi', bwMultiplier: 0.1, areas: [], keywords: ['polpacci'], equipment: [] },
    { id: 'stacco-rumeno-manubri', name: 'Stacco rumeno con manubri', bwMultiplier: 0.2, areas: ['lowerBack', 'hip'], keywords: ['stacco rumeno'], equipment: ['dumbbells'] },
    { id: 'clamshell-elastico', name: 'Abduzione anca con elastico (da seduto)', bwMultiplier: null, areas: ['hip'], keywords: ['clamshell', 'abduzione anca'], equipment: ['bands'] },
  ],
  Push: [
    { id: 'push-up', name: 'Push-up', bwMultiplier: null, areas: ['shoulder', 'wrist'], keywords: ['push-up', 'push up', 'piegamenti'], equipment: [] },
    { id: 'shoulder-press-manubri', name: 'Shoulder press con manubri', bwMultiplier: 0.08, areas: ['shoulder'], keywords: ['shoulder press'], equipment: ['dumbbells'] },
    { id: 'dip-sedia', name: 'Dip su sedia', bwMultiplier: null, areas: ['shoulder', 'wrist'], keywords: ['dip'], equipment: [] },
    { id: 'alzate-laterali-manubri', name: 'Alzate laterali con manubri', bwMultiplier: 0.03, areas: ['shoulder'], keywords: ['alzate laterali'], equipment: ['dumbbells'] },
  ],
  Pull: [
    { id: 'rematore-manubrio', name: 'Rematore con manubrio', bwMultiplier: 0.12, areas: ['lowerBack'], keywords: ['rematore con manubrio'], equipment: ['dumbbells'] },
    { id: 'trazioni-lat-elastico', name: 'Trazioni o lat pulldown con elastico', bwMultiplier: null, areas: ['shoulder'], keywords: ['trazioni', 'lat pulldown'], equipment: ['bands'] },
    { id: 'face-pull-elastico', name: 'Face pull con elastico', bwMultiplier: null, areas: ['shoulder'], keywords: ['face pull'], equipment: ['bands'] },
    { id: 'curl-manubri', name: 'Curl con manubri', bwMultiplier: 0.06, areas: [], keywords: ['curl'], equipment: ['dumbbells'] },
    { id: 'rematore-elastico', name: 'Rematore con elastico', bwMultiplier: null, areas: ['lowerBack'], keywords: ['rematore con elastico'], equipment: ['bands'] },
  ],
  Legs: [
    { id: 'squat-manubri', name: 'Squat con manubri', bwMultiplier: 0.15, areas: ['knee', 'hip'], keywords: ['squat'], equipment: ['dumbbells'] },
    { id: 'affondi-manubri', name: 'Affondi', bwMultiplier: 0.1, areas: ['knee', 'hip'], keywords: ['affondi', 'affondo', 'lunge'], equipment: [] },
    { id: 'hip-thrust', name: 'Hip thrust', bwMultiplier: 0.3, areas: ['hip'], keywords: ['hip thrust'], equipment: [] },
    { id: 'stacco-rumeno-manubri', name: 'Stacco rumeno con manubri', bwMultiplier: 0.2, areas: ['lowerBack', 'hip'], keywords: ['stacco rumeno'], equipment: ['dumbbells'] },
    { id: 'polpacci-piedi', name: 'Polpacci in piedi', bwMultiplier: 0.1, areas: [], keywords: ['polpacci'], equipment: [] },
    { id: 'clamshell-elastico', name: 'Abduzione anca con elastico (da seduto)', bwMultiplier: null, areas: ['hip'], keywords: ['clamshell', 'abduzione anca'], equipment: ['bands'] },
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

// Conservative starting-point scaling by declared experience — spec §4.3:
// "il carico iniziale deve derivare da esperienza dell'utente + esercizio".
// A flat bodyweight multiplier with no experience adjustment risks starting
// a true beginner too heavy (their intermediate multiplier calibration
// assumption doesn't hold) or under-loading someone with years of training.
// This is still a starting-point heuristic, not a 1RM-based prescription —
// exercise history (once logged) is the more reliable input, see §7 ter.
const EXPERIENCE_LOAD_MULTIPLIER: Record<string, number> = {
  never: 0.55,
  '3-12months': 0.75,
  '1-3years': 1,
  '3plusYears': 1.15,
};

export function suggestedLoadFor(exercise: ExerciseDef, bodyweightKg: number, isAdattamento: boolean, gymExperience?: unknown): number | null {
  if (exercise.bwMultiplier == null) return null;
  const experienceMultiplier = typeof gymExperience === 'string' ? (EXPERIENCE_LOAD_MULTIPLIER[gymExperience] ?? 1) : 1;
  const raw = bodyweightKg * exercise.bwMultiplier * experienceMultiplier * (isAdattamento ? 0.85 : 1);
  return roundLoad(raw);
}
