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

import { dayNutrition, validateDietMonth, validateUpdate, varietyMetrics, type ValidationIssue } from '@/domain/nutrition/validation';
import type { InterventionKind } from '@/domain/nutrition/types';
import { buildPlans, type PlanBundle } from '@/domain/plan-engine';
import { NEUTRAL_CALIBRATION, recalibrate, type CheckinSignals, type PlanCalibration, type RecalibrationRecord } from '@/domain/recalibration';
import { buildUserContext } from '@/domain/user-context';
import { DIET_ENGINE_VERSION, generateDietPlan, reconcileDay } from '@/lib/planning/diet-planner';
import { applySubstitution } from '@/lib/planning/substitution';
import { buildFreeMealLog, logFreeMeal } from '@/lib/planning/free-meal';
import { resizeItem } from '@/lib/planning/fitlab/meal-builder';
import { buildFitLabPools } from '@/lib/planning/fitlab/pools';
import { SLOT_KIND } from '@/lib/planning/fitlab/catalog';
import { NUTRITION_PARAMS } from '@/domain/nutrition/params';
import { SEX_FLOOR } from '@/domain/nutrition/safety';
import { FITLAB_FOODS } from '@/lib/planning/fitlab/foods';
import { buildMealSlotsFromAnswers } from '@/lib/planning/meal-slots';
import type { DietMonthPlan, DietPlan, PlanMealItem } from '@/lib/planning/types';

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
  /** Requested foods that must be rejected as conflicts (by name). */
  conflict?: string[];
  /** The diet must be frozen: no calorie, rotation or adaptation change, no new month content. */
  frozen?: boolean;
  /** A confirmed regime that must reach the profile. */
  profileUpdate?: string;
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
type Scenario = {
  user: TestUser & { months: (MonthOutcome & { weights?: (startKg: number, start: string) => { date: string; kg: number }[]; answersPatch?: Answers })[] };
  expect: Expectation[];
  topic: string;
  /** The safety engine must stop the plan before any generation. */
  preflight?: 'supervision';
};

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
  { topic: 'Violazione di un vincolo nutrizionale', user: { id: 's-veg-meat', name: 'Vegetariana chiede carne', summary: 'Vegetariana che scrive di volere pollo e salmone.', answers: q({ ...LOSS, sex: 'female', heightCm: 165, currentWeightKg: 68, targetWeightKg: 62, dietaryPattern: 'vegetarian', preferredProteins: [id('Uova intere'), id('Ceci')] }), months: [{ ...NO_OLD, weeklyKg: -0.4, checkin: { ...ck(4, 'normal', 'sometimes', ['none'], ['foodOptions']), checkinFoodsWanted: 'petto di pollo, salmone' } }] }, expect: [{ text: 'Il regime resta un vincolo: pollo e salmone non entrano nel piano né tra le preferenze; si chiede conferma di un cambio di regime.', step: [0, 0], conflict: ['Petto di pollo', 'Salmone'], clarification: true, planCheck: (diet, m) => (foodIn(diet, m, 'Petto di pollo') || foodIn(diet, m, 'Salmone') ? 'carne o pesce nel piano di una vegetariana' : null) }] },
  { topic: 'Superamento dei limiti calorici', user: { id: 's-limit', name: 'Taglio oltre il limite', summary: 'Già al deficit massimo del 20%: lo stallo non può portare un altro taglio.', answers: q({ ...LOSS, age: 52, currentWeightKg: 98, heightCm: 176, targetWeightKg: 88, dailySteps: '3000-5000' }), months: [{ ...NO_OLD, weeklyKg: 0, trackedDays: 5, checkin: ck(5, 'normal', 'sometimes') }] }, expect: [{ text: 'Il taglio viene bloccato dal limite di deficit e spiegato.', verdict: ['plateau'], step: [0, 0], safetyBlocked: true }] },
  { topic: 'Gravidanza', user: { id: 's-pregnancy', name: 'Gravidanza', summary: 'Segnala una gravidanza nel check-in.', answers: q({ ...LOSS, sex: 'female', heightCm: 165, currentWeightKg: 68, targetWeightKg: 62 }), months: [{ ...NO_OLD, weeklyKg: 0, checkin: { ...ck(4, 'normal', 'sometimes'), checkinSpecialConditions: ['pregnancy'] } }] }, expect: [{ text: 'Gravidanza comunicata al check-in: adattamenti sospesi subito, piano congelato con lo storico, stato di supervisione.', verdict: ['professional_review'], step: [0, 0], must: ['professional_review'], frozen: true }] },
  { topic: 'Minorenne', user: { id: 's-minor', name: '17 anni', summary: 'Minorenne con obiettivo di massa.', answers: q({ ...GAIN, age: 17 }), months: [{ ...NO_OLD, weeklyKg: 0, checkin: ck(4, 'normal', 'sometimes') }] }, expect: [{ text: 'Minorenne: nessun piano alimentare generato, nessun obiettivo calorico autonomo, stato di supervisione.', verdict: ['professional_review'], step: [0, 0], must: ['professional_review'] }], preflight: 'supervision' },
  { topic: 'Nota non interpretabile', user: { id: 's-unclear', name: 'Nota ambigua', summary: 'Una nota che il motore non sa interpretare.', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -0.45, checkin: ck(4, 'normal', 'sometimes', ['none'], ['nothing'], 'Il mercoledì per me è complicato per via del calcetto') }] }, expect: [{ text: 'Il motore chiede un chiarimento invece di inventare.', step: [0, 0], clarification: true }] },
  // ---- new cases (review of fitlab-7)
  { topic: 'Allergia a un alimento delle ricette', user: { id: 'n-allergy', name: 'Allergia alla frutta a guscio', summary: 'Ha scelto le noci tra i preferiti ma dichiara un’allergia alla frutta a guscio.', answers: q({ ...LOSS_4, allergiesIntolerances: 'Allergia alla frutta a guscio', preferredFats: [id('Noci'), id('Mandorle')] }), months: [{ ...NO_OLD, weeklyKg: -0.45, checkin: ck(4, 'normal', 'sometimes') }] }, expect: [{ text: 'Nessuna frutta a guscio nel piano né nei sostituti, nonostante la preferenza.', step: [0, 0], planCheck: (diet, m) => (['Noci', 'Mandorle', 'Nocciole', 'Anacardi', 'Pistacchi'].some((n) => foodIn(diet, m, n) || foodIn(diet, 1, n)) ? 'frutta a guscio nel piano' : null) }] },
  { topic: 'Vegano chiede un alimento animale', user: { id: 'n-vegan-animal', name: 'Vegano chiede yogurt', summary: 'Vegano che nel check-in chiede yogurt greco e uova.', answers: q({ ...LOSS, dietaryPattern: 'vegan', preferredProteins: [id('Ceci'), id('Lenticchie')] }), months: [{ ...NO_OLD, weeklyKg: -0.4, checkin: { ...ck(4, 'normal', 'sometimes', ['none'], ['foodOptions']), checkinFoodsWanted: 'yogurt greco 0%, uova intere' } }] }, expect: [{ text: 'Conflitto rilevato, nessun alimento animale nel piano o tra le preferenze, richiesta di conferma.', step: [0, 0], conflict: ['Yogurt greco 0%', 'Uova intere'], clarification: true, planCheck: (diet, m) => (foodIn(diet, m, 'Yogurt greco 0%') || foodIn(diet, m, 'Uova intere') ? 'alimento animale nel piano di un vegano' : null) }] },
  { topic: 'Preferenza cambiata, restrizione invariata', user: { id: 'n-pref-restriction', name: 'Senza lattosio chiede mozzarella', summary: 'Intollerante al lattosio: chiede mozzarella (in conflitto) e salmone (compatibile).', answers: q({ ...LOSS, allergiesIntolerances: 'Intollerante al lattosio' }), months: [{ ...NO_OLD, weeklyKg: -0.45, checkin: { ...ck(4, 'normal', 'sometimes', ['none'], ['foodOptions']), checkinFoodsWanted: 'mozzarella, salmone' } }] }, expect: [{ text: 'Il salmone diventa preferito, la mozzarella no: l’intolleranza resta e il conflitto è segnalato.', step: [0, 0], conflict: ['Mozzarella'], clarification: true, planCheck: (diet, m) => (foodIn(diet, m, 'Mozzarella') ? 'mozzarella nel piano' : !foodIn(diet, m, 'Salmone') ? 'salmone assente' : null) }] },
  { topic: 'Nuova condizione al check-in', user: { id: 'n-checkin-condition', name: 'Condizione medica al secondo mese', summary: 'Primo mese regolare; al secondo check-in segnala una terapia in corso.', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -0.45, checkin: ck(4, 'normal', 'sometimes') }, { ...NO_OLD, weeklyKg: -0.4, checkin: { ...ck(4, 'normal', 'sometimes'), checkinSpecialConditions: ['medical'] } }, { ...NO_OLD, weeklyKg: -0.4, checkin: ck(4, 'normal', 'sometimes') }] }, expect: [{ text: 'In linea.', verdict: ['on_track'], step: [0, 0] }, { text: 'Supervisione: piano congelato, storico conservato.', verdict: ['professional_review'], step: [0, 0], frozen: true }, { text: 'Resta congelato anche senza ripetere la condizione: si riattiva solo con conferma esplicita.', verdict: ['professional_review'], step: [0, 0], frozen: true }] },
  { topic: 'Gravidanza dal questionario', user: { id: 'n-pregnancy-q', name: 'Gravidanza dichiarata subito', summary: 'Indica la gravidanza nel questionario iniziale.', answers: q({ ...LOSS, sex: 'female', heightCm: 165, currentWeightKg: 68, targetWeightKg: 62, specialConditions: ['pregnancy'] }), months: [{ ...NO_OLD, weeklyKg: 0, checkin: ck(4, 'normal', 'sometimes') }] }, expect: [{ text: 'Nessun piano generato, nessun deficit: solo indicazioni generali.' }], preflight: 'supervision' },
  { topic: 'Nessuna pesata', user: { id: 'n-noweights', name: 'Nessuna pesata', summary: 'Ha seguito il piano ma non si è mai pesato.', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -0.4, weighIns: 0, checkin: ck(4, 'normal', 'sometimes') }] }, expect: [{ text: 'Nessun adattamento calorico senza dati.', verdict: ['insufficient_data'], step: [0, 0], must: ['request_info'] }] },
  { topic: 'Cambio del numero di pasti', user: { id: 'n-meals', name: 'Da 3 a 5 pasti', summary: 'Dopo il primo mese aggiorna il questionario: aggiunge due spuntini.', answers: LOSS, months: [{ ...NO_OLD, weeklyKg: -0.45, checkin: ck(4, 'normal', 'sometimes'), answersPatch: { mealsSelected: ['colazione', 'spuntinoMattina', 'pranzo', 'spuntinoPomeriggio', 'cena'], morningSnackTime: '10:30', afternoonSnackTime: '17:00' } }] }, expect: [{ text: 'Il nuovo mese ha 5 pasti, calorie e macro ridistribuiti e coerenti.', step: [0, 0], planCheck: (diet, m) => (diet?.months.find((x) => x.monthIndex === m)?.weeklySplit.every((d) => d.meals.length === 5) ? null : 'il mese nuovo non ha 5 pasti') }] },
  { topic: 'Cambio di regime confermato', user: { id: 'n-regime', name: 'Da vegetariano a onnivoro', summary: 'Vegetariano: al primo check-in chiede pollo (conflitto), al secondo conferma di mangiare di tutto.', answers: q({ ...LOSS, dietaryPattern: 'vegetarian', preferredProteins: [id('Uova intere'), id('Ceci')] }), months: [{ ...NO_OLD, weeklyKg: -0.45, checkin: { ...ck(4, 'normal', 'sometimes', ['none'], ['foodOptions']), checkinFoodsWanted: 'petto di pollo' } }, { ...NO_OLD, weeklyKg: -0.45, checkin: { ...ck(4, 'normal', 'sometimes', ['none'], ['foodOptions']), checkinFoodsWanted: 'petto di pollo', checkinDietaryPattern: 'none' } }] }, expect: [{ text: 'Conflitto: il pollo non entra, si chiede conferma.', step: [0, 0], conflict: ['Petto di pollo'], clarification: true, planCheck: (diet, m) => (foodIn(diet, m, 'Petto di pollo') ? 'pollo nel piano prima della conferma' : null) }, { text: 'Regime confermato: profilo aggiornato, il pollo entra nel piano.', step: [0, 0], profileUpdate: 'none', planCheck: (diet, m) => (foodIn(diet, m, 'Petto di pollo') ? null : 'pollo assente dopo la conferma') }] },
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
    dietaryPatternChange: answers.checkinDietaryPattern && answers.checkinDietaryPattern !== 'keep' ? String(answers.checkinDietaryPattern) : undefined,
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
          log: x.freeMealLog ? { status: x.freeMealLog.status, kcal: x.freeMealLog.kcal, macros: x.freeMealLog.macros ?? null, method: x.freeMealLog.method } : null,
          items: x.items.map((i) => ({ name: i.name, qty: i.quantityLabel, kcal: Math.round(i.kcal), role: i.role ?? null, subs: (i.substitutes ?? []).map((s) => ({ name: s.name, qty: s.quantityLabel, kcal: s.kcal ?? null, p: s.protein ?? null, eq: s.equivalence ?? null, note: s.note ?? null })), from: i.substitutedFrom ? i.substitutedFrom.name : null })),
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

