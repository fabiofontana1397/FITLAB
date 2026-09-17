export type QuestionType = 'single' | 'multi' | 'scale' | 'number' | 'text' | 'longtext';

export type QuestionOption = { value: string; label: string };

/** Shows this question only when another question's answer matches `equals`
 * (array-includes for multi-select answers, strict equality otherwise). */
export type QuestionDependency = { questionId: string; equals: string };

export type Question = {
  id: string;
  type: QuestionType;
  label: string;
  helper?: string;
  options?: QuestionOption[];
  min?: number;
  max?: number;
  unit?: string;
  placeholder?: string;
  optional?: boolean;
  dependsOn?: QuestionDependency;
};

export type OnboardingStep = {
  id: string;
  title: string;
  subtitle?: string;
  banner?: string;
  questions: Question[];
};

/** Looks up a static question by id across the whole schema (used to render answer labels). */
export function findQuestion(id: string): Question | undefined {
  for (const step of ONBOARDING_STEPS) {
    const found = step.questions.find((q) => q.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Resolves a stored answer value to its human-readable option label. */
export function labelFor(question: Question | undefined, value: unknown): string | undefined {
  if (!question?.options || typeof value !== 'string') return undefined;
  return question.options.find((o) => o.value === value)?.label;
}

export function isQuestionVisible(question: Question, answers: Record<string, unknown>): boolean {
  if (!question.dependsOn) return true;
  const value = answers[question.dependsOn.questionId];
  if (Array.isArray(value)) return value.includes(question.dependsOn.equals);
  return value === question.dependsOn.equals;
}

/**
 * Options for question `activitiesPracticed`. Values are distinct (so
 * multi-select toggling works), but several map onto the app's core
 * `Sport` enum via ACTIVITY_TO_SPORT (see lib/mock/training.ts) so this
 * answer can double as the user's `sports` profile field.
 */
const ACTIVITY_OPTIONS: QuestionOption[] = [
  { value: 'gym', label: 'Pesi' },
  { value: 'running', label: 'Corsa' },
  { value: 'cycling', label: 'Ciclismo' },
  { value: 'swimming', label: 'Nuoto' },
  { value: 'tennis', label: 'Tennis/padel' },
  { value: 'functional', label: 'CrossFit / Functional' },
  { value: 'calcio', label: 'Calcio' },
  { value: 'artiMarziali', label: 'Arti marziali' },
  { value: 'camminata', label: 'Camminata' },
  { value: 'escursionismo', label: 'Escursionismo' },
  { value: 'altro', label: 'Altro' },
];

/** Maps `activitiesPracticed` answer values onto the app's Sport enum. */
export const ACTIVITY_TO_SPORT: Record<string, 'gym' | 'functional' | 'running' | 'swimming' | 'tennis' | 'cycling' | 'other'> = {
  gym: 'gym',
  running: 'running',
  cycling: 'cycling',
  swimming: 'swimming',
  tennis: 'tennis',
  functional: 'functional',
  calcio: 'other',
  artiMarziali: 'other',
  camminata: 'other',
  escursionismo: 'other',
  altro: 'other',
};

/**
 * Activities the app can actually build a training program for. Every other
 * selected activity is informational only — tracked for the calendar/weekly
 * schedule, not turned into a generated program — so only these get a
 * "what do you want to improve" follow-up (see buildActivityQuestions).
 */
export const TRAINABLE_ACTIVITIES = new Set(['gym', 'running']);

const FREQUENCY_OPTIONS: QuestionOption[] = [
  { value: '1', label: '1x a settimana' },
  { value: '2', label: '2x a settimana' },
  { value: '3', label: '3x a settimana' },
  { value: '4', label: '4x a settimana' },
  { value: '5', label: '5x a settimana' },
  { value: '6+', label: '6+ a settimana' },
];

const FOCUS_OPTIONS_BY_ACTIVITY: Record<string, QuestionOption[]> = {
  gym: [
    { value: 'strength', label: 'Forza' },
    { value: 'hypertrophy', label: 'Massa muscolare (ipertrofia)' },
    { value: 'fatLoss', label: 'Definizione / dimagrimento' },
    { value: 'muscularEndurance', label: 'Resistenza muscolare' },
    { value: 'technique', label: 'Tecnica' },
  ],
  running: [
    { value: 'endurance', label: 'Resistenza' },
    { value: 'speed', label: 'Velocità' },
    { value: 'raceTime', label: 'Migliorare i tempi' },
    { value: 'fatLoss', label: 'Dimagrimento' },
    { value: 'raceReady', label: 'Preparazione gara' },
  ],
};

/**
 * Builds the dynamic per-activity questions for the Training step: a
 * frequency question for every selected activity, plus (for gym/running
 * only — the two the app can generate a real program for) a "what do you
 * want to improve" question with sport-specific options. Everything else
 * (tennis, nuoto, ecc.) only gets the frequency question, purely so it can
 * be placed on the weekly calendar.
 */
export function buildActivityQuestions(activities: string[]): Question[] {
  const questions: Question[] = [];
  for (const activity of activities) {
    const label = ACTIVITY_OPTIONS.find((o) => o.value === activity)?.label ?? activity;
    questions.push({
      id: `freq_${activity}`,
      type: 'single',
      label: `Quante volte pratichi: ${label}?`,
      options: FREQUENCY_OPTIONS,
    });
    const focusOptions = FOCUS_OPTIONS_BY_ACTIVITY[activity];
    if (focusOptions) {
      questions.push({
        id: `focus_${activity}`,
        type: 'single',
        label: `Cosa vuoi migliorare con ${label}?`,
        options: focusOptions,
      });
    }
  }
  return questions;
}

export type OnboardingMode = 'diet' | 'training' | 'both';

const DIET_ONLY_STEP_IDS = new Set(['eatingHabits', 'preferences']);
const TRAINING_ONLY_STEP_IDS = new Set(['training', 'availability', 'limitations']);

/** Filters the full step list down to what a given diet/training/both choice should show. */
export function stepsForMode(mode: OnboardingMode): OnboardingStep[] {
  return ONBOARDING_STEPS.filter((step) => {
    if (DIET_ONLY_STEP_IDS.has(step.id)) return mode !== 'training';
    if (TRAINING_ONLY_STEP_IDS.has(step.id)) return mode !== 'diet';
    return true;
  });
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'physical',
    title: 'Profilo fisico',
    questions: [
      {
        id: 'ageRange',
        type: 'single',
        label: 'Età',
        options: [
          { value: 'lt18', label: 'Meno di 18' },
          { value: '18-24', label: '18–24' },
          { value: '25-34', label: '25–34' },
          { value: '35-44', label: '35–44' },
          { value: '45-54', label: '45–54' },
          { value: '55+', label: '55+' },
        ],
      },
      {
        id: 'sex',
        type: 'single',
        label: 'Sesso',
        options: [
          { value: 'male', label: 'Uomo' },
          { value: 'female', label: 'Donna' },
          { value: 'unspecified', label: 'Preferisco non specificarlo' },
        ],
      },
      { id: 'heightCm', type: 'number', label: 'Altezza', unit: 'cm' },
      { id: 'currentWeightKg', type: 'number', label: 'Peso attuale', unit: 'kg' },
      { id: 'targetWeightKg', type: 'number', label: 'Peso desiderato', unit: 'kg' },
      { id: 'neckCm', type: 'number', label: 'Collo', unit: 'cm', optional: true },
      { id: 'chestCm', type: 'number', label: 'Petto', unit: 'cm', optional: true },
      { id: 'waistCm', type: 'number', label: 'Girovita', unit: 'cm', optional: true },
      { id: 'hipsCm', type: 'number', label: 'Fianchi', unit: 'cm', optional: true },
      { id: 'armCm', type: 'number', label: 'Braccia (bicipite)', unit: 'cm', optional: true },
      { id: 'thighCm', type: 'number', label: 'Cosce', unit: 'cm', optional: true },
    ],
  },
  {
    id: 'goal',
    title: 'Obiettivo',
    subtitle: 'Cosa vuoi ottenere con FITLAB?',
    questions: [
      {
        id: 'goal',
        type: 'single',
        label: 'Qual è il tuo obiettivo principale?',
        options: [
          { value: 'loseFat', label: 'Perdere grasso' },
          { value: 'gainMuscle', label: 'Aumentare massa muscolare' },
          { value: 'maintainImprove', label: 'Mantenere il peso e migliorare la forma fisica' },
          { value: 'gainStrength', label: 'Aumentare forza' },
          { value: 'improveEndurance', label: 'Migliorare resistenza' },
          { value: 'generalHealth', label: 'Migliorare salute e benessere generale' },
        ],
      },
      {
        id: 'hasDeadline',
        type: 'single',
        label: 'Hai una scadenza o un evento specifico?',
        options: [
          { value: 'no', label: 'No' },
          { value: 'yes', label: 'Sì' },
        ],
      },
      { id: 'deadlineDate', type: 'text', label: 'Se sì, data', placeholder: 'gg/mm/aaaa', optional: true },
      { id: 'successWeightKg', type: 'number', label: 'Peso che consideri un successo', unit: 'kg', optional: true },
    ],
  },
  {
    id: 'daily',
    title: 'Attività quotidiana',
    questions: [
      {
        id: 'jobActivity',
        type: 'single',
        label: 'Che tipo di lavoro fai?',
        options: [
          { value: 'sedentary', label: 'Prevalentemente sedentario' },
          { value: 'seatedMobile', label: 'Seduto ma con frequenti spostamenti' },
          { value: 'standing', label: 'In piedi per gran parte della giornata' },
          { value: 'active', label: 'Lavoro fisicamente attivo' },
          { value: 'veryHeavy', label: 'Lavoro molto pesante/fisico' },
        ],
      },
      {
        id: 'dailySteps',
        type: 'single',
        label: 'Quanti passi fai mediamente al giorno?',
        options: [
          { value: 'lt3000', label: '<3.000' },
          { value: '3000-5000', label: '3.000–5.000' },
          { value: '5000-8000', label: '5.000–8.000' },
          { value: '8000-12000', label: '8.000–12.000' },
          { value: 'gt12000', label: '>12.000' },
          { value: 'unknown', label: 'Non lo so' },
        ],
      },
      {
        id: 'sleepHoursRange',
        type: 'single',
        label: 'Quanto dormi mediamente?',
        options: [
          { value: 'lt5', label: '<5 ore' },
          { value: '5-6', label: '5–6 ore' },
          { value: '6-7', label: '6–7 ore' },
          { value: '7-8', label: '7–8 ore' },
          { value: 'gt8', label: '>8 ore' },
        ],
      },
      { id: 'sleepQuality', type: 'scale', label: 'Come valuteresti la qualità del tuo sonno?', min: 1, max: 5 },
    ],
  },
  {
    id: 'eatingHabits',
    title: 'Alimentazione',
    questions: [
      {
        id: 'dietHistory',
        type: 'single',
        label: 'Hai seguito una dieta strutturata in passato?',
        options: [
          { value: 'never', label: 'Mai' },
          { value: 'occasionally', label: 'Sì, occasionalmente' },
          { value: 'months', label: 'Sì, per diversi mesi' },
          { value: 'years', label: 'Sì, per diversi anni' },
        ],
      },
      {
        id: 'mealsPerDay',
        type: 'single',
        label: 'Quanti pasti preferisci fare al giorno?',
        options: [
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
          { value: '5', label: '5' },
          { value: '6+', label: '6+' },
        ],
      },
      { id: 'breakfastTime', type: 'text', label: 'A che ora fai normalmente colazione?', placeholder: '07:30' },
      { id: 'lunchTime', type: 'text', label: 'A che ora pranzi?', placeholder: '13:00' },
      { id: 'dinnerTime', type: 'text', label: 'A che ora ceni?', placeholder: '20:00' },
      {
        id: 'snacks',
        type: 'single',
        label: 'Fai spuntini?',
        options: [
          { value: 'no', label: 'No' },
          { value: 'morning', label: 'Mattina' },
          { value: 'afternoon', label: 'Pomeriggio' },
          { value: 'evening', label: 'Sera' },
          { value: 'multiple', label: 'Più di uno' },
        ],
      },
      {
        id: 'eatingOut',
        type: 'single',
        label: 'Mangi normalmente fuori casa?',
        options: [
          { value: 'rarely', label: 'Quasi mai' },
          { value: '1-2week', label: '1–2 volte/settimana' },
          { value: '3-5week', label: '3–5 volte/settimana' },
          { value: 'daily', label: 'Quasi tutti i giorni' },
        ],
      },
    ],
  },
  {
    id: 'preferences',
    title: 'Preferenze alimentari',
    questions: [
      {
        id: 'dietaryPattern',
        type: 'single',
        label: "Segui un'alimentazione particolare?",
        options: [
          { value: 'none', label: 'Nessuna' },
          { value: 'vegetarian', label: 'Vegetariana' },
          { value: 'vegan', label: 'Vegana' },
          { value: 'pescetarian', label: 'Pescetariana' },
          { value: 'mediterranean', label: 'Mediterranea' },
          { value: 'lowCarb', label: 'Low carb' },
          { value: 'other', label: 'Altro' },
        ],
      },
      { id: 'dietaryPatternOther', type: 'text', label: 'Specifica', optional: true, dependsOn: { questionId: 'dietaryPattern', equals: 'other' } },
      { id: 'allergies', type: 'text', label: 'Hai allergie alimentari?', placeholder: 'No, oppure elenca quali', optional: true },
      { id: 'intolerances', type: 'text', label: 'Hai intolleranze o alimenti che digerisci male?', placeholder: 'No, oppure elenca quali', optional: true },
      { id: 'excludedFoods', type: 'longtext', label: 'Quali alimenti NON vuoi nella tua dieta?', optional: true },
      { id: 'includedFoods', type: 'longtext', label: 'Quali alimenti vuoi assolutamente includere?', optional: true },
      {
        id: 'preferredProteins',
        type: 'multi',
        label: 'Quali sono le tue fonti proteiche preferite?',
        options: [
          { value: 'chicken', label: 'Pollo' },
          { value: 'turkey', label: 'Tacchino' },
          { value: 'beef', label: 'Manzo' },
          { value: 'eggs', label: 'Uova' },
          { value: 'fish', label: 'Pesce' },
          { value: 'legumes', label: 'Legumi' },
          { value: 'dairy', label: 'Latticini' },
          { value: 'yogurt', label: 'Yogurt' },
          { value: 'proteinPowder', label: 'Proteine in polvere' },
          { value: 'tofu', label: 'Tofu/alternative vegetali' },
          { value: 'other', label: 'Altro' },
        ],
      },
      { id: 'preferredProteinsOther', type: 'text', label: 'Specifica', optional: true, dependsOn: { questionId: 'preferredProteins', equals: 'other' } },
      {
        id: 'preferredCarbs',
        type: 'multi',
        label: 'Quali carboidrati preferisci?',
        options: [
          { value: 'rice', label: 'Riso' },
          { value: 'pasta', label: 'Pasta' },
          { value: 'potatoes', label: 'Patate' },
          { value: 'bread', label: 'Pane' },
          { value: 'oats', label: 'Avena' },
          { value: 'cereals', label: 'Cereali' },
          { value: 'legumes', label: 'Legumi' },
          { value: 'fruit', label: 'Frutta' },
          { value: 'other', label: 'Altro' },
        ],
      },
      { id: 'preferredCarbsOther', type: 'text', label: 'Specifica', optional: true, dependsOn: { questionId: 'preferredCarbs', equals: 'other' } },
      {
        id: 'preferredFats',
        type: 'multi',
        label: 'Quali grassi preferisci?',
        options: [
          { value: 'oliveOil', label: 'Olio EVO' },
          { value: 'nuts', label: 'Frutta secca' },
          { value: 'avocado', label: 'Avocado' },
          { value: 'eggs', label: 'Uova' },
          { value: 'fattyFish', label: 'Pesce grasso' },
          { value: 'butter', label: 'Burro' },
          { value: 'other', label: 'Altro' },
        ],
      },
      { id: 'preferredFatsOther', type: 'text', label: 'Specifica', optional: true, dependsOn: { questionId: 'preferredFats', equals: 'other' } },
      {
        id: 'hungerLevel',
        type: 'single',
        label: 'Quanto spesso hai fame durante la giornata?',
        options: [
          { value: 'rarely', label: 'Quasi mai' },
          { value: 'little', label: 'Poco' },
          { value: 'moderate', label: 'Moderatamente' },
          { value: 'much', label: 'Molto' },
          { value: 'constant', label: 'Quasi continuamente' },
        ],
      },
      { id: 'cravings', type: 'scale', label: 'Hai spesso voglia di dolci/snack?', min: 1, max: 5 },
      {
        id: 'coffeeIntake',
        type: 'single',
        label: 'Quanto caffè bevi?',
        options: [
          { value: '0', label: 'Nessuno' },
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4+', label: '4+' },
        ],
      },
      {
        id: 'alcoholIntake',
        type: 'single',
        label: 'Consumi alcol?',
        options: [
          { value: 'never', label: 'Mai' },
          { value: 'occasionally', label: 'Occasionalmente' },
          { value: '1-2week', label: '1–2 volte/settimana' },
          { value: '3+week', label: '3+ volte/settimana' },
        ],
      },
      {
        id: 'supplements',
        type: 'multi',
        label: 'Integratori utilizzati',
        options: [
          { value: 'protein', label: 'Proteine' },
          { value: 'creatine', label: 'Creatina' },
          { value: 'omega3', label: 'Omega-3' },
          { value: 'vitaminD', label: 'Vitamina D' },
          { value: 'multivitamin', label: 'Multivitaminico' },
          { value: 'magnesium', label: 'Magnesio' },
          { value: 'electrolytes', label: 'Elettroliti' },
          { value: 'preworkout', label: 'Caffeina/pre-workout' },
          { value: 'none', label: 'Nessuno' },
          { value: 'other', label: 'Altro' },
        ],
      },
      { id: 'supplementsOther', type: 'text', label: 'Specifica', optional: true, dependsOn: { questionId: 'supplements', equals: 'other' } },
    ],
  },
  {
    id: 'training',
    title: 'Allenamento',
    subtitle: 'Programmi veri e propri li costruiamo solo per sala pesi e corsa: tutto il resto lo teniamo comunque in agenda.',
    questions: [{ id: 'activitiesPracticed', type: 'multi', label: 'Quali attività pratichi?', options: ACTIVITY_OPTIONS }],
  },
  {
    id: 'availability',
    title: 'Disponibilità',
    questions: [
      {
        id: 'availableDays',
        type: 'single',
        label: 'Quanti giorni alla settimana puoi allenarti realisticamente?',
        options: [
          { value: '1', label: '1' },
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
          { value: '5', label: '5' },
          { value: '6+', label: '6+' },
          { value: 'variable', label: 'Variabile' },
        ],
      },
      {
        id: 'sessionDuration',
        type: 'single',
        label: 'Quanto tempo hai per ogni allenamento?',
        options: [
          { value: 'lt30', label: '<30 min' },
          { value: '30-45', label: '30–45 min' },
          { value: '45-60', label: '45–60 min' },
          { value: '60-90', label: '60–90 min' },
          { value: 'gt90', label: '>90 min' },
        ],
      },
      {
        id: 'trainingLocation',
        type: 'single',
        label: 'Dove ti alleni principalmente?',
        options: [
          { value: 'gym', label: 'Palestra' },
          { value: 'home', label: 'Casa' },
          { value: 'outdoor', label: "All'aperto" },
          { value: 'mixed', label: 'Misto' },
        ],
      },
      {
        id: 'equipment',
        type: 'multi',
        label: 'Quale attrezzatura hai a casa?',
        dependsOn: { questionId: 'trainingLocation', equals: 'home' },
        options: [
          { value: 'none', label: 'Nessuna' },
          { value: 'dumbbells', label: 'Manubri' },
          { value: 'barbell', label: 'Bilanciere' },
          { value: 'rack', label: 'Rack' },
          { value: 'bench', label: 'Panca' },
          { value: 'machines', label: 'Macchine' },
          { value: 'cables', label: 'Cavi' },
          { value: 'kettlebell', label: 'Kettlebell' },
          { value: 'bands', label: 'Elastici' },
          { value: 'cardioMachine', label: 'Cardio machine' },
          { value: 'other', label: 'Altro' },
        ],
      },
    ],
  },
  {
    id: 'limitations',
    title: 'Limitazioni fisiche',
    banner:
      "Se segnali dolore, un infortunio o una condizione medica rilevante, evitiamo di generare esercizi potenzialmente rischiosi e ti consigliamo di confrontarti con un professionista sanitario.",
    questions: [
      {
        id: 'hasPain',
        type: 'single',
        label: 'Hai attualmente dolori o limitazioni che possono influenzare l’allenamento?',
        options: [
          { value: 'no', label: 'No' },
          { value: 'yes', label: 'Sì' },
        ],
      },
      { id: 'painDetails', type: 'longtext', label: 'Se sì, descrivi', optional: true },
      {
        id: 'cannotDoExercises',
        type: 'single',
        label: 'Ci sono esercizi che non puoi eseguire?',
        options: [
          { value: 'no', label: 'No' },
          { value: 'yes', label: 'Sì' },
        ],
      },
      { id: 'cannotDoDetails', type: 'longtext', label: 'Se sì, quali', optional: true },
      {
        id: 'recentInjuries',
        type: 'single',
        label: 'Hai avuto infortuni recenti che dovremmo considerare?',
        options: [
          { value: 'no', label: 'No' },
          { value: 'yes', label: 'Sì' },
        ],
      },
      { id: 'recentInjuriesDetails', type: 'longtext', label: 'Se sì, quali', optional: true },
    ],
  },
];
