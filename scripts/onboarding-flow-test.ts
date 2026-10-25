/**
 * Onboarding questionnaire checks.
 *
 *   npm run onboarding:test
 *
 * The redesign moved the questionnaire to one question per screen without
 * touching schema.ts, so what has to be proven is that nothing got lost on
 * the way: every question of every mode is still reachable, the conditional
 * ones still appear exactly when their trigger is met, validation still
 * rejects what it used to reject, every question still gets a control that
 * can produce its answer, and the unit toggles can't move a stored value.
 *
 * Pure TypeScript only (no React Native imports), same as the plan-generation
 * harness next to it.
 */
import { buildFlow, flowProgress, resumeIndex, INTRO_SCREEN_ID, SUMMARY_SCREEN_ID } from '@/lib/questionnaire/flow';
import { inputForQuestion, screenTitle } from '@/lib/questionnaire/presentation';
import {
  ONBOARDING_STEPS,
  buildActivityQuestions,
  stepsForMode,
  type OnboardingMode,
  type Question,
} from '@/lib/questionnaire/schema';
import { getStepQuestions, isAnswered, isStepComplete } from '@/lib/questionnaire/step-questions';
import { cmToInches, inchesToCm, kgToLb, lbToKg, roundToStep } from '@/lib/questionnaire/units';

const MODES: OnboardingMode[] = ['diet', 'training', 'both'];

let failures = 0;
let checks = 0;