function evaluate(exp: Expectation | undefined, r: ReturnType<typeof recalibrate>, nextDiet: PlanBundle['diet'], m: number, issues: ValidationIssue[], frozenOk: boolean | null): { status: Status; failures: string[] } {
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
    for (const name of exp.conflict ?? []) {
      if (!d.conflicts.some((c) => c.name === name)) failures.push(`conflitto non rilevato per ${name}`);
      const fid = FITLAB_FOODS.find((f) => f.name === name)?.id;
      if (fid && r.calibration.diet?.extraPreferredFoodIds?.includes(fid)) failures.push(`${name} salvato tra le preferenze nonostante il conflitto`);
    }
    if (exp.profileUpdate && d.profileUpdates.dietaryPattern !== exp.profileUpdate) failures.push(`regime non aggiornato (atteso ${exp.profileUpdate})`);
    if (!exp.profileUpdate && d.profileUpdates.dietaryPattern) failures.push('regime cambiato senza conferma');
    if (exp.frozen && frozenOk === false) failures.push('il piano non è rimasto congelato (calibrazione o mesi cambiati)');
    const pc = exp.planCheck?.(nextDiet, m + 1);
    if (pc) failures.push(pc);
  }
  for (const i of issues) if (i.level === 'BLOCKER') failures.push(`${i.code}: ${i.message}`);
  const status: Status = failures.length ? 'failed' : d.supervision ? 'professional' : d.weight.classification === 'insufficient_data' ? 'not_evaluable' : 'passed';
  return { status, failures };
}

/** Per-month nutrition summary for the report (from the plan as generated: items → meals → days → week). */
function nutritionSummary(month: DietMonthPlan, previous?: DietMonthPlan) {
  const days = month.weeklySplit.map((d) => ({ target: d.calorieTarget ?? month.calorieTarget, ...dayNutrition(d.meals) }));
  const avg = (f: (x: (typeof days)[number]) => number) => Math.round(days.reduce((s, x) => s + f(x), 0) / days.length);
  const vm = varietyMetrics(month, previous);
  return {
    monthIndex: month.monthIndex,
    target: month.calorieTarget,
    macroTargets: month.macroTargetsG,
    weekAvgKcal: avg((x) => x.kcal),
    protein: avg((x) => x.protein),
    carbs: avg((x) => x.carbs),
    fats: avg((x) => x.fats),
    fiber: avg((x) => x.fiber),
    maxDayDevPct: Math.round(Math.max(...days.map((x) => Math.abs(x.kcal / x.target - 1))) * 1000) / 10,
    maxMacroGapPct: Math.round(Math.max(...days.filter((x) => x.prescribedKcal > 0).map((x) => Math.abs(x.prescribedKcal / x.derivedKcal - 1))) * 1000) / 10,
    days: days.map((x) => ({ target: x.target, kcal: x.kcal, derived: Math.round(x.derivedKcal + x.budgetKcal), protein: Math.round(x.protein), carbs: Math.round(x.carbs), fats: Math.round(x.fats), fiber: Math.round(x.fiber), budget: x.budgetKcal })),
    // largest daily deviation of each macro from its target, on the share of the day whose macros are known
    maxMacroDevPct: (['protein', 'carbs', 'fats'] as const).reduce((acc, k) => {
      acc[k] = Math.round(Math.max(...month.weeklySplit.map((d, i) => {
        const t = (d.macroTargetsG ?? month.macroTargetsG)[k] * (1 - days[i].budgetShare);
        const got = k === 'carbs' ? days[i].carbs + days[i].fiber / 2 : days[i][k];
        return t > 0 ? Math.abs(got / t - 1) : 0;
      })) * 1000) / 10;
      return acc;
    }, {} as Record<'protein' | 'carbs' | 'fats', number>),
    freeMeals: month.weeklySplit.reduce((n, d) => n + d.meals.filter((m) => m.isFreeMeal).length, 0),
    mealsWithoutMacros: month.weeklySplit.reduce((n, d) => n + d.meals.filter((m) => m.isFreeMeal && !m.freeMealLog?.macros).length, 0),
    partialDays: days.filter((x) => x.observed === 'partial').length,
    alternatives: month.weeklySplit.reduce((n, d) => n + d.meals.reduce((a, m) => a + m.items.reduce((b, i) => b + (i.substitutes?.length ?? 0), 0), 0), 0),
    alternativesTradeoff: month.weeklySplit.reduce((n, d) => n + d.meals.reduce((a, m) => a + m.items.reduce((b, i) => b + (i.substitutes?.filter((x) => x.equivalence === 'tradeoff').length ?? 0), 0), 0), 0),
    eggMeals: month.weeklySplit.reduce((n, d) => n + d.meals.filter((x) => x.items.some((it) => it.role === 'protein' && /Uova|Albume/.test(it.name))).length, 0),
    repeatedMeals: vm.repeatedMeals,
    repeatedVsPreviousPct: vm.repeatedVsPrevious == null ? null : Math.round(vm.repeatedVsPrevious * 100),
    consecutiveSameRecipe: vm.consecutiveSameRecipe,
    topProteins: vm.topProteins,
    proteinCategories: vm.proteinCategories,
  };
}


