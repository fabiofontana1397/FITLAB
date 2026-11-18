/**
 * The six FitLab nutrition test users (regression cases): questionnaire, and for each month a hypothetical
 * outcome (weight trend, weigh-ins, logged intake) with the check-in answers. These inputs are FROZEN: the
 * engine's new decisions are always compared with these same inputs.
 *
 * `expect`, `verdict`, `step` and `review` record what the FIRST engine (fitlab-6) did and the issues found
 * in its review; the expectations of the adaptive engine live in nutrition-journey.ts (SPEC_EXPECTATIONS).
 */
import { FITLAB_FOODS } from '@/lib/planning/fitlab/foods';

export type Answers = Record<string, unknown>;
const id = (name: string) => {
  const f = FITLAB_FOODS.find((x) => x.name === name);
  if (!f) throw new Error(`Alimento non trovato: ${name}`);
  return f.id;
};
const ids = (...names: string[]) => names.map(id);

/** Risultato ipotetico di un mese. */
export type MonthOutcome = {
  /** Variazione reale di peso, kg a settimana. */
  weeklyKg: number;
  /** Pesate nel mese (default 10, una ogni 3 giorni). */
  weighIns?: number;
  /** Quota delle calorie del piano mangiate davvero (1 = come da piano). */
  eatenShare?: number;
  /** Giorni con pasti registrati (su 30). */
  trackedDays?: number;
  trainingCompletion?: number | null;
  /** Risposte al check-in, stessi id e valori di monthly-checkin-schema.ts. */
  checkin: Answers;
  /** Engine fitlab-6: what it was expected to do, in words. */
  expect: string;
  /** Engine fitlab-6: verdict (one of) and calorie step. */
  verdict: string[];
  step: number;
  /** Issue found in the review of fitlab-6. */
  review?: string;
};

export type TestUser = { id: string; name: string; summary: string; answers: Answers; months: MonthOutcome[] };

