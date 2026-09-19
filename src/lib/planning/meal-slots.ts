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

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
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
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

  const totalWeight = slots.reduce((sum, s) => sum + s.weight, 0) || 1;
  return slots.map((s) => ({ id: s.id, label: LABELS[s.id], time: s.time, sharePct: s.weight / totalWeight }));
}
