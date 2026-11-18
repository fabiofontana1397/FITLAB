/**
 * Percorsi di test dei piani di allenamento (motore v3): per ogni utente di prova
 *   questionario → scheda iniziale → check-in mensili con risultati ipotetici → scheda ricalibrata.
 * Stesso flusso dell'app (plan-store.recalibrateMonth): recalibrate() con le prestazioni registrate,
 * buildPlans() con i mesi passati preservati. Per isolare l'effetto del check-in si costruisce anche
 * la scheda "senza check-in" (stessa calibrazione di prima).
 *
 * Gli input dei 7 utenti sono gli stessi della versione precedente del test (regressione):
 * cambiano solo le risposte alle nuove domande di approfondimento del check-in.
 *
 *   npx tsx scripts/agent-tests/training-journey.ts <out.json>
 */
import { writeFileSync } from 'node:fs';

import { buildPlans, type PlanBundle } from '@/domain/plan-engine';
import { NEUTRAL_CALIBRATION, recalibrate, type PlanCalibration } from '@/domain/recalibration';
import { computeTargets } from '@/domain/targets';
import { buildUserContext } from '@/domain/user-context';
import { checkinSignals } from '@/lib/planning/checkin-signals';
import { plannedLoadOf } from '@/lib/planning/training/planned-load';
import { CATALOG_BY_ID, MUSCLE_SHORT } from '@/lib/planning/training/catalog';
import { buildProgramProfile, equipmentFor } from '@/lib/planning/training/profile';
import type { ExercisePerformance, TrainingCalibration } from '@/lib/planning/training/types';
import { TRAINING_ENGINE_VERSION } from '@/lib/planning/training-planner';
import type { BodyArea } from '@/lib/planning/exercise-library';
import type { TrainingMonthPlan, TrainingPlan } from '@/lib/planning/types';

type Answers = Record<string, unknown>;

type Expected = Partial<{
  deload: boolean;
  /** Direction of the volume change: −1 lower, 0 same, +1 higher. */
  volume: -1 | 0 | 1;
  rirShift: number;
  availableDays: number;
  split: string;
  avoidAreas: BodyArea[];
  shorterSessions: boolean;
}>;

type MonthOutcome = {
  weeklyKg: number;
  completion: number;
  /** How the logged loads moved during the month. */
  perf: 'improving' | 'stable' | 'declining' | 'none';
  /** Average RIR the person logged (default: as planned). */
  loggedRir?: number;
  checkin: Answers;
  expect: string;
  expected: Expected;
  review?: string;
};

type TestUser = { id: string; name: string; summary: string; answers: Answers; gymSessions: number; runSessions: number; avoidAreas?: BodyArea[]; months: MonthOutcome[] };

const BASE: Answers = {
  mode: 'both',
  age: 30,
  sex: 'male',
  heightCm: 178,
  currentWeightKg: 78,
  goal: 'maintainImprove',
  targetWeightKg: 78,
  jobActivity: 'sedentary',
  dailySteps: '5000-8000',
  sleepHoursRange: '7-8',
  mealsSelected: ['colazione', 'pranzo', 'cena'],
  breakfastTime: '07:30',
  lunchTime: '13:00',
  dinnerTime: '20:00',
  eatingOut: '1',
  dietaryPattern: 'none',
  allergiesIntolerances: 'No',
  excludedFoods: '',
  includedFoods: '',
  coffeeIntake: '2',
  alcoholIntake: 'occasionally',
  activitiesPracticed: ['gym'],
  freq_gym: '3',
  gymExperience: '1-3years',
  gymSkillLevel: 'intermediate',
  gymSplitPreference: 'noPreference',
  focus_gym: 'hypertrophy',
  availableDays: '3',
  sessionDuration: '45-60',
  trainingLocation: 'gym',
  hasPain: 'no',
  cannotDoExercises: 'no',
  recentInjuries: 'no',
};
const q = (o: Answers): Answers => ({ ...BASE, ...o });
const ck = (adherence: number, energy: string, difficulty: string[] = ['none'], wantsChange: string[] = ['nothing'], notes = '', extra: Answers = {}): Answers => ({
  checkinAdherence: adherence,
  checkinEnergyLevel: energy,
  checkinHungerLevel: 'sometimes',
  checkinDifficulty: difficulty,
  checkinWantsChange: wantsChange,
  checkinNotes: notes,
  ...extra,
});

/** Running by component, from the month's week (engine v5): what grows and what does not. */
function runProgress(m: TrainingMonthPlan) {
  const runs = m.weeklySplit.flatMap((d) => (d.type === 'cardio' && d.run ? [{ ...d.run, note: d.note ?? '' }] : d.extraRun ? [{ ...d.extraRun, note: d.extraRun.title }] : []));
  const of = (k: string) => runs.filter((r) => r.kind === k);
  const total = runs.reduce((a, r) => a + r.minutes, 0);
  const week4 = runs.reduce((a, r) => a + (r.weeks?.find((w) => w.week === 4)?.minutes ?? r.minutes), 0);
  const week1 = runs.reduce((a, r) => a + (r.weeks?.find((w) => w.week === 1)?.minutes ?? r.minutes), 0);
  const reps = Number(of('intervals')[0]?.note.match(/(\d+)×/)?.[1] ?? of('intervals')[0]?.structure.match(/(\d+)×/)?.[1] ?? 0);
  return {
    runs: runs.length,
    totalMinutes: total,
    easyMinutes: of('easy').reduce((a, r) => a + r.minutes, 0),
    longMinutes: of('long')[0]?.minutes ?? 0,
    intervalReps: reps,
    tempoMinutes: of('tempo')[0]?.minutes ?? 0,
    recoveryWeekMinutes: Math.min(week1, week4) < total ? Math.min(week1, week4) : null,
  };
}

