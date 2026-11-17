/**
 * User profile engine: from the questionnaire context to the facts the
 * programming decisions are made on — training level, programming model,
 * time and equipment available, limitations.
 *
 * Level is NOT read from the declared years alone: the self-rated skill, the
 * years of practice and age are combined, and when they disagree the more
 * cautious reading wins (someone who says "expert" after six months is planned
 * as an intermediate; someone with years of practice who rates themselves a
 * beginner is planned as a beginner, because technique is what limits them).
 */
import type { UserContext } from '@/domain/user-context';

import { deriveExerciseExclusions, type ExerciseExclusions } from '../exercise-constraints';
import type { Equipment } from './catalog';
import type { TrainingCalibration } from './types';

export type Level = 'beginner' | 'intermediate' | 'advanced';

/** The programming model: what the plan optimises for. */
export type ProgramModel = 'hypertrophy' | 'strength' | 'fatLoss' | 'recomposition' | 'muscularEndurance' | 'health' | 'hybridEndurance';

export const MODEL_LABEL: Record<ProgramModel, string> = {
  hypertrophy: 'Ipertrofia',
  strength: 'Forza',
  fatLoss: 'Dimagrimento con mantenimento della massa muscolare',
  recomposition: 'Ricomposizione corporea',
  muscularEndurance: 'Resistenza muscolare',
  health: 'Salute e tecnica',
  hybridEndurance: 'Corsa con forza di supporto',
};

export const LEVEL_LABEL: Record<Level, string> = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzato' };

export type ProgramProfile = {
  level: Level;
  levelReason: string;
  model: ProgramModel;
  /** Secondary objective, when the goal and the gym focus point in different directions. */
  secondaryModel: ProgramModel | null;
  modelReason: string;
  /** Energy deficit expected from the goal: recovery capacity is lower. */
  inDeficit: boolean;
  /** Gym sessions per week the person asked for (before fitting into available days). */
  gymDays: number;
  sessionMinutes: number;
  equipment: Set<Equipment>;
  location: 'gym' | 'home' | 'outdoor' | 'mixed';
  exclusions: ExerciseExclusions;
  age: number;
  sex: 'male' | 'female' | 'unspecified';
  isMinor: boolean;
  isOlder: boolean;
  bodyweightKg: number;
  notes: string[];
};

const SESSION_MIN: Record<string, number> = { lt30: 28, '30-45': 42, '45-60': 58, '60-90': 80, gt90: 95 };
const BUCKETS = ['lt30', '30-45', '45-60', '60-90', 'gt90'] as const;

export function shorterBucket(bucket: string): string {
  const i = BUCKETS.indexOf(bucket as (typeof BUCKETS)[number]);
  return i > 0 ? BUCKETS[i - 1] : bucket;
}

function levelFrom(skill: string | undefined, experience: string | undefined, age: number): { level: Level; reason: string } {
  const years = experience === '3plusYears' ? 3 : experience === '1-3years' ? 1.5 : experience === '3-12months' ? 0.5 : 0;
  const rated: Level = skill === 'expert' ? 'advanced' : skill === 'intermediate' ? 'intermediate' : 'beginner';
  let level: Level;
  let reason: string;
  if (rated === 'beginner' || years < 0.5) {
    level = 'beginner';
    reason = years >= 1 ? 'Anni di allenamento dichiarati, ma tecnica autovalutata da principiante: si parte dall’apprendimento dei movimenti.' : 'Esperienza sotto i 6 mesi o tecnica da principiante.';
  } else if (rated === 'advanced' && years >= 3) {
    level = 'advanced';
    reason = 'Oltre 3 anni di allenamento continuativo e tecnica avanzata.';
  } else if (rated === 'advanced') {
    level = 'intermediate';
    reason = 'Tecnica autovalutata avanzata ma meno di 3 anni di pratica: programmato come intermedio.';
  } else {
    level = 'intermediate';
    reason = years >= 3 ? 'Esperienza lunga con tecnica intermedia.' : 'Esperienza da 6 mesi a 3 anni con tecnica intermedia.';
  }
  if (level === 'advanced' && age >= 60) {
    level = 'intermediate';
    reason += ' Oltre i 60 anni il volume resta su livelli intermedi.';
  }
  return { level, reason };
}

