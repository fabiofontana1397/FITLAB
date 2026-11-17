/**
 * Adaptive nutrition engine — regression and scenario tests.
 *
 *   questionnaire → first plan → N monthly check-ins with hypothetical results → recalibrated plan
 *
 * Same flow as the app (store/plan-store.ts recalibrateMonth): the month's targets as stored in the plan, the
 * check-in mapped like `checkinSignals`, `recalibrate()` with the training weeks, the history and the meal
 * slots, then `buildPlans()` preserving the months already lived. Every generated month and every update go
 * through the validation engine (domain/nutrition/validation.ts).
 *
 * Each check-in is classified as: passed, failed, professional (needs a professional) or not evaluable
 * (insufficient data). The six original users (nutrition-cases.ts) are regression cases on frozen inputs.
 *
 *   npx tsx scripts/agent-tests/nutrition-journey.ts <out.json>      (exit code 1 when a test fails)
 */
import { writeFileSync } from 'node:fs';

import { validateDietMonth, validateUpdate, type ValidationIssue } from '@/domain/nutrition/validation';
import type { InterventionKind } from '@/domain/nutrition/types';
import { buildPlans, type PlanBundle } from '@/domain/plan-engine';
import { NEUTRAL_CALIBRATION, recalibrate, type CheckinSignals, type PlanCalibration, type RecalibrationRecord } from '@/domain/recalibration';
import { buildUserContext } from '@/domain/user-context';
import { DIET_ENGINE_VERSION } from '@/lib/planning/diet-planner';
import { FITLAB_FOODS } from '@/lib/planning/fitlab/foods';
import { buildMealSlotsFromAnswers } from '@/lib/planning/meal-slots';

import { ck, q, USERS, type Answers, type MonthOutcome, type TestUser } from './nutrition-cases';

// -------------------------------------------------------------- expectations --

/** What the adaptive engine must do at a check-in (from the review of the first engine). */
type Expectation = {
  /** The correction asked for, in words. */
  text: string;
  verdict?: string[];
  /** Allowed range of the applied calorie step. */
  step?: [number, number];
  /** Interventions that must be present / absent. */
  must?: InterventionKind[];
  mustNot?: InterventionKind[];
  /** Adaptation flags that must be set on the calibration. */
  adapt?: string[];
  /** A safety limit must have blocked the proposal. */
  safetyBlocked?: boolean;
  /** A clarification question must be asked. */
  clarification?: boolean;
  /** Custom check on the plan generated for the next month. */
  planCheck?: (next: PlanBundle['diet'], m: number) => string | null;
};

const id = (name: string) => FITLAB_FOODS.find((x) => x.name === name)!.id;
const foodIn = (diet: PlanBundle['diet'], m: number, name: string) => !!diet?.months.find((x) => x.monthIndex === m)?.weeklySplit.some((d) => d.meals.some((meal) => meal.items.some((i) => i.name === name)));
const countIn = (diet: PlanBundle['diet'], m: number, pred: (meal: NonNullable<PlanBundle['diet']>['months'][number]['weeklySplit'][number]['meals'][number]) => boolean) =>
  diet?.months.find((x) => x.monthIndex === m)?.weeklySplit.reduce((s, d) => s + d.meals.filter(pred).length, 0) ?? 0;