export const USERS: TestUser[] = [
  {
    id: 'marco',
    name: 'Marco, 34 — principiante, dimagrimento',
    summary: 'Mai allenato, palestra 3 volte da 45-60 min, obiettivo perdere grasso (92 → 82 kg).',
    answers: q({ age: 34, currentWeightKg: 92, targetWeightKg: 82, goal: 'loseFat', gymExperience: 'never', gymSkillLevel: 'beginner', focus_gym: 'fatLoss' }),
    gymSessions: 3,
    runSessions: 0,
    months: [
      { weeklyKg: -0.5, completion: 0.9, perf: 'improving', checkin: ck(4, 'normal'), expect: 'Prestazioni in crescita, recupero buono: si continua senza cambiare nulla.', expected: { volume: 0, rirShift: 0, deload: false } },
      { weeklyKg: -0.45, completion: 0.95, perf: 'improving', checkin: ck(5, 'high'), expect: 'In crescita ed energia alta: un po’ di volume in più (circa +5%).', expected: { volume: 1, rirShift: 0 } },
      { weeklyKg: -0.5, completion: 0.85, perf: 'improving', checkin: ck(4, 'normal', ['soreness']), expect: 'Dolori muscolari ma carichi in salita: la fatica non viene dal volume, una ripetizione in più in riserva per un mese, volume invariato.', expected: { volume: 0, rirShift: 1 } },
      { weeklyKg: -0.4, completion: 0.9, perf: 'stable', checkin: ck(4, 'normal'), expect: 'Prestazioni stabili con RIR come previsto: programma confermato.', expected: { volume: 0, rirShift: 0 } },
    ],
  },
  {
    id: 'luca',
    name: 'Luca, 23 — esperto, massa',
    summary: 'Oltre 3 anni di palestra, 5 sedute da 60-90 min, ipertrofia, obiettivo 68 → 75 kg.',
    answers: q({ age: 23, heightCm: 180, currentWeightKg: 68, targetWeightKg: 75, goal: 'gainMuscle', jobActivity: 'seatedMobile', freq_gym: '5', availableDays: '5', sessionDuration: '60-90', gymExperience: '3plusYears', gymSkillLevel: 'expert' }),
    gymSessions: 5,
    runSessions: 0,
    months: [
      { weeklyKg: 0.25, completion: 0.95, perf: 'improving', checkin: ck(5, 'high'), expect: 'In crescita ed energia alta: volume +5%.', expected: { volume: 1 } },
      {
        weeklyKg: 0.25,
        completion: 0.9,
        perf: 'stable',
        loggedRir: 4.5,
        checkin: ck(4, 'normal', ['none'], ['trainingIntensity']),
        expect: 'Carichi fermi con RIR registrato 4-5 (pianificato 1-2) e richiesta di più intensità: serie più vicine al cedimento, volume invariato.',
        expected: { volume: 0, rirShift: -1 },
      },
      {
        weeklyKg: 0.3,
        completion: 0.4,
        perf: 'stable',
        checkin: ck(3, 'normal', ['trainingTime']),
        expect: 'Solo 4 sedute su 10 per mancanza di tempo: sedute più corte, stessi esercizi principali.',
        expected: { shorterSessions: true, volume: 0 },
      },
      { weeklyKg: 0.25, completion: 0.9, perf: 'declining', checkin: ck(3, 'low', ['soreness']), expect: 'Carichi in calo, stanco e con dolori: settimana di scarico all’inizio del mese.', expected: { deload: true } },
    ],
  },
  {
    id: 'giulia',
    name: 'Giulia, 27 — a casa con manubri ed elastici',
    summary: 'Principiante, si allena a casa 3 volte da 30-45 min con manubri ed elastici, perdere grasso (64 → 58 kg).',
    answers: q({ age: 27, sex: 'female', heightCm: 166, currentWeightKg: 64, targetWeightKg: 58, goal: 'loseFat', gymExperience: 'never', gymSkillLevel: 'beginner', focus_gym: 'fatLoss', sessionDuration: '30-45', trainingLocation: 'home', equipment: ['dumbbells', 'bands'] }),
    gymSessions: 3,
    runSessions: 0,
    months: [
      { weeklyKg: -0.35, completion: 0.9, perf: 'improving', checkin: ck(4, 'normal'), expect: 'In crescita: si continua.', expected: { volume: 0, rirShift: 0 } },
      {
        weeklyKg: -0.3,
        completion: 0.7,
        perf: 'stable',
        checkin: ck(3, 'normal', ['trainingTime'], ['trainingDays'], 'Lavoro su turni: riesco ad allenarmi solo 2 giorni a settimana.', { checkinTrainingDays: '2' }),
        expect: 'Chiede 2 giorni: la scheda passa a 2 sedute (Full Body A/B) e le sedute si accorciano.',
        expected: { availableDays: 2, shorterSessions: true },
      },
      { weeklyKg: -0.3, completion: 0.85, perf: 'stable', checkin: ck(4, 'low'), expect: 'Energia bassa con carichi stabili e recupero non segnalato come scarso: un solo segnale negativo, programma mantenuto con una ripetizione in più in riserva (regola v5: niente riduzioni per un dato isolato).', expected: { volume: 0, rirShift: 1 } },
    ],
  },
  {
    id: 'elena',
    name: 'Elena, 41 — dolore al ginocchio',
    summary: 'Intermedia, palestra 3 volte con preferenza Upper/Lower, ipertrofia, mantenimento. Dichiara dolore al ginocchio destro.',
    answers: q({ age: 41, sex: 'female', heightCm: 165, currentWeightKg: 60, targetWeightKg: 60, gymSplitPreference: 'upperLower', hasPain: 'yes', painDetails: 'Dolore al ginocchio destro quando scendo le scale' }),
    gymSessions: 3,
    runSessions: 0,
    avoidAreas: ['knee'],
    months: [
      { weeklyKg: 0.05, completion: 0.9, perf: 'improving', checkin: ck(4, 'normal'), expect: 'In crescita: si continua.', expected: { volume: 0 } },
      {
        weeklyKg: 0.0,
        completion: 0.85,
        perf: 'stable',
        checkin: ck(4, 'normal', ['none'], ['nothing'], 'Da due settimane mi fa male la spalla sinistra.'),
        expect: 'Dolore alla spalla scritto nelle note: niente esercizi che caricano la spalla dal mese 3, con l’invito a farsi valutare.',
        expected: { avoidAreas: ['knee', 'shoulder'] },
        review: 'Senza esercizi per spalla e ginocchio la scheda perde molte spinte: è giusto così finché un professionista non indica le varianti tollerate?',
      },
      { weeklyKg: -0.05, completion: 0.9, perf: 'declining', checkin: ck(4, 'veryLow', ['soreness']), expect: 'Molto stanca, dolori e prestazioni in calo: settimana di scarico.', expected: { deload: true } },
    ],
  },
  {
    id: 'andrea',
    name: 'Andrea, 30 — corsa e palestra',
    summary: 'Corre 3 volte (obiettivo tempo in gara) e vuole 2 sedute di forza, ma ha solo 4 giorni liberi. Intermedio, mantenimento.',
    answers: q({ goal: 'improveEndurance', activitiesPracticed: ['gym', 'running'], freq_gym: '2', freq_running: '3', focus_running: 'raceTime', focus_gym: 'strength', availableDays: '4', dailySteps: '8000-12000' }),
    gymSessions: 2,
    runSessions: 2,
    months: [
      { weeklyKg: 0.0, completion: 0.9, perf: 'improving', checkin: ck(5, 'high'), expect: 'In crescita ed energia alta: volume +5%.', expected: { volume: 1 } },
      {
        weeklyKg: 0.05,
        completion: 0.9,
        perf: 'stable',
        checkin: ck(4, 'normal', ['none'], ['trainingDays'], 'Vorrei correre 3 volte come avevo chiesto.', { checkinTrainingDays: '5' }),
        expect: 'Chiede più giorni: con 5 giorni entrano le 2 sedute di palestra e le 3 uscite.',
        expected: { availableDays: 5 },
        review: 'Andrea non ha indicato quale attività ha la precedenza (domanda nuova): finché non risponde, il piano divide i giorni in proporzione e lo dice.',
      },
      { weeklyKg: 0.1, completion: 0.45, perf: 'stable', checkin: ck(4, 'normal'), expect: 'Meno della metà delle sedute: scheda semplificata (−15% di serie), niente aumenti.', expected: { volume: -1 } },
    ],
  },
  {
    id: 'sara',
    name: 'Sara, 19 — forza, Push/Pull/Legs',
    summary: 'Intermedia (3-12 mesi), 4 sedute con preferenza Push/Pull/Legs, obiettivo forza, mantenimento a 55 kg.',
    answers: q({ age: 19, sex: 'female', heightCm: 163, currentWeightKg: 55, targetWeightKg: 55, freq_gym: '4', availableDays: '4', gymExperience: '3-12months', gymSplitPreference: 'pushPullLegs', focus_gym: 'strength', sessionDuration: '60-90' }),
    gymSessions: 4,
    runSessions: 0,
    months: [
      { weeklyKg: 0.0, completion: 0.9, perf: 'improving', checkin: ck(4, 'normal'), expect: 'In crescita: si continua.', expected: { volume: 0 } },
      {
        weeklyKg: -0.35,
        completion: 0.95,
        perf: 'improving',
        checkin: ck(5, 'veryHigh', ['none'], ['trainingSplit'], '', { checkinSplit: 'upperLower' }),
        expect: 'Chiede Upper/Lower: la scheda cambia struttura dal mese 3; volume +5% perché progredisce e recupera bene.',
        expected: { split: 'upperLower', volume: 1 },
      },
      { weeklyKg: 0.4, completion: 0.95, perf: 'improving', checkin: ck(5, 'high'), expect: 'Il peso sale ma la forza cresce: la decisione sull’allenamento non dipende dal peso. Volume ancora +5%, fino al tetto del +10%.', expected: { volume: 1 } },
    ],
  },
  {
    id: 'paolo',
    name: 'Paolo, 55 — solo allenamento, all’aperto',
    summary: 'Solo piano di allenamento, principiante, all’aperto 2 volte da meno di 30 min, salute generale, 80 kg.',
    answers: q({ mode: 'training', age: 55, heightCm: 175, currentWeightKg: 80, targetWeightKg: 80, goal: 'generalHealth', gymExperience: 'never', gymSkillLevel: 'beginner', freq_gym: '2', availableDays: '2', sessionDuration: 'lt30', trainingLocation: 'outdoor', focus_gym: 'technique' }),
    gymSessions: 2,
    runSessions: 0,
    months: [
      { weeklyKg: 0.0, completion: 0.9, perf: 'none', checkin: ck(4, 'normal'), expect: 'Nessun carico registrato (corpo libero): progressione normale.', expected: { volume: 0, rirShift: 0 } },
      { weeklyKg: 0.0, completion: 0.3, perf: 'none', checkin: ck(2, 'normal', ['none']), expect: 'Aderenza 2/5 e 30% delle sedute senza problemi di tempo: scheda semplificata.', expected: { volume: -1 } },
      {
        weeklyKg: 0.0,
        completion: 0.8,
        perf: 'none',
        checkin: ck(4, 'low', ['none'], ['trainingIntensity']),
        expect: 'Stanco e chiede di cambiare intensità: allenamenti meno duri (RIR +1); un solo segnale di fatica, volume mantenuto (regola v5).',
        expected: { rirShift: 1, volume: 0 },
      },
    ],
  },
];

