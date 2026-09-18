import { MEAL_WEIGHTS } from '@/lib/nutrition/meal-distribution';
import type { MealSlot } from '@/store/nutrition-store';

export type MealSlotDef = { id: MealSlot; label: string; time: string; sharePct: number };

const LABELS: Record<MealSlot, string> = {
  colazione: 'Colazione',
  spuntinoMattina: 'Spuntino mattina',
  pranzo: 'Pranzo',
  spuntinoPomeriggio: 'Spuntino pomeriggio',
  cena: 'Cena',
  spuntinoSera: 'Spuntino sera',
};

function parseTime(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return fallback;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function midpoint(a: string, b: string): string {
  return fromMinutes(Math.round((toMinutes(a) + toMinutes(b)) / 2));
}

/**
 * Builds the actual set of meal slots for this user from the questionnaire
 * (mealsPerDay, breakfastTime/lunchTime/dinnerTime, snacks) instead of the
 * same fixed 6-slot/fixed-times template for everyone. Slot ids stay
 * within the 6 canonical values `meal_entries.slot`'s check constraint
 * allows (see supabase/migrations/0005_nutrition.sql) — this only decides
 * which of those 6 to use and at what time/share, never invents a new one.
 */
export function buildMealSlotsFromAnswers(answers: Record<string, unknown>): MealSlotDef[] {
  const breakfastTime = parseTime(answers.breakfastTime, '07:30');
  const lunchTime = parseTime(answers.lunchTime, '13:00');
  const dinnerTime = parseTime(answers.dinnerTime, '20:00');
  const mealsPerDay = typeof answers.mealsPerDay === 'string' ? answers.mealsPerDay : '3';
  const snacksAnswer = typeof answers.snacks === 'string' ? answers.snacks : 'no';

  // "2 pasti" is almost always someone skipping breakfast (16:8-style),
  // not skipping lunch or dinner — so drop colazione, keep both anchors
  // that actually anchor the rest of the day.
  const includeBreakfast = mealsPerDay !== '2';

  const anchors: { id: MealSlot; time: string; weight: number }[] = [];
  if (includeBreakfast) anchors.push({ id: 'colazione', time: breakfastTime, weight: MEAL_WEIGHTS.colazione });
  anchors.push({ id: 'pranzo', time: lunchTime, weight: MEAL_WEIGHTS.pranzo });
  anchors.push({ id: 'cena', time: dinnerTime, weight: MEAL_WEIGHTS.cena });

  const snackIds: MealSlot[] =
    snacksAnswer === 'morning'
      ? ['spuntinoMattina']
      : snacksAnswer === 'afternoon'
        ? ['spuntinoPomeriggio']
        : snacksAnswer === 'evening'
          ? ['spuntinoSera']
          : snacksAnswer === 'multiple'
            ? ['spuntinoMattina', 'spuntinoPomeriggio']
            : [];

  // mealsPerDay is the user's own total-slot-count intent; snacks says
  // WHERE those extra slots go. When they disagree (e.g. "5 pasti" but
  // "no spuntini"), honor mealsPerDay for the count and fall back to a
  // sensible default placement rather than dropping their requested count.
  const wantedTotal = mealsPerDay === '6+' ? 6 : Number(mealsPerDay) || anchors.length + snackIds.length;
  let extra = wantedTotal - anchors.length;
  const fallbackOrder: MealSlot[] = ['spuntinoPomeriggio', 'spuntinoMattina', 'spuntinoSera'];
  const chosenSnacks: MealSlot[] = [...snackIds];
  for (const candidate of fallbackOrder) {
    if (chosenSnacks.length >= extra) break;
    if (!chosenSnacks.includes(candidate)) chosenSnacks.push(candidate);
  }
  const finalSnacks = extra > 0 ? chosenSnacks.slice(0, extra) : [];

  const snackTimes: Record<string, string> = {
    spuntinoMattina: midpoint(breakfastTime, lunchTime),
    spuntinoPomeriggio: midpoint(lunchTime, dinnerTime),
    spuntinoSera: fromMinutes(toMinutes(dinnerTime) + 120),
  };

  // Questionnaire Keep+Use (spec §11/§13 point 4): hungerLevel/cravings were
  // collected but never used. A user who reports frequent hunger/cravings
  // gets slightly larger snack slots relative to main meals — the total
  // calorie target is unchanged, this only redistributes it toward more
  // frequent smaller feedings, a standard strategy for high hunger.
  const hungerAnswer = typeof answers.hungerLevel === 'string' ? answers.hungerLevel : 'moderate';
  const cravingsScore = Number(answers.cravings) || 0;
  const snackWeightBoost = (hungerAnswer === 'much' || hungerAnswer === 'constant' ? 1.2 : 1) * (cravingsScore >= 4 ? 1.1 : 1);

  const slots = [
    ...anchors,
    ...finalSnacks.map((id) => ({ id, time: snackTimes[id], weight: MEAL_WEIGHTS[id] * snackWeightBoost })),
  ].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));

  const totalWeight = slots.reduce((sum, s) => sum + s.weight, 0);
  return slots.map((s) => ({ id: s.id, label: LABELS[s.id], time: s.time, sharePct: s.weight / totalWeight }));
}
