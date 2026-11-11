/**
 * The descriptive lines under the gauge on the carousel's last page. Pure
 * text from the example's reading, so it changes as soon as the values do.
 */
import type { DemoDay } from '@/lib/energy-guide/demo-example';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';

/** Which colour a line's bullet takes (mapped to theme colours by the view). */
export type ExplainTone = 'burned' | 'neutral' | 'goal' | 'surplus' | 'deficit';

/** The descriptive lines under the ring and bars, rewritten from the example's current reading. */
export function explain(day: DemoDay): { key: string; text: string; tone: ExplainTone }[] {
  const { reading, balanceKcal, goalKcal } = day;
  const kcal = formatKcal(balanceKcal);
  const side =
    reading.status === 'even'
      ? 'al centro: assunte e consumate si equivalgono'
      : reading.status === 'deficit'
        ? `a destra del centro: consumi ${kcal} kcal più di quante ne assumi`
        : `a sinistra del centro: assumi ${kcal} kcal più di quante ne consumi`;

  const toGoal = goalKcal - balanceKcal;
  const goal = formatSignedKcal(goalKcal);
  const goalText = reading.reached
    ? reading.goalKind === 'maintenance'
      ? 'La listarella ingrandita è nella zona verde: sei in linea con il mantenimento.'
      : `La listarella ingrandita è nella zona verde dell’obiettivo (${goal} kcal): obiettivo raggiunto.`
    : reading.towardGoal
      ? `La listarella si avvicina alla zona verde dell’obiettivo (${goal} kcal): mancano ${formatKcal(toGoal)} kcal.`
      : `La listarella è dal lato opposto alla zona verde dell’obiettivo (${goal} kcal): ti allontani.`;

  return [
    {
      key: 'ring',
      text: `Le listarelle sono il bilancio: a destra il deficit, a sinistra il surplus. Quella ingrandita è ${side}.`,
      tone: 'neutral',
    },
    { key: 'goal', text: goalText, tone: 'goal' },
    {
      key: 'bars',
      text: 'Sotto: arancione le assunte rispetto al piano; verde le bruciate, chiaro il metabolismo e scuro l’attività.',
      tone: 'burned',
    },
  ];
}
