/**
 * Admin test lab: rebuild diet and training with the engine that is running now, from any set of
 * questionnaire answers (a test persona, or a real account's saved answers), and measure the result.
 * The same numbers are computed on a plan saved earlier so the two can be compared side by side.
 */
import { buildPlans, type PlanBundle } from '@/domain/plan-engine';
import { buildUserContext } from '@/domain/user-context';
import type { DietMonthPlan, TrainingMonthPlan } from '@/lib/planning/types';

export type Answers = Record<string, unknown>;

export function generateFromAnswers(answers: Answers): PlanBundle {
  return buildPlans(buildUserContext(answers));
}

export type DietMonthStats = {
  month: number;
  kcalTarget: number;
  /** Average daily kcal actually delivered by the meals. */
  kcalAvg: number;
  /** Largest gap between a day's delivered kcal and that day's target, in %. */
  worstDayGapPct: number;
  /** Delivered protein over the month's protein target, in % (null when meals carry no macros). */
  proteinPct: number | null;
  /** Most times the same dish appears in one slot over the week (1 = no repeats). */
  maxRepeat: number;
  /** Distinct dishes over the week (meals that are not free). */
  distinctDishes: number;
};

export function dietStats(months: DietMonthPlan[]): DietMonthStats[] {
  return months.map((m, i) => {
    const gaps: number[] = [];
    const delivered: number[] = [];
    const protein: number[] = [];
    const bySlot = new Map<string, Map<string, number>>();
    const dishes = new Set<string>();
    for (const d of m.weeklySplit) {
      const meals = d.meals.filter((x) => !x.isFreeMeal);
      // the free meal carries its reference budget in totalKcal and counts towards the day's target
      const kcal = d.meals.reduce((s, x) => s + x.totalKcal, 0);
      delivered.push(kcal);
      const target = d.calorieTarget ?? m.calorieTarget;
      gaps.push(Math.abs(kcal - target) / target);
      if (meals.every((x) => x.macros)) protein.push(meals.reduce((s, x) => s + (x.macros?.protein ?? 0), 0));
      for (const meal of meals) {
        const key = meal.recipe?.name ?? meal.items.map((x) => x.name).join('+');
        dishes.add(key);
        const slot = bySlot.get(meal.slotId) ?? new Map<string, number>();
        slot.set(key, (slot.get(key) ?? 0) + 1);
        bySlot.set(meal.slotId, slot);
      }
    }
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    return {
      month: i + 1,
      kcalTarget: m.calorieTarget,
      kcalAvg: Math.round(avg(delivered)),
      worstDayGapPct: Math.round(Math.max(0, ...gaps) * 1000) / 10,
      proteinPct: protein.length ? Math.round((avg(protein) / m.macroTargetsG.protein) * 100) : null,
      maxRepeat: Math.max(1, ...[...bySlot.values()].flatMap((s) => [...s.values()])),
      distinctDishes: dishes.size,
    };
  });
}

export type TrainingMonthStats = { month: number; sessions: number; exercises: number; reviewFlags: number };

export function trainingStats(months: TrainingMonthPlan[]): TrainingMonthStats[] {
  return months.map((m, i) => {
    const days = m.weeklySplit.filter((d) => d.type !== 'rest');
    const exercises = days.flatMap((d) => d.exercises ?? []);
    return { month: i + 1, sessions: days.length, exercises: exercises.length, reviewFlags: exercises.filter((e) => e.needsManualReview).length };
  });
}