const SPEC_EXPECTATIONS: Record<string, Expectation> = {
  'marco:1': { text: 'In linea: calorie confermate.', verdict: ['on_track'], step: [0, 0] },
  'marco:2': {
    text: 'Stallo con fame frequente, porzioni scarse e richiesta di alimenti diversi: niente taglio massimo; prima sazietà e composizione dei pasti, poi integrare gli alimenti.',
    verdict: ['plateau'],
    step: [-50, 0],
    must: ['change_macros', 'increase_volume', 'change_foods'],
    adapt: ['highVolume', 'strongVariety'],
  },
  'marco:3': { text: 'Di nuovo in linea: calorie confermate.', verdict: ['on_track'], step: [0, 0] },
  'marco:4': { text: 'Dimagrimento troppo rapido con fame, stanchezza e recupero difficile: aumento prudente entro i limiti di sicurezza.', verdict: ['too_fast'], step: [100, 150] },
  'giulia:1': { text: 'Dimagrimento lento con aderenza buona: piccolo aggiustamento ammesso, entro i limiti.', verdict: ['too_slow'], step: [-100, 0] },
  'giulia:2': {
    text: 'Aderenza 2/5, fame, energia bassa, difficoltà con quantità e orari: nessun taglio; orari davvero modificati, distribuzione rivista, piano più facile, varietà.',
    verdict: ['low_adherence'],
    step: [0, 0],
    must: ['change_times', 'change_distribution', 'simplify_week', 'change_macros'],
    mustNot: ['decrease_calories'],
    adapt: ['timeWindowMin', 'simplify'],
    clarification: true,
    planCheck: (diet, m) => (diet?.months.find((x) => x.monthIndex === m)?.weeklySplit.every((d) => d.meals.every((meal) => !!meal.timeWindow)) ? null : 'orari flessibili non presenti nel piano'),
  },
  'giulia:3': { text: 'In linea ma fame sempre presente: sostenibilità prima di tutto, nessun taglio.', verdict: ['on_track'], step: [0, 50], must: ['change_macros', 'increase_volume'] },
  'luca:1': { text: 'In linea: calorie confermate.', verdict: ['on_track'], step: [0, 0] },
  'luca:2': {
    text: 'Peso fermo ma quantità già difficili: non aumentare il volume; alimenti più densi e distribuzione diversa, aumento contenuto.',
    verdict: ['plateau', 'wrong_direction'],
    step: [50, 100],
    must: ['energy_density', 'reduce_volume'],
    adapt: ['energyDense'],
  },
  'luca:3': { text: 'Aumento rapido: verificare che sia costante, poi ridurre il surplus senza basarsi su una sola pesata.', verdict: ['too_fast'], step: [-100, 0] },
  'luca:4': { text: 'In linea: calorie confermate.', verdict: ['on_track'], step: [0, 0] },
  'elena:1': { text: 'Peso stabile: calorie confermate.', verdict: ['on_track'], step: [0, 0] },
  'elena:2': {
    text: 'Peso in salita e richiesta esplicita di alimenti diversi: rotazione davvero cambiata, fonti proteiche alternate, preferenze considerate.',
    verdict: ['weight_up'],
    step: [-100, 0],
    must: ['change_foods'],
    adapt: ['strongVariety'],
    planCheck: (diet, m) => {
      const tuna = countIn(diet, m, (meal) => meal.items.some((i) => i.name === 'Tonno al naturale'));
      return tuna > 2 ? `tonno ${tuna} volte nella settimana` : null;
    },
  },
  'elena:3': { text: 'Una sola pesata (viaggio): dati insufficienti, nessuna decisione calorica.', verdict: ['insufficient_data'], step: [0, 0], must: ['request_info'] },
  'davide:1': {
    text: 'Peso in aumento con due cene di lavoro a settimana: leggere le note, inserire le cene fuori casa, nessun taglio automatico.',
    step: [0, 0],
    must: ['eat_out_alternatives'],
    mustNot: ['decrease_calories'],
    planCheck: (diet, m) => {
      const n = countIn(diet, m, (meal) => !!meal.eatOut);
      return n === 2 ? null : `${n} cene fuori casa nel piano invece di 2`;
    },
  },
  'davide:2': { text: 'Dimagrimento lento: eventuale riduzione entro il deficit massimo (mai oltre il 20% del dispendio stimato).', verdict: ['too_slow'], step: [-100, 0] },
  'davide:3': { text: 'In linea: calorie confermate, deficit entro i limiti.', verdict: ['on_track'], step: [0, 0] },
  'davide:4': { text: 'In linea: calorie confermate, deficit entro i limiti.', verdict: ['on_track'], step: [0, 0] },
  'sara:1': { text: 'Stabile: calorie confermate.', verdict: ['on_track'], step: [0, 0] },
  'sara:2': {
    text: 'Aderenza 2/5, molto stanca, sessione d’esami, difficoltà con orari e tempo: considerare il contesto, cambiare davvero gli orari, piano più semplice, nessun taglio.',
    verdict: ['low_adherence'],
    step: [0, 0],
    must: ['change_times', 'simplify_week', 'training_signal', 'request_info'],
    adapt: ['timeWindowMin', 'simplify'],
  },
  'sara:3': { text: 'Perdita di peso non voluta con fame e stanchezza: adeguamento energetico prudente e più sazietà.', verdict: ['weight_down'], step: [50, 100], must: ['change_macros'] },
};

// ------------------------------------------------------------------ scenarios --

/** A synthetic scenario: one user, one or two months, an expectation per check-in. */
type Scenario = { user: TestUser & { months: (MonthOutcome & { weights?: (startKg: number, start: string) => { date: string; kg: number }[] })[] }; expect: Expectation[]; topic: string };

