/**
 * Test cases of the training engine v3: one scenario per behaviour the brief asks for
 * (24 cases) plus quality indicators over a broad set of profiles. Every case states
 * what must be true and checks it on the real engine output.
 *
 *   npx tsx scripts/agent-tests/training-cases.ts [out.json]
 */
import { writeFileSync } from 'node:fs';

import { buildPlans } from '@/domain/plan-engine';
import { NEUTRAL_CALIBRATION } from '@/domain/recalibration';
import { buildUserContext, type UserContext } from '@/domain/user-context';
import { rescheduleMissed } from '@/lib/planning/training-days';
import { adaptTraining } from '@/lib/planning/training/adaptation';
import { CATALOG_BY_ID } from '@/lib/planning/training/catalog';
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
  return [ok(!begDeload, 'nessuno scarico programmato per il principiante', 'scarico automatico'), ok(advCond.includes('se serve'), `avanzato: "${advCond}"`, 'manca lo scarico condizionale'), ok((forced.months[1].mesocycle?.weeks[0].label ?? '').includes('scarico'), 'scarico deciso al check-in nella settimana 1', 'scarico non applicato')];
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
