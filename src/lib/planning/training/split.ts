/**
 * Training split generator. Decides how the week's gym sessions are divided
 * and which muscle groups each one trains, in priority order (the order
 * becomes the order of the session's blocks).
 *
 * Rules, from the evidence and from common coaching practice:
 *  - with weekly volume equated, how often a muscle is trained matters little
 *    for hypertrophy (Schoenfeld et al. 2016/2019; Pelland et al. 2024), but
 *    each session has a useful ceiling (≈10–11 fractional sets per muscle,
 *    Remmert et al. 2025): so the split must spread the weekly volume so that
 *    no session needs more than that → frequency ≥2 when volume is high;
 *  - beginners learn movements faster with frequent practice of the same
 *    patterns → full body or upper/lower, never a once-a-week split;
 *  - an explicit preference wins, when the days make it workable.
 */
import type { MuscleGroup } from './catalog';
import type { Level, ProgramProfile } from './profile';

export type SplitKind = 'fullBody' | 'upperLower' | 'upperLowerFull' | 'pushPullLegs' | 'pplUpperLower' | 'pplFull' | 'pushPull' | 'broSplit';

export const SPLIT_LABEL: Record<SplitKind, string> = {
  fullBody: 'Full Body',
  upperLower: 'Upper / Lower',
  upperLowerFull: 'Upper / Lower + Full Body',
  pushPullLegs: 'Push / Pull / Legs',
  pplUpperLower: 'Push / Pull / Legs + Upper / Lower',
  pplFull: 'Push / Pull / Legs + Full Body',
  pushPull: 'Push / Pull',
  broSplit: 'Split per gruppo muscolare',
};

export type SessionTemplate = {
  key: string;
  name: string;
  focus: string;
  /** Groups in block order. A group listed twice in a week gets its weekly volume split across the sessions. */
  groups: MuscleGroup[];
  /** True for the lower-body heavy sessions (used to keep hard runs away from them). */
  legDay: boolean;
};

const T = (key: string, name: string, focus: string, groups: MuscleGroup[], legDay = false): SessionTemplate => ({ key, name, focus, groups, legDay });

const FB_A = T('fbA', 'Full Body A', 'Squat e spinta orizzontale', ['quads', 'chest', 'upperBack', 'hamstrings', 'sideDelts', 'triceps', 'abs'], true);
const FB_B = T('fbB', 'Full Body B', 'Hip hinge e tirata verticale', ['hamstrings', 'lats', 'chest', 'glutes', 'rearDelts', 'biceps', 'calves'], true);
const FB_C = T('fbC', 'Full Body C', 'Gambe unilaterali e tirata orizzontale', ['quads', 'upperBack', 'chest', 'glutes', 'sideDelts', 'biceps', 'triceps', 'abs'], true);
const UPPER_A = T('upA', 'Upper A', 'Petto e schiena, carichi più alti', ['chest', 'upperBack', 'lats', 'sideDelts', 'triceps', 'biceps']);
const UPPER_B = T('upB', 'Upper B', 'Dorsali e porzione alta del petto', ['lats', 'chest', 'upperBack', 'rearDelts', 'sideDelts', 'biceps', 'triceps']);
const LOWER_A = T('loA', 'Lower A', 'Quadricipiti', ['quads', 'hamstrings', 'glutes', 'calves', 'abs'], true);
const LOWER_B = T('loB', 'Lower B', 'Femorali e glutei', ['hamstrings', 'glutes', 'quads', 'calves', 'abs'], true);
const PUSH = T('push', 'Push', 'Petto, spalle e tricipiti', ['chest', 'sideDelts', 'triceps']);
const PULL = T('pull', 'Pull', 'Dorsali, alta schiena e bicipiti', ['lats', 'upperBack', 'rearDelts', 'biceps']);
const LEGS = T('legs', 'Legs', 'Gambe complete', ['quads', 'hamstrings', 'glutes', 'calves', 'abs'], true);
const PUSH_Q = T('pushQ', 'Push', 'Spinte di petto e spalle + quadricipiti', ['chest', 'quads', 'sideDelts', 'triceps', 'calves'], true);
const PULL_H = T('pullH', 'Pull', 'Tirate di schiena + femorali e glutei', ['lats', 'hamstrings', 'upperBack', 'glutes', 'biceps', 'rearDelts', 'abs'], true);