/**
 * What happens when the person applies alternatives: on the first month of the first plan, up to four of them
 * (a secondo, a primo, a breakfast/snack protein, and a declared compromise when there is one) are applied in turn
 * through applySubstitution; each row reports values, differences and the validator's verdict on the month.
 */
function simulateSubstitutions(answers: Answers, plan: DietPlan) {
  const ctx = buildUserContext(answers);
  const rows: Record<string, unknown>[] = [];
  let current = plan;
  const picks: ((i: PlanMealItem, slot: string) => boolean)[] = [
    (i, slot) => i.role === 'protein' && (slot === 'pranzo' || slot === 'cena'),
    (i, slot) => i.role === 'carb' && (slot === 'pranzo' || slot === 'cena'),
    (i, slot) => i.role === 'protein' && slot !== 'pranzo' && slot !== 'cena',
    (i) => !!i.substitutes?.some((x) => x.equivalence === 'tradeoff'),
  ];
  const used = new Set<string>();
  for (const [k, pick] of picks.entries()) {
    const month = current.months[0];
    let at: { dayIndex: number; slotId: string; itemIndex: number; item: PlanMealItem; sub: NonNullable<PlanMealItem['substitutes']>[number] } | null = null;
    for (const [dayIndex, d] of month.weeklySplit.entries()) {
      for (const meal of d.meals) {
        for (const [itemIndex, it] of meal.items.entries()) {
          if (at || used.has(`${dayIndex}|${meal.slotId}`) || it.substitutedFrom || !it.substitutes?.length || !pick(it, meal.slotId)) continue;
          const sub = k === 3 ? it.substitutes.find((x) => x.equivalence === 'tradeoff')! : it.substitutes[0];
          at = { dayIndex, slotId: meal.slotId, itemIndex, item: it, sub };
        }
      }
    }
    if (!at) continue;
    used.add(`${at.dayIndex}|${at.slotId}`);
    const res = applySubstitution(current, { monthIndex: month.monthIndex, dayIndex: at.dayIndex, slotId: at.slotId, itemIndex: at.itemIndex, substituteFoodId: at.sub.foodId }, { answers, sex: ctx.sex }, { now: '2026-11-18T00:00:00Z' });
    if (!res.ok) { rows.push({ original: at.item.name, substitute: at.sub.name, outcome: 'rifiutata', reason: res.reason }); continue; }
    current = res.plan;
    const m = current.months[0];
    const issues = validateDietMonth(m, ctx, {}).filter((i) => (i.code === 'V14' && i.level !== 'INFO') || i.code === 'V5' || (i.level === 'BLOCKER'));
    const meal = m.weeklySplit[at.dayIndex].meals.find((x) => x.slotId === at!.slotId)!;
    const sum = meal.items.reduce((a, i) => a + i.kcal, 0);
    const recalculated = sum === meal.totalKcal && issues.length === 0;
    const inBand = Math.abs(res.change.day.afterDevPct) <= NUTRITION_PARAMS.planning.dayKcalTolerance * 100 + 0.05;
    rows.push({
      day: m.weeklySplit[at.dayIndex].weekday,
      meal: meal.label,
      original: res.change.original.name,
      substitute: res.change.substitute.name,
      originalQty: `${res.change.original.grams} g`,
      newQty: `${res.change.substitute.grams} g`,
      originalKcal: res.change.original.kcal,
      newKcal: res.change.substitute.kcal,
      dP: res.change.delta.protein,
      dC: res.change.delta.carbs,
      dF: res.change.delta.fats,
      equivalence: res.change.equivalence,
      note: res.change.note ?? null,
      mealKcal: res.change.meal,
      dayKcal: res.change.day,
      week: res.change.week,
      recalculated,
      outcome: recalculated && inBand ? 'coerente' : 'da rivedere',
    });
  }
  return rows;
}

// --------------------------------------------------------------------- run --

function runUser(u: Scenario['user'], expectations: (m: number) => Expectation | undefined, preflight?: 'supervision') {
  const rand = rng(u.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0) * 7919);
  let answers = u.answers;
  const ctxInitial = buildUserContext(answers);
  let calibration: PlanCalibration = { ...NEUTRAL_CALIBRATION };
  let bundle = buildPlans(ctxInitial);
  const base = {
    id: u.id,
    name: u.name,
    summary: u.summary,
    answers: u.answers,
    initial: {
      durationMonths: bundle.durationMonths,
      monthTargets: bundle.monthTargets.map((t) => ({ calories: t.calories, macros: t.macros, weeklyKg: t.pace.weeklyKg })),
      tdee: Math.round(bundle.monthTargets[0].averageExpenditure),
      adjustments: bundle.monthTargets[0].adjustments,
    },
  };

  // Safety engine before any generation
  if (!bundle.diet) {
    const failures: string[] = [];
    if (preflight !== 'supervision') failures.push('nessun piano generato senza un motivo di supervisione');
    if (bundle.dietSupervision.length === 0) failures.push('piano non generato ma nessuna supervisione dichiarata');
    if (bundle.monthTargets[0].pace.dailyBalanceKcal !== 0) failures.push('obiettivo calorico con deficit o surplus nonostante la supervisione');
    const status: Status = failures.length ? 'failed' : 'professional';
    return { ...base, preflight: { reasons: bundle.dietSupervision, status, failures, note: bundle.monthTargets[0].adjustments.join(' ') }, weights: [], checkins: [], months: [], monthIssues: {}, nutrition: [], history: [] };
  }
  const preflightFailures = preflight === 'supervision' ? ['il piano è stato generato nonostante una condizione da supervisionare'] : [];
  const substitutions = simulateSubstitutions(answers, bundle.diet);

  const slots = () => buildMealSlotsFromAnswers(answers).map((s) => s.id);
  const months = [monthView(bundle, 1)];
  const ofMonth = (issues: ValidationIssue[], k: number) => issues.filter((i) => new RegExp(`^Mese ${k}[,:]`).test(i.message));
  const monthIssues: Record<number, ValidationIssue[]> = { 1: ofMonth(bundle.dietIssues, 1) };
  const nutrition = [nutritionSummary(bundle.diet.months[0])];
  const checkins: unknown[] = [];
  const weights: { date: string; kg: number }[] = [];
  const history: RecalibrationRecord[] = [];
  let kg = ctxInitial.weightKg;
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
    const ctx = { ...buildUserContext(answers), weightKg: r1(kg) };
    const targetsFollowed = { ...bundle.monthTargets[m - 1], calories: stored.calorieTarget, macros: stored.macroTargetsG };
    const wasFrozen = !!bundle.diet!.supervision;
    const result = recalibrate({
      ctx,
      monthIndex: m,
      durationMonths: bundle.durationMonths,
      targets: targetsFollowed,
      weights: used,
      adherence: {
        trainingCompletion: o.trainingCompletion !== undefined ? o.trainingCompletion : ctx.mode === 'diet' ? null : signals.adherence != null && signals.adherence <= 2 ? 0.45 : 0.9,
        mealDaysTracked: tracked,
        daysInMonth: 30,
        avgEatenKcal: tracked >= 10 ? stored.calorieTarget * (o.eatenShare ?? 1) : null,
      },
      checkin: signals,
      calibration,
      weeks: { current: bundle.training?.months[m - 1]?.weeklySplit ?? null, next: bundle.training?.months[m]?.weeklySplit ?? null },
      history,
      slots: slots(),
      frozen: wasFrozen,
    });
    if (history.length && result.previousOutcome && history[history.length - 1].decision) history[history.length - 1].decision!.observedOutcome = result.previousOutcome;
    history.push({ monthIndex: m, date: addDays(start, m * 30), verdict: result.verdict, weeklyRateKg: result.weeklyRateKg, expectedWeeklyKg: result.expectedWeeklyKg, changes: result.changes, calibration: result.calibration, decision: result.decision });
    // same as plan-store.recalibrateMonth: a confirmed regime reaches the profile; a questionnaire update
    // between months (answersPatch) is applied; a reported condition freezes the diet before the rebuild
    if (result.decision.profileUpdates.dietaryPattern) answers = { ...answers, dietaryPattern: result.decision.profileUpdates.dietaryPattern };
    if (o.answersPatch) answers = { ...answers, ...o.answersPatch };
    const prevBundle = bundle;
    const prevCalibration = calibration;
    calibration = result.calibration;
    const dietForBuild =
      result.decision.supervision && !bundle.diet!.supervision
        ? { ...bundle.diet!, supervision: { status: 'professional_review' as const, reasons: ['check-in'], since: addDays(start, m * 30), source: 'checkin' as const, monthIndex: m } }
        : bundle.diet;
    bundle = buildPlans({ ...buildUserContext(answers), weightKg: r1(kg) }, { calibration, preserveMonthsBefore: m + 1, existing: { diet: dietForBuild, training: bundle.training } });
    const next = bundle.diet!.months.find((x) => x.monthIndex === m + 1)!;
    months.push(monthView(bundle, m + 1));

    const supervised = result.decision.supervision;
    const frozenOk = supervised
      ? JSON.stringify(bundle.diet!.months) === JSON.stringify(prevBundle.diet!.months) &&
        calibration.calorieAdjustment === prevCalibration.calorieAdjustment &&
        calibration.mealVariant === prevCalibration.mealVariant &&
        JSON.stringify(calibration.diet ?? null) === JSON.stringify(prevCalibration.diet ?? null)
      : null;
    // a frozen plan is not re-validated as a new publication: nothing new was generated
    const issues: ValidationIssue[] = supervised ? [] : [...validateUpdate(result.decision, stored, next), ...ofMonth(bundle.dietIssues, m + 1)];
    if (bundle.dietBlocked) issues.push({ level: 'BLOCKER', code: 'P0', message: `Pubblicazione bloccata: ${bundle.dietIssues.filter((i) => i.level === 'BLOCKER').length} blocker nel piano generato.` });
    if (JSON.stringify(bundle.diet!.months.find((x) => x.monthIndex === m)) !== JSON.stringify(prevBundle.diet!.months.find((x) => x.monthIndex === m)))
      issues.push({ level: 'BLOCKER', code: 'J1', message: `Il mese ${m}, già vissuto, è stato modificato dal check-in.` });
    monthIssues[m + 1] = issues;
    nutrition.push(nutritionSummary(next, stored));
    const exp = expectations(m);
    const evaluation = evaluate(exp, result, bundle.diet, m, issues, frozenOk);
    if (preflightFailures.length && m === 1) {
      evaluation.failures.unshift(...preflightFailures);
      evaluation.status = 'failed';
    }

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
      questionnaireUpdate: o.answersPatch ? Object.keys(o.answersPatch) : null,
      before: o.expect ? { verdict: o.verdict, step: o.step, text: o.expect, review: o.review ?? null } : null,
      expectation: exp ? { text: exp.text, verdict: exp.verdict ?? null, step: exp.step ?? null, must: exp.must ?? [] } : null,
      evaluation,
      frozen: supervised,
      result: { verdict: result.verdict, changes: result.changes, reasons: result.reasons, clarifications: result.clarifications, adaptations: calibration.diet, expenditureOffset: calibration.expenditureOffset ?? 0 },
      decision: result.decision,
    });
  }

  return {
    ...base,
    preflight: null,
    weights,
    checkins,
    months,
    monthIssues,
    nutrition,
    substitutions,
    history: history.map((h) => ({ monthIndex: h.monthIndex, step: h.decision?.calorieStep, expected: h.decision?.expectedOutcome, observed: h.decision?.observedOutcome ?? null })),
  };
}

