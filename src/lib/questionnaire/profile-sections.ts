/**
 * How the questionnaire answers are grouped and summarized in Profilo. The
 * onboarding steps are written as questions ("Che tipo di lavoro fai?"); here
 * every answer gets a short label and a readable value, grouped by topic, and
 * each group knows which questions its "Modifica" sheet edits.
 */
import type { IconName } from '@/components/ui/icon';
import {
  buildActivityQuestions,
  findQuestion,
  MEAL_SLOT_OPTIONS,
  ONBOARDING_STEPS,
  stepsForMode,
  type OnboardingMode,
  type Question,
} from '@/lib/questionnaire/schema';
import { getStepQuestions } from '@/lib/questionnaire/step-questions';

export type ProfileGroupId = 'identity' | 'lifestyle' | 'meals' | 'foodPrefs' | 'habits' | 'training' | 'availability' | 'limitations';

export type ProfileGroup = {
  id: ProfileGroupId;
  title: string;
  icon: IconName;
  /** The onboarding steps whose questions this group edits. */
  stepIds: string[];
  /** Restricts the editable questions to these ids (all the steps' questions when omitted). */
  questionIds?: string[];
};

export const PROFILE_GROUPS: ProfileGroup[] = [
  { id: 'identity', title: 'Profilo e obiettivo', icon: 'target', stepIds: ['physical', 'goal'] },
  { id: 'lifestyle', title: 'Stile di vita', icon: 'footsteps', stepIds: ['daily'] },
  { id: 'meals', title: 'Pasti e orari', icon: 'clock', stepIds: ['eatingHabits'] },
  {
    id: 'foodPrefs',
    title: 'Preferenze alimentari',
    icon: 'nutrition',
    stepIds: ['preferences'],
    questionIds: ['dietaryPattern', 'allergiesIntolerances', 'excludedFoods', 'includedFoods', 'preferredProteins', 'preferredCarbs', 'preferredFats'],
  },
  {
    id: 'habits',
    title: 'Abitudini a tavola',
    icon: 'utensils',
    stepIds: ['preferences'],
    questionIds: ['usualBreakfast', 'usualMorningSnack', 'usualLunch', 'usualAfternoonSnack', 'usualDinner', 'usualPreSleepSnack', 'coffeeIntake', 'alcoholIntake'],
  },
  { id: 'training', title: 'Allenamento', icon: 'barbell', stepIds: ['training'] },
  { id: 'availability', title: 'Disponibilità', icon: 'calendar', stepIds: ['availability'] },
  { id: 'limitations', title: 'Salute e limitazioni', icon: 'heart', stepIds: ['limitations'] },
];

/** The groups shown below the identity card for a plan mode (diet-only people have no training groups, and vice versa). */
export function groupsForMode(mode: OnboardingMode): ProfileGroup[] {
  const stepIds = new Set(stepsForMode(mode).map((s) => s.id));
  return PROFILE_GROUPS.filter((g) => g.id !== 'identity' && g.stepIds.every((id) => stepIds.has(id)));
}

export function findGroup(id: ProfileGroupId): ProfileGroup {
  return PROFILE_GROUPS.find((g) => g.id === id)!;
}

/** The questions the group's edit sheet shows for these (draft) answers. */
export function groupQuestions(group: ProfileGroup, answers: Record<string, unknown>): Question[] {
  const questions = ONBOARDING_STEPS.filter((s) => group.stepIds.includes(s.id)).flatMap((s) => getStepQuestions(s, answers));
  return group.questionIds ? questions.filter((q) => group.questionIds!.includes(q.id)) : questions;
}

/** Every question the group could ever show, visible or not — the hidden ones get cleared on save so a stale answer (e.g. home equipment after switching to the gym) can't keep steering the plan. */
export function allGroupQuestions(group: ProfileGroup): Question[] {
  const questions = ONBOARDING_STEPS.filter((s) => group.stepIds.includes(s.id)).flatMap((s) =>
    s.id === 'training' ? [...s.questions, ...buildActivityQuestions(['gym', 'running'])] : s.questions
  );
  return group.questionIds ? questions.filter((q) => group.questionIds!.includes(q.id)) : questions;
}

