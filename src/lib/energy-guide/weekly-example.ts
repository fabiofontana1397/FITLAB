/**
 * The worked example of the weekly guide, built on the person's own weekly goal.
 * Two weeks that both add up to exactly that goal:
 *  - a calm one, where every day lands close to the daily share of the goal;
 *  - a rough one, where one day goes far the wrong way and the days after it
 *    share the recovery evenly, so the week still ends on its goal.
 * Pure: the same goal always gives the same weeks. Never read from a store.
 */

/** A goal this small (kcal a day) has no direction to illustrate, so the example uses a plain deficit instead. */
const MIN_DAILY_GOAL_KCAL = 100;
const FALLBACK_WEEKLY_GOAL_KCAL = -3500;

/** Each day as a multiple of the daily goal. Both sets add up to 7, so a week lands on its goal. */
const CALM_SHARES = [1.05, 0.95, 1.1, 0.9, 1, 1.05, 0.95] as const;
/** Day 3 goes the other way (by one and a half daily goals); the four days after it make it up equally. */
export const BAD_DAY_INDEX = 2;
const BAD_DAY_SHARE = -1.5;
const FIRST_DAYS_SHARES = [1.05, 0.95] as const;

export const WEEKDAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'] as const;
export const WEEKDAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'] as const;

export type WeeklyExample = {
  /** A week where every day is close to its share of the goal (kcal per day, eaten − burned). */
  calm: number[];
  /** A week with one day far off and the recovery spread over the days after it. */
  rough: number[];
  dailyGoalKcal: number;
  /** The person's weekly goal (rounded to 10 kcal) — what both example weeks add up to, exactly. */
  weeklyGoalKcal: number;
  /** 'deficit' or 'surplus': the direction the goal points. */
  goalWord: 'deficit' | 'surplus';
  /** The opposite word, for the day that goes the wrong way. */
  oppositeWord: 'deficit' | 'surplus';
};

const round10 = (n: number) => Math.round(n / 10) * 10;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Days from shares of the daily goal; the last day absorbs the rounding so the week adds up to `weekly` exactly. */
function week(weekly: number, shares: readonly number[]): number[] {
  const daily = weekly / 7;
  const days = shares.map((s) => round10(daily * s));
  days[days.length - 1] = weekly - sum(days.slice(0, -1));
  return days;
}

export function buildWeeklyExample(weeklyGoalKcal: number): WeeklyExample {
  const weekly = Math.abs(weeklyGoalKcal / 7) >= MIN_DAILY_GOAL_KCAL ? round10(weeklyGoalKcal) : FALLBACK_WEEKLY_GOAL_KCAL;
  const dailyGoalKcal = round10(weekly / 7);
  const recoveryDays = 7 - BAD_DAY_INDEX - 1;
  const recoveryShare = (7 - sum([...FIRST_DAYS_SHARES]) - BAD_DAY_SHARE) / recoveryDays;
  const roughShares = [...FIRST_DAYS_SHARES, BAD_DAY_SHARE, ...Array.from({ length: recoveryDays }, () => recoveryShare)];
  const goalWord = weekly < 0 ? 'deficit' : 'surplus';
  return {
    calm: week(weekly, CALM_SHARES),
    rough: week(weekly, roughShares),
    dailyGoalKcal,
    weeklyGoalKcal: weekly,
    goalWord,
    oppositeWord: goalWord === 'deficit' ? 'surplus' : 'deficit',
  };
}
