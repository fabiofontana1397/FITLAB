/**
 * The descriptive lines under the gauge on the carousel's last page. Pure
 * text from the example's reading, so it changes as soon as the values do.
 */
import type { DemoDay } from '@/lib/energy-guide/demo-example';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';

/** Which colour a line's bullet takes (mapped to theme colours by the view). */
export type ExplainTone = 'burned' | 'neutral' | 'goal' | 'surplus' | 'deficit';

/** The descriptive lines under the gauge, rewritten from the example's current reading. */
export function explain(day: DemoDay): { key: string; text: string; tone: ExplainTone }[] {
  const { reading, balanceKcal, goalKcal } = day;
  const kcal = formatKcal(balanceKcal);
  const side =
    reading.status === 'even'
      ? 'in cima, al centro: assunte e consumate si equivalgono'
      : reading.status === 'deficit'
        ? `a destra del centro: consumi ${kcal} kcal più di quante ne assumi`
        : `a sinistra del centro: assumi ${kcal} kcal più di quante ne consumi`;

  const toGoal = goalKcal - balanceKcal;
  const goal = formatSignedKcal(goalKcal);
  const goalText = reading.reached
    ? reading.goalKind === 'maintenance'
      ? 'Il triangolo è nella zona verde: sei in linea con il mantenimento.'
      : `Il triangolo è nella zona verde dell’obiettivo (${goal} kcal): obiettivo raggiunto.`
    : reading.towardGoal
      ? `Il triangolo si avvicina alla zona verde dell’obiettivo (${goal} kcal): mancano ${formatKcal(toGoal)} kcal.`
      : `Il triangolo è dal lato opposto alla zona verde dell’obiettivo (${goal} kcal): ti allontani.`;

  return [
    {
      key: 'arcs',
      text: `Arancione: consumate. Verde: assunte. Il pallino dove si incontrano è ${side}.`,
      tone: 'burned',
    },
    { key: 'goal', text: goalText, tone: 'goal' },
  ];
}
