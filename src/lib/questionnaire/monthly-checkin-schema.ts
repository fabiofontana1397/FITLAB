import type { Question } from './schema';

/**
 * The monthly plan check-in (spec §0.4, punto 2) — a short questionnaire
 * shown at the end of each plan month, gating the unlock of the next one.
 * Explicitly a first-pass proposal (the user asked for an initial version
 * to refine later, not a finished design): six questions, short enough to
 * fill in under a minute, aimed at catching what a pure weight/adherence
 * trend can't see on its own — subjective hunger/energy, what got in the
 * way, what the user actually wants changed for next month.
 *
 * Every answer is read by the adaptive engine (domain/nutrition/monitoring.ts):
 * the optional questions refine the decision, and the follow-ups (portion
 * direction, preferred times, foods) appear only when the answer above them
 * makes them relevant.
 */
export const MONTHLY_CHECKIN_QUESTIONS: Question[] = [
  { id: 'checkinAdherence', type: 'scale', min: 1, max: 5, label: 'Quanto sei riuscito a seguire il piano questo mese?' },
  {
    id: 'checkinEnergyLevel',
    type: 'single',
    label: 'Come ti sei sentito a livello di energia durante il mese?',
    options: [
      { value: 'veryLow', label: 'Molto stanco' },
      { value: 'low', label: 'Stanco' },
      { value: 'normal', label: 'Normale' },
      { value: 'high', label: 'Energico' },
      { value: 'veryHigh', label: 'Molto energico' },
    ],
  },
  {
    id: 'checkinHungerLevel',
    type: 'single',
    label: 'Hai avuto fame durante la giornata?',
    options: [
      { value: 'never', label: 'Mai' },
      { value: 'rarely', label: 'Raramente' },
      { value: 'sometimes', label: 'A volte' },
      { value: 'often', label: 'Spesso' },
      { value: 'always', label: 'Sempre' },
    ],
  },
  {
    id: 'checkinDifficulty',
    type: 'multi',
    optional: true,
    label: 'Cosa ti ha creato più difficoltà questo mese?',
    options: [
      { value: 'mealTimes', label: 'Orari dei pasti' },
      { value: 'foodQuantity', label: 'Quantità di cibo' },
      { value: 'foodType', label: 'Tipo di alimenti proposti' },
      { value: 'preparation', label: 'Preparare i pasti' },
      { value: 'organization', label: 'Organizzazione della settimana' },
      { value: 'trainingTime', label: 'Tempo per allenarti' },
      { value: 'soreness', label: 'Recupero/dolori muscolari' },
      { value: 'pain', label: 'Dolore articolare o fastidio durante gli esercizi' },
      { value: 'none', label: 'Nessuna difficoltà' },
    ],
  },
  {
    id: 'checkinRecovery',
    type: 'single',
    optional: true,
    label: 'Come hai recuperato tra un allenamento e l’altro?',
    options: [
      { value: 'good', label: 'Bene, arrivavo fresco' },
      { value: 'ok', label: 'Abbastanza' },
      { value: 'poor', label: 'Male, ero spesso ancora stanco o indolenzito' },
    ],
  },
  {
    id: 'checkinSleep',
    type: 'single',
    optional: true,
    label: 'Come hai dormito questo mese?',
    options: [
      { value: 'good', label: 'Bene' },
      { value: 'ok', label: 'Così così' },
      { value: 'poor', label: 'Male' },
    ],
  },
  {
    id: 'checkinPainAreas',
    type: 'multi',
    label: 'Dove senti dolore?',
    helper: 'Dal prossimo mese la scheda non caricherà quella zona. Se il dolore persiste, fatti valutare da un medico o da un fisioterapista.',
    dependsOn: { questionId: 'checkinDifficulty', equals: 'pain' },
    options: [
      { value: 'shoulder', label: 'Spalla' },
      { value: 'knee', label: 'Ginocchio' },
      { value: 'lowerBack', label: 'Zona lombare' },
      { value: 'hip', label: 'Anca' },
      { value: 'wrist', label: 'Polso' },
    ],
  },
  {
    id: 'checkinQuantityDirection',
    type: 'single',
    optional: true,
    label: 'Le porzioni ti sono sembrate…',
    dependsOn: { questionId: 'checkinDifficulty', equals: 'foodQuantity' },
    options: [
      { value: 'tooMuch', label: 'Troppo abbondanti' },
      { value: 'tooLittle', label: 'Troppo scarse' },
      { value: 'mixed', label: 'Dipende dal pasto' },
    ],
  },
  {
    id: 'checkinSkippedMeals',
    type: 'single',
    optional: true,
    label: 'Quanti pasti del piano hai saltato in una settimana tipo?',
    options: [
      { value: 'none', label: 'Nessuno' },
      { value: '1-2', label: '1–2' },
      { value: '3-5', label: '3–5' },
      { value: 'gt5', label: 'Più di 5' },
    ],
  },
  {
    id: 'checkinEatingOut',
    type: 'single',
    optional: true,
    label: 'Quanti pasti a settimana hai mangiato fuori casa (lavoro, ristorante)?',
    options: [
      { value: '0', label: 'Nessuno' },
      { value: '1', label: '1' },
      { value: '2', label: '2' },
      { value: '3', label: '3 o più' },
    ],
  },
  {
    id: 'checkinActivityChange',
    type: 'single',
    optional: true,
    label: 'Rispetto al mese scorso, quanto ti sei mosso (passi, attività)?',
    options: [
      { value: 'less', label: 'Meno' },
      { value: 'same', label: 'Come prima' },
      { value: 'more', label: 'Di più' },
    ],
  },
  {
    id: 'checkinEvents',
    type: 'multi',
    optional: true,
    label: 'Nel mese c’è stato qualcosa che può aver influito sul peso?',
    options: [
      { value: 'travel', label: 'Viaggi' },
      { value: 'illness', label: 'Malattia' },
      { value: 'cycle', label: 'Ciclo o ritenzione' },
      { value: 'salty', label: 'Pasti molto salati o eventi' },
      { value: 'intenseTraining', label: 'Allenamenti molto intensi' },
      { value: 'stress', label: 'Stress, esami, lavoro intenso' },
      { value: 'none', label: 'Niente di particolare' },
    ],
  },
  { id: 'checkinWaistCm', type: 'number', optional: true, label: 'Circonferenza vita (se l’hai misurata)', unit: 'cm', min: 40, max: 200 },
  {
    id: 'checkinWantsChange',
    type: 'multi',
    optional: true,
    label: 'Cosa vorresti cambiare per il prossimo mese?',
    options: [
      { value: 'mealTimes', label: 'Orari dei pasti' },
      { value: 'foodOptions', label: 'Alimenti proposti' },
      { value: 'trainingIntensity', label: 'Intensità allenamento' },
      { value: 'trainingDays', label: 'Giorni di allenamento' },
      { value: 'trainingSplit', label: 'Struttura degli allenamenti' },
      { value: 'nothing', label: 'Niente, va bene così' },
    ],
  },
  {
    id: 'checkinTrainingDays',
    type: 'single',
    label: 'Quanti giorni a settimana potrai allenarti?',
    dependsOn: { questionId: 'checkinWantsChange', equals: 'trainingDays' },
    options: ['1', '2', '3', '4', '5', '6'].map((v) => ({ value: v, label: v })),
  },
  {
    id: 'checkinSplit',
    type: 'single',
    label: 'Come preferisci dividere gli allenamenti?',
    dependsOn: { questionId: 'checkinWantsChange', equals: 'trainingSplit' },
    options: [
      { value: 'fullBody', label: 'Full body (tutto il corpo in ogni seduta)' },
      { value: 'upperLower', label: 'Parte alta / parte bassa' },
      { value: 'pushPullLegs', label: 'Spinta / tirata / gambe' },
    ],
  },
  {
    id: 'checkinPreferredTimes',
    type: 'text',
    optional: true,
    label: 'A che ora ti è comodo mangiare?',
    placeholder: 'es. pranzo 14:00, cena 21:00',
    dependsOn: { questionId: 'checkinWantsChange', equals: 'mealTimes' },
  },
  {
    id: 'checkinFoodsToReplace',
    type: 'text',
    optional: true,
    label: 'Quali alimenti vorresti togliere dal piano?',
    placeholder: 'es. merluzzo, ceci',
    dependsOn: { questionId: 'checkinWantsChange', equals: 'foodOptions' },
  },
  {
    id: 'checkinFoodsWanted',
    type: 'text',
    optional: true,
    label: 'Quali alimenti vorresti trovare più spesso?',
    placeholder: 'es. salmone, patate dolci',
    dependsOn: { questionId: 'checkinWantsChange', equals: 'foodOptions' },
  },
  {
    id: 'checkinDietaryPattern',
    type: 'single',
    optional: true,
    label: 'Il tuo regime alimentare è cambiato?',
    helper: 'Cambia il piano solo se lo confermi qui: le preferenze da sole non modificano mai il regime.',
    options: [
      { value: 'keep', label: 'No, resta com’è' },
      { value: 'none', label: 'Mangio di tutto' },
      { value: 'pescetarian', label: 'Pescetariano' },
      { value: 'vegetarian', label: 'Vegetariano' },
      { value: 'vegan', label: 'Vegano' },
    ],
  },
  {
    id: 'checkinSpecialConditions',
    type: 'multi',
    optional: true,
    label: 'C’è una situazione che richiede attenzione particolare?',
    helper: 'In questi casi il piano non viene modificato in automatico: va rivisto con un professionista.',
    options: [
      { value: 'pregnancy', label: 'Gravidanza' },
      { value: 'breastfeeding', label: 'Allattamento' },
      { value: 'medical', label: 'Condizione medica o terapia in corso' },
      { value: 'eatingDisorder', label: 'Storia di disturbi del comportamento alimentare' },
      { value: 'none', label: 'Nessuna' },
    ],
  },
  { id: 'checkinNotes', type: 'longtext', optional: true, label: 'Altro da segnalare (infortuni, eventi, cambi di routine)?' },
];
