import type { CheckinSignals } from '@/domain/recalibration';

/** Maps the check-in questionnaire's stored answers onto the signals the engine reads. */
export function checkinSignals(answers: Record<string, unknown>): CheckinSignals {
  const asArray = (v: unknown) => (Array.isArray(v) ? (v as string[]) : undefined);
  const adherence = Number(answers.checkinAdherence);
  const days = Number(answers.checkinTrainingDays);
  const split = answers.checkinSplit;
  const areas = asArray(answers.checkinPainAreas)?.filter((a) => ['knee', 'shoulder', 'lowerBack', 'wrist', 'hip'].includes(a)) as CheckinSignals['painAreas'];
  return {
    adherence: Number.isFinite(adherence) && adherence > 0 ? adherence : undefined,
    energy: answers.checkinEnergyLevel as CheckinSignals['energy'],
    hunger: answers.checkinHungerLevel as CheckinSignals['hunger'],
    difficulty: asArray(answers.checkinDifficulty),
    wantsChange: asArray(answers.checkinWantsChange),
    newDays: Number.isFinite(days) && days >= 1 && days <= 6 ? days : undefined,
    split: split === 'fullBody' || split === 'upperLower' || split === 'pushPullLegs' ? split : undefined,
    painAreas: areas && areas.length ? areas : undefined,
    notes: typeof answers.checkinNotes === 'string' ? answers.checkinNotes : undefined,
  };
}
