// Bump whenever a question is added/removed/renamed in a way that changes
// how a stored answers blob should be interpreted (spec §3.1/§11, Passo 8)
// — written alongside every answers upsert (see lib/api/onboarding.ts) so
// existing responses can always be traced back to the schema version that
// collected them.
export const QUESTIONNAIRE_VERSION = 2;

export type QuestionType = 'single' | 'multi' | 'scale' | 'number' | 'text' | 'longtext' | 'time';

// HH:MM, 00-23 hours — same format meal-slots.ts's parseTime() already
// expects. Exported so question-field.tsx and onboarding.tsx's isAnswered()
// validate against exactly one definition (spec §13 point 7: previously the
// UI accepted any text and the regex only lived in meal-slots.ts, silently
// discarding an unparseable time downstream instead of flagging it).
export const TIME_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;

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
  { value: 'gym', label: 'Palestra' },
  { value: 'functional', label: 'CrossFit-Functional' },
  { value: 'running', label: 'Corsa' },
  { value: 'cycling', label: 'Ciclismo' },
  { value: 'swimming', label: 'Nuoto' },
  { value: 'tennis', label: 'Tennis/padel' },
  { value: 'altro', label: 'Altro' },
];

/** Maps `activitiesPracticed` answer values onto the app's Sport enum. */
export const ACTIVITY_TO_SPORT: Record<string, 'gym' | 'functional' | 'running' | 'swimming' | 'tennis' | 'cycling' | 'other'> = {
  gym: 'gym',
  functional: 'functional',
  running: 'running',
  cycling: 'cycling',
  swimming: 'swimming',
  tennis: 'tennis',
  altro: 'other',
};

/**
 * Activities the app can actually build a training program for. Every other
 * selected activity is informational only — tracked for the calendar/weekly
 * schedule, not turned into a generated program — so only these get a
 * "what do you want to improve" follow-up (see buildActivityQuestions).
 */
export const TRAINABLE_ACTIVITIES = new Set(['gym', 'running']);

// "1x-6+ a settimana" cover a real weekly cadence the training planner can
// schedule; "biweekly"/"monthly" are below one session a week — collected
// for TDEE/context purposes (see deriveWeeklyTrainingDays) but not turned
// into a weekly training-planner slot (there's no "every other week" plan
// day in the generated program's model).
const FREQUENCY_OPTIONS: QuestionOption[] = [
  { value: '1', label: '1x a settimana' },
  { value: '2', label: '2x a settimana' },
  { value: '3', label: '3x a settimana' },
  { value: '4', label: '4x a settimana' },
  { value: '5', label: '5x a settimana' },
  { value: '6+', label: '6+ a settimana' },
  { value: 'biweekly', label: 'Una volta ogni 2 settimane' },
  { value: 'monthly', label: 'Una volta al mese' },
];

const GYM_EXPERIENCE_OPTIONS: QuestionOption[] = [
  { value: 'never', label: 'Mai praticata' },
  { value: '3-12months', label: '3-12 mesi' },
  { value: '1-3years', label: '1-3 anni' },
  { value: '3plusYears', label: '3+ anni' },
];

const GYM_SKILL_LEVEL_OPTIONS: QuestionOption[] = [
  { value: 'beginner', label: 'Principiante' },
  { value: 'intermediate', label: 'Intermedio' },
  { value: 'expert', label: 'Esperto' },
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
 * frequency question for every selected activity, gym-specific experience/
 * skill-level questions only for "gym", plus (for gym/running only — the
 * two the app can generate a real program for) a "what do you want to
 * improve" question with sport-specific options. Everything else (tennis,
 * nuoto, ecc.) only gets the frequency question, purely so it can be placed
 * on the weekly calendar.
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
    if (activity === 'gym') {
      questions.push({
        id: 'gymExperience',
        type: 'single',
        label: 'Da quanto tempo pratichi palestra?',
        options: GYM_EXPERIENCE_OPTIONS,
      });
      questions.push({
        id: 'gymSkillLevel',
        type: 'single',
        label: 'Come valuteresti la tua esperienza con i pesi?',
        options: GYM_SKILL_LEVEL_OPTIONS,
      });
    }
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

// The 6 meal-slot ids matching meal_entries.slot's check constraint (see
// supabase/migrations/0005_nutrition.sql) — `mealsSelected` lets the user
// pick these directly instead of the old mealsPerDay-count +
// snacks-which-slot pair. src/lib/planning/meal-slots.ts reads this answer
// directly to decide which slots the generated diet plan includes.
export const MEAL_SLOT_OPTIONS: QuestionOption[] = [
  { value: 'colazione', label: 'Colazione' },
  { value: 'spuntinoMattina', label: 'Spuntino mattina' },
  { value: 'pranzo', label: 'Pranzo' },
  { value: 'spuntinoPomeriggio', label: 'Spuntino pomeriggio' },
  { value: 'cena', label: 'Cena' },
  { value: 'spuntinoSera', label: 'Spuntino pre-nanna' },
];