const NO_OLD = { expect: '', verdict: [] as string[], step: 0 };
const LOSS = q({ age: 38, currentWeightKg: 86, targetWeightKg: 78, goal: 'loseFat', preferredProteins: [id('Petto di pollo'), id('Merluzzo')], preferredCarbs: [id('Pasta'), id('Riso basmati')] });
const LOSS_4 = q({ ...LOSS, mealsSelected: ['colazione', 'pranzo', 'spuntinoPomeriggio', 'cena'], afternoonSnackTime: '17:00' });
const GAIN = q({ age: 25, currentWeightKg: 70, targetWeightKg: 76, goal: 'gainMuscle', gymSkillLevel: 'intermediate', freq_gym: '4', availableDays: '4' });
const flatThenSpike = (startKg: number, start: string) =>
  Array.from({ length: 10 }, (_, i) => ({ date: new Date(new Date(start).getTime() + i * 3 * 86_400_000).toISOString().slice(0, 10), kg: Math.round((startKg - i * 0.06 + (i >= 8 ? 1.4 : 0)) * 10) / 10 }));

const SCENARIOS: Scenario[] = [
  { topic: 'Stallo con aderenza elevata', user: { id: 's-stall-high', name: 'Stallo, aderenza 5/5', summary: 'Dimagrimento, peso fermo per tutto il mese, piano seguito, fame gestibile.', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -0.02, checkin: ck(5, 'normal', 'sometimes') }] }, expect: [{ text: 'Stallo reale con aderenza alta: piccolo aggiustamento.', verdict: ['plateau'], step: [-150, -50], must: ['decrease_calories'] }] },
  { topic: 'Stallo con aderenza bassa', user: { id: 's-stall-low', name: 'Stallo, aderenza 2/5', summary: 'Peso fermo, orari difficili, pasti saltati, fame alta.', answers: LOSS_4, months: [{ ...NO_OLD, weeklyKg: 0, checkin: { ...ck(2, 'normal', 'often', ['mealTimes']), checkinSkippedMeals: '3-5' } }] }, expect: [{ text: 'Nessun taglio: prima orari, quantità, organizzazione.', verdict: ['low_adherence'], step: [0, 0], must: ['change_times', 'simplify_week'], mustNot: ['decrease_calories'] }] },
  { topic: 'Fame frequente', user: { id: 's-hunger', name: 'Fame frequente', summary: 'Dimagrimento in linea ma fame spesso presente.', answers: LOSS_4, months: [{ ...NO_OLD, weeklyKg: -0.45, checkin: ck(4, 'normal', 'often') }] }, expect: [{ text: 'Calorie invariate; più proteine, volume e distribuzione uniforme.', verdict: ['on_track'], step: [0, 0], must: ['change_macros', 'increase_volume', 'change_distribution'], adapt: ['highVolume'] }] },
  { topic: 'Energia molto bassa', user: { id: 's-energy', name: 'Energia molto bassa', summary: 'Stallo con energia molto bassa.', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -0.03, checkin: ck(4, 'veryLow', 'sometimes') }] }, expect: [{ text: 'Nessuna ulteriore restrizione, verifica di sonno e recupero.', step: [0, 0], must: ['request_info'], mustNot: ['decrease_calories'] }] },
  { topic: 'Perdita di peso troppo rapida', user: { id: 's-fast', name: 'Perdita troppo rapida', summary: '−1,2 kg a settimana.', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -1.2, checkin: ck(4, 'normal', 'sometimes') }] }, expect: [{ text: 'Aumento calorico prudente.', verdict: ['too_fast'], step: [100, 150], must: ['increase_calories'] }] },
  { topic: 'Aumento di peso troppo rapido in massa', user: { id: 's-gain-fast', name: 'Massa, aumento rapido', summary: '+0,8 kg a settimana per tutto il mese.', answers: GAIN, months: [{ ...NO_OLD, weeklyKg: 0.8, checkin: ck(4, 'normal', 'rarely') }] }, expect: [{ text: 'Aumento costante: riduzione del surplus.', verdict: ['too_fast'], step: [-100, -50], must: ['decrease_calories'] }] },
  { topic: 'Difficoltà con quantità elevate', user: { id: 's-qty', name: 'Massa, porzioni eccessive', summary: 'Peso fermo, le porzioni sono troppo abbondanti (risposta esplicita).', answers: GAIN, months: [{ ...NO_OLD, weeklyKg: 0, checkin: { ...ck(4, 'normal', 'sometimes', ['foodQuantity']), checkinQuantityDirection: 'tooMuch' } }] }, expect: [{ text: 'Aumento contenuto e pasti più densi, non più volume.', step: [50, 100], must: ['energy_density', 'reduce_volume'], adapt: ['energyDense'] }] },
  { topic: 'Pasti fuori casa', user: { id: 's-out', name: 'Tre pranzi di lavoro', summary: 'Pranza fuori tre volte a settimana (note).', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -0.1, checkin: ck(3, 'normal', 'sometimes', ['none'], ['nothing'], 'Tre pranzi di lavoro a settimana con i clienti.') }] }, expect: [{ text: 'Tre pranzi fuori casa nel piano, nessun taglio.', step: [0, 0], must: ['eat_out_alternatives'], mustNot: ['decrease_calories'], planCheck: (diet, m) => (countIn(diet, m, (meal) => !!meal.eatOut && meal.slotId === 'pranzo') === 3 ? null : 'pranzi fuori casa non inseriti') }] },
  { topic: 'Richiesta di cambiare gli orari', user: { id: 's-times', name: 'Nuovi orari', summary: 'Chiede pranzo alle 14 e cena alle 21:30.', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -0.45, checkin: { ...ck(4, 'normal', 'sometimes', ['mealTimes'], ['mealTimes']), checkinPreferredTimes: 'pranzo 14:00, cena 21:30' } }] }, expect: [{ text: 'Orari aggiornati nel piano.', step: [0, 0], must: ['change_times'], planCheck: (diet, m) => (diet?.months.find((x) => x.monthIndex === m)?.weeklySplit.every((d) => d.meals.find((x) => x.slotId === 'cena')?.time === '21:30' && d.meals.find((x) => x.slotId === 'pranzo')?.time === '14:00') ? null : 'orari non applicati') }] },
  { topic: 'Richiesta di sostituire alimenti', user: { id: 's-replace', name: 'Sostituire alimenti', summary: 'Non vuole più merluzzo e petto di pollo, vorrebbe salmone.', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -0.45, checkin: { ...ck(4, 'normal', 'sometimes', ['foodType'], ['foodOptions']), checkinFoodsToReplace: 'merluzzo, petto di pollo', checkinFoodsWanted: 'salmone' } }] }, expect: [{ text: 'Alimenti tolti, preferenza nuova usata, equivalenze dal catalogo.', step: [0, 0], must: ['change_foods'], planCheck: (diet, m) => (foodIn(diet, m, 'Merluzzo') || foodIn(diet, m, 'Petto di pollo') ? 'alimenti tolti ancora presenti' : !foodIn(diet, m, 'Salmone') ? 'salmone assente' : null) }] },
  { topic: 'Dati insufficienti', user: { id: 's-nodata', name: 'Due pesate', summary: 'Solo due pesate nel mese.', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -0.1, weighIns: 2, checkin: ck(4, 'normal', 'sometimes') }] }, expect: [{ text: 'Nessuna decisione calorica, richiesta di pesate.', verdict: ['insufficient_data'], step: [0, 0], must: ['request_info'] }] },
  { topic: 'Variazione temporanea del peso', user: { id: 's-temp', name: 'Ritenzione a fine mese', summary: 'Peso stabile, +1,4 kg nell’ultima settimana con il ciclo.', answers: q({ ...LOSS, sex: 'female', heightCm: 165, currentWeightKg: 70, targetWeightKg: 64 }), months: [{ ...NO_OLD, weeklyKg: 0, weights: flatThenSpike, checkin: { ...ck(4, 'normal', 'sometimes'), checkinEvents: ['cycle'] } }] }, expect: [{ text: 'Oscillazione temporanea: nessuna correzione.', verdict: ['temporary_variation'], step: [0, 0] }] },
  { topic: 'Variazione dell’attività fisica', user: { id: 's-activity', name: 'Più attività', summary: 'Si è mosso molto di più: la stima del dispendio non va aggiornata su questo mese.', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -0.9, trackedDays: 26, checkin: { ...ck(5, 'high', 'sometimes'), checkinActivityChange: 'more' } }] }, expect: [{ text: 'Dispendio non ricalibrato su un mese anomalo; aumento prudente se troppo rapido.', step: [0, 150], planCheck: () => null }] },
  { topic: 'Violazione di un vincolo nutrizionale', user: { id: 's-veg-meat', name: 'Vegetariana chiede carne', summary: 'Vegetariana che scrive di volere pollo e salmone.', answers: q({ ...LOSS, sex: 'female', heightCm: 165, currentWeightKg: 68, targetWeightKg: 62, dietaryPattern: 'vegetarian', preferredProteins: [id('Uova intere'), id('Ceci')] }), months: [{ ...NO_OLD, weeklyKg: -0.4, checkin: { ...ck(4, 'normal', 'sometimes', ['none'], ['foodOptions']), checkinFoodsWanted: 'petto di pollo, salmone' } }] }, expect: [{ text: 'Il regime alimentare resta un vincolo: niente carne né pesce nel piano.', step: [0, 0], planCheck: (diet, m) => (foodIn(diet, m, 'Petto di pollo') || foodIn(diet, m, 'Salmone') ? 'carne o pesce nel piano di una vegetariana' : null) }] },
  { topic: 'Superamento dei limiti calorici', user: { id: 's-limit', name: 'Taglio oltre il limite', summary: 'Già al deficit massimo del 20%: lo stallo non può portare un altro taglio.', answers: q({ ...LOSS, age: 52, currentWeightKg: 98, heightCm: 176, targetWeightKg: 88, dailySteps: '3000-5000' }), months: [{ ...NO_OLD, weeklyKg: 0, trackedDays: 5, checkin: ck(5, 'normal', 'sometimes') }] }, expect: [{ text: 'Il taglio viene bloccato dal limite di deficit e spiegato.', verdict: ['plateau'], step: [0, 0], safetyBlocked: true }] },
  { topic: 'Gravidanza', user: { id: 's-pregnancy', name: 'Gravidanza', summary: 'Segnala una gravidanza nel check-in.', answers: q({ ...LOSS, sex: 'female', heightCm: 165, currentWeightKg: 68, targetWeightKg: 62 }), months: [{ ...NO_OLD, weeklyKg: 0, checkin: { ...ck(4, 'normal', 'sometimes'), checkinSpecialConditions: ['pregnancy'] } }] }, expect: [{ text: 'Nessun aggiustamento automatico: valutazione professionale.', verdict: ['professional_review'], step: [0, 0], must: ['professional_review'] }] },
  { topic: 'Minorenne', user: { id: 's-minor', name: '17 anni', summary: 'Minorenne con obiettivo di massa.', answers: q({ ...GAIN, age: 17 }), months: [{ ...NO_OLD, weeklyKg: 0, checkin: ck(4, 'normal', 'sometimes') }] }, expect: [{ text: 'Nessun aggiustamento automatico per un minorenne.', verdict: ['professional_review'], step: [0, 0], must: ['professional_review'] }] },
  { topic: 'Nota non interpretabile', user: { id: 's-unclear', name: 'Nota ambigua', summary: 'Una nota che il motore non sa interpretare.', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -0.45, checkin: ck(4, 'normal', 'sometimes', ['none'], ['nothing'], 'Il mercoledì per me è complicato per via del calcetto') }] }, expect: [{ text: 'Il motore chiede un chiarimento invece di inventare.', step: [0, 0], clarification: true }] },
];