export type SplitPlan = { kind: SplitKind; sessions: SessionTemplate[]; reason: string };

function strengthOverhead(sessions: SessionTemplate[], p: ProgramProfile): SessionTemplate[] {
  // Strength programs practise the overhead press: add it to the first pushing session.
  if (p.model !== 'strength' || p.level === 'beginner') return sessions;
  const i = sessions.findIndex((s) => s.groups.includes('chest'));
  if (i < 0) return sessions;
  const s = sessions[i];
  const groups = [...s.groups];
  groups.splice(groups.indexOf('chest') + 1, 0, 'frontDelts');
  return sessions.map((x, k) => (k === i ? { ...s, groups } : x));
}

function byPreference(pref: string, days: number, level: Level): SplitPlan | null {
  if (pref === 'fullBody') return { kind: 'fullBody', sessions: cycle([FB_A, FB_B, FB_C], days), reason: 'Full Body come richiesto.' };
  if (pref === 'upperLower') {
    if (days === 1) return null;
    if (days === 3) return { kind: 'upperLowerFull', sessions: [UPPER_A, LOWER_A, FB_C], reason: 'Upper/Lower come richiesto: con 3 giorni la terza seduta è Full Body, così ogni gruppo si allena due volte.' };
    return { kind: 'upperLower', sessions: cycle([UPPER_A, LOWER_A, UPPER_B, LOWER_B], days), reason: 'Upper/Lower come richiesto.' };
  }
  if (pref === 'pushPullLegs') {
    if (days < 3) return null;
    if (days === 3) return { kind: 'pushPullLegs', sessions: [PUSH, PULL, LEGS], reason: 'Push/Pull/Legs come richiesto (ogni gruppo una volta a settimana: il volume per seduta è più alto).' };
    if (days === 4) return { kind: 'pplFull', sessions: [PUSH, PULL, LEGS, FB_C], reason: 'Push/Pull/Legs come richiesto, con una quarta seduta Full Body: così anche le gambe si allenano due volte a settimana, non solo la parte alta.' };
    if (days === 5) return { kind: 'pplUpperLower', sessions: [PUSH, PULL, LEGS, UPPER_A, LOWER_B], reason: 'Push/Pull/Legs + Upper/Lower: ogni gruppo due volte a settimana.' };
    return { kind: 'pushPullLegs', sessions: cycle([PUSH, PULL, LEGS], days), reason: 'Push/Pull/Legs ripetuto due volte.' };
  }
  void level;
  return null;
}

function cycle(list: SessionTemplate[], n: number): SessionTemplate[] {
  return Array.from({ length: n }, (_, i) => list[i % list.length]);
}