// ------------------------------------------------------------------ helpers --

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const addDays = (iso: string, n: number) => new Date(new Date(iso).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const r1 = (n: number) => Math.round(n * 10) / 10;
const AREA: Record<BodyArea, string> = { knee: 'ginocchio', shoulder: 'spalla', lowerBack: 'zona lombare', wrist: 'polso', hip: 'anca' };

function monthView(m: TrainingMonthPlan | undefined) {
  if (!m) return null;
  const days = m.weeklySplit.map((d) => ({
    weekday: d.weekday,
    type: d.type,
    title: d.title,
    focus: d.focus ?? null,
    note: d.note ?? null,
    run: d.run ?? null,
    extraRun: d.extraRun ?? null,
    minutes: d.estimatedMinutes ?? null,
    notes: d.notes ?? [],
    exercises: (d.exercises ?? []).map((x) => ({
      id: x.id,
      name: x.name,
      block: x.blockName ?? null,
      blockOrder: x.blockOrder ?? null,
      role: x.role ?? null,
      sets: x.sets,
      reps: x.reps,
      rir: x.rir ?? null,
      restSec: x.restSec,
      tempo: x.tempo,
      kg: x.suggestedKg,
      loadStatus: x.loadStatus ?? null,
      loadNote: x.loadNote ?? null,
      primary: x.primaryMuscle ?? null,
      region: x.primaryRegion ?? null,
      secondary: x.secondaryMuscles ?? [],
      progression: x.progression ?? null,
      technique: x.technique?.label ?? null,
      superset: !!x.supersetWith,
      reason: x.orderingReason ?? null,
      cues: x.cues ?? [],
      areas: CATALOG_BY_ID.get(x.id)?.areas ?? [],
      pattern: CATALOG_BY_ID.get(x.id)?.pattern ?? null,
      weeks: x.weeks ?? [],
    })),
  }));
  const workouts = days.filter((d) => d.type === 'workout');
  return {
    monthIndex: m.monthIndex,
    phase: m.phase,
    block: m.block ?? null,
    title: m.title,
    focusNote: m.focusNote,
    mesocycle: m.mesocycle ?? null,
    weeklyVolume: m.weeklyVolume ?? [],
    gymSessions: workouts.length,
    runSessions: days.filter((d) => d.type === 'cardio').length + days.filter((d) => d.extraRun).length,
    doubleDays: days.filter((d) => d.extraRun).map((d) => d.weekday),
    runProgress: runProgress(m),
    weeklySets: workouts.reduce((s, d) => s + d.exercises.reduce((a, x) => a + x.sets, 0), 0),
    patternCoverage: m.patternCoverage ?? [],
    exclusions: m.exclusions ?? [],
    validation: m.validation ?? [],
    fatigue: m.fatigue ?? null,
    volumeChanges: m.volumeChanges ?? [],
    exerciseChanges: m.exerciseChanges ?? [],
    days,
  };
}
type MonthView = NonNullable<ReturnType<typeof monthView>>;

function loads(m: MonthView) {
  const out: Record<string, number> = {};
  for (const d of m.days) for (const x of d.exercises) if (x.kg != null && (out[x.name] == null || x.kg > out[x.name])) out[x.name] = x.kg;
  return out;
}

/** Simulated logged performance for the month: the plan's loaded lifts, moved by the outcome's trend. */
function performanceFor(m: TrainingMonthPlan, o: MonthOutcome): ExercisePerformance[] {
  if (o.perf === 'none') return [];
  const delta = o.perf === 'improving' ? 0.05 : o.perf === 'declining' ? -0.06 : 0.005;
  const out = new Map<string, ExercisePerformance>();
  for (const d of m.weeklySplit) for (const x of d.exercises ?? []) {
    if (!x.suggestedKg || out.has(x.id)) continue;
    const first = x.suggestedKg * (1 + ((x.repsMax ?? 10) + (x.rir ?? 2)) / 30);
    out.set(x.id, { exerciseId: x.id, name: x.name, firstE1rm: first, lastE1rm: first * (1 + delta), sessions: 8, avgRir: o.loggedRir ?? x.rir ?? 2 });
  }
  return [...out.values()];
}

const ENERGY: Record<string, string> = { veryLow: 'Molto stanco', low: 'Stanco', normal: 'Normale', high: 'Energico', veryHigh: 'Molto energico' };
const DIFF: Record<string, string> = { mealTimes: 'Orari dei pasti', foodQuantity: 'Quantità di cibo', foodType: 'Tipo di alimenti', trainingTime: 'Tempo per allenarsi', soreness: 'Recupero/dolori', pain: 'Dolore articolare', none: 'Nessuna' };
const WANTS: Record<string, string> = { mealTimes: 'Orari dei pasti', foodOptions: 'Alimenti proposti', trainingIntensity: 'Intensità allenamento', trainingDays: 'Giorni di allenamento', trainingSplit: 'Struttura degli allenamenti', nothing: 'Niente' };
const SPLIT: Record<string, string> = { fullBody: 'Full body', upperLower: 'Upper/Lower', pushPullLegs: 'Push/Pull/Legs' };
const PERF: Record<string, string> = { improving: 'carichi in crescita (+5%)', stable: 'carichi stabili', declining: 'carichi in calo (−6%)', none: 'nessun carico registrato' };

function decisionText(c: TrainingCalibration | undefined, prev: TrainingCalibration | undefined): string[] {
  const out: string[] = [];
  if (!c) return out;
  const vf = c.volumeFactor ?? 1;
  const pv = prev?.volumeFactor ?? 1;
  if (Math.abs(vf - pv) > 0.001) out.push(`Volume ${vf > pv ? '+' : '−'}${Math.round(Math.abs(vf / pv - 1) * 100)}%`);
  if (c.rirShift) out.push(`RIR ${c.rirShift > 0 ? '+' : '−'}${Math.abs(c.rirShift)}`);
  if (c.deloadFirstWeek) out.push('Settimana di scarico');
  if (c.availableDays && c.availableDays !== prev?.availableDays) out.push(`${c.availableDays} giorni`);
  if (c.split && c.split !== prev?.split) out.push(SPLIT[c.split]);
  if (c.sessionBucket && c.sessionBucket !== prev?.sessionBucket) out.push('Sedute più corte');
  const newAreas = (c.avoidAreas ?? []).filter((a) => !(prev?.avoidAreas ?? []).includes(a));
  if (newAreas.length) out.push(`Esclusa: ${newAreas.map((a) => AREA[a]).join(', ')}`);
  return out;
}

// --------------------------------------------------------------------- run --

type Finding = { level: string; code: string; message: string; month?: number };

function runUser(u: TestUser) {
  const rand = rng(u.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0) * 7919);
  const ctx0 = buildUserContext(u.answers);
  let calibration: PlanCalibration = { ...NEUTRAL_CALIBRATION };
  let bundle: PlanBundle = buildPlans(ctx0);
  if (!bundle.training) throw new Error(`${u.id}: nessuna scheda generata`);
  const findings: Finding[] = [];
  const months: MonthView[] = [monthView(bundle.training.months[0])!];
  const calibByMonth = new Map<number, TrainingCalibration | undefined>();
  const checkins: unknown[] = [];
  const weights: { date: string; kg: number }[] = [];
  let kg = ctx0.weightKg;
  const start = '2026-01-05';
  const horizon = Math.min(u.months.length, bundle.durationMonths - 1);
  if (horizon < u.months.length) findings.push({ level: 'INFO', code: 'A0', message: `Il piano dura ${bundle.durationMonths} mesi: simulati ${horizon} check-in su ${u.months.length}.` });

  for (let m = 1; m <= horizon; m++) {
    const o = u.months[m - 1];
    const storedTraining = bundle.training!.months.find((x) => x.monthIndex === m)!;
    const monthWeights: { date: string; kg: number }[] = [];
    const startKg = kg;
    for (let i = 0; i < 30; i++) {
      kg += o.weeklyKg / 7;
      if (i % 3 === 0) monthWeights.push({ date: addDays(start, (m - 1) * 30 + i), kg: r1(kg + (rand() - 0.5) * 0.5) });
    }
    weights.push(...monthWeights);
    const signals = checkinSignals(o.checkin);
    const ctx = { ...ctx0, weightKg: r1(kg) };
    const followed = computeTargets(ctx, storedTraining.weeklySplit, calibration);
    const storedDiet = bundle.diet?.months.find((x) => x.monthIndex === m);
    const targets = storedDiet ? { ...followed, calories: storedDiet.calorieTarget, macros: storedDiet.macroTargetsG } : followed;
    const performance = performanceFor(storedTraining, o);
    const result = recalibrate({
      ctx,
      monthIndex: m,
      durationMonths: bundle.durationMonths,
      targets,
      weights: monthWeights,
      adherence: { trainingCompletion: o.completion, mealDaysTracked: 24, daysInMonth: 30, avgEatenKcal: storedDiet ? storedDiet.calorieTarget : null },
      checkin: signals,
      calibration,
      performance,
      plannedLoad: plannedLoadOf(storedTraining),
    });
    const prevCal = calibration;
    calibration = result.calibration;
    calibByMonth.set(m + 1, calibration.training);
    const existing = { diet: bundle.diet, training: bundle.training };
    const prevBundle = bundle;
    bundle = buildPlans(ctx, { calibration, preserveMonthsBefore: m + 1, existing });
    // counterfactual: the same rebuild with the previous training calibration (what the month would have been without this check-in)
    const neutral = buildPlans(ctx, { calibration: { ...calibration, training: prevCal.training ? { ...prevCal.training, fromMonth: m + 1, deloadFirstWeek: false } : undefined }, preserveMonthsBefore: m + 1, existing });
    const next = monthView(bundle.training!.months.find((x) => x.monthIndex === m + 1))!;
    const nextNeutral = monthView(neutral.training!.months.find((x) => x.monthIndex === m + 1))!;
    const lived = monthView(storedTraining)!;
    months.push(next);
    void prevBundle;

    // ---- checks on the update
    const livedAfter = bundle.training!.months.find((x) => x.monthIndex === m);
    if (JSON.stringify(livedAfter) !== JSON.stringify(storedTraining)) findings.push({ level: 'FAIL', code: 'A1', month: m, message: `Il mese ${m}, già vissuto, è stato modificato dal check-in.` });

    const tc = calibration.training;
    const ptc = prevCal.training;
    const e = o.expected;
    const vf = tc?.volumeFactor ?? 1;
    const pvf = ptc?.volumeFactor ?? 1;
    const volDir = Math.abs(vf - pvf) < 0.001 ? 0 : vf > pvf ? 1 : -1;
    const mismatches: string[] = [];
    if (e.volume != null && e.volume !== volDir) mismatches.push(`volume ${e.volume > 0 ? 'in aumento' : e.volume < 0 ? 'in calo' : 'invariato'} atteso, ottenuto ${volDir > 0 ? 'in aumento' : volDir < 0 ? 'in calo' : 'invariato'}`);
    if (e.rirShift != null && e.rirShift !== (tc?.rirShift ?? 0)) mismatches.push(`RIR ${e.rirShift >= 0 ? '+' : ''}${e.rirShift} atteso, ottenuto ${(tc?.rirShift ?? 0) >= 0 ? '+' : ''}${tc?.rirShift ?? 0}`);
    if (e.deload != null && e.deload !== !!tc?.deloadFirstWeek) mismatches.push(e.deload ? 'scarico atteso, non deciso' : 'scarico non atteso');
    if (e.availableDays != null && e.availableDays !== tc?.availableDays) mismatches.push(`${e.availableDays} giorni attesi, ottenuto ${tc?.availableDays ?? 'nessun cambio'}`);
    if (e.split != null && e.split !== tc?.split) mismatches.push(`split ${e.split} attesa`);
    if (e.avoidAreas != null && e.avoidAreas.some((a) => !(tc?.avoidAreas ?? []).includes(a) && !(u.avoidAreas ?? []).includes(a))) mismatches.push(`zone da escludere attese: ${e.avoidAreas.map((a) => AREA[a]).join(', ')}`);
    if (e.shorterSessions != null && e.shorterSessions !== (tc?.sessionBucket != null && tc.sessionBucket !== ptc?.sessionBucket)) mismatches.push('sedute più corte attese');
    const matches = mismatches.length === 0;
    if (!matches) findings.push({ level: 'FAIL', code: 'A2', month: m, message: `Check-in ${m}: ${mismatches.join('; ')}.` });

    // decision really applied to next month's plan
    if (tc?.deloadFirstWeek && !(next.mesocycle?.weeks[0]?.label ?? '').includes('scarico')) findings.push({ level: 'FAIL', code: 'A3', month: m + 1, message: 'Scarico deciso ma la settimana 1 del mese successivo non è di scarico.' });
    if (tc?.availableDays && next.gymSessions + next.runSessions > tc.availableDays) findings.push({ level: 'FAIL', code: 'A3', month: m + 1, message: `Chiesti ${tc.availableDays} giorni ma il mese ${m + 1} ne prevede ${next.gymSessions + next.runSessions}.` });
    const capped = bundle.training!.months.find((x) => x.monthIndex === m + 1)?.timeCapped;
    if (volDir > 0 && capped) findings.push({ level: 'INFO', code: 'A3', month: m + 1, message: `Volume +${Math.round((vf / pvf - 1) * 100)}% deciso, ma le sedute sono già al limite del tempo disponibile: il piano lo dice nel mese ${m + 1}.` });
    else if (volDir !== 0 && Math.sign(next.weeklySets - nextNeutral.weeklySets) !== volDir && Math.abs(next.weeklySets - nextNeutral.weeklySets) > 0)
      findings.push({ level: 'FAIL', code: 'A3', month: m + 1, message: `Volume deciso ${volDir > 0 ? 'in aumento' : 'in calo'} ma le serie del mese ${m + 1} passano da ${nextNeutral.weeklySets} a ${next.weeklySets}.` });
    for (const area of tc?.avoidAreas ?? []) {
      const still = new Set(next.days.flatMap((d) => d.exercises.filter((x) => (x.areas as BodyArea[]).includes(area)).map((x) => x.name)));
      if (still.size) findings.push({ level: 'FAIL', code: 'A7', month: m + 1, message: `Zona dolorante (${AREA[area]}) ma il mese ${m + 1} contiene ${[...still].join(', ')}.` });
    }
    if (o.review) findings.push({ level: 'REVIEW', code: 'A9', month: m, message: o.review });

    checkins.push({
      monthIndex: m,
      outcome: { weeklyKg: o.weeklyKg, startKg: r1(startKg), endKg: r1(kg), completion: o.completion, perf: PERF[o.perf], loggedRir: o.loggedRir ?? null },
      answers: {
        adherence: o.checkin.checkinAdherence,
        energy: ENERGY[String(o.checkin.checkinEnergyLevel)],
        difficulty: (o.checkin.checkinDifficulty as string[]).map((x) => DIFF[x]),
        wantsChange: (o.checkin.checkinWantsChange as string[]).map((x) => WANTS[x]),
        notes: o.checkin.checkinNotes,
        followUps: [o.checkin.checkinTrainingDays ? `Giorni: ${o.checkin.checkinTrainingDays}` : null, o.checkin.checkinSplit ? `Struttura: ${SPLIT[String(o.checkin.checkinSplit)]}` : null].filter(Boolean),
      },
      expect: o.expect,
      result: {
        verdict: result.verdict,
        decision: decisionText(tc, ptc),
        matches,
        mismatches,
        review: o.review ?? null,
        changes: result.changes.filter((c) => c.area === 'allenamento').map((c) => c.text),
        reasons: result.reasons.filter((r) => !/calori|peso|Peso|mangiat|pesate/.test(r)),
        lived: { weeklySets: lived.weeklySets },
        nextNeutral: { weeklySets: nextNeutral.weeklySets, gym: nextNeutral.gymSessions, run: nextNeutral.runSessions },
        nextAfter: { weeklySets: next.weeklySets, gym: next.gymSessions, run: next.runSessions, block: next.block, firstWeek: next.mesocycle?.weeks[0]?.label ?? null },
      },
    });
  }

  // ---- checks on every month (lived + next)
  const plan = bundle.training as TrainingPlan;
  const p0 = buildProgramProfile(ctx0, null);
  const has = equipmentFor(String(u.answers.trainingLocation ?? 'gym'), (u.answers.equipment as string[] | undefined) ?? []);
  const available = u.answers.availableDays === '6+' ? 6 : Number(u.answers.availableDays ?? 3);
  for (const mv of months) {
    const tag = `Mese ${mv.monthIndex}`;
    const days = calibByMonth.get(mv.monthIndex)?.availableDays ?? available;
    if (mv.monthIndex === 1 && (mv.gymSessions !== u.gymSessions || mv.runSessions !== u.runSessions))
      findings.push({ level: 'FAIL', code: 'A4', month: 1, message: `${tag}: ${mv.gymSessions} sedute di palestra e ${mv.runSessions} di corsa, attese ${u.gymSessions} e ${u.runSessions}.` });
    // training DAYS, not sessions: a double-session day counts once
    const trainingDays = mv.days.filter((d) => d.type !== 'rest').length;
    if (trainingDays > days) findings.push({ level: 'FAIL', code: 'A4', month: mv.monthIndex, message: `${tag}: ${trainingDays} giorni di allenamento con ${days} giorni disponibili.` });
    for (const d of mv.days) if (d.extraRun && d.extraRun.kind !== 'easy') findings.push({ level: 'FAIL', code: 'A4', month: mv.monthIndex, message: `${tag}, ${d.weekday}: doppia seduta con una corsa impegnativa.` });
    const equip = new Set<string>();
    const area = new Set<string>();
    for (const d of mv.days) {
      if (d.type !== 'workout') continue;
      const ids = d.exercises.map((x) => x.id);
      if (new Set(ids).size !== ids.length) findings.push({ level: 'FAIL', code: 'A5', month: mv.monthIndex, message: `${tag}, ${d.weekday}: esercizi ripetuti nella stessa seduta.` });
      // blocks must be contiguous; inside a block multi-joint before isolation
      const seen: string[] = [];
      for (const x of d.exercises) {
        if (x.block && seen.length && seen[seen.length - 1] !== x.block && seen.includes(x.block)) findings.push({ level: 'WARN', code: 'A16', month: mv.monthIndex, message: `${tag}, ${d.weekday}: il blocco ${x.block} è spezzato.` });
        if (x.block && seen[seen.length - 1] !== x.block) seen.push(x.block);
      }
      if (d.minutes && d.minutes > p0.sessionMinutes + 10) findings.push({ level: 'WARN', code: 'A17', month: mv.monthIndex, message: `${tag}, ${d.weekday}: ${d.minutes} minuti stimati, oltre i ${p0.sessionMinutes} disponibili.` });
      for (const x of d.exercises) {
        const def = CATALOG_BY_ID.get(x.id);
        for (const need of def?.equipment ?? []) if (!has.has(need)) equip.add(`${x.name} (serve ${need})`);
        for (const a of x.areas as BodyArea[]) if ((u.avoidAreas ?? []).includes(a)) area.add(`${x.name} (${AREA[a]})`);
        if (x.sets < 2 || x.sets > 6) findings.push({ level: 'FAIL', code: 'A6', month: mv.monthIndex, message: `${tag}: ${x.name} con ${x.sets} serie.` });
        if (x.rir === 0 && (p0.level === 'beginner' || def?.kind === 'compound')) findings.push({ level: 'FAIL', code: 'A6', month: mv.monthIndex, message: `${tag}: ${x.name} a cedimento.` });
      }
    }
    if (equip.size) findings.push({ level: 'FAIL', code: 'A8', month: mv.monthIndex, message: `${tag}: esercizi non eseguibili: ${[...equip].join(', ')}.` });
    if (area.size) findings.push({ level: 'FAIL', code: 'A7', month: mv.monthIndex, message: `${tag}: esercizi che caricano la zona dolorante dichiarata: ${[...area].join(', ')}.` });
  }
  const notices = plan.rationale?.notices ?? [];
  for (const n of notices) findings.push({ level: 'INFO', code: 'A18', message: n });

  // loads month by month: no drop during progression unless the plan lightens on purpose
  const loadTable = months.map((mv) => ({ monthIndex: mv.monthIndex, block: mv.block, loads: loads(mv) }));
  // same prescription = same rep range and same RIR (more reps in reserve means a lighter load, on purpose)
  const repsOf = (mv: MonthView, name: string) => {
    const x = mv.days.flatMap((d) => d.exercises).find((y) => y.name === name);
    return x ? `${x.reps}@${x.rir}` : undefined;
  };
  for (let i = 1; i < loadTable.length; i++) {
    const a = loadTable[i - 1];
    const b = loadTable[i];
    if (b.block === 'consolidamento') continue;
    // a heavier rep range (intensification) and back is a different prescription, not a drop
    const drops = Object.entries(b.loads).filter(([n, v]) => a.loads[n] != null && v < a.loads[n] && repsOf(months[i - 1], n) === repsOf(months[i], n));
    if (drops.length) findings.push({ level: 'WARN', code: 'A13', month: b.monthIndex, message: `Mese ${b.monthIndex}: carichi stimati più bassi del mese ${a.monthIndex} per ${drops.map(([n, v]) => `${n} ${a.loads[n]}→${v} kg`).join(', ')}.` });
  }
  // volume: jumps bigger than 25% month to month that no check-in decided
  for (let i = 1; i < months.length; i++) {
    const a = months[i - 1];
    const b = months[i];
    const change = a.weeklySets ? b.weeklySets / a.weeklySets - 1 : 0;
    const ci = checkins[i - 1] as { result: { decision: string[] } } | undefined;
    const decided = (ci?.result.decision.length ?? 0) > 0;
    if (Math.abs(change) > 0.25 && !decided) findings.push({ level: 'WARN', code: 'A14', month: b.monthIndex, message: `Volume da ${a.weeklySets} a ${b.weeklySets} serie a settimana (${change > 0 ? '+' : ''}${Math.round(change * 100)}%) tra il mese ${a.monthIndex} e il ${b.monthIndex}, senza una decisione del check-in.` });
  }
  if (u.runSessions > 0) {
    const notes = months.map((mv) => mv.days.filter((d) => d.type === 'cardio').map((d) => d.note).join(' | '));
    if (new Set(notes).size === 1) findings.push({ level: 'WARN', code: 'A15', message: 'Le uscite di corsa sono identiche in tutti i mesi.' });
  }

  return {
    id: u.id,
    name: u.name,
    summary: u.summary,
    answers: u.answers,
    rationale: plan.rationale ?? null,
    conflicts: plan.conflicts ?? [],
    expected: { gymSessions: u.gymSessions, runSessions: u.runSessions, avoidAreas: (u.avoidAreas ?? []).map((a) => AREA[a]) },
    durationMonths: bundle.durationMonths,
    weights,
    checkins,
    months,
    loadTable,
    findings,
    muscleLabels: MUSCLE_SHORT,
  };
}