// ------------------------------------------------------------------ helpers --

/** The app's mapping (lib/planning/month-adherence.ts checkinSignals; that module pulls in react-native). */
function checkinSignals(answers: Answers): CheckinSignals {
  const asArray = (v: unknown) => (Array.isArray(v) ? (v as string[]) : undefined);
  const asText = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const adherence = Number(answers.checkinAdherence);
  const difficulty = asArray(answers.checkinDifficulty);
  const wantsChange = asArray(answers.checkinWantsChange);
  return {
    adherence: Number.isFinite(adherence) && adherence > 0 ? adherence : undefined,
    energy: answers.checkinEnergyLevel as CheckinSignals['energy'],
    hunger: answers.checkinHungerLevel as CheckinSignals['hunger'],
    difficulty,
    wantsChange,
    quantityDirection: difficulty?.includes('foodQuantity') ? (answers.checkinQuantityDirection as CheckinSignals['quantityDirection']) : undefined,
    skippedMeals: answers.checkinSkippedMeals as CheckinSignals['skippedMeals'],
    eatingOutPerWeek: answers.checkinEatingOut != null ? Number(answers.checkinEatingOut) : undefined,
    activityChange: answers.checkinActivityChange as CheckinSignals['activityChange'],
    events: asArray(answers.checkinEvents)?.filter((e) => e !== 'none'),
    waistCm: answers.checkinWaistCm != null ? Number(answers.checkinWaistCm) : undefined,
    preferredTimes: wantsChange?.includes('mealTimes') ? asText(answers.checkinPreferredTimes) : undefined,
    foodsToReplace: wantsChange?.includes('foodOptions') ? asText(answers.checkinFoodsToReplace) : undefined,
    foodsWanted: wantsChange?.includes('foodOptions') ? asText(answers.checkinFoodsWanted) : undefined,
    specialConditions: asArray(answers.checkinSpecialConditions)?.filter((e) => e !== 'none'),
    notes: asText(answers.checkinNotes),
  };
}

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

