/**
 * How each existing question is *presented* — nothing here adds, removes or
 * re-words a question, and none of it is read by the planning engines.
 *
 * schema.ts stays the single source of truth for what is asked, in which
 * order, with which options and which validation. This file only answers
 * "which control does this question deserve on its own screen, and what
 * does it look like": a wheel for the age, a graduated ruler for height and
 * weight, cards with icons for the choices, a contextual visual for the
 * screens whose answer area leaves room for one.
 */
import type { IconName } from '@/components/ui/icon';
import { ACTIVITY_TO_SPORT, type Question } from '@/lib/questionnaire/schema';
import { sportIcon } from '@/lib/mock/training';

/** Virtual question id of the intro screen's "what do you want to build" choice. */
export const MODE_QUESTION_ID = 'mode';

export type QuestionInput =
  | { kind: 'cards' }
  | { kind: 'wheel'; fallback: number; step: number; suffix?: string }
  | { kind: 'ruler'; axis: 'vertical' | 'horizontal'; measure: 'length' | 'mass'; fallback: number; step: number }
  | { kind: 'time' }
  | { kind: 'slider' }
  | { kind: 'foodPicker' }
  | { kind: 'text' };

/**
 * The control a question gets. Driven by `question.type` with three
 * by-id refinements — age, height and weight are the three numbers worth a
 * purpose-built picker; every other `number` question falls back to the wheel.
 * `fallback` is only where an untouched picker is *parked*: it is shown
 * dimmed and is never written to the answers until the user actually moves
 * it (see NumberWheel/RulerPicker), so it can't pass for an answer.
 */
export function inputForQuestion(question: Question): QuestionInput {
  switch (question.id) {
    case 'age':
      return { kind: 'wheel', fallback: 30, step: 1, suffix: question.unit };
    case 'heightCm':
      return { kind: 'ruler', axis: 'vertical', measure: 'length', fallback: 175, step: 1 };
    case 'currentWeightKg':
    case 'targetWeightKg':
      return { kind: 'ruler', axis: 'horizontal', measure: 'mass', fallback: 75, step: 0.1 };
    default:
      break;
  }
  switch (question.type) {
    case 'single':
    case 'multi':
      return { kind: 'cards' };
    case 'number':
      return { kind: 'wheel', fallback: Math.round(((question.min ?? 0) + (question.max ?? 10)) / 2), step: 1, suffix: question.unit };
    case 'time':
      return { kind: 'time' };
    case 'scale':
      return { kind: 'slider' };
    case 'foodPicker':
      return { kind: 'foodPicker' };
    default:
      return { kind: 'text' };
  }
}

/**
 * Screen title. The schema's `label` is written to sit above a field in a
 * list ("Età", "Peso attuale"); on a screen of its own a question reads
 * better as a question, so a handful get a spoken-out title here. Anything
 * without an entry keeps its schema label verbatim.
 */
const SCREEN_TITLE: Record<string, string> = {
  age: 'Quanti anni hai?',
  sex: 'Qual è il tuo sesso?',
  heightCm: 'Qual è la tua altezza?',
  currentWeightKg: 'Qual è il tuo peso?',
  targetWeightKg: 'Qual è il tuo peso obiettivo?',
  mealsSelected: 'Quali pasti preferisci fare al giorno?',
};

/**
 * One line under the title. Same rule as the titles: presentation only —
 * each one restates why the question is asked, it never adds a new
 * question or promises a result. Questions that open a step whose own
 * subtitle already says this (goal, activitiesPracticed) are left out, so
 * the screen doesn't carry two subtitles saying the same thing.
 */
const SCREEN_SUBTITLE: Record<string, string> = {
  age: 'Serve a stimare il tuo metabolismo basale.',
  sex: 'Entra nel calcolo del fabbisogno energetico.',
  heightCm: 'Insieme al peso descrive il tuo punto di partenza.',
  currentWeightKg: 'Il tuo percorso parte da qui.',
  targetWeightKg: 'Puoi saltarla: senza un peso obiettivo il piano punta al mantenimento.',
  jobActivity: 'Quanto ti muovi fuori dall’allenamento conta quanto l’allenamento.',
  dailySteps: 'Una stima va benissimo, non serve essere precisi.',
  sleepHoursRange: 'Il recupero decide quanto puoi spingere.',
  mealsSelected: 'Il piano userà esattamente i pasti che scegli qui.',
  eatingOut: 'Ci aiuta a lasciare spazio ai pasti fuori casa.',
  dietaryPattern: 'Scegliamo gli alimenti di conseguenza.',
  availableDays: 'Meglio pochi giorni sostenibili che tanti sulla carta.',
  sessionDuration: 'La durata decide quanti esercizi entrano in una seduta.',
  trainingLocation: 'Determina gli attrezzi su cui costruiamo la scheda.',
};

