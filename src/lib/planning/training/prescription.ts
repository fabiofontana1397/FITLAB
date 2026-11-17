/**
 * Sets × reps, effort (RIR), rest, tempo and the progression rule of every
 * exercise, from the programming model, the exercise's role in the session and
 * the training block.
 *
 * Evidence behind the defaults:
 *  - hypertrophy happens across a wide range of loads/reps when sets are taken
 *    close to failure; heavy loads are what drive maximal strength
 *    (Schoenfeld et al. 2017, 2021) → compounds in moderate ranges, isolations
 *    higher, strength work low;
 *  - failure is not required: stopping 1–3 reps short is enough for growth
 *    (Refalo et al. 2023; Robinson et al. 2024), and strength gains are similar
 *    across a wide RIR range → RIR 1–3, never failure on heavy compounds, RIR 0
 *    only on the last set of an isolation for advanced lifters;
 *  - RIR estimates are imprecise, especially for novices (Zourdos et al. 2016;
 *    Halperin et al. 2022) → beginners start at RIR 3 with a calibration week;
 *  - longer rests preserve the reps of later sets (Schoenfeld et al. 2016) →
 *    2–4 min on heavy compounds, shorter only on isolations.
 */
import type { CatalogExercise } from './catalog';
import type { Level, ProgramModel } from './profile';

export type Role = 'main' | 'secondary' | 'isolation' | 'core';

export const ROLE_LABEL: Record<Role, string> = {
  main: 'Esercizio principale',
  secondary: 'Multiarticolare complementare',
  isolation: 'Isolamento',
  core: 'Core',
};

/** Training block (mesocycle phase) of a month. */
export type Block = 'adattamento' | 'accumulo' | 'intensificazione' | 'consolidamento';

export const BLOCK_LABEL: Record<Block, string> = {
  adattamento: 'Adattamento',
  accumulo: 'Accumulo',
  intensificazione: 'Intensificazione',
  consolidamento: 'Consolidamento',
};

type Scheme = { reps: [number, number]; rir: number; rest: number };

const SCHEMES: Record<ProgramModel, Record<Role, Scheme>> = {
  hypertrophy: {
    main: { reps: [6, 10], rir: 2, rest: 150 },
    secondary: { reps: [8, 12], rir: 2, rest: 120 },
    isolation: { reps: [10, 15], rir: 1, rest: 75 },
    core: { reps: [10, 15], rir: 2, rest: 60 },
  },
  strength: {
    main: { reps: [3, 5], rir: 2, rest: 210 },
    secondary: { reps: [5, 8], rir: 2, rest: 150 },
    isolation: { reps: [8, 12], rir: 2, rest: 90 },
    core: { reps: [8, 12], rir: 2, rest: 60 },
  },
  fatLoss: {
    main: { reps: [6, 10], rir: 2, rest: 150 },
    secondary: { reps: [8, 12], rir: 2, rest: 105 },
    isolation: { reps: [10, 15], rir: 1, rest: 60 },
    core: { reps: [10, 15], rir: 2, rest: 45 },
  },
  recomposition: {
    main: { reps: [6, 10], rir: 2, rest: 150 },
    secondary: { reps: [8, 12], rir: 2, rest: 120 },
    isolation: { reps: [10, 15], rir: 1, rest: 75 },
    core: { reps: [10, 15], rir: 2, rest: 60 },
  },
  muscularEndurance: {
    main: { reps: [12, 15], rir: 2, rest: 90 },
    secondary: { reps: [15, 20], rir: 2, rest: 60 },
    isolation: { reps: [15, 25], rir: 1, rest: 45 },
    core: { reps: [15, 20], rir: 2, rest: 40 },
  },
  health: {
    main: { reps: [8, 12], rir: 3, rest: 120 },
    secondary: { reps: [10, 12], rir: 3, rest: 90 },
    isolation: { reps: [12, 15], rir: 2, rest: 60 },
    core: { reps: [10, 12], rir: 2, rest: 45 },
  },
  hybridEndurance: {
    main: { reps: [5, 8], rir: 3, rest: 150 },
    secondary: { reps: [8, 10], rir: 2, rest: 105 },
    isolation: { reps: [10, 15], rir: 2, rest: 60 },
    core: { reps: [10, 12], rir: 2, rest: 45 },
  },
};

export type Intensification = { kind: 'topSetBackoff' | 'myoReps' | 'dropSet' | 'restPause' | 'antagonistSuperset'; label: string; how: string };

export type Prescription = {
  repsMin: number;
  repsMax: number;
  /** "8-12", or "30-45 s" for timed holds. */
  reps: string;
  rir: number;
  rpe: number;
  restSec: number;
  /** Eccentric – pause in the stretch – concentric – pause at the top ("X" = explosive intent). */
  tempo: string;
  technique: Intensification | null;
  progression: string;
};

/** Execution tempo from the exercise's tempo profile and the goal. */
export function tempoFor(e: CatalogExercise, model: ProgramModel, level: Level, block: Block): string {
  if (e.timed) return 'isometria';
  const learning = level === 'beginner' && block === 'adattamento';
  switch (e.tempo) {
    case 'heavyCompound':
      if (learning) return '3-0-1-0';
      return model === 'strength' || block === 'intensificazione' ? '2-0-X-0' : '2-0-1-0';
    case 'compound':
      return learning ? '3-0-1-0' : '2-0-1-0';
    case 'stretch':
      return '3-1-1-0';
    case 'squeeze':
      return '2-0-1-1';
    case 'machine':
      return '3-0-1-0';
    case 'bodyweight':
      return '2-0-1-0';
    default:
      return '2-0-1-0';
  }
}

