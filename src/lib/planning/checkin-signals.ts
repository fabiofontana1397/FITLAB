import type { CheckinSignals } from '@/domain/recalibration';

/** Maps the check-in questionnaire's stored answers onto the signals the engines (nutrition and training) read. */
export function checkinSignals(answers: Record<string, unknown>): CheckinSignals {
  const asArray = (v: unknown) => (Array.isArray(v) ? (v as string[]) : undefined);
  const asText = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const adherence = Number(answers.checkinAdherence);
  const eatingOut = Number(answers.checkinEatingOut);
  const waist = Number(answers.checkinWaistCm);
  const days = Number(answers.checkinTrainingDays);
  const split = answers.checkinSplit;
  const difficulty = asArray(answers.checkinDifficulty);
  const wantsChange = asArray(answers.checkinWantsChange);
  const areas = asArray(answers.checkinPainAreas)?.filter((a) => ['knee', 'shoulder', 'lowerBack', 'wrist', 'hip'].includes(a)) as CheckinSignals['painAreas'];
  const level = (v: unknown) => (v === 'good' || v === 'ok' || v === 'poor' ? v : undefined);
  return {
    adherence: Number.isFinite(adherence) && adherence > 0 ? adherence : undefined,
    energy: answers.checkinEnergyLevel as CheckinSignals['energy'],
    hunger: answers.checkinHungerLevel as CheckinSignals['hunger'],
    difficulty,
    wantsChange,
    // follow-up answers count only while the question they depend on still asks for them
    quantityDirection: difficulty?.includes('foodQuantity') ? (answers.checkinQuantityDirection as CheckinSignals['quantityDirection']) : undefined,
    skippedMeals: answers.checkinSkippedMeals as CheckinSignals['skippedMeals'],
    eatingOutPerWeek: answers.checkinEatingOut != null && Number.isFinite(eatingOut) ? eatingOut : undefined,
    activityChange: answers.checkinActivityChange as CheckinSignals['activityChange'],
    events: asArray(answers.checkinEvents)?.filter((e) => e !== 'none'),
    waistCm: Number.isFinite(waist) && waist > 0 ? waist : undefined,
    preferredTimes: wantsChange?.includes('mealTimes') ? asText(answers.checkinPreferredTimes) : undefined,
    foodsToReplace: wantsChange?.includes('foodOptions') ? asText(answers.checkinFoodsToReplace) : undefined,
    foodsWanted: wantsChange?.includes('foodOptions') ? asText(answers.checkinFoodsWanted) : undefined,
    specialConditions: asArray(answers.checkinSpecialConditions)?.filter((e) => e !== 'none'),
    dietaryPatternChange: answers.checkinDietaryPattern && answers.checkinDietaryPattern !== 'keep' ? String(answers.checkinDietaryPattern) : undefined,
    notes: asText(answers.checkinNotes),
    // training
    newDays: Number.isFinite(days) && days >= 1 && days <= 6 ? days : undefined,
    split: split === 'fullBody' || split === 'upperLower' || split === 'pushPullLegs' ? split : undefined,
    painAreas: areas && areas.length ? areas : undefined,
    recovery: level(answers.checkinRecovery),
    sleep: level(answers.checkinSleep),
  };
}
