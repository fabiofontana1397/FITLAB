/**
 * The worked example of the weekly guide: a week built on the person's own
 * weekly goal (so the numbers feel like theirs) in which one day goes the wrong
 * way and the next one makes up for it, ending exactly on the weekly goal.
 * Pure: the same goal always gives the same week. Never read from a store.
 */

/** A goal this small (kcal a day) has no direction to illustrate, so the example uses a plain deficit instead. */
const MIN_DAILY_GOAL_KCAL = 100;
const FALLBACK_DAILY_GOAL_KCAL = -500;

/** Each day as a multiple of the daily goal. They add up to 7, so the week lands on its goal; day 3 goes the other way, day 4 recovers. */
const DAY_SHARES = [1, 1, -0.5, 1.9, 1.2, 0.8, 1.6] as const;
export const BAD_DAY_INDEX = 2;
export const RECOVERY_DAY_INDEX = 3;
export const WEEKDAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'] as const;
export const WEEKDAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'] as const;

export type WeeklyExample = {
  /** Balance of each day (eaten − burned), kcal; negative = deficit. */
  days: number[];
  /** Running total after each day. */
  cumulative: number[];
  dailyGoalKcal: number;
  weeklyGoalKcal: number;
  /** 'deficit' or 'surplus': the direction the goal points. */
  goalWord: 'deficit' | 'surplus';
  /** The opposite word, for the day that goes the wrong way. */
  oppositeWord: 'deficit' | 'surplus';
};

const round10 = (n: number) => Math.round(n / 10) * 10;

export function buildWeeklyExample(weeklyGoalKcal: number): WeeklyExample {
  const rawDaily = weeklyGoalKcal / 7;
  const dailyGoalKcal = Math.abs(rawDaily) >= MIN_DAILY_GOAL_KCAL ? round10(rawDaily) : FALLBACK_DAILY_GOAL_KCAL;
  const goal = dailyGoalKcal * 7;
  const days = DAY_SHARES.map((share) => round10(dailyGoalKcal * share));
  // The last day absorbs the rounding, so the week ends exactly on the goal.
  days[days.length - 1] = goal - days.slice(0, -1).reduce((a, b) => a + b, 0);
  const cumulative = days.reduce<number[]>((acc, d) => [...acc, (acc[acc.length - 1] ?? 0) + d], []);
  const goalWord = dailyGoalKcal < 0 ? 'deficit' : 'surplus';
  return { days, cumulative, dailyGoalKcal, weeklyGoalKcal: goal, goalWord, oppositeWord: goalWord === 'deficit' ? 'surplus' : 'deficit' };
}