export function chooseSplit(p: ProgramProfile, days: number, preference: string, override?: string): SplitPlan {
  const n = Math.max(1, Math.min(days, 6));
  const pref = override ?? preference;
  const fromPref = pref && pref !== 'noPreference' ? byPreference(pref, n, p.level) : null;
  let plan: SplitPlan;
  if (fromPref) plan = fromPref;
  else if (n === 1) plan = { kind: 'fullBody', sessions: [FB_A], reason: 'Una seduta a settimana: Full Body, l’unica struttura che allena tutti i gruppi.' };
  else if (n === 2)
    plan =
      p.level === 'advanced' && p.sessionMinutes >= 70
        ? { kind: 'upperLower', sessions: [UPPER_A, LOWER_A], reason: 'Avanzato con sedute lunghe: Upper/Lower concentra più volume per seduta.' }
        : { kind: 'fullBody', sessions: [FB_A, FB_B], reason: 'Due sedute: Full Body A/B allena ogni gruppo due volte a settimana con esercizi diversi.' };
  else if (n === 3) {
    if (p.level === 'beginner' || p.model === 'strength' || p.model === 'health')
      plan = { kind: 'fullBody', sessions: [FB_A, FB_B, FB_C], reason: p.level === 'beginner' ? 'Principiante: Full Body ripete i movimenti fondamentali tre volte a settimana, il modo più rapido per impararli.' : 'Full Body: i fondamentali si allenano più volte a settimana con poca fatica per seduta.' };
    else if (p.level === 'advanced' && p.sessionMinutes >= 70 && p.model === 'hypertrophy')
      plan = { kind: 'pushPullLegs', sessions: [PUSH, PULL, LEGS], reason: 'Avanzato con sedute lunghe: Push/Pull/Legs permette più esercizi per gruppo in ogni seduta.' };
    else plan = { kind: 'upperLowerFull', sessions: [UPPER_A, LOWER_A, FB_C], reason: 'Tre sedute da intermedio: Upper, Lower e Full Body allenano ogni gruppo due volte senza sedute troppo lunghe.' };
  } else if (n === 4)
    plan =
      p.level === 'advanced' && p.model === 'hypertrophy' && p.sessionMinutes >= 75
        ? { kind: 'pushPull', sessions: [PUSH_Q, PULL_H, PUSH_Q, PULL_H], reason: 'Push/Pull con le gambe dentro: frequenza 2 per tutti i gruppi e sedute bilanciate.' }
        : { kind: 'upperLower', sessions: [UPPER_A, LOWER_A, UPPER_B, LOWER_B], reason: 'Quattro sedute: Upper/Lower due volte, ogni gruppo allenato due volte con varianti diverse.' };
  else if (n === 5)
    plan =
      p.level === 'beginner'
        ? { kind: 'upperLowerFull', sessions: [UPPER_A, LOWER_A, FB_C, UPPER_B, LOWER_B], reason: 'Cinque sedute da principiante: Upper/Lower e una Full Body, nessun gruppo allenato una sola volta.' }
        : { kind: 'pplUpperLower', sessions: [UPPER_A, LOWER_A, PUSH, PULL, LEGS], reason: 'Cinque sedute: Upper/Lower + Push/Pull/Legs, ogni gruppo due volte a settimana.' };
  else
    plan =
      p.level === 'beginner'
        ? { kind: 'upperLower', sessions: [UPPER_A, LOWER_A, UPPER_B, LOWER_B, UPPER_A, LOWER_A], reason: 'Sei sedute: Upper/Lower tre volte.' }
        : { kind: 'pushPullLegs', sessions: [PUSH, PULL, LEGS, PUSH, PULL, LEGS], reason: 'Sei sedute: Push/Pull/Legs due volte.' };
  if (pref && pref !== 'noPreference' && !fromPref) plan = { ...plan, reason: `${plan.reason} La preferenza indicata non è applicabile con ${n} ${n === 1 ? 'giorno' : 'giorni'}.` };
  return { ...plan, sessions: strengthOverhead(plan.sessions, p) };
}

/** Bodybuilding "bro split" (one big session per group). Available on request; never chosen automatically, because each session would exceed the useful per-session volume for the main groups. */
export function broSplit(): SplitPlan {
  return {
    kind: 'broSplit',
    reason: 'Split per gruppo muscolare su richiesta: ogni gruppo una volta a settimana.',
    sessions: [
      T('bChest', 'Petto', 'Petto', ['chest', 'triceps']),
      T('bBack', 'Dorso', 'Dorso', ['lats', 'upperBack', 'rearDelts']),
      T('bLegs', 'Gambe', 'Gambe', ['quads', 'hamstrings', 'glutes', 'calves'], true),
      T('bShoulders', 'Spalle', 'Spalle', ['sideDelts', 'rearDelts', 'abs']),
      T('bArms', 'Braccia', 'Braccia', ['biceps', 'triceps']),
    ],
  };
}