function monthView(bundle: PlanBundle, m: number) {
  const month = bundle.diet?.months.find((x) => x.monthIndex === m);
  if (!month) return null;
  return {
    monthIndex: month.monthIndex,
    phase: month.phase,
    title: month.title,
    focusNote: month.focusNote,
    calorieTarget: month.calorieTarget,
    macroTargetsG: month.macroTargetsG,
    days: month.weeklySplit.map((d) => {
      const kcal = d.meals.reduce((s, x) => s + x.totalKcal, 0);
      const mac = d.meals.reduce((s, x) => ({ p: s.p + (x.macros?.protein ?? 0), c: s.c + (x.macros?.carbs ?? 0), f: s.f + (x.macros?.fats ?? 0) }), { p: 0, c: 0, f: 0 });
      return {
        weekday: d.weekday,
        isTrainingDay: d.isTrainingDay ?? false,
        target: d.calorieTarget ?? month.calorieTarget,
        targetMacros: d.macroTargetsG ?? month.macroTargetsG,
        kcal,
        hasFreeMeal: d.meals.some((x) => x.isFreeMeal),
        macros: mac,
        meals: d.meals.map((x) => ({
          slot: x.label,
          slotId: x.slotId,
          time: x.timeWindow ?? x.time,
          dish: x.eatOut ? 'Pasto fuori casa' : x.recipe?.name ?? (x.isFreeMeal ? 'Pasto libero' : '—'),
          dishId: x.recipe?.dishId ?? null,
          free: !!x.isFreeMeal,
          eatOut: x.eatOut?.guidance ?? null,
          kcal: x.totalKcal,
          macros: x.macros ?? null,
          items: x.items.map((i) => ({ name: i.name, qty: i.quantityLabel, kcal: Math.round(i.kcal), role: i.role ?? null, subs: (i.substitutes ?? []).map((s) => `${s.name} ${s.quantityLabel}`) })),
        })),
      };
    }),
  };
}