const SHORT_LABEL: Record<string, string> = {
  age: 'Età',
  sex: 'Sesso',
  heightCm: 'Altezza',
  currentWeightKg: 'Peso iniziale',
  goal: 'Obiettivo',
  targetWeightKg: 'Peso obiettivo',
  jobActivity: 'Lavoro',
  dailySteps: 'Passi al giorno',
  sleepHoursRange: 'Sonno',
  eatingOut: 'Pasti fuori casa',
  dietaryPattern: 'Regime alimentare',
  allergiesIntolerances: 'Allergie e intolleranze',
  excludedFoods: 'Da escludere',
  includedFoods: 'Da includere sempre',
  preferredProteins: 'Proteine preferite',
  preferredCarbs: 'Carboidrati preferiti',
  preferredFats: 'Grassi preferiti',
  usualBreakfast: 'Colazione tipo',
  usualMorningSnack: 'Spuntino di metà mattina',
  usualLunch: 'Pranzo tipo',
  usualAfternoonSnack: 'Merenda tipo',
  usualDinner: 'Cena tipo',
  usualPreSleepSnack: 'Spuntino serale',
  coffeeIntake: 'Caffè al giorno',
  alcoholIntake: 'Alcol',
  activitiesPracticed: 'Attività',
  freq_gym: 'Frequenza palestra',
  freq_running: 'Frequenza corsa',
  gymExperience: 'Esperienza in palestra',
  gymSkillLevel: 'Livello con i pesi',
  gymSplitPreference: 'Struttura della scheda',
  focus_gym: 'Obiettivo in palestra',
  focus_running: 'Obiettivo nella corsa',
  availableDays: 'Giorni a settimana',
  sessionDuration: 'Durata sessione',
  trainingLocation: 'Dove ti alleni',
  equipment: 'Attrezzatura a casa',
  hasPain: 'Dolori o limitazioni',
  cannotDoExercises: 'Esercizi da evitare',
  recentInjuries: 'Infortuni recenti',
};

// Yes/no questions whose "Sì" is only meaningful with the details next to it: shown as one row.
const DETAIL_OF: Record<string, string> = { hasPain: 'painDetails', cannotDoExercises: 'cannotDoDetails', recentInjuries: 'recentInjuriesDetails' };
const DETAIL_IDS = new Set(Object.values(DETAIL_OF));

const MEAL_TIME_ID: Record<string, string> = {
  colazione: 'breakfastTime',
  spuntinoMattina: 'morningSnackTime',
  pranzo: 'lunchTime',
  spuntinoPomeriggio: 'afternoonSnackTime',
  cena: 'dinnerTime',
  spuntinoSera: 'preSleepSnackTime',
};
const MEAL_TIME_IDS = new Set(Object.values(MEAL_TIME_ID));

export type SummaryRow =
  | { kind: 'value'; id: string; label: string; value: string | null; alert?: boolean }
  | { kind: 'chips'; id: string; label: string; values: string[] }
  | { kind: 'text'; id: string; label: string; value: string | null };

export type MealSlotRow = { id: string; label: string; time: string | null };

function optionLabel(question: Question, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (question.options) return question.options.find((o) => o.value === value)?.label ?? String(value);
  if (question.type === 'number') return question.unit ? `${value} ${question.unit}` : String(value);
  return String(value).trim() || null;
}

const isYes = (v: unknown) => v === 'yes';

/** The readable rows of a group (identity is rendered by its own card). */
export function summaryRows(group: ProfileGroup, answers: Record<string, unknown>): SummaryRow[] {
  const rows: SummaryRow[] = [];
  for (const question of groupQuestions(group, answers)) {
    const { id } = question;
    if (DETAIL_IDS.has(id) || MEAL_TIME_IDS.has(id) || id === 'mealsSelected') continue;
    const label = SHORT_LABEL[id] ?? question.label;
    const value = answers[id];
    if (DETAIL_OF[id]) {
      const details = typeof answers[DETAIL_OF[id]] === 'string' ? (answers[DETAIL_OF[id]] as string).trim() : '';
      rows.push({ kind: 'value', id, label, value: isYes(value) ? details || 'Sì' : optionLabel(question, value), alert: isYes(value) });
    } else if (question.type === 'multi') {
      const values = Array.isArray(value) ? value.map((v) => question.options?.find((o) => o.value === v)?.label ?? String(v)) : [];
      rows.push({ kind: 'chips', id, label, values });
    } else if (question.type === 'text' || question.type === 'longtext') {
      rows.push({ kind: 'text', id, label, value: optionLabel(question, value) });
    } else {
      rows.push({ kind: 'value', id, label, value: optionLabel(question, value) });
    }
  }
  return rows;
}

/** The chosen meals in day order with their usual time — the "Pasti e orari" timeline. */
export function mealTimeline(answers: Record<string, unknown>): MealSlotRow[] {
  const selected = Array.isArray(answers.mealsSelected) ? (answers.mealsSelected as string[]) : [];
  return MEAL_SLOT_OPTIONS.filter((o) => selected.includes(o.value)).map((o) => {
    const time = answers[MEAL_TIME_ID[o.value]];
    return { id: o.value, label: o.label, time: typeof time === 'string' && time.trim() ? time.trim() : null };
  });
}

/** Short label + readable value of one answer (identity card). */
export function answerText(id: string, answers: Record<string, unknown>): string | null {
  const question = findQuestion(id) ?? buildActivityQuestions(['gym', 'running']).find((q) => q.id === id);
  return question ? optionLabel(question, answers[id]) : null;
}