const EATING_OUT_OPTIONS: QuestionOption[] = [
  { value: 'rarely', label: 'Quasi mai' },
  { value: '1', label: '1 volta a settimana' },
  { value: '2', label: '2 volte a settimana' },
  { value: '3', label: '3 volte a settimana' },
  { value: '4', label: '4 volte a settimana' },
  { value: '5', label: '5 volte a settimana' },
  { value: '6', label: '6 volte a settimana' },
  { value: 'gt6', label: 'Più di 6 volte a settimana' },
];

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'physical',
    title: 'Profilo fisico',
    questions: [
      { id: 'age', type: 'number', label: 'Età', unit: 'anni' },
      {
        id: 'sex',
        type: 'single',
        label: 'Sesso',
        options: [
          { value: 'male', label: 'Uomo' },
          { value: 'female', label: 'Donna' },
        ],
      },
      { id: 'heightCm', type: 'number', label: 'Altezza', unit: 'cm' },
      { id: 'currentWeightKg', type: 'number', label: 'Peso attuale', unit: 'kg' },
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
      { id: 'targetWeightKg', type: 'number', label: 'Peso obiettivo', unit: 'kg', optional: true },
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
        id: 'generalActivityLevel',
        type: 'single',
        label: 'Oltre il lavoro e gli allenamenti, quanto ti muovi mediamente durante la giornata?',
        options: [
          { value: 'mostlySeated', label: 'Quasi sempre seduto' },
          { value: 'occasional', label: 'Mi muovo occasionalmente' },
          { value: 'moderate', label: 'Mi muovo abbastanza' },
          { value: 'active', label: 'Molto attivo' },
          { value: 'veryActive', label: 'Molto attivo fisicamente' },
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
      { id: 'bedTime', type: 'time', label: 'A che ora vai generalmente a dormire?', placeholder: '23:00' },
      { id: 'wakeTime', type: 'time', label: 'A che ora ti svegli generalmente?', placeholder: '07:00' },
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
      { id: 'mealsSelected', type: 'multi', label: 'Quali pasti preferisci fare al giorno?', options: MEAL_SLOT_OPTIONS },
      { id: 'breakfastTime', type: 'time', label: 'A che ora fai normalmente colazione?', placeholder: '07:30' },
      {
        id: 'morningSnackTime',
        type: 'time',
        label: 'A che ora fai normalmente lo spuntino della mattina?',
        placeholder: '10:30',
        dependsOn: { questionId: 'mealsSelected', equals: 'spuntinoMattina' },
      },
      { id: 'lunchTime', type: 'time', label: 'A che ora pranzi?', placeholder: '13:00' },
      {
        id: 'afternoonSnackTime',
        type: 'time',
        label: 'A che ora fai normalmente lo spuntino del pomeriggio?',
        placeholder: '17:30',
        dependsOn: { questionId: 'mealsSelected', equals: 'spuntinoPomeriggio' },
      },
      { id: 'dinnerTime', type: 'time', label: 'A che ora ceni?', placeholder: '20:00' },
      {
        id: 'preSleepSnackTime',
        type: 'time',
        label: 'A che ora fai normalmente lo spuntino pre-nanna?',
        placeholder: '22:30',
        dependsOn: { questionId: 'mealsSelected', equals: 'spuntinoSera' },
      },
      { id: 'eatingOut', type: 'single', label: 'Quanti pasti consumi mediamente fuori casa ogni settimana?', options: EATING_OUT_OPTIONS },
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
      { id: 'allergiesIntolerances', type: 'text', label: 'Hai allergie alimentari, intolleranze o alimenti che digerisci male?', placeholder: 'No, oppure elenca quali', optional: true },
      { id: 'excludedFoods', type: 'longtext', label: 'Quali alimenti NON vuoi nella tua dieta?', optional: true },
      { id: 'includedFoods', type: 'longtext', label: 'Quali alimenti vuoi assolutamente includere?', optional: true },
      { id: 'usualBreakfast', type: 'text', label: 'Cosa mangi di solito a colazione?', optional: true },
      {
        id: 'usualMorningSnack',
        type: 'text',
        label: 'Cosa mangi di solito allo spuntino della mattina?',
        optional: true,
        dependsOn: { questionId: 'mealsSelected', equals: 'spuntinoMattina' },
      },
      { id: 'usualLunch', type: 'text', label: 'Cosa mangi di solito a pranzo?', optional: true },
      {
        id: 'usualAfternoonSnack',
        type: 'text',
        label: 'Cosa mangi di solito allo spuntino del pomeriggio?',
        optional: true,
        dependsOn: { questionId: 'mealsSelected', equals: 'spuntinoPomeriggio' },
      },
      { id: 'usualDinner', type: 'text', label: 'Cosa mangi di solito a cena?', optional: true },
      {
        id: 'usualPreSleepSnack',
        type: 'text',
        label: 'Cosa mangi di solito allo spuntino pre-nanna?',
        optional: true,
        dependsOn: { questionId: 'mealsSelected', equals: 'spuntinoSera' },
      },
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