/** Hybrid scenarios (engine v5): Andrea's same request with different answers on priority and double sessions, and a
 * runner with three Lower-heavy strength sessions. Not part of the 7 regression users. */
const ANDREA = USERS.find((u) => u.id === 'andrea')!;
export const HYBRID: TestUser[] = [
  {
    ...ANDREA,
    id: 'andrea-doppie',
    name: 'Andrea · doppie sedute',
    summary: 'Come Andrea, ma può allenarsi due volte nello stesso giorno: 2 forza + 3 corse in 4 giorni.',
    answers: { ...ANDREA.answers, doubleSessions: 'yes' },
    gymSessions: 2,
    runSessions: 3,
    months: [
      { weeklyKg: 0.0, completion: 0.9, perf: 'improving', checkin: ck(5, 'high'), expect: 'In crescita ed energia alta: volume +5%.', expected: { volume: 1 } },
      {
        weeklyKg: 0.0,
        completion: 0.85,
        perf: 'stable',
        checkin: ck(4, 'low', ['soreness'], ['nothing'], '', { checkinRecovery: 'poor' }),
        expect: 'Recupero scarso con doppie sedute: la corsa non progredisce, stress della forza ridotto, nessuno scarico per un solo mese.',
        expected: { deload: false, volume: -1, rirShift: 1 },
      },
      { weeklyKg: 0.0, completion: 0.9, perf: 'stable', checkin: ck(4, 'normal', ['none'], ['nothing'], '', { checkinRecovery: 'poor' }), expect: 'Recupero scarso per il secondo check-in di fila: settimana di scarico.', expected: { deload: true } },
    ],
  },
  { ...ANDREA, id: 'andrea-corsa', name: 'Andrea · precedenza alla corsa', summary: 'Come Andrea, con la corsa che ha la precedenza e niente doppie sedute.', answers: { ...ANDREA.answers, trainingPriority: 'running', doubleSessions: 'no' }, gymSessions: 1, runSessions: 3 },
  { ...ANDREA, id: 'andrea-palestra', name: 'Andrea · precedenza alla palestra', summary: 'Come Andrea, con la palestra che ha la precedenza e niente doppie sedute.', answers: { ...ANDREA.answers, trainingPriority: 'gym', doubleSessions: 'no' }, gymSessions: 2, runSessions: 2 },
  {
    id: 'runner-lower',
    name: 'Chiara · corsa veloce + 3 sedute di forza',
    summary: 'Intermedia, corre 2 volte con ripetute e fa 3 sedute di forza (Upper/Lower) con 5 giorni: corsa intensa e gambe da distanziare.',
    answers: q({ sex: 'female', heightCm: 168, currentWeightKg: 60, targetWeightKg: 60, goal: 'maintainImprove', activitiesPracticed: ['gym', 'running'], freq_gym: '3', freq_running: '2', focus_running: 'speed', availableDays: '5', gymSplitPreference: 'upperLower', trainingPriority: 'balanced' }),
    gymSessions: 3,
    runSessions: 2,
    months: [
      { weeklyKg: 0.0, completion: 0.9, perf: 'improving', checkin: ck(4, 'normal'), expect: 'Regolare: si continua.', expected: { volume: 0 } },
      { weeklyKg: 0.0, completion: 0.9, perf: 'declining', checkin: ck(3, 'low', ['soreness'], ['nothing'], '', { checkinRecovery: 'poor', checkinSleep: 'poor' }), expect: 'Prestazioni in calo per più settimane e recupero scarso: scarico.', expected: { deload: true } },
    ],
  },
];

if (require.main === module) {
  const out = { engine: TRAINING_ENGINE_VERSION, generatedAt: new Date().toISOString(), users: USERS.map(runUser), hybrid: HYBRID.map(runUser) };
  const path = process.argv[2] ?? 'training-journey.json';
  writeFileSync(path, JSON.stringify(out));
  for (const u of [...out.users, ...out.hybrid]) {
    const c = (l: string) => u.findings.filter((f) => f.level === l).length;
    console.log(`${u.name}: ${u.durationMonths} mesi, ${u.checkins.length} check-in, ${c('FAIL')} errori, ${c('WARN')} avvisi, ${c('REVIEW')} da valutare`);
    for (const f of u.findings) if (f.level === 'FAIL' || f.level === 'WARN') console.log(`   ${f.level} ${f.code} ${f.message}`);
  }
  console.log(`→ ${path}`);
}