export const BASE: Answers = {
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
export const q = (o: Answers): Answers => ({ ...BASE, ...o });
export const ck = (adherence: number, energy: string, hunger: string, difficulty: string[] = ['none'], wantsChange: string[] = ['nothing'], notes = ''): Answers => ({
  checkinAdherence: adherence,
  checkinEnergyLevel: energy,
  checkinHungerLevel: hunger,
  checkinDifficulty: difficulty,
  checkinWantsChange: wantsChange,
  checkinNotes: notes,
});

export const USERS: TestUser[] = [
  {
    id: 'marco',
    name: 'Marco, 34 — dimagrimento',
    summary: 'Impiegato sedentario, 92 kg × 178 cm, obiettivo 82 kg. Palestra 3 volte, onnivoro, 3 pasti.',
    answers: q({
      age: 34,
      currentWeightKg: 92,
      targetWeightKg: 82,
      goal: 'loseFat',
      dailySteps: '3000-5000',
      gymExperience: 'never',
      gymSkillLevel: 'beginner',
      focus_gym: 'fatLoss',
      preferredProteins: ids('Petto di pollo', 'Petto di tacchino', 'Merluzzo', 'Uova intere', 'Yogurt greco 0%'),
      preferredCarbs: ids('Pasta', 'Riso basmati', 'Patate', "Fiocchi d'avena"),
      preferredVegetables: ids('Zucchine', 'Lattuga', 'Broccoli'),
    }),
    months: [
      { weeklyKg: -0.45, checkin: ck(4, 'normal', 'sometimes'), expect: 'In linea: calorie confermate, nuova rotazione dei piatti.', verdict: ['on_track'], step: 0 },
      {
        weeklyKg: -0.05,
        checkin: ck(4, 'normal', 'often', ['foodQuantity'], ['foodOptions']),
        expect: 'Peso fermo con buona aderenza: −150 kcal (stallo). La fame non attenua il taglio: il +50 vale solo se il passo non è negativo.',
        verdict: ['plateau'],
        step: -150,
        review: 'Fame "spesso" e poco cibo segnalati, eppure le calorie scendono di 150. Valuta se in stallo con fame frequente il taglio debba essere più piccolo.',
      },
      { weeklyKg: -0.45, checkin: ck(4, 'high', 'sometimes'), expect: 'Di nuovo in linea: calorie confermate.', verdict: ['on_track'], step: 0 },
      { weeklyKg: -1.1, checkin: ck(5, 'low', 'often', ['soreness']), expect: 'Troppo veloce (>1% del peso a settimana): +100 kcal, +50 per la fame.', verdict: ['too_fast'], step: 150 },
    ],
  },
  {
    id: 'giulia',
    name: 'Giulia, 27 — dimagrimento vegetariana',
    summary: 'Studentessa, 64 kg × 166 cm, obiettivo 58 kg. Vegetariana, 4 pasti con merenda, principiante.',
    answers: q({
      age: 27,
      sex: 'female',
      heightCm: 166,
      currentWeightKg: 64,
      targetWeightKg: 58,
      goal: 'loseFat',
      jobActivity: 'seatedMobile',
      dailySteps: '5000-8000',
      dietaryPattern: 'vegetarian',
      mealsSelected: ['colazione', 'pranzo', 'spuntinoPomeriggio', 'cena'],
      afternoonSnackTime: '17:00',
      gymExperience: 'never',
      gymSkillLevel: 'beginner',
      focus_gym: 'fatLoss',
      preferredProteins: ids('Uova intere', 'Ceci', 'Lenticchie', 'Yogurt greco 0%', 'Ricotta magra'),
      preferredCarbs: ids('Riso integrale', 'Pasta integrale', "Fiocchi d'avena"),
      preferredFruit: ids('Mela', 'Frutti di bosco'),
    }),
    months: [
      { weeklyKg: -0.12, checkin: ck(4, 'normal', 'sometimes'), expect: 'Troppo lento (sotto il 60% del previsto): −100 kcal.', verdict: ['too_slow'], step: -100 },
      {
        weeklyKg: 0.1,
        eatenShare: 1.25,
        checkin: ck(2, 'low', 'often', ['foodQuantity', 'mealTimes'], ['mealTimes']),
        expect: 'Bassa aderenza: calorie invariate, piatti nuovi.',
        verdict: ['low_adherence'],
        step: 0,
        review: 'Chiede di cambiare gli orari dei pasti e segnala difficoltà con orari e quantità: il motore non legge queste risposte, gli orari restano quelli del questionario.',
      },
      { weeklyKg: -0.35, checkin: ck(4, 'normal', 'always'), expect: 'In linea, ma fame sempre: +50 kcal.', verdict: ['on_track'], step: 50 },
    ],
  },
  {
    id: 'luca',
    name: 'Luca, 23 — massa muscolare',
    summary: 'Studente magro, 68 kg × 180 cm, obiettivo 75 kg. Esperto, 5 allenamenti, 5 pasti.',
    answers: q({
      age: 23,
      heightCm: 180,
      currentWeightKg: 68,
      targetWeightKg: 75,
      goal: 'gainMuscle',
      jobActivity: 'seatedMobile',
      dailySteps: '8000-12000',
      mealsSelected: ['colazione', 'spuntinoMattina', 'pranzo', 'spuntinoPomeriggio', 'cena'],
      morningSnackTime: '10:30',
      afternoonSnackTime: '17:00',
      freq_gym: '5',
      availableDays: '5',
      sessionDuration: '60-90',
      gymExperience: '3plusYears',
      gymSkillLevel: 'expert',
      preferredProteins: ids('Petto di pollo', 'Manzo magro', 'Uova intere', 'Yogurt greco 0%'),
      preferredCarbs: ids('Riso basmati', 'Pasta', "Fiocchi d'avena", 'Pane integrale'),
      preferredFats: ids('Mandorle', 'Burro di arachidi 100%'),
    }),
    months: [
      { weeklyKg: 0.2, checkin: ck(4, 'high', 'rarely'), expect: 'In linea: calorie confermate.', verdict: ['on_track'], step: 0 },
      {
        weeklyKg: 0.0,
        checkin: ck(4, 'normal', 'never', ['foodQuantity']),
        expect: 'Peso fermo in surplus: +150 kcal. "Fame mai" non toglie nulla perché il passo è positivo.',
        verdict: ['plateau', 'wrong_direction'],
        step: 150,
        review: 'Segnala che il cibo è già tanto (quantità) e riceve +150 kcal: corretto sui numeri, ma la difficoltà non viene considerata.',
      },
      { weeklyKg: 0.7, checkin: ck(5, 'veryHigh', 'never'), expect: 'Troppo veloce: −100 kcal, −50 perché non ha mai fame.', verdict: ['too_fast'], step: -150 },
      { weeklyKg: 0.2, checkin: ck(4, 'normal', 'sometimes'), expect: 'In linea: calorie confermate.', verdict: ['on_track'], step: 0 },
    ],
  },
  {
    id: 'elena',
    name: 'Elena, 41 — mantenimento, pescetariana, senza lattosio',
    summary: 'Insegnante, 60 kg × 165 cm, mantenimento. Pescetariana, intollerante al lattosio, 4 pasti, palestra 2 volte.',
    answers: q({
      age: 41,
      sex: 'female',
      heightCm: 165,
      currentWeightKg: 60,
      targetWeightKg: 60,
      goal: 'maintainImprove',
      dietaryPattern: 'pescetarian',
      allergiesIntolerances: 'Intollerante al lattosio',
      mealsSelected: ['colazione', 'spuntinoMattina', 'pranzo', 'cena'],
      morningSnackTime: '10:30',
      freq_gym: '2',
      availableDays: '2',
      preferredProteins: ids('Salmone', 'Merluzzo', 'Tonno al naturale', 'Uova intere'),
      preferredCarbs: ids('Riso basmati', 'Farro', 'Patate dolci'),
      preferredVegetables: ids('Spinaci', 'Carciofi', 'Peperoni'),
    }),
    months: [
      { weeklyKg: 0.05, checkin: ck(4, 'normal', 'rarely'), expect: 'Peso stabile: calorie confermate.', verdict: ['on_track'], step: 0 },
      {
        weeklyKg: 0.4,
        checkin: ck(3, 'normal', 'rarely', ['none'], ['foodOptions']),
        expect: 'Mantenimento ma +0,4 kg a settimana: −100 kcal.',
        verdict: ['too_fast'],
        step: -100,
        review: 'Chiede alimenti diversi: la rotazione dei piatti avviene sempre, ma la richiesta in sé non cambia nulla.',
      },
      { weeklyKg: -0.1, weighIns: 1, checkin: ck(4, 'normal', 'sometimes', ['none'], ['nothing'], 'Mi sono pesata solo una volta, ero in viaggio.'), expect: 'Una sola pesata: dati insufficienti, calorie invariate.', verdict: ['insufficient_data'], step: 0 },
    ],
  },
  {
    id: 'davide',
    name: 'Davide, 52 — solo dieta, niente uova',
    summary: 'Manager sedentario, 98 kg × 176 cm, obiettivo 88 kg. Solo piano alimentare (non si allena), non mangia uova, 3 pasti.',
    answers: q({
      mode: 'diet',
      age: 52,
      heightCm: 176,
      currentWeightKg: 98,
      targetWeightKg: 88,
      goal: 'loseFat',
      dailySteps: '3000-5000',
      sleepHoursRange: '6-7',
      excludedFoods: 'uova',
      activitiesPracticed: [],
      freq_gym: undefined,
      preferredProteins: ids('Petto di pollo', 'Bresaola', 'Merluzzo', 'Fagioli'),
      preferredCarbs: ids('Pasta', 'Pane integrale', 'Patate'),
    }),
    months: [
      {
        weeklyKg: 0.15,
        checkin: ck(3, 'normal', 'rarely', ['none'], ['nothing'], 'Due cene di lavoro a settimana.'),
        expect: 'Peso in salita con obiettivo dimagrimento: −150 kcal.',
        verdict: ['wrong_direction'],
        step: -150,
        review: 'Le note parlano di due cene di lavoro a settimana: il motore non legge le note e taglia le calorie del piano anche se il piano non è stato seguito.',
      },
      { weeklyKg: -0.15, checkin: ck(4, 'low', 'sometimes'), expect: 'Troppo lento: −100 kcal.', verdict: ['too_slow'], step: -100 },
      { weeklyKg: -0.4, checkin: ck(4, 'normal', 'sometimes'), expect: 'In linea: calorie confermate.', verdict: ['on_track'], step: 0 },
      { weeklyKg: -0.4, checkin: ck(5, 'normal', 'rarely'), expect: 'In linea: calorie confermate.', verdict: ['on_track'], step: 0 },
    ],
  },
  {
    id: 'sara',
    name: 'Sara, 19 — tonificazione, preferenze precise',
    summary: 'Studentessa, 55 kg × 163 cm, mantenimento. Palestra 3 volte, 4 pasti, ha scelto molti alimenti preferiti.',
    answers: q({
      age: 19,
      sex: 'female',
      heightCm: 163,
      currentWeightKg: 55,
      targetWeightKg: 55,
      goal: 'maintainImprove',
      mealsSelected: ['colazione', 'pranzo', 'spuntinoPomeriggio', 'cena'],
      afternoonSnackTime: '16:30',
      gymExperience: '3-12months',
      gymSkillLevel: 'beginner',
      preferredProteins: ids('Petto di tacchino', 'Salmone', 'Uova intere', 'Yogurt greco 0%', 'Ceci'),
      preferredCarbs: ids('Riso integrale', 'Pasta integrale', 'Patate dolci', "Fiocchi d'avena"),
      preferredFats: ids('Avocado', 'Noci'),
      preferredFruit: ids('Banana', 'Kiwi', 'Mirtilli'),
      preferredVegetables: ids('Zucchine', 'Spinaci', 'Broccoli'),
    }),
    months: [
      { weeklyKg: 0.0, checkin: ck(4, 'normal', 'sometimes'), expect: 'Stabile: calorie confermate.', verdict: ['on_track'], step: 0 },
      {
        weeklyKg: -0.2,
        trackedDays: 8,
        checkin: ck(2, 'veryLow', 'sometimes', ['mealTimes', 'trainingTime'], ['mealTimes', 'trainingDays'], 'Sessione d’esami.'),
        expect: 'Bassa aderenza: calorie invariate, piano più leggero.',
        verdict: ['low_adherence'],
        step: 0,
        review: 'Chiede orari dei pasti diversi: non vengono cambiati.',
      },
      { weeklyKg: -0.4, checkin: ck(4, 'low', 'often'), expect: 'Mantenimento ma −0,4 kg a settimana: +100 kcal, +50 per la fame frequente.', verdict: ['too_slow'], step: 150 },
    ],
  },
];