function check(ok: boolean, label: string, detail?: string) {
  checks += 1;
  if (ok) return;
  failures += 1;
  console.error(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
}

/** A plausible answer for a question, used to fill a whole questionnaire in. */
function answerFor(question: Question): unknown {
  switch (question.type) {
    case 'single':
      return question.options?.[0]?.value;
    case 'multi':
      return question.options?.[0] ? [question.options[0].value] : [];
    case 'number':
      return question.min ?? 1;
    case 'time':
      return '08:00';
    default:
      return 'ok';
  }
}

function questionIds(mode: OnboardingMode, answers: Record<string, unknown>): string[] {
  return buildFlow(mode, answers)
    .filter((screen) => screen.kind === 'question')
    .map((screen) => screen.id);
}

// ---------------------------------------------------------------- coverage

for (const mode of MODES) {
  const answers: Record<string, unknown> = { mode };
  const flow = buildFlow(mode, answers);
  check(flow[0].id === INTRO_SCREEN_ID, `[${mode}] il flusso inizia dall'intro`);
  check(flow[flow.length - 1].id === SUMMARY_SCREEN_ID, `[${mode}] il flusso finisce con il riepilogo`);

  const expected = stepsForMode(mode).flatMap((step) => getStepQuestions(step, answers).map((q) => q.id));
  const actual = questionIds(mode, answers);
  check(
    JSON.stringify(expected) === JSON.stringify(actual),
    `[${mode}] una schermata per ogni domanda, nello stesso ordine`,
    `attese ${expected.length}, trovate ${actual.length}`
  );
  check(new Set(actual).size === actual.length, `[${mode}] nessuna domanda ripetuta`);

  // Every screen carries the step it belongs to, so the header can say where you are.
  for (const screen of flow) {
    if (screen.kind !== 'question') continue;
    check(screen.stepNumber >= 1 && screen.stepNumber <= screen.stepCount, `[${mode}] ${screen.id}: posizione dello step valida`);
    check(screenTitle(screen.question).length > 0, `[${mode}] ${screen.id}: titolo non vuoto`);
  }
}

// Across the three modes every question in the schema must be reachable at least once.
const reachable = new Set(MODES.flatMap((mode) => questionIds(mode, { mode })));
for (const step of ONBOARDING_STEPS) {
  for (const question of step.questions) {
    if (question.dependsOn) continue; // conditional ones are covered below
    check(reachable.has(question.id), `la domanda "${question.id}" è raggiungibile in almeno una modalità`);
  }
}

// ------------------------------------------------------------- conditionals

{
  const base: Record<string, unknown> = { mode: 'both', mealsSelected: ['colazione', 'pranzo', 'cena'] };
  check(!questionIds('both', base).includes('morningSnackTime'), 'senza spuntino mattina, niente domanda sull’orario');
  check(!questionIds('both', base).includes('usualMorningSnack'), 'senza spuntino mattina, niente domanda su cosa mangi');

  const withSnack = { ...base, mealsSelected: [...(base.mealsSelected as string[]), 'spuntinoMattina'] };
  check(questionIds('both', withSnack).includes('morningSnackTime'), 'con spuntino mattina compare l’orario');
  check(questionIds('both', withSnack).includes('usualMorningSnack'), 'con spuntino mattina compare cosa mangi');

  // The time question must land inside the eating-habits step, not at the end.
  const ids = questionIds('both', withSnack);
  check(ids.indexOf('morningSnackTime') > ids.indexOf('mealsSelected'), 'l’orario dello spuntino segue la scelta dei pasti');
  check(ids.indexOf('morningSnackTime') < ids.indexOf('lunchTime'), 'l’orario dello spuntino precede quello del pranzo');
}

{
  const gym = { mode: 'training', trainingLocation: 'gym' };
  const home = { mode: 'training', trainingLocation: 'home' };
  check(!questionIds('training', gym).includes('equipment'), 'in palestra non chiediamo l’attrezzatura di casa');
  check(questionIds('training', home).includes('equipment'), 'a casa chiediamo l’attrezzatura');
}

{
  const none = { mode: 'training', activitiesPracticed: [] };
  const withGym = { mode: 'training', activitiesPracticed: ['gym'] };
  const withRunning = { mode: 'training', activitiesPracticed: ['running'] };
  const withTennis = { mode: 'training', activitiesPracticed: ['tennis'] };

  check(!questionIds('training', none).includes('freq_gym'), 'senza attività nessuna domanda per attività');
  for (const id of ['freq_gym', 'gymExperience', 'gymSkillLevel', 'gymSplitPreference', 'focus_gym']) {
    check(questionIds('training', withGym).includes(id), `palestra selezionata: compare "${id}"`);
  }
  check(questionIds('training', withRunning).includes('freq_running'), 'corsa selezionata: compare la frequenza');
  check(!questionIds('training', withRunning).includes('gymExperience'), 'solo corsa: nessuna domanda da palestra');
  check(
    buildActivityQuestions(['tennis']).length === 0 && !questionIds('training', withTennis).includes('freq_tennis'),
    'sport senza programma: nessuna domanda di follow-up'
  );
}

// Diet-only / training-only steps stay on their side of the fence.
check(!questionIds('diet', { mode: 'diet' }).includes('availableDays'), 'solo dieta: nessuna domanda di allenamento');
check(!questionIds('training', { mode: 'training' }).includes('mealsSelected'), 'solo allenamento: nessuna domanda sui pasti');
check(questionIds('both', { mode: 'both' }).includes('availableDays'), 'entrambi: ci sono le domande di allenamento');
check(questionIds('both', { mode: 'both' }).includes('mealsSelected'), 'entrambi: ci sono le domande sui pasti');

// --------------------------------------------------------------- validation

const byId = new Map<string, Question>();
for (const step of ONBOARDING_STEPS) for (const q of step.questions) byId.set(q.id, q);

const age = byId.get('age')!;
check(!isAnswered(age, undefined), 'età non risposta');
check(!isAnswered(age, ''), 'età vuota non vale');
check(!isAnswered(age, 15), 'età sotto il minimo rifiutata');
check(!isAnswered(age, 90), 'età sopra il massimo rifiutata');
check(isAnswered(age, 29), 'età valida accettata come numero');
check(isAnswered(age, '29'), 'età valida accettata come stringa');

const weight = byId.get('currentWeightKg')!;
check(isAnswered(weight, 76.5), 'peso decimale accettato');
check(isAnswered(weight, '76,5'), 'peso con virgola accettato');
check(!isAnswered(weight, 300), 'peso fuori scala rifiutato');

const breakfast = byId.get('breakfastTime')!;
check(isAnswered(breakfast, '07:30'), 'orario valido accettato');
check(!isAnswered(breakfast, '7:3'), 'orario incompleto rifiutato');
check(!isAnswered(breakfast, '25:00'), 'ora impossibile rifiutata');

const meals = byId.get('mealsSelected')!;
check(!isAnswered(meals, []), 'nessun pasto selezionato non vale');
check(isAnswered(meals, ['colazione']), 'un pasto selezionato vale');

const target = byId.get('targetWeightKg')!;
check(target.optional === true, 'il peso obiettivo resta facoltativo');

// A step is complete only when every mandatory question of it is answered.
const physical = ONBOARDING_STEPS.find((s) => s.id === 'physical')!;
check(!isStepComplete(physical, { age: 29, sex: 'male' }), 'profilo fisico incompleto senza altezza e peso');
check(isStepComplete(physical, { age: 29, sex: 'male', heightCm: 180, currentWeightKg: 76.5 }), 'profilo fisico completo');

// --------------------------------------------------------------- controls

for (const mode of MODES) {
  for (const screen of buildFlow(mode, { mode })) {
    if (screen.kind !== 'question') continue;
    const input = inputForQuestion(screen.question);
    const q = screen.question;
    if (q.type === 'single' || q.type === 'multi') check(input.kind === 'cards', `${q.id}: scelta a card`);
    if (q.type === 'time') check(input.kind === 'time', `${q.id}: picker orario`);
    if (q.type === 'foodPicker') check(input.kind === 'foodPicker', `${q.id}: selettore alimenti`);
    if (q.type === 'text' || q.type === 'longtext') check(input.kind === 'text', `${q.id}: campo di testo`);
    if (q.type === 'number') {
      check(input.kind === 'wheel' || input.kind === 'ruler', `${q.id}: picker numerico`);
      if (input.kind === 'wheel' || input.kind === 'ruler') {
        const min = q.min ?? -Infinity;
        const max = q.max ?? Infinity;
        check(input.fallback >= min && input.fallback <= max, `${q.id}: il valore di partenza sta nel range`, String(input.fallback));
      }
    }
    // Option lists must never be empty, or the screen would have nothing to tap.
    if (input.kind === 'cards') check((q.options?.length ?? 0) > 0, `${q.id}: la domanda ha opzioni`);
  }
}

check(inputForQuestion(byId.get('age')!).kind === 'wheel', 'età: ruota');
check(inputForQuestion(byId.get('heightCm')!).kind === 'ruler', 'altezza: righello');
check(inputForQuestion(byId.get('currentWeightKg')!).kind === 'ruler', 'peso: righello');

// ---------------------------------------------------------------- progress

for (const mode of MODES) {
  const flow = buildFlow(mode, { mode });
  let previous = -1;
  for (let i = 0; i < flow.length; i += 1) {
    const p = flowProgress(i, flow.length);
    check(p >= 0 && p <= 1, `[${mode}] avanzamento entro 0–1`, String(p));
    check(p > previous, `[${mode}] avanzamento monotono alla schermata ${i}`);
    previous = p;
  }
  check(flowProgress(0, flow.length) === 0, `[${mode}] l'intro è a 0%`);
  check(flowProgress(flow.length - 1, flow.length) === 1, `[${mode}] il riepilogo è al 100%`);
}

// The path grows when a conditional question appears: same screen, lower share.
{
  const before = buildFlow('both', { mode: 'both', mealsSelected: ['colazione', 'pranzo', 'cena'] });
  const after = buildFlow('both', { mode: 'both', mealsSelected: ['colazione', 'spuntinoMattina', 'pranzo', 'cena'] });
  check(after.length > before.length, 'un pasto in più allunga il percorso');
  const index = before.findIndex((s) => s.id === 'mealsSelected');
  check(
    flowProgress(index, after.length) < flowProgress(index, before.length),
    'l’avanzamento riflette il percorso effettivo, non una lunghezza fissa'
  );
}

// ------------------------------------------------------------------- resume

{
  const empty = { mode: 'both' };
  const flow = buildFlow('both', empty);
  check(resumeIndex(flow, empty) === 1, 'senza risposte si riparte dalla prima domanda');

  const partial = { mode: 'both', age: 29, sex: 'male' };
  const partialFlow = buildFlow('both', partial);
  const resumed = partialFlow[resumeIndex(partialFlow, partial)];
  check(resumed.kind === 'question' && resumed.id === 'heightCm', 'si riprende dalla prima domanda senza risposta', resumed.id);

  // A question answered out of range doesn't count as answered.
  const badAge = { mode: 'both', age: 200 };
  const badFlow = buildFlow('both', badAge);
  check(badFlow[resumeIndex(badFlow, badAge)].id === 'age', 'una risposta fuori intervallo non vale come risposta');

  // An optional question left empty is not something to resume on.
  const skipped: Record<string, unknown> = { mode: 'both', age: 29, sex: 'male', heightCm: 180, currentWeightKg: 76.5, goal: 'loseFat' };
  const skippedFlow = buildFlow('both', skipped);
  const after = skippedFlow[resumeIndex(skippedFlow, skipped)];
  check(after.id !== 'targetWeightKg', 'una domanda facoltativa saltata non blocca la ripresa', after.id);

  // Nothing left to resume: back to the intro, not to the summary. Filling
  // the questionnaire in takes several passes because answering a question
  // can add new ones — which is itself worth asserting: it has to converge.
  const complete: Record<string, unknown> = { mode: 'both' };
  let passes = 0;
  for (; passes < 8; passes += 1) {
    let added = false;
    for (const screen of buildFlow('both', complete)) {
      if (screen.kind !== 'question' || screen.question.optional) continue;
      if (complete[screen.question.id] !== undefined) continue;
      complete[screen.question.id] = answerFor(screen.question);
      added = true;
    }
    if (!added) break;
  }
  check(passes < 8, 'il questionario si stabilizza: le domande condizionali non si generano all’infinito');
  const completeFlow = buildFlow('both', complete);
  check(resumeIndex(completeFlow, complete) === 0, 'un questionario completo si riapre dall’intro');
}

// ------------------------------------------------------------------- units

for (const kg of [35, 62.4, 76.5, 100, 199.9]) {
  check(Math.abs(lbToKg(kgToLb(kg)) - kg) < 1e-9, `kg → lb → kg resta ${kg}`);
  // Ten round trips through the ruler's stored precision must not drift.
  let value = kg;
  for (let i = 0; i < 10; i += 1) value = roundToStep(lbToKg(roundToStep(kgToLb(value), 0.2)), 0.1);
  check(Math.abs(value - kg) <= 0.15, `il peso non deriva cambiando unità più volte`, `${kg} → ${value}`);
}

for (const cm of [150, 165, 175, 180, 199]) {
  check(Math.abs(inchesToCm(cmToInches(cm)) - cm) < 1e-9, `cm → in → cm resta ${cm}`);
  let value = cm;
  for (let i = 0; i < 10; i += 1) value = Math.round(inchesToCm(Math.round(cmToInches(value))));
  check(Math.abs(value - cm) <= 1, `l'altezza non deriva cambiando unità più volte`, `${cm} → ${value}`);
}

check(roundToStep(76.54, 0.1) === 76.5, 'arrotondamento al decimo');
check(roundToStep(76.56, 0.1) === 76.6, 'arrotondamento al decimo, per eccesso');

// ---------------------------------------------------------------- outcome

console.log(`\n${failures === 0 ? '✅' : '❌'} questionario: ${checks - failures}/${checks} controlli superati`);
if (failures > 0) process.exit(1);