const LABEL: Record<string, Record<string, string>> = {
  energy: { veryLow: 'molto stanco', low: 'stanco', normal: 'normale', high: 'energico', veryHigh: 'molto energico' },
  hunger: { never: 'mai', rarely: 'raramente', sometimes: 'a volte', often: 'spesso', always: 'sempre' },
  diff: { mealTimes: 'orari dei pasti', foodQuantity: 'quantità di cibo', foodType: 'tipo di alimenti', preparation: 'preparazione', organization: 'organizzazione', trainingTime: 'tempo per allenarsi', soreness: 'recupero/dolori', none: 'nessuna' },
  wants: { mealTimes: 'orari dei pasti', foodOptions: 'alimenti proposti', trainingIntensity: 'intensità allenamento', trainingDays: 'giorni di allenamento', nothing: 'niente' },
};

type Status = 'passed' | 'failed' | 'professional' | 'not_evaluable';

function evaluate(exp: Expectation | undefined, r: ReturnType<typeof recalibrate>, nextDiet: PlanBundle['diet'], m: number, issues: ValidationIssue[]): { status: Status; failures: string[] } {
  const failures: string[] = [];
  const d = r.decision;
  if (exp) {
    if (exp.verdict && !exp.verdict.includes(r.verdict)) failures.push(`verdetto ${r.verdict}, atteso ${exp.verdict.join(' o ')}`);
    if (exp.step && (d.calorieStep < exp.step[0] || d.calorieStep > exp.step[1])) failures.push(`passo calorico ${d.calorieStep} kcal, atteso tra ${exp.step[0]} e ${exp.step[1]}`);
    const kinds = d.interventions.map((i) => i.kind);
    for (const k of exp.must ?? []) if (!kinds.includes(k)) failures.push(`manca l'intervento ${k}`);
    for (const k of exp.mustNot ?? []) if (kinds.includes(k)) failures.push(`intervento non ammesso: ${k}`);
    for (const a of exp.adapt ?? []) if (!(r.calibration.diet as Record<string, unknown> | undefined)?.[a]) failures.push(`adattamento ${a} non applicato`);
    if (exp.safetyBlocked && !d.safety.some((s) => s.blocked)) failures.push('il limite di sicurezza non è intervenuto');
    if (exp.clarification && r.clarifications.length === 0) failures.push('nessuna richiesta di chiarimento');
    const pc = exp.planCheck?.(nextDiet, m + 1);
    if (pc) failures.push(pc);
  }
  for (const i of issues) if (i.level === 'FAIL') failures.push(`${i.code}: ${i.message}`);
  const status: Status = failures.length ? 'failed' : d.supervision ? 'professional' : d.weight.classification === 'insufficient_data' ? 'not_evaluable' : 'passed';
  return { status, failures };
}

