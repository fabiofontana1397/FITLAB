/**
 * Periodization: which training block each month of the plan is, and how the
 * four weeks inside a month are organised.
 *
 *  - Beginners: a technique/calibration month, then steady accumulation — a
 *    simple, measurable progression is what they need (ACSM 2009); no
 *    intensification blocks, no planned deload.
 *  - Intermediate/advanced: blocks of accumulation (volume, moderate reps)
 *    followed by an intensification month (heavier multi-joint work, same
 *    sets). Load progression and volume progression are never pushed in the
 *    same month.
 *  - Last month of a plan of 4+ months: consolidation — volume slightly lower
 *    (≈ −15%), effort a little further from failure; NOT a halving.
 *  - Deload: a period of reduced stress to dissipate fatigue (Bell et al. 2023
 *    Delphi consensus). It is NOT scheduled every month: it is written into
 *    week 4 of an intensification month for advanced lifters only as a
 *    conditional ("if fatigue is high"), and the monthly check-in adds a full
 *    deload week when the person's answers and performance call for it.
 */
import type { Block } from './prescription';
import type { Level, ProgramModel } from './profile';

export type WeekPlan = {
  week: number;
  label: string;
  /** Added to every exercise's RIR target this week. */
  rirOffset: number;
  /** Multiplier on the sets of the week (deload < 1). */
  setsFactor: number;
  note: string;
  /** Which exercises the RIR offset applies to: all, or only the safe ones (machines, isolations, core). */
  rirScope: 'all' | 'safe';
  /** A real deload: sets × setsFactor, RIR + rirOffset, load ≈ −10%, no intensification techniques. */
  deload: boolean;
  /** Applied only if needed (fatigue): the exercises still carry its prescription. */
  conditional: boolean;
  /** Multiplier on running minutes (recovery week < 1). */
  runFactor: number;
};

export type MonthBlock = {
  block: Block;
  /** Volume multiplier vs the base weekly target (accumulation ramps up, consolidation eases off). */
  volumeFactor: number;
  goal: string;
  progression: string;
  exitCriteria: string;
  weeks: WeekPlan[];
};

export function blockSequence(months: number, level: Level, model: ProgramModel): Block[] {
  const out: Block[] = [];
  for (let m = 1; m <= months; m++) {
    if (m === 1 && level === 'beginner') out.push('adattamento');
    else if (m === months && months >= 3) out.push('consolidamento');
    else if (level === 'beginner' || model === 'health' || model === 'hybridEndurance') out.push('accumulo');
    else {
      // three-month waves: accumulation, accumulation, intensification (strength: alternate)
      const k = m - 1;
      out.push(model === 'strength' ? (k % 2 === 0 ? 'accumulo' : 'intensificazione') : k % 3 === 2 ? 'intensificazione' : 'accumulo');
    }
  }
  return out;
}

export function monthBlock(args: { block: Block; monthIndex: number; blocks: Block[]; level: Level; deloadFirstWeek: boolean; prevVolumeFactor: number | null }): MonthBlock {
  const { block, monthIndex, blocks, level, deloadFirstWeek, prevVolumeFactor } = args;
  // consecutive accumulation months add volume gradually (+7% per month in the wave, max +14%)
  let run = 0;
  for (let i = monthIndex - 1; i >= 0 && blocks[i] === 'accumulo'; i--) run++;
  const prev = prevVolumeFactor ?? 1;
  const volumeFactor =
    block === 'accumulo' ? 1 + Math.min(run - 1, 2) * 0.07 : block === 'intensificazione' ? prev : block === 'consolidamento' ? Math.round(prev * 0.88 * 100) / 100 : 0.85;

  const weeks: WeekPlan[] = [1, 2, 3, 4].map((w) => ({ week: w, label: `Settimana ${w}`, rirOffset: 0, setsFactor: 1, note: '', rirScope: 'all', deload: false, conditional: false, runFactor: 1 }));
  if (monthIndex === 1) {
    weeks[0] = { ...weeks[0], label: 'Settimana 1 · calibrazione', rirOffset: 1, note: 'Trova il carico giusto per ogni esercizio: una ripetizione in più in riserva rispetto al previsto.' };
  }
  if (block === 'accumulo' && level !== 'beginner') {
    weeks[3] = { ...weeks[3], rirOffset: -1, rirScope: 'safe', note: 'Ultima settimana del blocco: una ripetizione in meno in riserva sugli esercizi sicuri (macchine, isolamenti).' };
  }
  if (block === 'intensificazione' && level === 'advanced') {
    weeks[3] = { ...weeks[3], label: 'Settimana 4 · scarico se serve', rirOffset: 2, setsFactor: 0.5, deload: true, conditional: true, note: 'Se energia e prestazioni sono calate, fai questa settimana di scarico: metà delle serie, 2 ripetizioni in più in riserva, carichi circa −10%, niente tecniche di intensità.' };
  }
  if (deloadFirstWeek) {
    weeks[0] = { ...weeks[0], label: 'Settimana 1 · scarico', rirOffset: 2, setsFactor: 0.6, deload: true, conditional: false, runFactor: 0.7, note: 'Scarico deciso al check-in: circa il 40% di serie in meno, 2 ripetizioni in più in riserva, carichi circa −10%, niente tecniche di intensità.' };
  }
  // running: every third month the last week is a recovery week (unless that month already starts with a deload)
  if (monthIndex % 3 === 0 && !deloadFirstWeek && block !== 'consolidamento') {
    weeks[3] = { ...weeks[3], runFactor: 0.75, note: [weeks[3].note, 'Corsa: settimana di recupero, durate −25%.'].filter(Boolean).join(' ') };
  }

  const goal =
    block === 'adattamento'
      ? 'Imparare i movimenti e trovare i carichi di lavoro.'
      : block === 'accumulo'
        ? 'Accumulare volume utile e far salire ripetizioni e carichi con la doppia progressione.'
        : block === 'intensificazione'
          ? 'Più carico sui multiarticolari con ripetizioni più basse, a parità di serie.'
          : 'Consolidare i carichi raggiunti con un volume un po’ più basso.';
  const progression =
    block === 'intensificazione'
      ? 'Il volume resta quello del mese precedente; sale l’intensità sugli esercizi principali.'
      : block === 'consolidamento'
        ? 'Volume ridotto di circa il 15%, carichi mantenuti.'
        : run > 1
          ? 'Volume in leggero aumento sui gruppi che recuperano bene; carichi con doppia progressione.'
          : 'Carichi con doppia progressione, volume stabile.';
  const exitCriteria =
    block === 'adattamento'
      ? 'Tecnica stabile su tutti gli esercizi e carichi calibrati.'
      : block === 'accumulo'
        ? 'Ripetizioni in crescita sulla maggior parte degli esercizi senza segnali di fatica eccessiva.'
        : block === 'intensificazione'
          ? 'Carichi dei principali in aumento; se calano energia e prestazioni, scarico.'
          : 'Carichi mantenuti: si può ripartire con un nuovo ciclo.';
  return { block, volumeFactor, goal, progression, exitCriteria, weeks };
}
