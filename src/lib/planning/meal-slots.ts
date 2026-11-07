import { MEAL_WEIGHTS } from '@/lib/nutrition/meal-distribution';
import { TIME_REGEX } from '@/lib/questionnaire/schema';
import type { MealSlot } from '@/store/nutrition-store';

export type MealSlotDef = { id: MealSlot; label: string; time: string; sharePct: number };

const LABELS: Record<MealSlot, string> = {
  colazione: 'Colazione',
  spuntinoMattina: 'Spuntino mattina',
  pranzo: 'Pranzo',
  spuntinoPomeriggio: 'Spuntino pomeriggio',
  cena: 'Cena',
  spuntinoSera: 'Spuntino pre-nanna',
};

/** The order a day's meals are always shown in, whatever times the person typed: breakfast, lunch, the snack between lunch and dinner, dinner. */
export const MEAL_SLOT_ORDER: MealSlot[] = ['colazione', 'spuntinoMattina', 'pranzo', 'spuntinoPomeriggio', 'cena', 'spuntinoSera'];

/** A day's meals in `MEAL_SLOT_ORDER` (also straightens plans saved in time order). */
export function inMealOrder<T extends { slotId: string }>(meals: T[]): T[] {
  const rank = (id: string) => {
    const i = MEAL_SLOT_ORDER.indexOf(id as MealSlot);
    return i < 0 ? MEAL_SLOT_ORDER.length : i;
  };
  return [...meals].sort((a, b) => rank(a.slotId) - rank(b.slotId));
}

// Each slot's own time-answer id and fallback — questionnaire v2 asks for
// every slot's time directly (including the two-pre-nanna snack, no longer
// derived as "dinnerTime + 120min") instead of inferring times from
// mealsPerDay/snacks (schema.ts).
const TIME_ANSWER_ID: Record<MealSlot, string> = {
  colazione: 'breakfastTime',
  spuntinoMattina: 'morningSnackTime',
  pranzo: 'lunchTime',
  spuntinoPomeriggio: 'afternoonSnackTime',
  cena: 'dinnerTime',
  spuntinoSera: 'preSleepSnackTime',
};

const TIME_FALLBACK: Record<MealSlot, string> = {
  colazione: '07:30',
  spuntinoMattina: '10:30',
  pranzo: '13:00',
  spuntinoPomeriggio: '17:30',
  cena: '20:00',
  spuntinoSera: '22:30',
};

// A first-time/incomplete answer (old data, or a user who skipped the
// question) still needs a plan — these three core meals are the safest
// default rather than producing an empty day.
const DEFAULT_MEALS: MealSlot[] = ['colazione', 'pranzo', 'cena'];

function parseTime(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(TIME_REGEX);
  if (!match) return fallback;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/**
 * Builds the actual set of meal slots for this user directly from
 * `mealsSelected` (the questionnaire's direct "which meals do you eat"
 * multi-select, schema.ts) and each slot's own time answer, instead of
 * inferring both from a meal-count + snack-placement pair. Slot ids stay
 * within the 6 canonical values `meal_entries.slot`'s check constraint
 * allows (see supabase/migrations/0005_nutrition.sql) — this only decides
 * which of those 6 to use and at what time/share, never invents a new one.
 */
export function buildMealSlotsFromAnswers(answers: Record<string, unknown>): MealSlotDef[] {
  const selected = Array.isArray(answers.mealsSelected) ? (answers.mealsSelected as string[]) : [];
  const mealIds: MealSlot[] = (selected.length > 0 ? selected : DEFAULT_MEALS).filter(
    (id): id is MealSlot => id in LABELS
  );
  const uniqueMealIds = [...new Set(mealIds)];

  const slots = uniqueMealIds
    .map((id) => ({
      id,
      time: parseTime(answers[TIME_ANSWER_ID[id]], TIME_FALLBACK[id]),
      weight: MEAL_WEIGHTS[id],
    }))
    .sort((a, b) => MEAL_SLOT_ORDER.indexOf(a.id) - MEAL_SLOT_ORDER.indexOf(b.id));

  const totalWeight = slots.reduce((sum, s) => sum + s.weight, 0) || 1;
  return slots.map((s) => ({ id: s.id, label: LABELS[s.id], time: s.time, sharePct: s.weight / totalWeight }));
}