// ---------------------------------------------------------------- validator unit tests --
// Plans the generator would never produce, built on purpose by altering a valid month: the validator must catch them.

function validatorTests() {
  const ctx = buildUserContext(USERS[0].answers);
  const b = buildPlans(ctx);
  const good = b.diet!.months[0];
  const exp = b.monthTargets[0].averageExpenditure;
  const clone = (): DietMonthPlan => JSON.parse(JSON.stringify(good));
  const firstPrescribed = (mo: DietMonthPlan, day = 0) => mo.weeklySplit[day].meals.find((x) => !x.isFreeMeal && x.items.length > 1)!;
  const cases: { id: string; topic: string; expect: { level: 'BLOCKER' | 'WARNING'; code: string }; build: () => { month: DietMonthPlan; previous?: DietMonthPlan } }[] = [
    { id: 'v-incomplete', topic: 'Ricetta con valori nutrizionali incompleti', expect: { level: 'BLOCKER', code: 'V0' }, build: () => { const mo = clone(); const it = firstPrescribed(mo).items[0]; delete it.protein; it.kcal = Number.NaN; return { month: mo }; } },
    { id: 'v-recipe-kcal', topic: 'Ricetta con calorie non coerenti con gli ingredienti', expect: { level: 'BLOCKER', code: 'V5' }, build: () => { const mo = clone(); firstPrescribed(mo).totalKcal += 180; return { month: mo }; } },
    { id: 'v-macros', topic: 'Calorie corrette ma macro non coerenti', expect: { level: 'BLOCKER', code: 'V5' }, build: () => { const mo = clone(); const it = firstPrescribed(mo).items[0]; it.protein = (it.protein ?? 0) + 25; it.carbs = Math.max(0, (it.carbs ?? 0) - 25); return { month: mo }; } },
    {
      id: 'v-unbalanced',
      topic: 'Media settimanale corretta, giornate sbilanciate',
      expect: { level: 'BLOCKER', code: 'V3' },
      build: () => {
        const mo = clone();
        // +18% on Monday and −18% on Tuesday: the week's average stays on target
        const scale = (day: number, f: number) => { for (const meal of mo.weeklySplit[day].meals) { if (meal.isFreeMeal) continue; for (const it of meal.items) { it.grams = Math.round(it.grams * f); const food = FITLAB_FOODS.find((x) => x.id === it.foodId)!; const k = it.grams / 100; it.kcal = Math.round(food.kcal * k); it.protein = Math.round(food.p * k * 10) / 10; it.carbs = Math.round(food.c * k * 10) / 10; it.fats = Math.round(food.f * k * 10) / 10; it.fiber = Math.round(food.fib * k * 10) / 10; } meal.totalKcal = meal.items.reduce((s, i) => s + i.kcal, 0); const n = meal.items.reduce((a, i) => ({ p: a.p + i.protein!, c: a.c + i.carbs!, f: a.f + i.fats!, fib: a.fib + i.fiber! }), { p: 0, c: 0, f: 0, fib: 0 }); meal.macros = { protein: Math.round(n.p), carbs: Math.round(n.c), fats: Math.round(n.f), fiber: Math.round(n.fib) }; } };
        scale(0, 1.18);
        scale(1, 0.82);
        return { month: mo };
      },
    },
    { id: 'v-same-recipe', topic: 'Stessa ricetta per più giorni', expect: { level: 'WARNING', code: 'V17' }, build: () => { const mo = clone(); const lunch = mo.weeklySplit[0].meals.find((x) => x.slotId === 'pranzo')!; for (const d of mo.weeklySplit.slice(1, 5)) { const i = d.meals.findIndex((x) => x.slotId === 'pranzo'); d.meals[i] = JSON.parse(JSON.stringify(lunch)); } return { month: mo }; } },
    { id: 'v-same-month', topic: 'Menu mensile quasi identico al precedente', expect: { level: 'WARNING', code: 'V10' }, build: () => { const mo = clone(); mo.monthIndex = 2; return { month: mo, previous: good }; } },
    { id: 'v-substitute', topic: 'Sostituzione che cambia molto le calorie', expect: { level: 'WARNING', code: 'V14' }, build: () => { const mo = clone(); const it = firstPrescribed(mo).items.find((x) => x.substitutes?.length && x.role !== 'veg' && x.kcal >= 80)!; it.substitutes![0].grams = it.substitutes![0].grams * 2; return { month: mo }; } },
  ];
  return cases.map((c) => {
    const { month, previous } = c.build();
    const issues = validateDietMonth(month, ctx, { expenditure: exp, previous });
    const hit = issues.some((i) => i.level === c.expect.level && i.code === c.expect.code);
    const failures = hit ? [] : [`atteso ${c.expect.level} ${c.expect.code}, rilevati: ${issues.map((i) => `${i.level} ${i.code}`).join(', ') || 'nessuno'}`];
    return { id: c.id, topic: c.topic, expected: c.expect, issues: issues.filter((i) => i.code === c.expect.code).slice(0, 3), status: (hit ? 'passed' : 'failed') as Status, failures };
  });
}


// ------------------------------------------------------------ fitlab-9 engine tests --
// The 14 cases of the fitlab-9 review. Each one runs the real engine (generator, substitution, free meals,
// validator) and passes only on the measured result. `evidence` keeps the numbers shown in the report.

type EngineTest = { id: string; topic: string; status: Status; failures: string[]; evidence: Record<string, unknown> };

/** fitlab-8 reference values (report data.json of fitlab-8): Elena's share of meals repeating the previous month, egg meals a week. */
const FITLAB8 = { elenaRepeatPct: [67, 63, 63], elenaEggs: [8, 9, 9, 8] };

const userById = (uid: string) => USERS.find((u) => u.id === uid)! as unknown as TestUser;
const plansFor = (answers: Answers) => {
  const ctx = buildUserContext(answers);
  return { ctx, bundle: buildPlans(ctx) };
};
/** Every item of a plan with an alternative named `to`, on an item named `from` (first match). */
function findSwap(plan: DietPlan, from: (i: PlanMealItem) => boolean, to: (name: string) => boolean) {
  for (const month of plan.months)
    for (const [dayIndex, d] of month.weeklySplit.entries())
      for (const meal of d.meals)
        for (const [itemIndex, it] of meal.items.entries()) {
          const sub = from(it) ? it.substitutes?.find((x) => to(x.name)) : undefined;
          if (sub) return { monthIndex: month.monthIndex, dayIndex, slotId: meal.slotId, itemIndex, item: it, sub };
        }
  return null;
}
const sumItems = (items: PlanMealItem[]) => items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + (i.protein ?? 0), c: a.c + (i.carbs ?? 0), f: a.f + (i.fats ?? 0) }), { kcal: 0, p: 0, c: 0, f: 0 });

