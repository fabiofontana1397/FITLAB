/**
 * Calorie and macro targets, derived from the energy model and the PLANNED
 * training week — so the diet always follows what the training plan makes the
 * person burn:
 *
 *   target(day) = that day's expenditure (resting + everyday + its planned session)
 *                 + the goal's daily balance (deficit / surplus / 0)
 *                 + the current calibration adjustment
 *
 * So training days eat more by exactly what the session burns, and rest days
 * eat less, and EVERY day's balance (intake − expenditure) is the goal: the
 * gap Home shows for a day is always the same figure the plan was built on.
 * Only the safety floor can break that, on a rest day of a small, aggressive
 * plan (noted in `adjustments`).
 */
import { dayEnergy, weekEnergy, type SessionLike } from './energy';
import type { Goal, UserContext } from './user-context';

export const MIN_CALORIES = { female: 1200, male: 1500, unspecified: 1350 } as const;

export type GoalPace = {
  /** Planned body-weight change per week in kg (negative = loss). */
  weeklyKg: number;
  /** Daily calorie balance versus expenditure (negative = deficit). */
  dailyBalanceKcal: number;
  note?: string;
};

const KCAL_PER_KG = 7700;

/**
 * How fast the plan moves the body weight, and the daily balance that
 * implies. Single source of truth for plan duration AND calorie targets.
 * Rates are conservative sports-nutrition figures:
 *  - fat loss ≈ 0.7% of body weight per week, between 0.25 and 0.5 kg, never
 *    more than a 20% deficit;
 *  - muscle gain: a lean surplus of 8–14% of expenditure depending on
 *    experience (beginners gain faster);
 *  - strength: a small surplus; everything else: maintenance.
 * Under 18 there is never a deficit: growth comes first.
 */
export function goalPace(ctx: Pick<UserContext, 'goal' | 'weightKg' | 'isMinor' | 'training'>, averageExpenditure: number): GoalPace {
  const experience = ctx.training?.gym?.skill ?? 'beginner';
  switch (ctx.goal) {
    case 'loseFat': {
      if (ctx.isMinor) return { weeklyKg: 0, dailyBalanceKcal: 0, note: 'Sotto i 18 anni non si prevede un deficit: obiettivo di ricomposizione corporea a calorie di mantenimento.' };
      const weeklyKg = Math.min(0.5, Math.max(0.25, ctx.weightKg * 0.007));
      const deficit = Math.min((weeklyKg * KCAL_PER_KG) / 7, averageExpenditure * 0.2);
      return { weeklyKg: -(deficit * 7) / KCAL_PER_KG, dailyBalanceKcal: -Math.round(deficit) };
    }
    case 'gainMuscle': {
      const share = experience === 'expert' ? 0.08 : experience === 'intermediate' ? 0.1 : 0.12;
      const surplus = Math.min(Math.max(averageExpenditure * share, 150), 400);
      return { weeklyKg: (surplus * 7) / KCAL_PER_KG, dailyBalanceKcal: Math.round(surplus) };
    }
    case 'gainStrength': {
      const surplus = Math.min(Math.max(averageExpenditure * 0.05, 100), 250);
      return { weeklyKg: (surplus * 7) / KCAL_PER_KG, dailyBalanceKcal: Math.round(surplus) };
    }
    default:
      return { weeklyKg: 0, dailyBalanceKcal: 0 };
  }
}

/** Weeks the plan needs to reach the goal weight (null without a goal weight / pace). */
export function weeksToGoal(weightKg: number, targetWeightKg: number | null, pace: GoalPace): number | null {
  if (targetWeightKg == null || pace.weeklyKg === 0) return null;
  const delta = targetWeightKg - weightKg;
  if (delta * pace.weeklyKg <= 0) return null; // wrong side of the current weight
  return Math.abs(delta / pace.weeklyKg);
}

const PROTEIN_PER_KG: Record<Goal, number> = {
  loseFat: 2.0,
  gainMuscle: 1.9,
  gainStrength: 1.9,
  maintainImprove: 1.6,
  improveEndurance: 1.5,
  generalHealth: 1.4,
};

/** Weight protein is computed on: the real weight, capped at a healthy-BMI weight for people well above it. */
export function proteinReferenceKg(ctx: Pick<UserContext, 'weightKg' | 'heightCm' | 'targetWeightKg'>): number {
  const healthy = 25 * Math.pow(ctx.heightCm / 100, 2);
  return ctx.weightKg > healthy * 1.1 ? Math.max(healthy, ctx.targetWeightKg ?? 0) || healthy : ctx.weightKg;
}

export type Macros = { protein: number; carbs: number; fats: number };
export type DayTarget = { calories: number; macros: Macros; expenditure: number; exerciseKcal: number; isTrainingDay: boolean };

