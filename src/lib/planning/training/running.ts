/**
 * Running sessions with a real progression.
 *
 * Most of the weekly running is easy (conversational pace), with at most one
 * quality session (intervals or tempo) for performance goals and one long run
 * for endurance — the common polarised structure of endurance programmes.
 * Volume rises by about 10% a month and drops in consolidation months.
 * Paces are described by effort (RPE and talk test), because the questionnaire
 * collects no race times to derive them from.
 */
import type { RunFocus } from '@/domain/user-context';

export type RunKind = 'easy' | 'long' | 'intervals' | 'tempo';

export type RunSession = {
  kind: RunKind;
  title: string;
  minutes: number;
  /** One line shown in the plan; always contains "<minutes> min" (the energy model reads it). */
  note: string;
  intensity: string;
  structure: string;
  progression: string;
  /** Hard sessions are kept away from leg days. */
  hard: boolean;
};

const KIND_TITLE: Record<RunKind, string> = { easy: 'Corsa facile', long: 'Lungo lento', intervals: 'Ripetute', tempo: 'Corsa a ritmo medio' };

/** Session kinds for a week, by focus and number of runs. */
export function weekKinds(focus: RunFocus, n: number): RunKind[] {
  if (n <= 0) return [];
  const quality: RunKind | null = focus === 'speed' || focus === 'raceTime' ? 'intervals' : focus === 'raceReady' ? 'tempo' : null;
  const longRun = focus === 'endurance' || focus === 'raceReady' || focus === 'raceTime';
  if (n === 1) return [quality && focus !== 'raceReady' ? quality : longRun ? 'long' : 'easy'];
  if (n === 2) return [quality ?? 'easy', longRun ? 'long' : 'easy'];
  const kinds: RunKind[] = [quality ?? 'easy', 'easy', longRun ? 'long' : 'easy'];
  if (n >= 4) kinds.splice(1, 0, focus === 'raceTime' ? 'tempo' : 'easy');
  while (kinds.length < n) kinds.splice(kinds.length - 1, 0, 'easy');
  return kinds.slice(0, n);
}

export function runWeek(args: { focus: RunFocus; sessions: number; monthIndex: number; consolidation: boolean; beginnerStart: boolean }): RunSession[] {
  const { focus, sessions, monthIndex, consolidation, beginnerStart } = args;
  const step = Math.max(0, monthIndex - 1);
  // volume and intensity never rise in the same month: volume on odd steps (+10%), the quality session on even ones
  const volSteps = Math.ceil(step / 2);
  const intSteps = Math.floor(step / 2);
  const factor = Math.min(1 + volSteps * 0.1, 1.6) * (consolidation ? 0.85 : 1);
  const easyBase = beginnerStart ? 25 : 30;
  const week = weekKinds(focus, sessions).map((kind) => {
    if (kind === 'easy') {
      const minutes = Math.round((easyBase * factor) / 5) * 5;
      return {
        kind,
        title: KIND_TITLE.easy,
        minutes,
        note: `${KIND_TITLE.easy} ${minutes} min`,
        intensity: 'RPE 3-4: riesci a parlare in frasi complete',
        structure: `${minutes} minuti continui a ritmo facile${beginnerStart && monthIndex === 1 ? ' (puoi alternare 4 minuti di corsa e 1 di camminata)' : ''}.`,
        progression: 'Circa +10% di durata ogni mese, solo se le gambe arrivano fresche alla seduta successiva.',
        hard: false,
      };
    }
    if (kind === 'long') {
      const minutes = Math.round((Math.max(45, easyBase + 15) * factor) / 5) * 5;
      return {
        kind,
        title: KIND_TITLE.long,
        minutes: Math.min(minutes, 100),
        note: `${KIND_TITLE.long} ${Math.min(minutes, 100)} min`,
        intensity: 'RPE 3-4, più lento della corsa facile se serve',
        structure: `${Math.min(minutes, 100)} minuti continui: è la seduta che costruisce la resistenza.`,
        progression: '+5–10 minuti al mese, senza superare i 100 minuti.',
        hard: true,
      };
    }
    if (kind === 'intervals') {
      const long = focus === 'raceTime';
      const reps = Math.min((long ? 4 : 6) + intSteps, long ? 7 : 10);
      const dist = long ? '1000 m' : '400 m';
      const rec = long ? '2 min' : '90 s';
      const minutes = Math.round(20 + reps * (long ? 6.5 : 3));
      const effective = consolidation ? Math.max(long ? 4 : 6, reps - 1) : reps;
      return {
        kind,
        title: KIND_TITLE.intervals,
        minutes,
        note: `Ripetute ${effective}×${dist} · ${minutes} min totali`,
        intensity: long ? 'RPE 7-8: ritmo gara 5-10 km' : 'RPE 8: veloce ma controllato, tutte le prove allo stesso ritmo',
        structure: `10 min di riscaldamento facile, ${effective}×${dist} con ${rec} di recupero camminando o corricchiando, 10 min di defaticamento.`,
        progression: 'Una ripetuta in più ogni due mesi, alternata all’aumento di durata delle altre corse; il ritmo resta lo stesso.',
        hard: true,
      };
    }
    const block = Math.min(15 + intSteps * 5, 30) - (consolidation ? 5 : 0);
    const minutes = block + 20;
    return {
      kind,
      title: KIND_TITLE.tempo,
      minutes,
      note: `Corsa a ritmo medio ${minutes} min (${block} min a ritmo sostenuto)`,
      intensity: 'RPE 6-7: riesci a dire solo poche parole',
      structure: `10 min facili, ${block} min a ritmo sostenuto e costante, 10 min facili.`,
      progression: '+5 minuti di parte sostenuta ogni due mesi, alternati all’aumento di durata delle altre corse, fino a 30.',
      hard: true,
    };
  });
  // the long run stays proportionate: at most about 45% of the week's running time (when there are 3+ runs)
  const total = week.reduce((sum, r) => sum + r.minutes, 0);
  const lr = week.find((r) => r.kind === 'long');
  if (lr && week.length >= 3 && lr.minutes > total * 0.45) {
    const others = total - lr.minutes;
    const capped = Math.max(45, Math.round((others * (0.45 / 0.55)) / 5) * 5);
    if (capped < lr.minutes) {
      lr.minutes = capped;
      lr.note = `${KIND_TITLE.long} ${capped} min`;
      lr.structure = `${capped} minuti continui: è la seduta che costruisce la resistenza.`;
    }
  }
  return week;
}