/** Applies a substitution and checks every level: item values, meal sums, day and week derived, validator silent. */
function checkApplied(answers: Answers, plan: DietPlan, at: NonNullable<ReturnType<typeof findSwap>>, failures: string[]) {
  const ctx = buildUserContext(answers);
  const res = applySubstitution(plan, { monthIndex: at.monthIndex, dayIndex: at.dayIndex, slotId: at.slotId, itemIndex: at.itemIndex, substituteFoodId: at.sub.foodId }, { answers, sex: ctx.sex }, { now: '2026-11-18T00:00:00Z' });
  if (!res.ok) { failures.push(`sostituzione rifiutata: ${res.reason}`); return null; }
  const month = res.plan.months.find((m) => m.monthIndex === at.monthIndex)!;
  const meal = month.weeklySplit[at.dayIndex].meals.find((m) => m.slotId === at.slotId)!;
  const it = meal.items[at.itemIndex];
  const food = FITLAB_FOODS.find((f) => f.id === it.foodId)!;
  const k = it.grams / 100;
  if (it.foodId !== at.sub.foodId) failures.push('l’alimento del menu non è cambiato');
  if (it.grams !== at.sub.grams) failures.push(`grammi ${it.grams} invece dei ${at.sub.grams} proposti`);
  if (Math.abs(it.kcal - food.kcal * k) > 1 || Math.abs((it.protein ?? -1) - food.p * k) > 0.1 || Math.abs((it.fats ?? -1) - food.f * k) > 0.1) failures.push('valori dell’alimento non ricalcolati dal catalogo');
  if (!it.substitutedFrom || it.substitutedFrom.foodId !== at.item.foodId) failures.push('manca la traccia dell’alimento originale');
  const n = sumItems(meal.items);
  if (meal.totalKcal !== n.kcal || Math.abs((meal.macros?.protein ?? -1) - n.p) > 1 || Math.abs((meal.macros?.fats ?? -1) - n.f) > 1) failures.push('totali del pasto non ricalcolati');
  if (!it.substitutes?.some((x) => x.foodId === at.item.foodId)) failures.push('l’alimento originale non è tra le alternative per tornare indietro');
  const issues = validateDietMonth(month, ctx, { expenditure: undefined });
  const bad = issues.filter((i) => (i.code === 'V14' && i.level !== 'INFO') || i.code === 'V5' || i.level === 'BLOCKER');
  if (bad.length) failures.push(`validatore: ${bad.map((i) => `${i.level} ${i.code} ${i.kind ?? ''}`).join(', ')}`);
  if (Math.abs(res.change.day.afterDevPct) > NUTRITION_PARAMS.planning.dayKcalTolerance * 100 + 0.05) failures.push(`giornata a ${res.change.day.afterDevPct}% dal target dopo la sostituzione`);
  return res;
}

