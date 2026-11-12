import { acceptableRange, balanceHalfRange } from '@/domain/calorie-balance';

/**
 * What Home's "I tuoi progressi" card says: the length of the current run of
 * days with meals logged, how close the week's average balance is to the goal,
 * and which encouraging line fits the person's situation best. Pure — the
 * numbers come from the caller, nothing is read from a store.
 */

const MAX_STREAK_DAYS = 365;

/** ISO date `delta` days from `iso`, in local calendar terms. */
function shiftDay(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Days in a row with at least one meal logged, ending today — or yesterday while
 * today is still to be logged, so a streak is only broken once a day has really
 * gone by without a meal, never by an evening that has not come yet.
 */
export function trackingStreak(loggedDates: ReadonlySet<string>, today: string): number {
  let day = loggedDates.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (loggedDates.has(day) && streak < MAX_STREAK_DAYS) {
    streak++;
    day = shiftDay(day, -1);
  }
  return streak;
}

export type WeekAverageState = 'none' | 'onTrack' | 'close' | 'off';

/** How the week's average daily balance stands against the daily goal: within the acceptable range, within twice that, or further. */
export function weekAverageState(averageBalanceKcal: number, dailyGoalKcal: number, trackedDays: number): { state: WeekAverageState; closeness: number } {
  if (trackedDays <= 0) return { state: 'none', closeness: 0 };
  const off = Math.abs(averageBalanceKcal - dailyGoalKcal);
  const tolerance = acceptableRange(dailyGoalKcal);
  const closeness = Math.max(0, Math.min(1, 1 - off / balanceHalfRange(dailyGoalKcal)));
  return { state: off <= tolerance ? 'onTrack' : off <= tolerance * 2 ? 'close' : 'off', closeness };
}

export type MotivationKind = 'todayOnGoal' | 'streak' | 'weekOnTrack' | 'workoutsDone' | 'startStreak' | 'keepGoing';
export type Motivation = { kind: MotivationKind; title: string; text: string };

export type MotivationInput = {
  streakDays: number;
  /** Today has its meals logged. */
  todayTracked: boolean;
  /** Today's balance is inside the acceptable range around the day's goal. */
  todayOnGoal: boolean;
  weekAverage: WeekAverageState;
  workoutsDone: number;
  workoutsPlanned: number;
  goalWord: 'deficit' | 'surplus' | 'pareggio';
};

/**
 * One encouraging message, never a reproach: the most specific good news first
 * (today on goal, a tracking streak, a good week, workouts done), then an
 * invitation to start or keep going. Nothing here shames a missed day.
 */
export function pickMotivation(i: MotivationInput): Motivation {
  if (i.todayOnGoal && i.todayTracked) {
    return {
      kind: 'todayOnGoal',
      title: 'Oggi sei in linea con l’obiettivo',
      text: i.goalWord === 'pareggio' ? 'Il tuo bilancio di oggi è in equilibrio, come da piano.' : `Il tuo ${i.goalWord} di oggi è quello che serve al piano. Ottimo lavoro!`,
    };
  }
  if (i.streakDays >= 7) {
    return { kind: 'streak', title: `${i.streakDays} giorni di fila!`, text: 'Tracciare ogni giorno è diventato un’abitudine: è proprio questo che porta i risultati.' };
  }
  if (i.streakDays >= 3) {
    return { kind: 'streak', title: `${i.streakDays} giorni di fila!`, text: 'Stai tracciando con costanza: continua così, la serie è il tuo punto di forza.' };
  }
  if (i.streakDays === 2) {
    return { kind: 'streak', title: '2 giorni di fila', text: 'Ottimo inizio: se registri anche i pasti di domani sono 3.' };
  }
  if (i.weekAverage === 'onTrack') {
    return { kind: 'weekOnTrack', title: 'Settimana sulla buona strada', text: 'La media dei tuoi giorni è in linea con l’obiettivo settimanale: tieni questo ritmo.' };
  }
  if (i.workoutsPlanned > 0 && i.workoutsDone >= i.workoutsPlanned) {
    return { kind: 'workoutsDone', title: 'Allenamenti completati!', text: 'Hai fatto tutte le sessioni previste per questa settimana.' };
  }
  if (!i.todayTracked) {
    return { kind: 'startStreak', title: i.streakDays === 1 ? 'Ieri tracciato: continua oggi' : 'Inizia la tua serie', text: 'Registra i pasti di oggi: ogni giorno tracciato costruisce una serie.' };
  }
  return { kind: 'keepGoing', title: 'Ottimo, continua così', text: 'Ogni pasto registrato ti aiuta a restare sull’obiettivo della settimana.' };
}
