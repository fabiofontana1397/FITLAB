import type { Question } from './schema';

/**
 * The monthly plan check-in (spec §0.4, punto 2) — a short questionnaire
 * shown at the end of each plan month, gating the unlock of the next one.
 * Explicitly a first-pass proposal (the user asked for an initial version
 * to refine later, not a finished design): six questions, short enough to
 * fill in under a minute, aimed at catching what a pure weight/adherence
 * trend can't see on its own — subjective hunger/energy, what got in the
 * way, what the user actually wants changed for next month.
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
      { value: 'trainingTime', label: 'Tempo per allenarti' },
      { value: 'soreness', label: 'Recupero/dolori muscolari' },
      { value: 'none', label: 'Nessuna difficoltà' },
    ],
  },
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
      { value: 'nothing', label: 'Niente, va bene così' },
    ],
  },
  { id: 'checkinNotes', type: 'longtext', optional: true, label: 'Altro da segnalare (infortuni, eventi, cambi di routine)?' },
];