function engineTests(): EngineTest[] {
  const out: EngineTest[] = [];
  const run = (id: string, topic: string, body: (failures: string[], evidence: Record<string, unknown>) => void) => {
    const failures: string[] = [];
    const evidence: Record<string, unknown> = {};
    try { body(failures, evidence); } catch (e) { failures.push(`errore: ${(e as Error).message}`); }
    out.push({ id, topic, status: failures.length ? 'failed' : 'passed', failures, evidence });
  };
  const elena = userById('elena');
  const giulia = userById('giulia');
  const marco = userById('marco');
  const sara = userById('sara');

  run('t01-uova-albume', 'Sostituzione uova ↔ albume', (failures, ev) => {
    const candidates = [elena, giulia, sara, marco].map((u) => ({ u, ...plansFor(u.answers) }));
    let at = null as ReturnType<typeof findSwap>, who = candidates[0];
    for (const c of candidates) { at = findSwap(c.bundle.diet!, (i) => i.name === 'Uova intere', (n) => n === "Albume d'uovo"); if (at) { who = c; break; } }
    if (!at) { failures.push('nessun piano propone l’albume al posto delle uova'); return; }
    const res = checkApplied(who.u.answers, who.bundle.diet!, at, failures);
    if (!res) return;
    const dp = res.change.substitute.protein / res.change.original.protein - 1;
    if (Math.abs(dp) > NUTRITION_PARAMS.substitution.protein.nutrientShare + 0.01) failures.push(`proteine ${Math.round(dp * 100)}%: oltre la tolleranza del ruolo`);
    if (!(res.change.delta.fats < 0)) failures.push('l’albume dovrebbe ridurre i grassi');
    Object.assign(ev, { user: who.u.name, change: res.change });
  });

  run('t02-yogurt-2-0', 'Sostituzione yogurt greco 2% ↔ 0%', (failures, ev) => {
    const candidates = [giulia, sara, marco].map((u) => ({ u, ...plansFor(u.answers) }));
    let at = null as ReturnType<typeof findSwap>, who = candidates[0];
    for (const c of candidates) { at = findSwap(c.bundle.diet!, (i) => i.name === 'Yogurt greco 2%' || i.name === 'Yogurt greco 0%', (n) => n === 'Yogurt greco 0%' || n === 'Yogurt greco 2%'); if (at) { who = c; break; } }
    if (!at) { failures.push('nessun piano propone yogurt greco 2% ↔ 0%'); return; }
    const res = checkApplied(who.u.answers, who.bundle.diet!, at, failures);
    if (!res) return;
    const dp = res.change.substitute.protein / res.change.original.protein - 1;
    if (Math.abs(dp) > 0.16) failures.push(`proteine ${Math.round(dp * 100)}%`);
    const toLean = res.change.substitute.name.includes('0%');
    if (toLean ? !(res.change.delta.fats < 0) : !(res.change.delta.fats > 0)) failures.push('grassi non coerenti con il passaggio 2% ↔ 0%');
    Object.assign(ev, { user: who.u.name, change: res.change });
  });

  run('t03-kefir-yogurt', 'Sostituzione kefir ↔ yogurt (classificazione onesta)', (failures, ev) => {
    const candidates = [giulia, sara, marco].map((u) => ({ u, ...plansFor(u.answers) }));
    let at = null as ReturnType<typeof findSwap>, who = candidates[0];
    for (const c of candidates) {
      at = findSwap(c.bundle.diet!, (i) => i.name === 'Kefir', (n) => n.startsWith('Yogurt')) ?? findSwap(c.bundle.diet!, (i) => i.name.startsWith('Yogurt'), (n) => n === 'Kefir');
      if (at) { who = c; break; }
    }
    if (!at) { failures.push('nessun piano propone kefir ↔ yogurt'); return; }
    const res = checkApplied(who.u.answers, who.bundle.diet!, at, failures);
    if (!res) return;
    const rule = NUTRITION_PARAMS.substitution.protein;
    const dk = res.change.substitute.kcal / res.change.original.kcal - 1;
    const shouldTrade = Math.abs(dk) > rule.kcalShare && Math.abs(res.change.delta.kcal) > rule.kcalAbs;
    if ((res.change.equivalence === 'tradeoff') !== shouldTrade) failures.push(`classificata ${res.change.equivalence} con ${Math.round(dk * 100)}% di energia`);
    Object.assign(ev, { user: who.u.name, change: res.change, energyPct: Math.round(dk * 100) });
  });

  run('t04-proposta-non-applicata', 'Alternativa proposta ma non scelta: menu invariato', (failures, ev) => {
    const { ctx, bundle } = plansFor(giulia.answers);
    const month = bundle.diet!.months[0];
    const applied = month.weeklySplit.flatMap((d) => d.meals.flatMap((m) => m.items)).filter((i) => i.substitutedFrom).length;
    if (applied) failures.push(`${applied} alimenti risultano sostituiti senza scelta`);
    // the day's numbers are the items only: alternatives never enter them
    for (const d of month.weeklySplit) {
      const n = dayNutrition(d.meals);
      const items = d.meals.filter((m) => !m.isFreeMeal).flatMap((m) => m.items).reduce((s2, i) => s2 + i.kcal, 0);
      if (n.prescribedKcal !== items) failures.push(`${d.weekday}: calorie della giornata diverse dalla somma degli alimenti del menu`);
    }
    const issues = validateDietMonth(month, ctx, {});
    const v14 = issues.filter((i) => i.code === 'V14');
    if (v14.some((i) => i.level !== 'INFO')) failures.push(`le alternative proposte producono ${v14.filter((i) => i.level !== 'INFO').length} warning/blocker`);
    const subs = month.weeklySplit.flatMap((d) => d.meals.flatMap((m) => m.items.flatMap((i) => i.substitutes ?? [])));
    const withValues = subs.filter((x) => x.kcal != null && x.protein != null && x.equivalence).length;
    if (withValues !== subs.length) failures.push(`${subs.length - withValues} alternative senza valori o classificazione`);
    Object.assign(ev, { alternatives: subs.length, tradeoffs: subs.filter((x) => x.equivalence === 'tradeoff').length, v14: v14.map((i) => `${i.level} ${i.kind}`) });
  });

  run('t05-sostituzione-applicata', 'Sostituzione applicata: alimento, pasto, giorno e settimana aggiornati', (failures, ev) => {
    const { ctx, bundle } = plansFor(marco.answers);
    const at = findSwap(bundle.diet!, (i) => i.role === 'protein' && i.kcal >= 120, () => true);
    if (!at) { failures.push('nessuna alternativa proteica'); return; }
    const res = checkApplied(marco.answers, bundle.diet!, at, failures);
    if (!res) return;
    const month = res.plan.months.find((m) => m.monthIndex === at.monthIndex)!;
    const dayKcal = dayNutrition(month.weeklySplit[at.dayIndex].meals).kcal;
    if (dayKcal !== res.change.day.after) failures.push('giornata non derivata dai pasti');
    const week = Math.round(month.weeklySplit.reduce((s2, d) => s2 + dayNutrition(d.meals).kcal, 0) / 7);
    if (week !== res.change.week.afterAvg) failures.push('media settimanale non aggiornata');
    if (res.change.day.rebalanced.length === 0 && res.change.day.after !== res.change.day.before + (res.change.meal.after - res.change.meal.before)) failures.push('variazione della giornata diversa da quella del pasto');
    // the same substitution WITHOUT recalculation (food changed, old numbers kept) must be detected
    const stale: DietPlan = JSON.parse(JSON.stringify(bundle.diet));
    const m2 = stale.months.find((m) => m.monthIndex === at.monthIndex)!;
    const it = m2.weeklySplit[at.dayIndex].meals.find((m) => m.slotId === at.slotId)!.items[at.itemIndex];
    Object.assign(it, { foodId: at.sub.foodId, name: at.sub.name, grams: at.sub.grams, substitutedFrom: { foodId: at.item.foodId, name: at.item.name, grams: at.item.grams, kcal: at.item.kcal, protein: 0, carbs: 0, fats: 0, fiber: 0, at: 'x' } });
    const staleIssues = validateDietMonth(m2, ctx, {}).filter((i) => i.code === 'V14' && i.kind === 'applied_stale');
    if (staleIssues.length === 0 && Math.abs(at.sub.kcal! - at.item.kcal) > 1) failures.push('sostituzione senza ricalcolo non rilevata');
    Object.assign(ev, { change: res.change, staleDetected: staleIssues.map((i) => `${i.level} ${i.message}`) });
  });

  run('t06-macro-giornata', 'Giornata con macro fuori target: rilevata e migliorata', (failures, ev) => {
    const { ctx, bundle } = plansFor(marco.answers);
    const month: DietMonthPlan = JSON.parse(JSON.stringify(bundle.diet!.months[0]));
    const day = month.weeklySplit[1];
    const pools = buildFitLabPools(marco.answers);
    const kcalT = (mi: number) => day.meals[mi].totalKcal;
    // protein portions down by ~35%, carbohydrates up to keep the energy: a day short of protein
    day.meals = day.meals.map((m, mi) => {
      if (m.isFreeMeal) return m;
      const items = m.items.map((i) => (i.role === 'protein' ? resizeItem(i, Math.max(10, Math.round((i.grams * 0.65) / 10) * 10), { kind: SLOT_KIND[m.slotId as keyof typeof SLOT_KIND], pools, kcalTarget: kcalT(mi) }) ?? i : i));
      const t = sumItems(items);
      return { ...m, items, totalKcal: t.kcal, macros: { protein: Math.round(t.p), carbs: Math.round(t.c), fats: Math.round(t.f), fiber: m.macros?.fiber } };
    });
    const before = validateDietMonth(month, ctx, {}).filter((i) => i.code === 'V16' && /^Mese 1, Mar/.test(i.message));
    const pBefore = dayNutrition(day.meals).protein;
    if (!before.some((i) => i.kind === 'day_protein_low')) failures.push('giornata con proteine basse non rilevata');
    reconcileDay(day.meals, day.calorieTarget!, day.macroTargetsG!, SEX_FLOOR[ctx.sex], (mi, it, g) => resizeItem(it, g, { kind: SLOT_KIND[day.meals[mi].slotId as keyof typeof SLOT_KIND], pools, kcalTarget: kcalT(mi) }));
    const n = dayNutrition(day.meals);
    const offBefore = pBefore / day.macroTargetsG!.protein - 1;
    const offAfter = n.protein / day.macroTargetsG!.protein - 1;
    if (!(Math.abs(offAfter) < Math.abs(offBefore) - 0.05)) failures.push(`proteine non migliorate (${Math.round(offBefore * 100)}% → ${Math.round(offAfter * 100)}%)`);
    if (Math.abs(n.kcal / day.calorieTarget! - 1) > NUTRITION_PARAMS.planning.dayKcalTolerance + 0.001) failures.push('energia fuori banda dopo la correzione');
    Object.assign(ev, { proteinTarget: day.macroTargetsG!.protein, before: Math.round(pBefore), after: Math.round(n.protein), kcal: n.kcal, target: day.calorieTarget, flagged: before.map((i) => i.message) });
  });

  run('t07-settimana-ok-giorni-sbilanciati', 'Media settimanale corretta ma giornate sbilanciate', (failures, ev) => {
    const { ctx, bundle } = plansFor(marco.answers);
    const month: DietMonthPlan = JSON.parse(JSON.stringify(bundle.diet!.months[0]));
    // Monday and Tuesday swap their main-meal protein foods and carbohydrate portions in opposite directions
    const pools = buildFitLabPools(marco.answers);
    const shift = (dayIdx: number, pf: number, cf: number) => {
      const d = month.weeklySplit[dayIdx];
      d.meals = d.meals.map((m) => {
        if (m.isFreeMeal || (m.slotId !== 'pranzo' && m.slotId !== 'cena')) return m;
        const items = m.items.map((i) => {
          const f = i.role === 'protein' ? pf : i.role === 'carb' ? cf : 1;
          if (f === 1) return i;
          const food = FITLAB_FOODS.find((x) => x.id === i.foodId)!;
          const g = Math.max(5, Math.round((i.grams * f) / 5) * 5);
          const k = g / 100;
          return { ...i, grams: g, kcal: Math.round(food.kcal * k), protein: Math.round(food.p * k * 10) / 10, carbs: Math.round(food.c * k * 10) / 10, fats: Math.round(food.f * k * 10) / 10, fiber: Math.round(food.fib * k * 10) / 10 };
        });
        const t = sumItems(items);
        return { ...m, items, totalKcal: t.kcal, macros: { protein: Math.round(t.p), carbs: Math.round(t.c), fats: Math.round(t.f), fiber: m.macros?.fiber } };
      });
      void pools;
    };
    shift(0, 1.45, 0.7);
    shift(1, 0.55, 1.3);
    const issues = validateDietMonth(month, ctx, {});
    const v16 = issues.filter((i) => i.code === 'V16');
    const daily = v16.filter((i) => i.kind?.startsWith('day_') && /Mese 1, (Lun|Mar)/.test(i.message));
    const weekly = v16.filter((i) => i.kind?.startsWith('week_protein'));
    const n0 = dayNutrition(month.weeklySplit[0].meals), n1 = dayNutrition(month.weeklySplit[1].meals);
    if (daily.length < 2) failures.push(`scostamenti giornalieri non rilevati (${daily.length})`);
    const wp = month.weeklySplit.reduce((s2, d) => s2 + dayNutrition(d.meals).protein, 0) / month.weeklySplit.reduce((s2, d) => s2 + (d.macroTargetsG ?? month.macroTargetsG).protein * (1 - dayNutrition(d.meals).budgetShare), 0) - 1;
    if (Math.abs(wp) <= NUTRITION_PARAMS.macroCheck.week.protein && weekly.length) failures.push('settimana segnalata fuori target pur essendo in media');
    if (Math.abs(wp) > NUTRITION_PARAMS.macroCheck.week.protein && !weekly.length) failures.push('media settimanale fuori target non segnalata');
    Object.assign(ev, { mon: Math.round(n0.protein), tue: Math.round(n1.protein), target: month.macroTargetsG.protein, weekProteinPct: Math.round(wp * 1000) / 10, daily: daily.map((i) => i.message), weekly: weekly.map((i) => i.message) });
  });

  run('t08-pasto-libero-senza-macro', 'Pasto libero senza macro: mai zero, giornata parzialmente osservata', (failures, ev) => {
    const { ctx, bundle } = plansFor(marco.answers);
    const month = bundle.diet!.months[0];
    const dayIndex = month.weeklySplit.findIndex((d) => d.meals.some((m) => m.isFreeMeal));
    const d = month.weeklySplit[dayIndex];
    const free = d.meals.find((m) => m.isFreeMeal)!;
    const n = dayNutrition(d.meals);
    if (n.observed !== 'partial' || n.budgetKcal !== free.totalKcal) failures.push('la giornata non risulta parzialmente osservata');
    const prescribedProtein = d.meals.filter((m) => !m.isFreeMeal).flatMap((m) => m.items).reduce((s2, i) => s2 + (i.protein ?? 0), 0);
    if (Math.abs(n.protein - prescribedProtein) > 0.01) failures.push('al pasto libero sono attribuiti dei macro');
    if (!validateDietMonth(month, ctx, {}).some((i) => i.code === 'V20' && i.level === 'INFO')) failures.push('manca l’informazione sulla giornata parzialmente osservata');
    const none = buildFreeMealLog({});
    if (none.ok) failures.push('un pasto senza calorie né alimenti è stato registrato');
    const kcalOnly = logFreeMeal(bundle.diet!, { monthIndex: 1, dayIndex, slotId: free.slotId }, { kcal: 950 });
    const pizza = buildFreeMealLog({ kcal: 900, description: 'pizza margherita e una birra' });
    if (!kcalOnly.ok || kcalOnly.log.status !== 'calories_only' || kcalOnly.log.macros) failures.push('pasto con sole calorie: macro inventati o stato errato');
    if (!pizza.ok || pizza.log.macros) failures.push('alimenti fuori catalogo: macro inventati');
    if (kcalOnly.ok) {
      const n2 = dayNutrition(kcalOnly.plan.months[0].weeklySplit[dayIndex].meals);
      if (n2.kcal !== n.prescribedKcal + 950 || n2.observed !== 'partial') failures.push('calorie registrate non contate o giornata segnata completa');
      Object.assign(ev, { dayBefore: { kcal: n.kcal, budget: n.budgetKcal, observed: n.observed }, dayAfterKcalOnly: { kcal: n2.kcal, unknownMacroKcal: n2.budgetKcal, observed: n2.observed } });
    }
    Object.assign(ev, { emptyLog: none.ok ? 'registrato' : none.reason, pizza: pizza.ok ? pizza.log : null });
  });

  run('t09-pasto-libero-dettagliato', 'Pasto libero dettagliato: misurato, stimato, più pasti liberi nella settimana', (failures, ev) => {
    const { bundle } = plansFor(marco.answers);
    let plan = bundle.diet!;
    const month = plan.months[0];
    const dayIndex = month.weeklySplit.findIndex((d) => d.meals.some((m) => m.isFreeMeal));
    const slotId = month.weeklySplit[dayIndex].meals.find((m) => m.isFreeMeal)!.slotId;
    const measured = logFreeMeal(plan, { monthIndex: 1, dayIndex, slotId }, { items: [{ foodId: id('Pasta'), grams: 110 }, { foodId: id('Petto di pollo'), grams: 150 }, { foodId: id('Olio extravergine di oliva'), grams: 10 }] });
    if (!measured.ok) { failures.push(`registrazione rifiutata: ${measured.reason}`); return; }
    const exp = [['Pasta', 110], ['Petto di pollo', 150], ['Olio extravergine di oliva', 10]].reduce((a, [nm, g]) => { const f = FITLAB_FOODS.find((x) => x.name === nm)!; const k = (g as number) / 100; return { p: a.p + f.p * k, f: a.f + f.f * k }; }, { p: 0, f: 0 });
    if (measured.log.status !== 'measured' || Math.abs(measured.log.macros!.protein - exp.p) > 0.3 || Math.abs(measured.log.macros!.fats - exp.f) > 0.3) failures.push('valori misurati diversi dal catalogo');
    const n = dayNutrition(measured.plan.months[0].weeklySplit[dayIndex].meals);
    if (n.observed !== 'complete') failures.push('giornata con pasto misurato non completa');
    const est = buildFreeMealLog({ description: 'pasta al pomodoro con petto di pollo', kcal: 800 });
    if (!est.ok || est.log.status !== 'estimated' || est.log.kcal !== 800 || !/stima/i.test(est.log.method)) failures.push('stima da descrizione non etichettata o calorie non rispettate');
    // a week with several free meals: a second one on another day, left unlogged
    plan = measured.plan;
    const other = (dayIndex + 3) % 7;
    const m0 = plan.months[0];
    const day2 = m0.weeklySplit[other];
    const cena = day2.meals.findIndex((m) => m.slotId === 'cena');
    const weeklySplit = m0.weeklySplit.map((d, i) => (i === other ? { ...d, meals: d.meals.map((m, j) => (j === cena ? { ...m, items: [], isFreeMeal: true, totalKcal: m.totalKcal, recipe: undefined, macros: undefined } : m)) } : d));
    const partial = weeklySplit.filter((d) => dayNutrition(d.meals).observed === 'partial').map((d) => d.weekday);
    if (partial.length !== 1 || partial[0] !== weeklySplit[other].weekday) failures.push(`giornate parziali errate: ${partial.join(', ')}`);
    Object.assign(ev, { measured: measured.log, estimated: est.ok ? est.log : null, partialDays: partial });
  });

  run('t10-elena-varieta-4-mesi', 'Pescetariana senza lattosio: più varietà su 4 mesi', (failures, ev) => {
    const ctx = buildUserContext(elena.answers);
    const base = buildPlans(ctx);
    const monthTargets = base.monthTargets;
    const plan = generateDietPlan({ ctx, monthTargets, variant: 0 });
    const pools = buildFitLabPools(elena.answers);
    const repeat: number[] = [], eggs: number[] = [], v10: string[] = [];
    plan.months.forEach((m, i) => {
      for (const it of m.weeklySplit.flatMap((d) => d.meals.flatMap((x) => x.items))) if (!pools.allowed(FITLAB_FOODS.find((f) => f.id === it.foodId)!)) failures.push(`${it.name} non ammesso`);
      eggs.push(m.weeklySplit.reduce((n, d) => n + d.meals.filter((x) => x.items.some((it) => it.role === 'protein' && /Uova|Albume/.test(it.name))).length, 0));
      if (i > 0) {
        repeat.push(Math.round((varietyMetrics(m, plan.months[i - 1]).repeatedVsPrevious ?? 0) * 100));
        v10.push(...validateDietMonth(m, ctx, { previous: plan.months[i - 1] }).filter((x) => x.code === 'V10').map((x) => `${x.level}: ${x.message}`));
      }
    });
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    if (!(avg(repeat) < avg(FITLAB8.elenaRepeatPct))) failures.push(`ripetizione media ${Math.round(avg(repeat))}% non inferiore a fitlab-8 (${Math.round(avg(FITLAB8.elenaRepeatPct))}%)`);
    if (!(avg(eggs) < avg(FITLAB8.elenaEggs))) failures.push(`uova ${eggs.join('/')} non inferiori a fitlab-8`);
    Object.assign(ev, { repeatPct: repeat, fitlab8RepeatPct: FITLAB8.elenaRepeatPct, eggMeals: eggs, fitlab8Eggs: FITLAB8.elenaEggs, v10 });
  });

  run('t11-ripetizione-uova', 'Ripetizione delle uova nella settimana', (failures, ev) => {
    const rows: Record<string, number[]> = {};
    for (const u of USERS as unknown as TestUser[]) {
      const { ctx, bundle } = plansFor(u.answers);
      if (!bundle.diet) continue;
      rows[u.name] = bundle.diet.months.map((m) => m.weeklySplit.reduce((n, d) => n + d.meals.filter((x) => x.items.some((it) => it.role === 'protein' && /Uova|Albume/.test(it.name))).length, 0));
      for (const m of bundle.diet.months) {
        const egg = validateDietMonth(m, ctx, {}).filter((i) => i.code === 'V9' && i.kind?.startsWith('eggs'));
        const n = rows[u.name][m.monthIndex - 1];
        if (n > NUTRITION_PARAMS.planning.maxEggMealsPerWeek + 1 && egg.length === 0) failures.push(`${u.name} M${m.monthIndex}: ${n} pasti con uova non segnalati`);
      }
      // with alternatives in every slot (omnivores) the cap holds
      if ((u.answers.dietaryPattern ?? 'none') === 'none' && Math.max(...rows[u.name]) > NUTRITION_PARAMS.planning.maxEggMealsPerWeek + 1) failures.push(`${u.name}: uova ${rows[u.name].join('/')} oltre il tetto pur con alternative`);
    }
    Object.assign(ev, { eggMealsPerWeek: rows, cap: NUTRITION_PARAMS.planning.maxEggMealsPerWeek });
  });

  run('t12-restrizioni-severe', 'Restrizioni molto severe: sicurezza prima della varietà artificiale', (failures, ev) => {
    const answers = q({ sex: 'female', age: 35, currentWeightKg: 62, targetWeightKg: 60, heightCm: 166, goal: 'loseFat', dietaryPattern: 'vegan', allergiesIntolerances: 'Allergia alla frutta a guscio, celiachia', excludedFoods: 'ceci, soia', mealsSelected: ['colazione', 'pranzo', 'cena'] });
    const { ctx, bundle } = plansFor(answers);
    const pools = buildFitLabPools(answers);
    if (!bundle.diet) {
      // acceptable only as an explicit, explained refusal: never a crash, never an invented food
      const why = bundle.dietIssues.filter((i) => i.level === 'BLOCKER');
      if (!bundle.dietBlocked || why.length === 0) failures.push('nessun piano e nessuna spiegazione');
      Object.assign(ev, { published: false, blockers: why.map((i) => i.message) });
      // with the strictest restriction removed (one of the exclusions) the same person gets a valid plan
      const relaxed = { ...answers, excludedFoods: 'ceci' };
      const r = plansFor(relaxed);
      const allR = r.bundle.diet?.months.flatMap((m) => m.weeklySplit.flatMap((d) => d.meals.flatMap((x) => x.items))) ?? [];
      const poolsR = buildFitLabPools(relaxed);
      if (allR.some((it) => !poolsR.allowed(FITLAB_FOODS.find((f) => f.id === it.foodId)!))) failures.push('piano meno restrittivo con alimenti vietati');
      Object.assign(ev, { relaxedPublished: !!r.bundle.diet, relaxedDistinctFoods: new Set(allR.map((x) => x.name)).size, relaxedBlockers: r.bundle.dietIssues.filter((i) => i.level === 'BLOCKER').length });
      return;
    }
    const all = bundle.diet.months.flatMap((m) => m.weeklySplit.flatMap((d) => d.meals.flatMap((x) => x.items)));
    const forbidden = all.filter((it) => !pools.allowed(FITLAB_FOODS.find((f) => f.id === it.foodId)!));
    const forbiddenSubs = all.flatMap((it) => it.substitutes ?? []).filter((s2) => !pools.allowed(FITLAB_FOODS.find((f) => f.id === s2.foodId)!));
    if (forbidden.length) failures.push(`alimenti vietati nel menu: ${[...new Set(forbidden.map((x) => x.name))].join(', ')}`);
    if (forbiddenSubs.length) failures.push(`alternative vietate: ${[...new Set(forbiddenSubs.map((x) => x.name))].join(', ')}`);
    const unknown = all.filter((it) => !FITLAB_FOODS.some((f) => f.id === it.foodId));
    if (unknown.length) failures.push('alimenti fuori catalogo');
    const issues = bundle.diet.months.flatMap((m) => validateDietMonth(m, ctx, {}));
    const forced = issues.filter((i) => i.kind === 'forced' || i.kind === 'eggs_forced' || (i.code === 'V10' && i.level === 'INFO') || i.code === 'V19');
    Object.assign(ev, { distinctFoods: new Set(all.map((x) => x.name)).size, blockers: issues.filter((i) => i.level === 'BLOCKER').map((i) => i.message), limitedVarietyNotes: forced.slice(0, 4).map((i) => i.message), warnings: issues.filter((i) => i.level === 'WARNING').length });
    if (issues.some((i) => i.level === 'BLOCKER')) failures.push('blocker nel piano');
  });

  run('t13-sostituzione-allergia', 'Sostituzione con un allergene: rifiutata', (failures, ev) => {
    const { bundle } = plansFor(marco.answers);
    const at = findSwap(bundle.diet!, () => true, (n) => /Uova|Albume|Yogurt|Ricotta|Fiocchi/.test(n));
    if (!at) { failures.push('nessuna alternativa con uova o latticini'); return; }
    const allergic = { ...marco.answers, allergiesIntolerances: /Uova|Albume/.test(at.sub.name) ? 'Allergia alle uova' : 'Allergia al latte' };
    const ctx = buildUserContext(allergic);
    const res = applySubstitution(bundle.diet!, { monthIndex: at.monthIndex, dayIndex: at.dayIndex, slotId: at.slotId, itemIndex: at.itemIndex, substituteFoodId: at.sub.foodId }, { answers: allergic, sex: ctx.sex });
    if (res.ok) failures.push(`${at.sub.name} applicato nonostante l’allergia`);
    // and a plan generated with the allergy proposes no such alternative (validator would block it)
    const fresh = buildPlans(ctx).diet!;
    const v14 = fresh.months.flatMap((m) => validateDietMonth(m, ctx, {})).filter((i) => i.code === 'V14' && i.kind === 'incompatible');
    if (v14.length) failures.push(`${v14.length} alternative incompatibili nel piano con allergia`);
    // the validator blocks an incompatible alternative injected in a plan
    const injected: DietPlan = JSON.parse(JSON.stringify(fresh));
    const target = injected.months[0].weeklySplit[0].meals.find((m) => !m.isFreeMeal)!.items[0];
    target.substitutes = [...(target.substitutes ?? []), { ...at.sub }];
    const blocked = validateDietMonth(injected.months[0], ctx, {}).filter((i) => i.code === 'V14' && i.level === 'BLOCKER');
    if (!blocked.length) failures.push('alternativa con allergene non bloccata dal validatore');
    Object.assign(ev, { refused: res.ok ? null : res.reason, validator: blocked.slice(0, 1).map((i) => i.message) });
  });

  run('t14-numero-pasti', 'Cambio del numero di pasti', (failures, ev) => {
    const rows: Record<string, unknown>[] = [];
    for (const meals of [['colazione', 'pranzo', 'cena'], ['colazione', 'spuntinoMattina', 'pranzo', 'spuntinoPomeriggio', 'cena'], ['pranzo', 'cena']]) {
      const answers = q({ ...marco.answers, mealsSelected: meals });
      const { ctx, bundle } = plansFor(answers);
      const m = bundle.diet!.months[0];
      const slots: string[] = buildMealSlotsFromAnswers(answers).map((x) => x.id);
      const devs = m.weeklySplit.map((d) => dayNutrition(d.meals).kcal / (d.calorieTarget ?? m.calorieTarget) - 1);
      const issues = validateDietMonth(m, ctx, {});
      if (m.weeklySplit.some((d) => d.meals.length !== slots.length || d.meals.some((x) => !slots.includes(x.slotId)))) failures.push(`${meals.length} pasti: slot del piano diversi da quelli scelti`);
      if (Math.max(...devs.map(Math.abs)) > NUTRITION_PARAMS.planning.dayKcalTolerance + 0.001) failures.push(`${meals.length} pasti: giornata oltre la tolleranza`);
      if (issues.some((i) => i.level === 'BLOCKER')) failures.push(`${meals.length} pasti: blocker`);
      const weekP = m.weeklySplit.reduce((s2, d) => s2 + dayNutrition(d.meals).protein, 0) / 7;
      rows.push({ meals: meals.length, maxDayDevPct: Math.round(Math.max(...devs.map(Math.abs)) * 1000) / 10, proteinAvg: Math.round(weekP), proteinTarget: m.macroTargetsG.protein, warnings: issues.filter((i) => i.level === 'WARNING').length });
    }
    Object.assign(ev, { rows });
  });

  return out;
}