// --------------------------------------------------------------------- run --

function runUser(u: Scenario['user'], expectations: (m: number) => Expectation | undefined) {
  const rand = rng(u.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0) * 7919);
  const ctx0 = buildUserContext(u.answers);
  let calibration: PlanCalibration = { ...NEUTRAL_CALIBRATION };
  let bundle = buildPlans(ctx0);
  const slots = buildMealSlotsFromAnswers(u.answers).map((s) => s.id);
  const initial = {
    durationMonths: bundle.durationMonths,
    monthTargets: bundle.monthTargets.map((t) => ({ calories: t.calories, macros: t.macros, weeklyKg: t.pace.weeklyKg })),
    tdee: Math.round(bundle.monthTargets[0].averageExpenditure),
    adjustments: bundle.monthTargets[0].adjustments,
  };
  const months = [monthView(bundle, 1)];
  const monthIssues: Record<number, ValidationIssue[]> = { 1: validateDietMonth(bundle.diet!.months[0], ctx0, { expenditure: bundle.monthTargets[0].averageExpenditure }) };
  const checkins: unknown[] = [];
  const weights: { date: string; kg: number }[] = [];
  const history: RecalibrationRecord[] = [];
  let kg = ctx0.weightKg;
  const start = '2026-01-05';
  const horizon = Math.min(u.months.length, bundle.durationMonths - 1);

  for (let m = 1; m <= horizon; m++) {
    const o = u.months[m - 1];
    const stored = bundle.diet!.months.find((x) => x.monthIndex === m)!;
    const monthWeights: { date: string; kg: number }[] = [];
    const n = o.weighIns ?? 10;
    const startKg = kg;
    // identical generation to the first test run (same seed, same order of random draws)
    for (let i = 0; i < 30; i++) {
      kg += o.weeklyKg / 7;
      const isWeighIn = n >= 10 ? i % 3 === 0 : n === 1 ? i === 14 : i % Math.floor(30 / n) === 0;
      if (isWeighIn) monthWeights.push({ date: addDays(start, (m - 1) * 30 + i), kg: r1(kg + (rand() - 0.5) * 0.5) });
    }
    const custom = o.weights?.(startKg, addDays(start, (m - 1) * 30));
    const used = custom ?? monthWeights;
    if (custom) kg = custom[custom.length - 1].kg;
    weights.push(...used);
    const tracked = o.trackedDays ?? 24;
    const signals = checkinSignals(o.checkin);
    const ctx = { ...ctx0, weightKg: r1(kg) };
    const targetsFollowed = { ...bundle.monthTargets[m - 1], calories: stored.calorieTarget, macros: stored.macroTargetsG };
    const result = recalibrate({
      ctx,
      monthIndex: m,
      durationMonths: bundle.durationMonths,
      targets: targetsFollowed,
      weights: used,
      adherence: {
        trainingCompletion: o.trainingCompletion !== undefined ? o.trainingCompletion : ctx0.mode === 'diet' ? null : signals.adherence != null && signals.adherence <= 2 ? 0.45 : 0.9,
        mealDaysTracked: tracked,
        daysInMonth: 30,
        avgEatenKcal: tracked >= 10 ? stored.calorieTarget * (o.eatenShare ?? 1) : null,
      },
      checkin: signals,
      calibration,
      weeks: { current: bundle.training?.months[m - 1]?.weeklySplit ?? null, next: bundle.training?.months[m]?.weeklySplit ?? null },
      history,
      slots,
    });
    if (history.length && result.previousOutcome && history[history.length - 1].decision) history[history.length - 1].decision!.observedOutcome = result.previousOutcome;
    history.push({ monthIndex: m, date: addDays(start, m * 30), verdict: result.verdict, weeklyRateKg: result.weeklyRateKg, expectedWeeklyKg: result.expectedWeeklyKg, changes: result.changes, calibration: result.calibration, decision: result.decision });
    const prevBundle = bundle;
    calibration = result.calibration;
    bundle = buildPlans(ctx, { calibration, preserveMonthsBefore: m + 1, existing: { diet: bundle.diet, training: bundle.training } });
    const next = bundle.diet!.months.find((x) => x.monthIndex === m + 1)!;
    months.push(monthView(bundle, m + 1));

    const issues: ValidationIssue[] = [
      ...validateUpdate(result.decision, stored, next),
      ...validateDietMonth(next, ctx, { expenditure: result.decision.tdeeEstimate, previous: stored, adapt: calibration.diet }),
    ];
    if (JSON.stringify(bundle.diet!.months.find((x) => x.monthIndex === m)) !== JSON.stringify(prevBundle.diet!.months.find((x) => x.monthIndex === m)))
      issues.push({ level: 'FAIL', code: 'J1', message: `Il mese ${m}, già vissuto, è stato modificato dal check-in.` });
    monthIssues[m + 1] = issues;
    const exp = expectations(m);
    const evaluation = evaluate(exp, result, bundle.diet, m, issues);

    checkins.push({
      monthIndex: m,
      outcome: { weeklyKg: o.weeklyKg, weighIns: used.length, startKg: r1(startKg), endKg: r1(kg), trackedDays: tracked, eatenShare: o.eatenShare ?? 1 },
      answers: {
        adherence: o.checkin.checkinAdherence,
        energy: LABEL.energy[String(o.checkin.checkinEnergyLevel)],
        hunger: LABEL.hunger[String(o.checkin.checkinHungerLevel)],
        difficulty: ((o.checkin.checkinDifficulty as string[]) ?? []).map((x) => LABEL.diff[x] ?? x),
        wantsChange: ((o.checkin.checkinWantsChange as string[]) ?? []).map((x) => LABEL.wants[x] ?? x),
        extra: Object.entries(o.checkin)
          .filter(([k, v]) => !['checkinAdherence', 'checkinEnergyLevel', 'checkinHungerLevel', 'checkinDifficulty', 'checkinWantsChange', 'checkinNotes'].includes(k) && v != null && v !== '')
          .map(([k, v]) => `${k.replace('checkin', '')}: ${Array.isArray(v) ? v.join(', ') : v}`),
        notes: o.checkin.checkinNotes,
      },
      before: o.expect ? { verdict: o.verdict, step: o.step, text: o.expect, review: o.review ?? null } : null,
      expectation: exp ? { text: exp.text, verdict: exp.verdict ?? null, step: exp.step ?? null, must: exp.must ?? [] } : null,
      evaluation,
      result: { verdict: result.verdict, changes: result.changes, reasons: result.reasons, clarifications: result.clarifications, adaptations: calibration.diet, expenditureOffset: calibration.expenditureOffset ?? 0 },
      decision: result.decision,
    });
  }

  return {
    id: u.id,
    name: u.name,
    summary: u.summary,
    answers: u.answers,
    initial,
    weights,
    checkins,
    months,
    monthIssues,
    history: history.map((h) => ({ monthIndex: h.monthIndex, step: h.decision?.calorieStep, expected: h.decision?.expectedOutcome, observed: h.decision?.observedOutcome ?? null })),
  };
}