export function screenTitle(question: Question): string {
  return SCREEN_TITLE[question.id] ?? question.label;
}

export function screenSubtitle(question: Question): string | undefined {
  return SCREEN_SUBTITLE[question.id] ?? question.helper;
}

/** Icons for the option cards, per question. Only where an icon really tells
 * the options apart — a list of frequencies or hour buckets reads better plain. */
const OPTION_ICONS: Record<string, Record<string, IconName>> = {
  mode: { diet: 'nutrition', training: 'training', both: 'sparkle' },
  goal: {
    loseFat: 'flame',
    gainMuscle: 'armFlex',
    maintainImprove: 'scale',
    gainStrength: 'barbell',
    improveEndurance: 'running',
    generalHealth: 'heart',
  },
  sex: { male: 'genderMale', female: 'genderFemale' },
  jobActivity: {
    sedentary: 'laptop',
    seatedMobile: 'walk',
    standing: 'standing',
    active: 'armFlex',
    veryHeavy: 'gym',
  },
  mealsSelected: {
    colazione: 'mealSun',
    spuntinoMattina: 'mealSnack',
    pranzo: 'mealMidday',
    spuntinoPomeriggio: 'mealSnack',
    cena: 'mealMoon',
    spuntinoSera: 'moon',
  },
  dietaryPattern: {
    none: 'utensils',
    vegetarian: 'leaf',
    vegan: 'sprout',
    pescetarian: 'fish',
    mediterranean: 'nutrition',
    lowCarb: 'carbs',
  },
  trainingLocation: { gym: 'gym', home: 'homeOutline', outdoor: 'tree', mixed: 'shuffle' },
};

export function optionIcon(questionId: string, optionValue: string): IconName | undefined {
  if (questionId === 'activitiesPracticed') {
    const sport = ACTIVITY_TO_SPORT[optionValue];
    return sport ? sportIcon[sport] : undefined;
  }
  return OPTION_ICONS[questionId]?.[optionValue];
}

/** One-liners under an option's label. Kept to the intro's three plans, the
 * only choice whose consequence isn't already in the label itself. */
const OPTION_DESCRIPTIONS: Record<string, Record<string, string>> = {
  mode: {
    diet: 'Calorie, macro e menu mese per mese',
    training: 'Scheda di allenamento con progressione',
    both: 'Dieta e allenamento costruiti insieme',
  },
};

export function optionDescription(questionId: string, optionValue: string): string | undefined {
  return OPTION_DESCRIPTIONS[questionId]?.[optionValue];
}

/**
 * The illustration at the top of a screen. Only for screens whose answer
 * area is a picker or a text field — a screen of option cards already has
 * an icon per card, and a second visual on top of those just eats the space
 * the cards need.
 */
const MEDIA_ICON: Record<string, IconName> = {
  age: 'calendar',
  heightCm: 'ruler',
  currentWeightKg: 'scale',
  targetWeightKg: 'target',
  breakfastTime: 'mealSun',
  morningSnackTime: 'mealSnack',
  lunchTime: 'mealMidday',
  afternoonSnackTime: 'mealSnack',
  dinnerTime: 'mealMoon',
  preSleepSnackTime: 'moon',
  allergiesIntolerances: 'alert',
  excludedFoods: 'close',
  includedFoods: 'checkCircle',
  usualBreakfast: 'mealSun',
  usualMorningSnack: 'mealSnack',
  usualLunch: 'mealMidday',
  usualAfternoonSnack: 'mealSnack',
  usualDinner: 'mealMoon',
  usualPreSleepSnack: 'moon',
  painDetails: 'alert',
  cannotDoDetails: 'alert',
  recentInjuriesDetails: 'alert',
};

export function mediaIcon(question: Question): IconName | undefined {
  return MEDIA_ICON[question.id];
}