// ------------------------------------------------------------------ output --

const users = USERS.map((u) => runUser(u as Scenario['user'], (m) => SPEC_EXPECTATIONS[`${u.id}:${m}`]));
const scenarios = SCENARIOS.map((s) => ({ topic: s.topic, ...runUser(s.user, (m) => s.expect[m - 1], s.preflight) }));
const validator = validatorTests();
const engine = engineTests();
type Row = { status: Status };
const evaluations: Row[] = [
  ...[...users, ...scenarios].flatMap((u) => [...(u.preflight ? [u.preflight] : []), ...(u.checkins as { evaluation: Row }[]).map((c) => c.evaluation)]),
  ...validator,
  ...engine,
];
const counts = { tests: evaluations.length, passed: 0, failed: 0, professional: 0, not_evaluable: 0 } as Record<Status | 'tests', number>;
for (const e of evaluations) counts[e.status]++;
const allIssues = [...users, ...scenarios].flatMap((u) => Object.values(u.monthIssues).flat());
const levels = { BLOCKER: 0, WARNING: 0, INFO: 0 } as Record<string, number>;
for (const i of allIssues) levels[i.level]++;
const byCode: Record<string, number> = {};
for (const i of allIssues) byCode[`${i.level} ${i.code}`] = (byCode[`${i.level} ${i.code}`] ?? 0) + 1;
const out = { engine: DIET_ENGINE_VERSION, generatedAt: new Date().toISOString(), counts, levels, byCode, users, scenarios, validator, engineTests: engine };
const path = process.argv[2] ?? 'nutrition-journey.json';
writeFileSync(path, JSON.stringify(out));