const users = USERS.map((u) => runUser(u as Scenario['user'], (m) => SPEC_EXPECTATIONS[`${u.id}:${m}`]));
const scenarios = SCENARIOS.map((s) => ({ topic: s.topic, ...runUser(s.user, (m) => s.expect[m - 1]) }));
const all = [...users, ...scenarios].flatMap((u) => (u.checkins as { evaluation: { status: Status; failures: string[] } }[]).map((c) => ({ u, c })));
const counts = { passed: 0, failed: 0, professional: 0, not_evaluable: 0 } as Record<Status, number>;
for (const { c } of all) counts[c.evaluation.status]++;
const out = { engine: DIET_ENGINE_VERSION, generatedAt: new Date().toISOString(), counts, users, scenarios };
const path = process.argv[2] ?? 'nutrition-journey.json';
writeFileSync(path, JSON.stringify(out));

for (const group of [users, scenarios]) {
  for (const u of group) {
    console.log(`${'topic' in u ? `[${(u as { topic: string }).topic}] ` : ''}${u.name}`);
    for (const c of u.checkins as { monthIndex: number; evaluation: { status: Status; failures: string[] }; decision: { calorieStep: number; previousTarget: number; newTarget: number; balancePct: number }; result: { verdict: string } }[]) {
      const icon = { passed: '✓', failed: '✗', professional: '⚕', not_evaluable: '·' }[c.evaluation.status];
      console.log(`   ${icon} M${c.monthIndex} ${c.result.verdict} passo ${c.decision.calorieStep} · ${c.decision.previousTarget}→${c.decision.newTarget} kcal · bilancio ${c.decision.balancePct}%${c.evaluation.failures.length ? `\n       - ${c.evaluation.failures.join('\n       - ')}` : ''}`);
    }
  }
}
console.log(`\nSuperati ${counts.passed} · falliti ${counts.failed} · valutazione professionale ${counts.professional} · non valutabili ${counts.not_evaluable}`);
console.log(`→ ${path}`);
if (counts.failed > 0) process.exitCode = 1;
