import { addDaysISO, isoMondayIndex, startOfWeek } from '@/lib/mock/dates';
import type { BodyMetricSnapshot } from '@/lib/mock/types';
import type { LoggedActivity } from '@/lib/api/activity-log';
import type { DietPlan, TrainingPlan } from '@/lib/planning/types';
import { macrosForEntry, type MealFoodEntry } from '@/store/nutrition-store';
import { isExerciseCompleted, type CompletedExercise } from '@/store/training-progress-store';

export type WeeklySummary = {
  start: string;
  end: string;
  loggedMealDays: number;
  averageKcal: number | null;
  averageTargetKcal: number | null;
  completedSessions: number;
  plannedSessions: number;
  weightChangeKg: number | null;
  wins: string[];
  improve: string[];
  missed: string[];
};

/** Build a factual recap for the last complete Monday–Sunday week.
 * Missing logs are described as missing data, never as proof that the user
 * skipped a meal or session. */
export function buildWeeklySummary(input: {
  now?: Date;
  dietPlan: DietPlan | null;
  trainingPlan: TrainingPlan | null;
  calorieTarget: number;
  nutritionEntries: MealFoodEntry[];
  completedExercises: CompletedExercise[];
  activities: LoggedActivity[];
  bodyEntries: BodyMetricSnapshot[];
}): WeeklySummary {
  const monday = startOfWeek(input.now ?? new Date());
  const thisMonday = monday.toISOString().slice(0, 10);
  const start = addDaysISO(thisMonday, -7);
  const end = addDaysISO(start, 6);
  const dates = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));

  const monthForDate = <T extends { monthIndex: number }>(
    plan: { generatedAt: string; months: T[] } | null,
    date: string
  ): T | undefined => {
    if (!plan?.months.length) return undefined;
    const start = new Date(`${plan.generatedAt.slice(0, 10)}T00:00:00Z`).getTime();
    const current = new Date(`${date}T00:00:00Z`).getTime();
    const monthIndex = Math.max(1, Math.floor((current - start) / (30 * 86_400_000)) + 1);
    return plan.months.find((month) => month.monthIndex === monthIndex) ?? plan.months.at(-1);
  };
  let plannedSessions = 0;
  let completedSessions = 0;
  for (const date of dates) {
    const day = monthForDate(input.trainingPlan, date)?.weeklySplit[isoMondayIndex(date)];
    if (!day || day.type === 'rest') continue;
    plannedSessions++;
    if (day.type === 'cardio') {
      if (input.activities.some((activity) => activity.date === date)) completedSessions++;
    } else {
      const exercises = day.exercises ?? [];
      if (exercises.length > 0 && exercises.every((exercise) => isExerciseCompleted(input.completedExercises, exercise.id, date))) {
        completedSessions++;
      }
    }
  }

  const loggedByDate = new Map<string, MealFoodEntry[]>();
  for (const entry of input.nutritionEntries) {
    if (entry.date < start || entry.date > end) continue;
    loggedByDate.set(entry.date, [...(loggedByDate.get(entry.date) ?? []), entry]);
  }
  const loggedMealDays = loggedByDate.size;
  const kcalByDate = [...loggedByDate.entries()].map(([date, entries]) => ({
    date,
    kcal: entries.reduce((sum, entry) => sum + macrosForEntry(entry).kcal, 0),
    target: monthForDate(input.dietPlan, date)?.weeklySplit[isoMondayIndex(date)]?.calorieTarget ?? input.calorieTarget,
  }));
  const averageKcal = loggedMealDays >= 3 ? kcalByDate.reduce((sum, day) => sum + day.kcal, 0) / loggedMealDays : null;
  const averageTargetKcal = loggedMealDays >= 3 ? kcalByDate.reduce((sum, day) => sum + day.target, 0) / loggedMealDays : null;

  const weights = input.bodyEntries
    .filter((entry) => entry.weightKg > 0 && entry.date >= start && entry.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  const weightChangeKg = weights.length >= 2 ? weights[weights.length - 1].weightKg - weights[0].weightKg : null;

  const wins: string[] = [];
  const improve: string[] = [];
  const missed: string[] = [];
  if (plannedSessions > 0) {
    if (completedSessions === plannedSessions) wins.push(`Hai completato tutte le ${plannedSessions} sedute previste.`);
    else if (completedSessions > 0) wins.push(`Hai completato ${completedSessions} di ${plannedSessions} sedute previste.`);
    if (completedSessions < plannedSessions) {
      missed.push(`${plannedSessions - completedSessions} sedut${plannedSessions - completedSessions === 1 ? 'a non risulta registrata' : 'e non risultano registrate'}. Se ne hai svolte, segnala la sessione per rendere il prossimo riepilogo più preciso.`);
      improve.push('Scegli in anticipo i giorni realistici per allenarti e registra la seduta appena finita.');
    }
  }
  if (loggedMealDays >= 5) wins.push(`Hai registrato i pasti in ${loggedMealDays} giorni: il trend è abbastanza coperto.`);
  else if (loggedMealDays > 0) {
    missed.push(`I pasti risultano registrati in ${loggedMealDays} giorni su 7; per gli altri giorni non ci sono dati sufficienti per valutare il bilancio.`);
    improve.push('Registra i pasti anche nei giorni più pieni: bastano le voci principali per rendere utile il trend.');
  } else {
    missed.push('Questa settimana non risultano pasti registrati, quindi non posso valutare il bilancio calorico.');
    improve.push('Inizia da un solo pasto al giorno: la costanza dei dati conta più della precisione perfetta.');
  }
  if (averageKcal != null && averageTargetKcal != null) {
    const delta = Math.round(averageKcal - averageTargetKcal);
    if (Math.abs(delta) <= 150) wins.push('Nei giorni tracciati, la media è rimasta vicina al target.');
    else if (delta < 0) improve.push(`Nei giorni tracciati sei stato in media ${Math.abs(delta)} kcal sotto il target: valuta se il piano è sostenibile per fame ed energia.`);
    else improve.push(`Nei giorni tracciati sei stato in media ${delta} kcal sopra il target: controlla prima porzioni e registrazioni, senza compensare saltando pasti.`);
  }
  if (weightChangeKg != null) {
    const direction = weightChangeKg > 0 ? '+' : '';
    wins.push(`Tra le pesate registrate il peso è variato di ${direction}${weightChangeKg.toFixed(1)} kg.`);
  } else {
    improve.push('Con almeno due pesate nella settimana posso mostrarti anche la variazione di peso; guarda il trend, non il singolo giorno.');
  }
  if (wins.length === 0) wins.push('La settimana è un punto di partenza: appena registri qualche attività il riepilogo diventa più personale.');

  return { start, end, loggedMealDays, averageKcal, averageTargetKcal, completedSessions, plannedSessions, weightChangeKg, wins, improve, missed };
}