const icon = { passed: '✓', failed: '✗', professional: '⚕', not_evaluable: '·' } as const;
for (const group of [users, scenarios]) {
  for (const u of group) {
    console.log(`${'topic' in u ? `[${(u as { topic: string }).topic}] ` : ''}${u.name}`);
    if (u.preflight) console.log(`   ${icon[u.preflight.status]} prima della generazione: ${u.preflight.reasons.join(', ') || '—'}${u.preflight.failures.length ? `\n       - ${u.preflight.failures.join('\n       - ')}` : ''}`);
    for (const c of u.checkins as { monthIndex: number; evaluation: { status: Status; failures: string[] }; decision: { calorieStep: number; previousTarget: number; newTarget: number; balancePct: number }; result: { verdict: string } }[]) {
      console.log(`   ${icon[c.evaluation.status]} M${c.monthIndex} ${c.result.verdict} passo ${c.decision.calorieStep} · ${c.decision.previousTarget}→${c.decision.newTarget} kcal · bilancio ${c.decision.balancePct}%${c.evaluation.failures.length ? `\n       - ${c.evaluation.failures.join('\n       - ')}` : ''}`);
    }
  }
}
console.log('[Validatore]');
for (const v of validator) console.log(`   ${icon[v.status]} ${v.topic}${v.failures.length ? `\n       - ${v.failures.join('\n       - ')}` : ''}`);
console.log('[fitlab-9]');
for (const v of engine) console.log(`   ${icon[v.status]} ${v.id} ${v.topic}${v.failures.length ? `\n       - ${v.failures.join('\n       - ')}` : ''}`);
console.log(`\nTest ${counts.tests}: superati ${counts.passed} · falliti ${counts.failed} · valutazione professionale ${counts.professional} · non valutabili ${counts.not_evaluable}`);
console.log(`Piani generati: ${levels.BLOCKER} blocker · ${levels.WARNING} warning · ${levels.INFO} info`);
console.log(`→ ${path}`);
if (counts.failed > 0) process.exitCode = 1;