export type PlanTargets = {
  /** Average over the week — what profile, Home and the month header show. */
  calories: number;
  macros: Macros;
  hydrationMl: number;
  /** Resting + everyday + planned exercise, averaged over the week. */
  averageExpenditure: number;
  /** Planned training energy per week and per day on average. */
  weeklyExerciseKcal: number;
  pace: GoalPace;
  /** Seven days, Monday first. */
  perWeekday: DayTarget[];
  /** Notes when a safety floor, the deficit cap or a nutrient limit shaped the result. */
  adjustments: string[];
};

export function computeTargets(ctx: UserContext, week: (SessionLike | null | undefined)[] | null, calibration?: { calorieAdjustment: number }): PlanTargets {
  const energy = weekEnergy(ctx, week);
  const adjustments: string[] = [];
  const pace = goalPace(ctx, energy.averageTotal);
  if (pace.note) adjustments.push(pace.note);

  let average = energy.averageTotal + pace.dailyBalanceKcal + (calibration?.calorieAdjustment ?? 0);
  const floor = MIN_CALORIES[ctx.sex];
  if (average < floor) {
    adjustments.push(`Soglia minima di sicurezza (${floor} kcal): il deficit reale è inferiore a quello previsto.`);
    average = floor;
  }
  average = Math.round(average);

  // protein and fat stay constant across the week; carbs carry the day-to-day variation
  // protein by body weight, but never more than 30% of the calories (on a low-calorie plan that would crowd out carbs)
  const proteinG = Math.min(Math.round(PROTEIN_PER_KG[ctx.goal] * proteinReferenceKg(ctx)), Math.floor((average * 0.3) / 4));
  const fatKcalShare = ctx.answers.dietaryPattern === 'lowCarb' ? 0.4 : 0.3;
  const fatsG = Math.max(Math.round((average * fatKcalShare) / 9), Math.round(ctx.weightKg * 0.7));

  // Each day eats its own expenditure plus the goal's balance. On a small, aggressive plan a rest day can fall
  // under the safety floor: it stays at the floor, and what it could not cut comes off the days that have room,
  // so the week keeps its balance.
  const dailyBalance = pace.dailyBalanceKcal + (calibration?.calorieAdjustment ?? 0);
  const raw = energy.days.map((d) => d.total + dailyBalance);
  const eats = raw.map((x) => Math.max(Math.round(x), floor));
  const shortfall = eats.reduce((s, x, i) => s + (x - Math.round(raw[i])), 0);
  if (shortfall > 0) {
    const room = eats.map((x, i) => (raw[i] >= floor ? x - floor : 0));
    const totalRoom = room.reduce((s, x) => s + x, 0);
    const take = Math.min(shortfall, totalRoom);
    if (totalRoom > 0) eats.forEach((x, i) => { eats[i] = Math.round(x - (take * room[i]) / totalRoom); });
    adjustments.push(
      take < shortfall
        ? `Soglia minima di sicurezza (${floor} kcal): in alcuni giorni il bilancio è meno negativo dell'obiettivo.`
        : `Soglia minima di sicurezza (${floor} kcal) nei giorni di riposo: il bilancio dei giorni di allenamento è stato riequilibrato per mantenere l'obiettivo della settimana.`
    );
  }
  const perWeekday: DayTarget[] = energy.days.map((d, i) => {
    const isTrainingDay = (week?.[i]?.type ?? 'rest') !== 'rest';
    const calories = eats[i];
    const carbsG = Math.max(Math.round((calories - proteinG * 4 - fatsG * 9) / 4), 0);
    return { calories, macros: { protein: proteinG, carbs: carbsG, fats: fatsG }, expenditure: d.total, exerciseKcal: d.exercise, isTrainingDay };
  });

  const avgCarbs = Math.round(perWeekday.reduce((s, d) => s + d.macros.carbs, 0) / 7);
  const trainingDaysPerWeek = perWeekday.filter((d) => d.isTrainingDay).length;
  const hydrationMl = Math.round(ctx.weightKg * 35 + (trainingDaysPerWeek >= 4 ? 350 : 0));

  if (avgCarbs < 100) adjustments.push('Carboidrati bassi: con queste calorie e proteine ne restano poche (meno di 100 g).');

  return {
    calories: average,
    macros: { protein: proteinG, carbs: avgCarbs, fats: fatsG },
    hydrationMl,
    averageExpenditure: Math.round(energy.averageTotal),
    weeklyExerciseKcal: Math.round(energy.days.reduce((s, d) => s + d.exercise, 0)),
    pace,
    perWeekday,
    adjustments,
  };
}

/** Weekly energy balance Home shows as "obiettivo": planned intake minus planned expenditure. */
export function weeklyBalanceGoal(targets: PlanTargets): number {
  return Math.round(targets.perWeekday.reduce((s, d) => s + d.calories - d.expenditure, 0));
}

/** Plan length in months for the goal, derived from the same pace as the calorie target. */
export function planDurationMonths(ctx: UserContext, targets: PlanTargets): number {
  const weeks = weeksToGoal(ctx.weightKg, ctx.targetWeightKg, targets.pace);
  if (weeks == null) return 4;
  return Math.min(Math.max(Math.ceil(weeks / 4.345), 2), 12);
}

export { dayEnergy };