/** Questionnaire equipment answers and catalog equipment, plus what each location provides. */
export function equipmentFor(location: string, owned: string[]): Set<Equipment> {
  if (location === 'gym') return new Set<Equipment>(['barbell', 'rack', 'bench', 'dumbbells', 'machines', 'cables', 'kettlebell', 'bands', 'pullupBar', 'dipBars']);
  const set = new Set<Equipment>();
  const map: Record<string, Equipment[]> = {
    dumbbells: ['dumbbells'],
    barbell: ['barbell'],
    rack: ['rack'],
    bench: ['bench'],
    machines: ['machines'],
    cables: ['cables'],
    kettlebell: ['kettlebell'],
    bands: ['bands'],
    pullupBar: ['pullupBar'],
    dipBars: ['dipBars'],
  };
  for (const item of owned) for (const e of map[item] ?? []) set.add(e);
  // "mixed" = part gym, part elsewhere: the plan stays executable anywhere, so only declared equipment.
  return set;
}

export function buildProgramProfile(ctx: UserContext, calibration?: TrainingCalibration | null): ProgramProfile {
  const t = ctx.training!;
  const gym = t.gym;
  const { level, reason: levelReason } = levelFrom(gym?.skill, gym?.experience, ctx.age);
  const notes: string[] = [];

  // programming model: the gym focus decides the method, the overall goal can add a secondary objective
  const focus = gym?.focus ?? 'hypertrophy';
  let model: ProgramModel;
  let secondaryModel: ProgramModel | null = null;
  let modelReason: string;
  if (!gym && t.running) {
    model = 'hybridEndurance';
    modelReason = 'Solo corsa: nessuna seduta in sala pesi.';
  } else if (t.running && ctx.goal === 'improveEndurance') {
    model = 'hybridEndurance';
    secondaryModel = focus === 'strength' ? 'strength' : focus === 'hypertrophy' ? 'hypertrophy' : null;
    modelReason = 'Obiettivo di resistenza con la corsa: la forza la sostiene (fondamentali, poche ripetizioni, lontano dal cedimento) senza togliere recupero alle uscite.';
  } else if (ctx.goal === 'gainStrength' || focus === 'strength') {
    model = 'strength';
    modelReason = 'Obiettivo forza: esercizi fondamentali prioritari, ripetizioni basse, recuperi lunghi.';
    if (ctx.goal === 'loseFat') secondaryModel = 'fatLoss';
    if (ctx.goal === 'gainMuscle') secondaryModel = 'hypertrophy';
  } else if (focus === 'muscularEndurance') {
    model = 'muscularEndurance';
    modelReason = 'Focus resistenza muscolare: ripetizioni più alte e recuperi più brevi.';
  } else if (focus === 'technique' || ctx.goal === 'generalHealth') {
    model = 'health';
    modelReason = 'Salute generale e tecnica: volume moderato, movimenti fondamentali, sforzo lontano dal cedimento.';
  } else if (ctx.goal === 'loseFat' || focus === 'fatLoss') {
    model = 'fatLoss';
    modelReason = 'Dimagrimento: la scheda resta di forza e ipertrofia per conservare la massa muscolare, con un volume sostenibile in deficit.';
  } else if (ctx.goal === 'maintainImprove') {
    model = 'recomposition';
    modelReason = 'Mantenimento del peso migliorando la composizione: stimolo ipertrofico e progressione dei carichi.';
  } else {
    model = 'hypertrophy';
    modelReason = 'Obiettivo massa muscolare: volume settimanale per gruppo muscolare e progressione.';
  }
  if (model === 'fatLoss' && focus === 'hypertrophy') secondaryModel = 'hypertrophy';

  const bucket = calibration?.sessionBucket ?? t.sessionBucket;
  const sessionMinutes = SESSION_MIN[bucket] ?? 58;
  const exclusions = deriveExerciseExclusions(ctx.answers);
  for (const area of calibration?.avoidAreas ?? []) exclusions.areas.add(area);

  const isMinor = ctx.isMinor;
  const isOlder = ctx.age >= 55;
  if (isMinor) notes.push('Sotto i 18 anni: niente cedimento muscolare, carichi prudenti e supervisione di un professionista qualificato.');
  if (isOlder) notes.push('Oltre i 55 anni: recuperi un po’ più lunghi, progressioni prudenti e priorità alla tecnica.');
  if (t.location === 'outdoor' && (t.equipment ?? []).length === 0)
    notes.push('All’aperto senza attrezzatura dichiarata: esercizi a corpo libero. Indica nel profilo elastici o sbarra se li hai.');

  return {
    level,
    levelReason,
    model,
    secondaryModel,
    modelReason,
    inDeficit: ctx.goal === 'loseFat',
    gymDays: gym?.daysPerWeek ?? 0,
    sessionMinutes,
    equipment: equipmentFor(t.location, t.equipment ?? []),
    location: t.location,
    exclusions,
    age: ctx.age,
    sex: ctx.sex,
    isMinor,
    isOlder,
    bodyweightKg: Number(ctx.answers.currentWeightKg) > 0 ? Number(ctx.answers.currentWeightKg) : ctx.weightKg,
    notes,
  };
}
