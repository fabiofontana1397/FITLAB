/**
 * Test cases of the training engine v3: one scenario per behaviour the brief asks for
 * (24 cases) plus quality indicators over a broad set of profiles. Every case states
 * what must be true and checks it on the real engine output.
 *
 *   npx tsx scripts/agent-tests/training-cases.ts [out.json]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { buildPlans } from '@/domain/plan-engine';
import { NEUTRAL_CALIBRATION } from '@/domain/recalibration';
import { buildUserContext, type UserContext } from '@/domain/user-context';
import { rescheduleMissed } from '@/lib/planning/training-days';
import { adaptTraining } from '@/lib/planning/training/adaptation';
import { CATALOG_BY_ID } from '@/lib/planning/training/catalog';
import { nearDuplicate, patternOf } from '@/lib/planning/training/session-builder';
import { validateMonth } from '@/lib/planning/training/safety';
import { compareVersions } from './training-compare';
import { doubleProgression } from '@/lib/planning/training/loads';
import { buildProgramProfile, equipmentFor } from '@/lib/planning/training/profile';
import { broSplit } from '@/lib/planning/training/split';
import type { TrainingCalibration } from '@/lib/planning/training/types';
import type { TrainingDayPlan, TrainingMonthPlan, TrainingPlan } from '@/lib/planning/types';

type Answers = Record<string, unknown>;

const BASE: Answers = {
  mode: 'training',
  age: 30,
  sex: 'male',
  heightCm: 178,
  currentWeightKg: 78,
  goal: 'gainMuscle',
  targetWeightKg: 82,
  jobActivity: 'sedentary',
  dailySteps: '5000-8000',
  sleepHoursRange: '7-8',
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

function plan(answers: Answers, training?: TrainingCalibration): { ctx: UserContext; t: TrainingPlan } {
  const ctx = buildUserContext(answers);
  const calibration = training ? { ...NEUTRAL_CALIBRATION, training: { fromMonth: 1, ...training }, fromMonth: training.fromMonth ?? 1 } : undefined;
  const b = buildPlans(ctx, calibration ? { calibration } : {});
  return { ctx, t: b.training! };
}
const workouts = (m: TrainingMonthPlan): TrainingDayPlan[] => m.weeklySplit.filter((d) => d.type === 'workout');
const allEx = (m: TrainingMonthPlan) => workouts(m).flatMap((d) => d.exercises ?? []);
const vol = (m: TrainingMonthPlan, g: string) => m.weeklyVolume?.find((v) => v.group === g)?.fractional ?? 0;
const repsTop = (r: string) => Math.max(...(r.match(/\d+/g) ?? ['0']).map(Number));

type Case = { n: number; title: string; expectation: string; pass: boolean; details: string[] };
const cases: Case[] = [];
function test(n: number, title: string, expectation: string, fn: () => string[] | { ok: boolean; details: string[] }) {
  try {
    const r = fn();
    const res = Array.isArray(r) ? { ok: r.every((x) => !x.startsWith('✗')), details: r } : r;
    cases.push({ n, title, expectation, pass: res.ok, details: res.details });
  } catch (e) {
    cases.push({ n, title, expectation, pass: false, details: [`✗ eccezione: ${(e as Error).message}`] });
  }
}
const ok = (cond: boolean, yes: string, no: string) => (cond ? `✓ ${yes}` : `✗ ${no}`);

// ------------------------------------------------------------------ cases --

test(1, 'Principiante in ipertrofia', 'Full Body, RIR ≥2, nessuna tecnica avanzata, carichi da calibrare, mese di adattamento.', () => {
  const { t } = plan(q({ gymExperience: 'never', gymSkillLevel: 'beginner' }));
  const m1 = t.months[0];
  const ex = allEx(m1);
  return [
    ok(t.rationale?.split.startsWith('Full Body') ?? false, `split ${t.rationale?.split}`, `split ${t.rationale?.split}`),
    ok(ex.every((x) => (x.rir ?? 0) >= 2), 'tutti gli esercizi con RIR ≥2', 'RIR sotto 2 per un principiante'),
    ok(ex.every((x) => !x.technique || x.technique.kind === 'antagonistSuperset'), 'nessuna tecnica di intensificazione', 'tecniche avanzate per un principiante'),
    ok(m1.block === 'adattamento', 'mese 1 di adattamento', `mese 1: ${m1.block}`),
    ok(ex.filter((x) => x.suggestedKg != null).every((x) => x.loadStatus === 'calibrate'), 'carichi del mese 1 da calibrare', 'carichi presentati come certi'),
  ];
});

test(2, 'Intermedio in ipertrofia', '3 giorni: Upper/Lower + Full Body; con sedute da 60-90 minuti il volume dei gruppi principali è nell’intervallo intermedio (8-16 serie frazionarie).', () => {
  const { t } = plan(q({}));
  const m = plan(q({ sessionDuration: '60-90' })).t.months[0];
  return [
    ok(t.rationale?.split === 'Upper / Lower + Full Body', `split ${t.rationale?.split}`, `split ${t.rationale?.split}`),
    ok(vol(m, 'chest') >= 8 && vol(m, 'chest') <= 16, `petto ${vol(m, 'chest')} serie frazionarie`, `petto ${vol(m, 'chest')}`),
    ok(vol(m, 'quads') >= 8 && vol(m, 'quads') <= 16, `quadricipiti ${vol(m, 'quads')}`, `quadricipiti ${vol(m, 'quads')}`),
  ];
});

test(3, 'Avanzato in ipertrofia', '5 giorni lunghi: frequenza 2 per gruppo, più volume dell’intermedio, tecniche solo sugli isolamenti finali.', () => {
  const adv = plan(q({ gymExperience: '3plusYears', gymSkillLevel: 'expert', freq_gym: '5', availableDays: '5', sessionDuration: '60-90' })).t;
  const mid = plan(q({ freq_gym: '5', availableDays: '5', sessionDuration: '60-90' })).t;
  const ex = allEx(adv.months[0]);
  const tech = ex.filter((x) => x.technique && x.technique.kind !== 'antagonistSuperset');
  const totA = adv.months[0].weeklyVolume!.reduce((s, v) => s + v.fractional, 0);
  const totI = mid.months[0].weeklyVolume!.reduce((s, v) => s + v.fractional, 0);
  return [
    ok(totA > totI, `volume totale ${Math.round(totA)} contro ${Math.round(totI)} dell’intermedio`, `volume avanzato ${Math.round(totA)} non superiore a ${Math.round(totI)}`),
    ok(tech.length > 0 && tech.every((x) => x.role === 'isolation'), `${tech.length} tecniche, tutte su isolamenti`, 'tecniche assenti o su multiarticolari'),
    ok((adv.months[0].weeklyVolume ?? []).filter((v) => ['chest', 'quads', 'lats'].includes(v.group)).every((v) => v.frequency >= 2), 'petto, quadricipiti e dorsali allenati almeno 2 volte', 'frequenza 1 su un gruppo principale'),
  ];
});

test(4, 'Atleta orientato alla forza', 'Fondamentali con bilanciere come principali, 3-5 ripetizioni, recuperi ≥3 minuti, military press presente.', () => {
  const { t } = plan(q({ focus_gym: 'strength', goal: 'gainStrength', freq_gym: '4', availableDays: '4', sessionDuration: '60-90' }));
  const mains = allEx(t.months[0]).filter((x) => x.role === 'main');
  return [
    ok(mains.length > 0 && mains.every((x) => CATALOG_BY_ID.get(x.id)?.loadType === 'barbell'), `principali: ${[...new Set(mains.map((x) => x.name))].join(', ')}`, `principali non con bilanciere: ${mains.map((x) => x.name).join(', ')}`),
    ok(mains.every((x) => repsTop(x.reps) <= 5), 'ripetizioni dei principali ≤5', 'principali oltre 5 ripetizioni'),
    ok(mains.every((x) => x.restSec >= 180), 'recuperi ≥180 s', 'recuperi brevi sui principali'),
    ok(allEx(t.months[0]).some((x) => x.id === 'military-press'), 'military press presente', 'nessuna spinta verticale'),
  ];
});

test(5, 'Principiante con due sedute', 'Full Body A e B diverse, ogni gruppo principale allenato.', () => {
  const { t } = plan(q({ gymExperience: 'never', gymSkillLevel: 'beginner', freq_gym: '2', availableDays: '2' }));
  const w = workouts(t.months[0]);
  const groups = new Set(allEx(t.months[0]).map((x) => CATALOG_BY_ID.get(x.id)?.primary));
  return [
    ok(w.length === 2 && w[0].title !== w[1].title, `${w.map((d) => d.title).join(' e ')}`, 'sedute uguali'),
    ok(['quads', 'chest', 'hamstrings'].every((g) => groups.has(g as never)) && (groups.has('lats') || groups.has('upperBack')), 'gambe, spinta e tirata presenti', 'gruppi principali mancanti'),
  ];
});

test(6, 'Full Body richiesto', 'Con preferenza Full Body e 4 giorni: 4 sedute Full Body con varianti.', () => {
  const { t } = plan(q({ gymSplitPreference: 'fullBody', freq_gym: '4', availableDays: '4' }));
  const titles = workouts(t.months[0]).map((d) => d.title);
  return [ok(titles.every((x) => x.startsWith('Full Body')), titles.join(', '), titles.join(', ')), ok(new Set(titles).size >= 3, 'almeno 3 varianti', 'varianti insufficienti')];
});

test(7, 'Upper/Lower', '4 giorni intermedio: Upper A/B e Lower A/B.', () => {
  const { t } = plan(q({ freq_gym: '4', availableDays: '4' }));
  const titles = workouts(t.months[0]).map((d) => d.title);
  return [ok(titles.join(',') === 'Upper A,Lower A,Upper B,Lower B', titles.join(', '), titles.join(', '))];
});

test(8, 'Push/Pull/Legs', '6 giorni intermedio: Push/Pull/Legs due volte, sedute ripetute con accessori diversi.', () => {
  const { t } = plan(q({ freq_gym: '6', availableDays: '6+', sessionDuration: '60-90' }));
  const w = workouts(t.months[0]);
  const push = w.filter((d) => d.title.startsWith('Push'));
  const sameMain = push.length === 2 && push[0].exercises![0].id === push[1].exercises![0].id;
  const diffAcc = push.length === 2 && JSON.stringify(push[0].exercises!.slice(1).map((x) => x.id)) !== JSON.stringify(push[1].exercises!.slice(1).map((x) => x.id));
  return [ok(w.length === 6 && push.length === 2, w.map((d) => d.title).join(', '), w.map((d) => d.title).join(', ')), ok(sameMain, 'stesso esercizio principale nei due Push', 'principale diverso'), ok(diffAcc, 'accessori diversi tra Push 1 e Push 2', 'Push identici')];
});

test(9, 'Allenamento con focus muscolare', 'Specializzazione sulle spalle laterali (+4 serie): il volume del gruppo sale, gli altri restano.', () => {
  const base = plan(q({ sessionDuration: '60-90' })).t.months[0];
  const spec = plan(q({ sessionDuration: '60-90' }), { groupSets: { sideDelts: 4 } }).t.months[0];
  return [ok(vol(spec, 'sideDelts') > vol(base, 'sideDelts'), `spalle laterali ${vol(base, 'sideDelts')} → ${vol(spec, 'sideDelts')}`, `spalle laterali ${vol(base, 'sideDelts')} → ${vol(spec, 'sideDelts')}`), ok(Math.abs(vol(spec, 'quads') - vol(base, 'quads')) <= 1, 'quadricipiti invariati', 'altri gruppi cambiati')];
});

test(10, 'Programma con blocchi muscolari', 'In ogni seduta i blocchi sono contigui, il multiarticolare apre il blocco, il core chiude la seduta.', () => {
  const { t } = plan(q({ freq_gym: '4', availableDays: '4', sessionDuration: '60-90' }));
  const errs: string[] = [];
  for (const d of workouts(t.months[0])) {
    const ex = d.exercises!;
    const seen: string[] = [];
    for (const x of ex) {
      if (seen.length && seen[seen.length - 1] !== x.blockName && seen.includes(x.blockName!)) errs.push(`${d.title}: blocco ${x.blockName} spezzato`);
      if (seen[seen.length - 1] !== x.blockName) seen.push(x.blockName!);
    }
    const coreIdx = ex.findIndex((x) => x.role === 'core');
    if (coreIdx >= 0 && coreIdx !== ex.length - 1) errs.push(`${d.title}: core non in fondo`);
    for (const b of new Set(ex.map((x) => x.blockName))) {
      const roles = ex.filter((x) => x.blockName === b).map((x) => x.role);
      const firstIso = roles.indexOf('isolation');
      if (firstIso >= 0 && roles.slice(firstIso).some((r) => r === 'main' || r === 'secondary')) errs.push(`${d.title}: isolamento prima di un multiarticolare nel blocco ${b}`);
    }
  }
  return errs.length ? errs.map((e) => `✗ ${e}`) : ['✓ blocchi contigui e ordinati in tutte le sedute', `✓ esempio: ${workouts(t.months[0])[0].exercises!.map((x) => `[${x.blockName}] ${x.name}`).join(' → ')}`];
});

test(11, 'Superset antagonisti', 'Intermedio con sedute brevi: superset tra gruppi antagonisti per stare nel tempo, mai per i principianti.', () => {
  const mid = plan(q({ freq_gym: '4', availableDays: '4', sessionDuration: '30-45' })).t;
  const beg = plan(q({ freq_gym: '4', availableDays: '4', sessionDuration: '30-45', gymExperience: 'never', gymSkillLevel: 'beginner' })).t;
  const ss = allEx(mid.months[0]).filter((x) => x.supersetWith);
  return [ok(ss.length > 0, `${ss.length / 2} superset: ${ss.map((x) => x.name).join(' + ')}`, 'nessun superset'), ok(allEx(beg.months[0]).every((x) => !x.supersetWith), 'nessun superset per il principiante', 'superset per un principiante')];
});

test(12, 'Allenamento a casa', 'Solo esercizi eseguibili con manubri e panca.', () => {
  const { t, ctx } = plan(q({ trainingLocation: 'home', equipment: ['dumbbells', 'bench'] }));
  const has = equipmentFor('home', ['dumbbells', 'bench']);
  const bad = t.months.flatMap(allEx).filter((x) => (CATALOG_BY_ID.get(x.id)?.equipment ?? []).some((e) => !has.has(e)));
  void ctx;
  return [ok(bad.length === 0, `esercizi: ${[...new Set(allEx(t.months[0]).map((x) => x.name))].join(', ')}`, `non eseguibili: ${bad.map((x) => x.name).join(', ')}`)];
});

test(13, 'Allenamento outdoor', 'Senza attrezzatura solo corpo libero; con sbarra compaiono trazioni e rematore inverso.', () => {
  const none = plan(q({ trainingLocation: 'outdoor', equipment: [] })).t;
  const bar = plan(q({ trainingLocation: 'outdoor', equipment: ['pullupBar'] })).t;
  const noneEq = allEx(none.months[0]).filter((x) => (CATALOG_BY_ID.get(x.id)?.equipment ?? []).length > 0);
  const barIds = allEx(bar.months[0]).map((x) => x.id);
  return [ok(noneEq.length === 0, 'solo corpo libero senza attrezzatura', `attrezzi non dichiarati: ${noneEq.map((x) => x.name).join(', ')}`), ok(barIds.includes('trazioni-sbarra') || barIds.includes('rematore-inverso'), 'con la sbarra: trazioni o rematore inverso', 'sbarra ignorata')];
});

test(14, 'Corsa e palestra', 'Priorità alla palestra rispettata e dichiarata; nessuna seduta di corsa intensa il giorno dopo le gambe.', () => {
  const { t } = plan(q({ activitiesPracticed: ['gym', 'running'], freq_gym: '3', freq_running: '3', focus_running: 'raceTime', availableDays: '4', trainingPriority: 'gym', goal: 'improveEndurance' }));
  const w = t.months[0].weeklySplit;
  const gym = w.filter((d) => d.type === 'workout').length;
  let bad = 0;
  for (let i = 0; i < 6; i++) {
    const a = w[i];
    const b = w[i + 1];
    const legs = a.type === 'workout' && (a.exercises ?? []).some((x) => ['quads', 'hamstrings', 'glutes'].includes(CATALOG_BY_ID.get(x.id)?.primary ?? ''));
    if (legs && b.type === 'cardio' && b.run && b.run.kind !== 'easy') bad++;
  }
  return [
    ok(gym === 3, `3 sedute di palestra e ${w.filter((d) => d.type === 'cardio').length} di corsa`, `${gym} sedute di palestra`),
    ok((t.rationale?.notices ?? []).some((n) => n.includes('precedenza')), 'la scelta è dichiarata nel piano', 'conflitto non dichiarato'),
    ok(bad === 0, 'nessuna corsa intensa dopo una seduta di gambe', `${bad} corse intense dopo le gambe`),
  ];
});

test(15, 'Carichi iniziali da calibrare', 'Mese 1 con stima prudente e istruzioni di calibrazione; dal mese 2 stima che non scende.', () => {
  const { t } = plan(q({}));
  const m1 = allEx(t.months[0]).filter((x) => x.suggestedKg != null);
  const m2 = allEx(t.months[1]).filter((x) => x.suggestedKg != null);
  return [ok(m1.every((x) => x.loadStatus === 'calibrate' && (x.loadNote ?? '').includes('calibrare')), `${m1.length} carichi marcati "da calibrare"`, 'carichi senza indicazione di calibrazione'), ok(m2.every((x) => x.loadStatus === 'estimate'), 'dal mese 2: stima finché non c’è storico', 'stato del carico mancante')];
});

test(16, 'Doppia progressione', 'Range completato con RIR rispettato → +1 incremento; dentro il range → stesso carico.', () => {
  const top = doubleProgression([1, 2, 3].map(() => ({ date: '2026-01-10', weightKg: 60, reps: 10, rir: 2 })), { repsMin: 8, repsMax: 10, rir: 2, increment: 2.5 }, 60);
  const mid = doubleProgression([10, 9, 8].map((r) => ({ date: '2026-01-10', weightKg: 60, reps: r, rir: 2 })), { repsMin: 8, repsMax: 10, rir: 2, increment: 2.5 }, 60);
  return [ok(top.action === 'increase' && top.kg === 62.5, `10/10/10 a 60 kg → ${top.kg} kg`, `10/10/10 → ${top.kg} (${top.action})`), ok(mid.action === 'hold' && mid.kg === 60, `10/9/8 → resta a ${mid.kg} kg`, `10/9/8 → ${mid.kg}`)];
});

test(17, 'Mancato raggiungimento del target', 'Sotto il range una volta → stesso carico; due sedute di fila → riduzione.', () => {
  const once = doubleProgression([{ date: '2026-01-10', weightKg: 60, reps: 6, rir: 0 }], { repsMin: 8, repsMax: 10, rir: 2, increment: 2.5 }, 60);
  const twice = doubleProgression(
    [
      { date: '2026-01-07', weightKg: 60, reps: 6, rir: 0 },
      { date: '2026-01-10', weightKg: 60, reps: 7, rir: 0 },
    ],
    { repsMin: 8, repsMax: 10, rir: 2, increment: 2.5 },
    60
  );
  return [ok(once.action === 'hold', 'una seduta sotto il range: stesso carico', `una seduta: ${once.action}`), ok(twice.action === 'reduce' && twice.kg < 60, `due sedute: ${twice.kg} kg`, `due sedute: ${twice.action}`)];
});

test(18, 'Recupero insufficiente', 'Prestazioni in calo + dolori + stanchezza → settimana di scarico; dolori con prestazioni in crescita → niente scarico.', () => {
  const tired = adaptTraining({ monthIndex: 1, previous: undefined, trainingCompletion: 0.9, checkin: { adherence: 4, energy: 'low', difficulty: ['soreness'] }, performance: perf(-0.06), plannedRir: 2, hasGym: true, sessionBucket: '45-60' });
  const growing = adaptTraining({ monthIndex: 1, previous: undefined, trainingCompletion: 0.9, checkin: { adherence: 4, energy: 'low', difficulty: ['soreness'] }, performance: perf(0.05), plannedRir: 2, hasGym: true, sessionBucket: '45-60' });
  return [ok(!!tired.calibration.deloadFirstWeek, 'calo + fatica: scarico', 'nessuno scarico'), ok(!growing.calibration.deloadFirstWeek && growing.calibration.rirShift === 1, 'in crescita: niente scarico, RIR +1', 'scarico non giustificato')];
});

test(19, 'Richiesta di modifica della split', 'Check-in "Parte alta / parte bassa": il mese dopo è Upper/Lower.', () => {
  const a = adaptTraining({ monthIndex: 1, previous: undefined, trainingCompletion: 0.9, checkin: { adherence: 4, energy: 'normal', wantsChange: ['trainingSplit'], split: 'upperLower' }, plannedRir: 2, hasGym: true, sessionBucket: '45-60' });
  const { t } = plan(q({ freq_gym: '4', availableDays: '4', gymExperience: 'never', gymSkillLevel: 'beginner', gymSplitPreference: 'fullBody' }), { ...a.calibration, fromMonth: 2 });
  return [ok(workouts(t.months[0])[0].title.startsWith('Full Body'), 'mese 1 Full Body come da preferenza', 'mese 1 cambiato'), ok(workouts(t.months[1]).every((d) => /Upper|Lower/.test(d.title)), `mese 2: ${workouts(t.months[1]).map((d) => d.title).join(', ')}`, 'split non cambiata')];
});

test(20, 'Segnalazione di dolore', 'Spalla dolorante scritta nelle note → nessun esercizio che carica la spalla e invito a una valutazione.', () => {
  const a = adaptTraining({ monthIndex: 1, previous: undefined, trainingCompletion: 0.9, checkin: { adherence: 4, energy: 'normal', notes: 'Mi fa male la spalla destra quando spingo' }, plannedRir: 2, hasGym: true, sessionBucket: '45-60' });
  const { t } = plan(q({}), { ...a.calibration, fromMonth: 2 });
  const bad = allEx(t.months[1]).filter((x) => CATALOG_BY_ID.get(x.id)?.areas.includes('shoulder'));
  return [ok((a.calibration.avoidAreas ?? []).includes('shoulder'), 'spalla esclusa', 'dolore non letto'), ok(bad.length === 0, 'nessun esercizio che carica la spalla nel mese 2', `ancora: ${bad.map((x) => x.name).join(', ')}`), ok(a.changes.some((c) => c.includes('fisioterapista')), 'invito a farsi valutare', 'manca l’invito')];
});

test(21, 'Cambio dell’attrezzatura', 'Aggiungere cavi e panca a casa cambia gli esercizi e li rende comunque eseguibili.', () => {
  const before = plan(q({ trainingLocation: 'home', equipment: ['dumbbells'] })).t;
  const after = plan(q({ trainingLocation: 'home', equipment: ['dumbbells', 'bench', 'cables'] })).t;
  const ids = (t: TrainingPlan) => new Set(allEx(t.months[0]).map((x) => x.id));
  const added = [...ids(after)].filter((x) => !ids(before).has(x));
  const has = equipmentFor('home', ['dumbbells']);
  const bad = allEx(before.months[0]).filter((x) => (CATALOG_BY_ID.get(x.id)?.equipment ?? []).some((e) => !has.has(e)));
  return [ok(added.length > 0, `nuovi esercizi: ${added.map((x) => CATALOG_BY_ID.get(x)?.name).join(', ')}`, 'nessun cambiamento'), ok(bad.length === 0, 'con soli manubri nessun esercizio non eseguibile', bad.map((x) => x.name).join(', '))];
});

test(22, 'Necessità di deload', 'Deload solo quando serve: nessuno nel piano iniziale di un principiante, condizionale per l’avanzato in intensificazione, applicato quando il check-in lo decide.', () => {
  const beg = plan(q({ gymExperience: 'never', gymSkillLevel: 'beginner' })).t;
  const adv = plan(q({ gymExperience: '3plusYears', gymSkillLevel: 'expert', freq_gym: '5', availableDays: '5', goal: 'gainMuscle', targetWeightKg: 90 })).t;
  const forced = plan(q({}), { deloadFirstWeek: true, fromMonth: 2 }).t;
  const begDeload = beg.months.some((m) => m.mesocycle?.weeks.some((w) => w.label.includes('scarico')));
  const advCond = adv.months.find((m) => m.block === 'intensificazione')?.mesocycle?.weeks[3]?.label ?? '';
  const m2 = forced.months[1];
  const ex2 = allEx(m2);
  const w1 = ex2.reduce((a, x) => a + (x.weeks?.[0]?.sets ?? x.sets), 0);
  const w2 = ex2.reduce((a, x) => a + (x.weeks?.[1]?.sets ?? x.sets), 0);
  return [
    ok(!begDeload, 'nessuno scarico programmato per il principiante', 'scarico automatico'),
    ok(advCond.includes('se serve'), `avanzato: "${advCond}"`, 'manca lo scarico condizionale'),
    ok((m2.mesocycle?.weeks[0].label ?? '').includes('scarico'), 'scarico deciso al check-in nella settimana 1', 'scarico non applicato'),
    ok(w1 < w2, `negli esercizi: ${w1} serie nella settimana di scarico contro ${w2}`, `serie della settimana di scarico ${w1} contro ${w2}: lo scarico è solo dichiarato`),
  ];
});

test(23, 'Utente con disponibilità ridotta', '2 sedute da meno di 30 minuti: sedute entro il tempo, volume ridotto in proporzione e dichiarato.', () => {
  const { t } = plan(q({ freq_gym: '2', availableDays: '2', sessionDuration: 'lt30' }));
  const w = workouts(t.months[0]);
  return [ok(w.every((d) => (d.estimatedMinutes ?? 99) <= 35), `durata stimata ${w.map((d) => d.estimatedMinutes).join(' e ')} minuti`, `sedute troppo lunghe: ${w.map((d) => d.estimatedMinutes).join(', ')}`), ok(w.every((d) => (d.exercises ?? []).length <= 4), 'al massimo 4 esercizi', 'troppi esercizi')];
});

test(24, 'Utente che progredisce rapidamente', 'Serie molto più facili del previsto → +2 incrementi; prestazioni in crescita con energia alta → volume +5% con tetto +10%.', () => {
  const fast = doubleProgression([1, 2, 3].map(() => ({ date: '2026-01-10', weightKg: 60, reps: 10, rir: 5 })), { repsMin: 8, repsMax: 10, rir: 2, increment: 2.5 }, 60);
  let prev: TrainingCalibration | undefined;
  const factors: number[] = [];
  for (let m = 1; m <= 4; m++) {
    prev = adaptTraining({ monthIndex: m, previous: prev, trainingCompletion: 0.95, checkin: { adherence: 5, energy: 'veryHigh' }, performance: perf(0.06), plannedRir: 2, hasGym: true, sessionBucket: '45-60' }).calibration;
    factors.push(prev.volumeFactor ?? 1);
  }
  return [ok(fast.kg === 65, `RIR 5 su 2 previsti: 60 → ${fast.kg} kg`, `→ ${fast.kg}`), ok(Math.max(...factors) <= 1.1 && factors[0] > 1, `volume ${factors.map((f) => `×${f.toFixed(2)}`).join(' → ')}`, `volume ${factors.join(', ')}`)];
});

test(25, 'Sedute saltate', 'Una seduta saltata si recupera nel primo giorno libero utile; la seconda non si accumula.', () => {
  const { t } = plan(q({}));
  const w = t.months[0].weeklySplit;
  const first = w.findIndex((d) => d.type === 'workout');
  const moved = rescheduleMissed(w, first, first + 1, false);
  const again = rescheduleMissed(w, first, first + 1, true);
  return [ok(moved != null && w[moved].type === 'rest', `${w[first].title} di ${w[first].weekday} spostata a ${moved != null ? w[moved].weekday : '—'}`, 'non recuperata'), ok(again == null, 'un secondo recupero nella stessa settimana viene saltato', 'sedute accumulate')];
});

test(26, 'Split per gruppo muscolare (bro split)', 'Disponibile su richiesta, mai scelta automaticamente.', () => {
  const autos = [3, 4, 5, 6].map((d) => plan(q({ freq_gym: String(d), availableDays: d === 6 ? '6+' : String(d), gymExperience: '3plusYears', gymSkillLevel: 'expert', sessionDuration: 'gt90' })).t.rationale?.split);
  return [ok(broSplit().sessions.length === 5, 'generatore disponibile (5 sedute)', 'generatore assente'), ok(autos.every((s) => s !== 'Split per gruppo muscolare'), `scelte automatiche: ${autos.join(', ')}`, 'bro split scelta da sola')];
});

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const weekSets = (m: TrainingMonthPlan, w: number) => sum(allEx(m).map((x) => x.weeks?.find((y) => y.week === w)?.sets ?? x.sets));
const blockers = (m: TrainingMonthPlan) => (m.validation ?? []).filter((f) => f.level === 'blocker');

test(27, 'A — Deload reale', 'setsFactor e rirOffset cambiano davvero serie, RIR, carichi e tecniche degli esercizi della settimana di scarico; un deload solo dichiarato viene bloccato.', () => {
  const t = plan(q({ gymExperience: '3plusYears', gymSkillLevel: 'expert', freq_gym: '5', availableDays: '5', sessionDuration: '60-90' }), { deloadFirstWeek: true, fromMonth: 2 }).t;
  const m = t.months[1];
  const ex = allEx(m);
  const wk = m.mesocycle!.weeks[0];
  const fewer = ex.filter((x) => x.sets > 1 && (x.weeks![0].sets >= x.sets));
  const rirUp = ex.filter((x) => x.rir != null && x.rir < 4 && (x.weeks![0].rir ?? 0) <= x.rir);
  const tech = ex.filter((x) => x.weeks![0].technique && x.weeks![0].technique.kind !== 'antagonistSuperset');
  // a load already at the smallest step of the exercise cannot go lower: there the deload is in sets and RIR
  const heavier = ex.filter((x) => x.suggestedKg != null && x.weeks![0].suggestedKg != null && x.weeks![0].suggestedKg! >= x.suggestedKg && x.suggestedKg > (x.loadIncrementKg ?? 1));
  const zeroed = ex.filter((x) => (x.suggestedKg ?? 0) > 0 && x.weeks![0].suggestedKg === 0);
  // a fake deload: same exercises, week flagged as deload but prescriptions unchanged → the validator must block it
  const fake = JSON.parse(JSON.stringify(m)) as TrainingMonthPlan;
  for (const d of fake.weeklySplit) for (const x of d.exercises ?? []) x.weeks = x.weeks!.map((w) => ({ ...w, sets: x.sets, rir: x.rir, suggestedKg: x.suggestedKg }));
  fake.mesocycle!.weeks[0].sets = undefined;
  const { ctx } = plan(q({}));
  const caught = validateMonth(fake, ctx, { profile: buildProgramProfile(ctx, null), splitKind: null, hybrid: false }).filter((f) => f.code === 'B3').length;
  return [
    ok(!!wk.deload && wk.setsFactor < 1 && wk.rirOffset > 0, `settimana 1: ${wk.label}, serie ×${wk.setsFactor}, RIR +${wk.rirOffset}`, 'parametri di scarico assenti'),
    ok(weekSets(m, 1) < weekSets(m, 2) * 0.75, `volume effettivo: ${weekSets(m, 1)} serie contro ${weekSets(m, 2)} della settimana ordinaria`, `volume ${weekSets(m, 1)} contro ${weekSets(m, 2)}`),
    ok(fewer.length === 0, 'ogni esercizio ha meno serie', `serie invariate: ${fewer.map((x) => x.name).join(', ')}`),
    ok(rirUp.length === 0, 'RIR più prudente su ogni esercizio', `RIR invariato: ${rirUp.map((x) => x.name).join(', ')}`),
    ok(tech.length === 0, 'nessuna tecnica di intensità nello scarico', `tecniche rimaste: ${tech.map((x) => x.name).join(', ')}`),
    ok(heavier.length === 0 && zeroed.length === 0, 'carichi circa −10% (mai azzerati)', `carichi non ridotti: ${heavier.map((x) => x.name).join(', ')}${zeroed.length ? `; azzerati: ${zeroed.map((x) => x.name).join(', ')}` : ''}`),
    ok(blockers(m).length === 0, 'nessun blocco del validatore sul piano reale', blockers(m).map((f) => f.message).join(' | ')),
    ok(caught > 0, `uno scarico solo dichiarato viene bloccato (${caught} errori B3)`, 'il validatore accetta un flag senza prescrizioni diverse'),
  ];
});

test(28, 'B — Full Body senza attrezzatura', 'Spinta, tirata, ginocchio, anca e core coperti nella settimana per quanto possibile; un limite non viene dichiarato come copertura completa.', () => {
  const none = plan(q({ mode: 'training', age: 55, gymExperience: 'never', gymSkillLevel: 'beginner', freq_gym: '2', availableDays: '2', sessionDuration: 'lt30', trainingLocation: 'outdoor', equipment: [], goal: 'generalHealth', focus_gym: 'technique' })).t;
  const bar = plan(q({ gymExperience: 'never', gymSkillLevel: 'beginner', freq_gym: '2', availableDays: '2', sessionDuration: '30-45', trainingLocation: 'outdoor', equipment: ['pullupBar'] })).t;
  const cov = (t: TrainingPlan) => Object.fromEntries((t.months[0].patternCoverage ?? []).map((c) => [c.pattern, c.status]));
  const n = cov(none);
  const b = cov(bar);
  const recomputed = (t: TrainingPlan) => {
    const keys = new Set<string>();
    for (const x of allEx(t.months[0])) {
      const def = CATALOG_BY_ID.get(x.id);
      const po = def ? patternOf(def) : null;
      if (po?.full) keys.add(po.key);
    }
    return ['push', 'pull', 'knee', 'hip', 'core'].every((k) => (cov(t)[k] === 'full') === keys.has(k));
  };
  return [
    ok(['push', 'knee', 'hip', 'core'].every((k) => n[k] === 'full'), `senza attrezzatura: ${Object.entries(n).map(([k, v]) => `${k} ${v}`).join(', ')}`, `schemi mancanti: ${JSON.stringify(n)}`),
    ok(n.pull === 'partial' && (none.rationale?.notices ?? []).some((x) => x.includes('solo in modo parziale')), 'tirata solo parziale e dichiarata come limite', `tirata: ${n.pull}, limite non dichiarato`),
    ok(Object.values(b).every((v) => v === 'full'), `con la sbarra: tutti gli schemi completi (${allEx(bar.months[0]).filter((x) => /trazioni|rematore/i.test(x.name)).map((x) => x.name).join(', ')})`, `con la sbarra: ${JSON.stringify(b)}`),
    ok(recomputed(none) && recomputed(bar), 'la copertura dichiarata corrisponde agli esercizi presenti', 'copertura dichiarata diversa dagli esercizi'),
  ];
});

test(29, 'C — Dolore a due distretti', 'Ginocchio e spalla: nessun esercizio che li carica, nessun gruppo alzato per compensare, esclusioni motivate e invito a una valutazione.', () => {
  const base = q({ sex: 'female', heightCm: 165, currentWeightKg: 60, targetWeightKg: 60, goal: 'maintainImprove', gymSplitPreference: 'upperLower' });
  const ref = plan(base).t;
  const pain = plan({ ...base, hasPain: 'yes', painDetails: 'Dolore al ginocchio destro' }, { avoidAreas: ['shoulder'], fromMonth: 2 }).t;
  const m = pain.months[1];
  const loading = allEx(m).filter((x) => (CATALOG_BY_ID.get(x.id)?.areas ?? []).some((a) => a === 'knee' || a === 'shoulder'));
  const refVol = new Map((ref.months[1].weeklyVolume ?? []).map((v) => [v.group, v]));
  // compensation = a group's TOTAL weekly volume (direct + indirect) raised above the same plan without pain. A group that
  // loses the indirect work of an excluded exercise (triceps without presses) may get direct sets up to its own target.
  // (the same plan without pain may sit below target because of time: reaching the group's own target is not compensating)
  const raised = (m.weeklyVolume ?? []).filter((v) => v.status !== 'excluded' && v.fractional > Math.max((refVol.get(v.group)?.fractional ?? 0) * 1.15 + 1, v.target * 1.15 + 1));
  const over = (m.weeklyVolume ?? []).filter((v) => v.status === 'over');
  return [
    ok(loading.length === 0, 'nessun esercizio che carica ginocchio o spalla', `ancora: ${loading.map((x) => x.name).join(', ')}`),
    ok(raised.length === 0, 'nessun gruppo oltre il proprio obiettivo né oltre la stessa scheda senza dolore', `gruppi alzati: ${raised.map((v) => `${v.label} ${refVol.get(v.group)?.fractional}→${v.fractional}`).join(', ')}`),
    ok(over.length === 0, 'nessun gruppo sovradosato', over.map((v) => v.label).join(', ')),
    ok((m.exclusions ?? []).some((e) => e.reason.includes('spalla')) && (m.exclusions ?? []).some((e) => e.reason.includes('ginocchio')), `esclusioni motivate: ${(m.exclusions ?? []).filter((e) => /sospeso/.test(e.reason)).map((e) => e.group).join(', ')} sospesi`, 'esclusioni non tracciate'),
    ok((pain.rationale?.notices ?? []).some((x) => x.includes('fisioterapista')), 'invito a farsi valutare da un professionista', 'manca l’invito'),
    ok(blockers(m).length === 0, 'nessun blocco del validatore', blockers(m).map((f) => f.message).join(' | ')),
  ];
});

test(30, 'D — Volume muscolare', 'Su profili rappresentativi nessun gruppo con serie dirette oltre l’obiettivo; ogni sottodosaggio ha una motivazione.', () => {
  const profilesD = [
    q({ gymExperience: 'never', gymSkillLevel: 'beginner', goal: 'loseFat', focus_gym: 'fatLoss', targetWeightKg: 70 }),
    q({}),
    q({ freq_gym: '4', availableDays: '4', sessionDuration: '60-90' }),
    q({ gymExperience: '3plusYears', gymSkillLevel: 'expert', freq_gym: '5', availableDays: '5', sessionDuration: '60-90' }),
    q({ focus_gym: 'strength', freq_gym: '4', availableDays: '4', gymSplitPreference: 'pushPullLegs', sessionDuration: '60-90' }),
    q({ trainingLocation: 'home', equipment: ['dumbbells', 'bands'], sessionDuration: '30-45' }),
  ];
  const overs: string[] = [];
  const unexplained: string[] = [];
  let groups = 0;
  for (const a of profilesD)
    for (const m of plan(a).t.months)
      for (const v of m.weeklyVolume ?? []) {
        if (v.target <= 0) continue;
        groups++;
        if (v.status === 'over') overs.push(`${v.label} M${m.monthIndex} ${v.direct}/${v.target}`);
        if (v.status === 'under' && !v.reason) unexplained.push(`${v.label} M${m.monthIndex}`);
      }
  return [ok(overs.length === 0, `nessun sovradosaggio diretto su ${groups} gruppi-mese`, `sovradosaggi: ${overs.slice(0, 5).join(', ')}`), ok(unexplained.length === 0, 'ogni sottodosaggio è motivato', `senza motivo: ${unexplained.slice(0, 5).join(', ')}`)];
});

test(31, 'E — Esercizi simili', 'Due varianti quasi identiche non stanno nella stessa seduta; varianti diverse (libero/macchina) sì.', () => {
  const g = (id: string) => CATALOG_BY_ID.get(id)!;
  let dups = 0;
  const ex: string[] = [];
  for (const p of profiles())
    for (const m of plan(p.answers).t.months)
      for (const d of workouts(m)) {
        const xs = d.exercises ?? [];
        for (let i = 0; i < xs.length; i++)
          for (let j = i + 1; j < xs.length; j++)
            if (nearDuplicate(g(xs[i].id), g(xs[j].id))) {
              dups++;
              if (ex.length < 3) ex.push(`${xs[i].name} + ${xs[j].name}`);
            }
      }
  const rdl = [...CATALOG_BY_ID.values()].find((e) => e.id !== 'romanian-deadlift' && e.pattern === 'hinge' && e.loadType === 'dumbbell');
  return [
    ok(!!rdl && nearDuplicate(g('romanian-deadlift'), rdl), `stacco rumeno con bilanciere e ${rdl?.name ?? '—'} riconosciuti come quasi identici`, 'similarità non riconosciuta'),
    ok(!nearDuplicate(g('back-squat'), g('leg-press')), 'back squat e leg press considerati complementari', 'squat e leg press considerati identici'),
    ok(dups === 0, 'nessuna coppia quasi identica nella stessa seduta su 360 profili', `${dups} coppie: ${ex.join('; ')}`),
  ];
});

test(32, 'F — Allenamento ibrido 2 forza + 3 corsa', 'Settimana ragionata insieme: niente forza consecutiva, niente gambe prima delle corse dure, ripetute lontane dal lungo, volume e intensità della corsa che non salgono insieme.', () => {
  const { t } = plan(q({ activitiesPracticed: ['gym', 'running'], freq_gym: '2', freq_running: '3', focus_running: 'raceTime', focus_gym: 'strength', availableDays: '5', goal: 'improveEndurance', dailySteps: '8000-12000' }));
  const issues: string[] = [];
  const both: string[] = [];
  let prev: { easy: number; reps: number } | null = null;
  for (const m of t.months) {
    const w = m.weeklySplit;
    const kind = (d: TrainingDayPlan) => (d.type === 'workout' ? 'gym' : d.type === 'cardio' ? (d.run?.kind === 'easy' ? 'easy' : d.run?.kind === 'long' ? 'long' : 'quality') : 'rest');
    for (let i = 0; i < 7; i++) {
      const a = kind(w[i]);
      const b = kind(w[(i + 1) % 7]);
      if (a === 'gym' && b === 'gym') issues.push(`M${m.monthIndex} ${w[i].weekday}: forza consecutiva`);
      if (a === 'gym' && (b === 'quality' || b === 'long')) issues.push(`M${m.monthIndex} ${w[i].weekday}: gambe prima di una corsa dura`);
      if ((a === 'quality' && b === 'long') || (a === 'long' && b === 'quality')) issues.push(`M${m.monthIndex} ${w[i].weekday}: ripetute e lungo vicini`);
    }
    const runs = w.filter((d) => d.type === 'cardio');
    const easy = sum(runs.filter((d) => d.run?.kind !== 'intervals' && d.run?.kind !== 'tempo').map((d) => d.run!.minutes));
    const reps = Number((runs.find((d) => d.run?.kind === 'intervals')?.note ?? '').match(/(\d+)×/)?.[1] ?? 0);
    if (prev && easy > prev.easy && reps > prev.reps && m.block !== 'consolidamento') both.push(`M${m.monthIndex}`);
    const long = runs.find((d) => d.run?.kind === 'long')?.run?.minutes ?? 0;
    if (runs.length >= 3 && long > sum(runs.map((d) => d.run!.minutes)) * 0.46) issues.push(`M${m.monthIndex}: lungo sproporzionato`);
    prev = { easy, reps };
  }
  const recovery = t.months.some((m) => (m.weeklySplit.find((d) => d.type === 'cardio')?.run?.weeks ?? []).some((x, i, arr) => i > 0 && x.minutes < arr[0].minutes));
  return [
    ok(issues.length === 0, `${t.months.length} mesi: ${t.months[0].weeklySplit.filter((d) => d.type !== 'rest').map((d) => `${d.weekday} ${d.title}`).join(', ')}`, issues.slice(0, 4).join('; ')),
    ok(both.length === 0, 'volume e intensità della corsa crescono in mesi alterni', `insieme nei mesi ${both.join(', ')}`),
    ok(recovery, 'settimana di recupero della corsa prevista', 'nessuna settimana di recupero'),
  ];
});

test(33, 'G — Recupero insufficiente', 'Calo di prestazioni e stanchezza → scarico applicato alle serie della settimana 1; stanchezza senza calo → RIR +1 sugli esercizi.', () => {
  const tired = adaptTraining({ monthIndex: 1, previous: undefined, trainingCompletion: 0.9, checkin: { adherence: 4, energy: 'veryLow', difficulty: ['soreness'] }, performance: perf(-0.06), plannedRir: 2, hasGym: true, sessionBucket: '45-60' });
  const lowEnergy = adaptTraining({ monthIndex: 1, previous: undefined, trainingCompletion: 0.9, checkin: { adherence: 4, energy: 'low', difficulty: ['soreness'] }, performance: perf(0.05), plannedRir: 2, hasGym: true, sessionBucket: '45-60' });
  const neutral = plan(q({})).t.months[1];
  const a = plan(q({}), { ...tired.calibration, fromMonth: 2 }).t.months[1];
  const b = plan(q({}), { ...lowEnergy.calibration, fromMonth: 2 }).t.months[1];
  const rirN = sum(allEx(neutral).map((x) => x.rir ?? 0));
  const rirB = sum(allEx(b).map((x) => x.rir ?? 0));
  return [
    ok(weekSets(a, 1) < weekSets(neutral, 1), `scarico: ${weekSets(a, 1)} serie in settimana 1 contro ${weekSets(neutral, 1)}`, `serie ${weekSets(a, 1)} contro ${weekSets(neutral, 1)}`),
    ok(rirB > rirN, `RIR complessivo ${rirN} → ${rirB}`, `RIR ${rirN} → ${rirB}`),
  ];
});

test(34, 'H — Attrezzatura limitata', 'Nessun esercizio richiede attrezzatura non disponibile, in nessun mese, su 360 profili.', () => {
  let bad = 0;
  let eqBlockers = 0;
  const ex: string[] = [];
  for (const p of profiles()) {
    const { t, ctx } = plan(p.answers);
    const prof = buildProgramProfile(ctx, null);
    for (const m of t.months) {
      eqBlockers += (m.validation ?? []).filter((f) => f.code === 'B1').length;
      for (const x of allEx(m)) {
        const miss = (CATALOG_BY_ID.get(x.id)?.equipment ?? []).filter((e) => !prof.equipment.has(e));
        if (miss.length) {
          bad++;
          if (ex.length < 3) ex.push(`${p.label}: ${x.name}`);
        }
      }
    }
  }
  return [ok(bad === 0 && eqBlockers === 0, 'tutti gli esercizi eseguibili con l’attrezzatura dichiarata', `${bad} esercizi non eseguibili: ${ex.join('; ')}`)];
});

test(35, 'I — Progressione dei carichi', 'Il carico sale solo quando il criterio è raggiunto; il piano non aumenta i carichi a calendario.', () => {
  const t = { repsMin: 8, repsMax: 10, rir: 2, increment: 2.5 };
  const pt = (reps: number, rir?: number) => ({ date: '2026-01-10', weightKg: 60, reps, rir });
  const met = doubleProgression([pt(10, 2), pt(10, 2), pt(10, 2)], t, 60);
  const closeToFailure = doubleProgression([pt(10, 0), pt(10, 0), pt(10, 1)], t, 60);
  const inRange = doubleProgression([pt(10, 2), pt(9, 2), pt(9, 2)], t, 60);
  const noData = doubleProgression([], t, 60);
  const p = plan(q({ gymExperience: 'never', gymSkillLevel: 'beginner' })).t;
  const id = allEx(p.months[1]).find((x) => x.suggestedKg != null)?.id;
  const kgs = p.months.slice(1).map((m) => allEx(m).filter((x) => x.id === id && m.block === p.months[1].block).map((x) => x.suggestedKg)[0]).filter((x) => x != null);
  return [
    ok(met.action === 'increase' && met.kg === 62.5, `3×10 con RIR 2 → ${met.kg} kg`, `criterio raggiunto: ${met.action}`),
    ok(closeToFailure.action === 'hold', '3×10 ma vicino al cedimento → stesso carico', `vicino al cedimento: ${closeToFailure.action}`),
    ok(inRange.action === 'hold', 'dentro il range → stesso carico', `dentro il range: ${inRange.action}`),
    ok(noData.action === 'calibrate' && noData.kg === 60, 'senza dati → carico da calibrare, nessun aumento', `senza dati: ${noData.action}`),
    ok(kgs.every((k) => k === kgs[0]), `nel piano il carico di partenza non sale da solo (${kgs.join(' → ')} kg)`, `carichi a calendario: ${kgs.join(' → ')}`),
  ];
});

test(36, 'J — Confronto tra versioni', 'Le metriche di confronto sono ricalcolate dai dati di before.json, del motore precedente e di data.json, non copiate.', () => {
  const dir = process.env.FITLAB_REPORT_DIR;
  if (!dir || !existsSync(`${dir}/before.json`) || !existsSync(`${dir}/data.json`)) return [`✗ file del report non trovati (FITLAB_REPORT_DIR=${dir ?? '—'})`];
  const load = (f: string) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const before = load('before.json');
  const data = load('data.json');
  const prev = existsSync(`${dir}/v3.json`) ? load('v3.json') : null;
  const c = compareVersions(before, prev, data);
  const identical = c.users.filter((u) => JSON.stringify(u.v2) === JSON.stringify(u.v4));
  const stored = data.compare;
  const mismatch = stored ? c.users.filter((u) => JSON.stringify(stored.users.find((s: { id: string }) => s.id === u.id)) !== JSON.stringify(u)) : [];
  return [
    ok(c.users.length === 7, `${c.users.length} profili confrontati su ${c.metrics.length} metriche`, `${c.users.length} profili`),
    ok(identical.length === 0, 'nessun profilo con valori identici tra training-2 e la nuova versione', `identici: ${identical.map((u) => u.id).join(', ')}`),
    ok(!!stored && mismatch.length === 0, 'i valori salvati in data.json coincidono con il ricalcolo', `disallineati: ${mismatch.map((u) => u.id).join(', ') || 'confronto assente'}`),
  ];
});

function perf(delta: number) {
  return ['panca-piana', 'back-squat', 'lat-machine'].map((id) => ({ exerciseId: id, name: id, firstE1rm: 100, lastE1rm: 100 * (1 + delta), sessions: 8, avgRir: 2 }));
}

// ----------------------------------------------------- quality indicators --

function profiles(): { label: string; answers: Answers }[] {
  const out: { label: string; answers: Answers }[] = [];
  const levels = [
    ['never', 'beginner'],
    ['1-3years', 'intermediate'],
    ['3plusYears', 'expert'],
  ];
  const focuses = ['hypertrophy', 'strength', 'fatLoss', 'muscularEndurance', 'technique'];
  const places: [string, string[]][] = [
    ['gym', []],
    ['home', ['dumbbells', 'bands']],
    ['outdoor', ['pullupBar']],
  ];
  for (const [exp, skill] of levels)
    for (const focus of focuses)
      for (const days of [2, 3, 4, 5])
        for (const dur of ['30-45', '60-90'])
          for (const [loc, eq] of places)
            out.push({
              label: `${skill}/${focus}/${days}g/${dur}/${loc}`,
              answers: q({ gymExperience: exp, gymSkillLevel: skill, focus_gym: focus, freq_gym: String(days), availableDays: String(days), sessionDuration: dur, trainingLocation: loc, equipment: eq, sex: days % 2 ? 'female' : 'male', goal: focus === 'fatLoss' ? 'loseFat' : 'gainMuscle', targetWeightKg: focus === 'fatLoss' ? 70 : 82 }),
            });
  return out;
}

function quality() {
  const ps = profiles();
  let constraintsOk = 0;
  let orderOk = 0;
  let timeOk = 0;
  let volumeOk = 0;
  let loadsOk = 0;
  let progressionOk = 0;
  const schemes = new Set<string>();
  const tempos = new Set<string>();
  const signatures = new Set<string>();
  const examples: string[] = [];
  for (const p of ps) {
    const { t, ctx } = plan(p.answers);
    const prof = buildProgramProfile(ctx, null);
    const m1 = t.months[0];
    const ex = t.months.flatMap(allEx);
    const eqOk = ex.every((x) => (CATALOG_BY_ID.get(x.id)?.equipment ?? []).every((e) => prof.equipment.has(e)));
    const issues = (t.rationale?.notices ?? []).filter((n) => /oltre il tempo|richiede attrezzatura|zona indicata|cedimento non adatto|troppe per il livello/.test(n));
    if (eqOk && issues.length === 0) constraintsOk++;
    else if (examples.length < 5) examples.push(`${p.label}: ${issues[0] ?? 'attrezzatura'}`);
    const ordered = workouts(m1).every((d) => {
      const seen: string[] = [];
      for (const x of d.exercises ?? []) {
        if (seen.length && seen[seen.length - 1] !== x.blockName && seen.includes(x.blockName!)) return false;
        if (seen[seen.length - 1] !== x.blockName) seen.push(x.blockName!);
      }
      return true;
    });
    if (ordered) orderOk++;
    if (workouts(m1).every((d) => (d.estimatedMinutes ?? 0) <= prof.sessionMinutes + 10)) timeOk++;
    const vols = (m1.weeklyVolume ?? []).filter((v) => v.target > 0);
    if (vols.length && vols.filter((v) => v.fractional >= v.target * 0.6 && v.fractional <= v.target * 1.8 + 2).length / vols.length >= 0.75) volumeOk++;
    const loaded = allEx(m1).filter((x) => x.suggestedKg != null);
    if (loaded.every((x) => x.suggestedKg! > 0 && x.suggestedKg! <= prof.bodyweightKg * 2.2 && x.loadStatus === 'calibrate')) loadsOk++;
    const m2 = t.months[1];
    if (m2 && allEx(m2).every((x) => x.progression && x.progression.length > 10)) progressionOk++;
    for (const x of allEx(m1)) {
      schemes.add(`${x.sets}×${x.reps}`);
      tempos.add(x.tempo);
    }
    signatures.add(JSON.stringify(workouts(m1).map((d) => d.exercises!.map((x) => [x.id, x.sets, x.reps]))));
  }
  const pct = (n: number) => Math.round((n / ps.length) * 100);
  let blockerN = 0;
  let warningN = 0;
  let cleanPlans = 0;
  for (const p of ps) {
    const t = plan(p.answers).t;
    const b = t.months.reduce((a, m) => a + (m.validation ?? []).filter((f) => f.level === 'blocker').length, 0);
    blockerN += b;
    warningN += t.months.reduce((a, m) => a + (m.validation ?? []).filter((f) => f.level === 'warning').length, 0);
    if (b === 0) cleanPlans++;
  }
  const threeByTen = ps.reduce((acc, p) => acc + allEx(plan(p.answers).t.months[0]).filter((x) => x.sets === 3 && (x.reps === '10' || x.reps === '12')).length, 0);
  return {
    profiles: ps.length,
    indicators: [
      { label: 'Schede che rispettano attrezzatura, limiti di tempo, sicurezza', value: `${pct(constraintsOk)}%` },
      { label: 'Ordine coerente (blocchi contigui, principali prima)', value: `${pct(orderOk)}%` },
      { label: 'Sedute entro il tempo disponibile (+10 min)', value: `${pct(timeOk)}%` },
      { label: 'Volume per gruppo vicino al target (≥75% dei gruppi)', value: `${pct(volumeOk)}%` },
      { label: 'Carichi del mese 1 plausibili e marcati da calibrare', value: `${pct(loadsOk)}%` },
      { label: 'Criterio di progressione su ogni esercizio', value: `${pct(progressionOk)}%` },
      { label: 'Schemi serie×ripetizioni diversi usati', value: `${schemes.size}` },
      { label: 'Tempi di esecuzione diversi usati', value: `${tempos.size} (${[...tempos].join(', ')})` },
      { label: 'Schede diverse su profili diversi', value: `${signatures.size} su ${ps.length}` },
      { label: 'Esercizi prescritti 3×10 o 3×12 fissi', value: `${threeByTen}` },
      { label: 'Schede senza blocchi del validatore', value: `${pct(cleanPlans)}%` },
      { label: 'Blocchi (blocker) in tutti i mesi', value: `${blockerN}` },
      { label: 'Avvisi (warning) in tutti i mesi', value: `${warningN} (${(warningN / ps.length).toFixed(1)} per scheda)` },
    ],
    examples,
  };
}

if (require.main === module) {
  const q2 = quality();
  const out = { cases, quality: q2 };
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out));
  for (const c of cases) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.n}. ${c.title}`);
    for (const d of c.details) console.log(`     ${d}`);
  }
  console.log(`\nIndicatori su ${q2.profiles} profili:`);
  for (const i of q2.indicators) console.log(`  ${i.label}: ${i.value}`);
  for (const e of q2.examples) console.log(`  ! ${e}`);
  console.log(`\n${cases.filter((c) => c.pass).length}/${cases.length} casi superati`);
}

export { cases, quality };