function blockAdjust(s: Scheme, role: Role, block: Block, model: ProgramModel): Scheme {
  if (block === 'adattamento') return { ...s, reps: [Math.max(s.reps[0], role === 'main' ? 8 : s.reps[0]), Math.max(s.reps[1], role === 'main' ? 12 : s.reps[1])], rir: s.rir + 1 };
  if (block === 'intensificazione' && (role === 'main' || role === 'secondary')) {
    // heavier work on the multi-joint lifts: lower reps, longer rest, same effort
    const lo = Math.max(model === 'strength' ? 2 : 4, s.reps[0] - 2);
    const hi = Math.max(lo + 2, s.reps[1] - 2);
    return { ...s, reps: [lo, hi], rest: s.rest + 30 };
  }
  if (block === 'consolidamento') return { ...s, rir: s.rir + (role === 'isolation' ? 0 : 1) };
  return s;
}

function progressionRule(e: CatalogExercise, sets: number, lo: number, hi: number, rir: number, model: ProgramModel, role: Role, timed: boolean): string {
  if (timed) return `Quando tieni tutte le ${sets} serie per il tempo massimo, aggiungi 5–10 secondi o passa a una variante più difficile.`;
  if (e.repsBased || e.loadType === 'band' || e.loadType === 'bodyweight')
    return `Aggiungi ripetizioni fino a ${sets}×${hi} con ${rir} in riserva, poi rendi l’esercizio più difficile (elastico più duro, variante più impegnativa o zavorra).`;
  const inc = String(e.increment).replace('.', ',');
  if (model === 'strength' && role === 'main') return `Quando completi tutte le serie da ${hi} ripetizioni lasciandone almeno ${rir} in riserva, aggiungi ${inc} kg. Se una seduta va male, ripeti il carico.`;
  return `Doppia progressione: resta sullo stesso carico finché fai ${sets}×${hi} con almeno ${rir} ripetizion${rir === 1 ? 'e' : 'i'} in riserva, poi aggiungi ${inc} kg e riparti da ${lo} ripetizioni.`;
}

export function prescribe(args: {
  e: CatalogExercise;
  role: Role;
  model: ProgramModel;
  level: Level;
  block: Block;
  sets: number;
  rirShift: number;
  isMinor: boolean;
  /** Last isolation of the session: where an advanced lifter may push to failure. */
  lastIsolation: boolean;
}): Prescription {
  const { e, role, model, level, block, sets, rirShift, isMinor, lastIsolation } = args;
  let s = SCHEMES[model][role];
  // a "main" slot on an isolation-only group (e.g. side delts) is still an isolation
  if (e.kind === 'isolation' && (role === 'main' || role === 'secondary')) s = SCHEMES[model].isolation;
  // shortened-position isolations and calves respond well to the higher part of the range
  if (e.kind === 'isolation' && (e.pattern === 'lateralRaise' || e.pattern === 'rearDeltFly')) s = { ...s, reps: [Math.max(s.reps[0], 12), Math.max(s.reps[1], 20)] };
  s = blockAdjust(s, role, block, model);
  let rir = s.rir + rirShift;
  if (level === 'beginner') rir = Math.max(rir, 2);
  if (level === 'advanced' && e.kind === 'isolation' && lastIsolation && model === 'hypertrophy') rir = Math.min(rir, 1);
  if (isMinor) rir = Math.max(rir, 2);
  if (e.tempo === 'heavyCompound') rir = Math.max(rir, 1);
  rir = Math.max(0, Math.min(4, rir));
  // beginners lift a lower share of their capacity (RIR ≥2): shorter rests keep the session in time without hurting quality
  const restSec = level === 'beginner' ? Math.max(60, Math.round((s.rest * 0.8) / 15) * 15) : s.rest;
  const [lo, hi] = s.reps;
  const timed = !!e.timed;
  const reps = timed ? (block === 'adattamento' || level === 'beginner' ? '20-30 s' : '30-45 s') : `${lo}-${hi}`;

  let technique: Intensification | null = null;
  if (level === 'advanced' && model === 'hypertrophy' && lastIsolation && block !== 'consolidamento' && (e.loadType === 'cable' || e.loadType === 'machine')) {
    technique = block === 'intensificazione'
      ? { kind: 'dropSet', label: 'Drop set sull’ultima serie', how: 'Arrivato a 0–1 in riserva, scala il carico del 20–30% e continua fino a 1 ripetizione dal cedimento.' }
      : { kind: 'myoReps', label: 'Myo-reps sull’ultima serie', how: 'Dopo la serie, 15 secondi di pausa e mini-serie da 3–5 ripetizioni, per 3 volte.' };
  }
  if (model === 'strength' && role === 'main' && level !== 'beginner' && block === 'intensificazione')
    technique = { kind: 'topSetBackoff', label: 'Top set + back-off', how: `Una serie pesante da ${lo} ripetizioni con 1 in riserva, poi le altre serie con il 10% in meno.` };

  return {
    repsMin: lo,
    repsMax: hi,
    reps,
    rir,
    rpe: 10 - rir,
    restSec,
    tempo: tempoFor(e, model, level, block),
    technique,
    progression: progressionRule(e, sets, lo, hi, rir, model, role, timed),
  };
}
