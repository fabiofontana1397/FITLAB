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
      ? 'quasi in cima, al centro: assunte e consumate si equivalgono'
      : reading.status === 'deficit'
        ? `a destra del centro: hai consumato ${kcal} kcal più di quante ne hai assunte`
        : `a sinistra del centro: hai assunto ${kcal} kcal più di quante ne hai consumate`;

  const toGoal = goalKcal - balanceKcal;
  const goalText = reading.reached
    ? reading.goalKind === 'maintenance'
      ? 'Il semicerchio in alto confronta il bilancio con l’obiettivo: sei in linea con il mantenimento.'
      : `Il semicerchio in alto confronta il bilancio con l’obiettivo di ${formatSignedKcal(goalKcal)} kcal: il marker ha raggiunto il triangolo dell’obiettivo, o l’ha superato.`
    : reading.towardGoal
      ? `Il semicerchio in alto confronta il bilancio con l’obiettivo di ${formatSignedKcal(goalKcal)} kcal: sei sulla strada giusta, mancano ${formatKcal(toGoal)} kcal al triangolo dell’obiettivo.`
      : `Il semicerchio in alto confronta il bilancio con l’obiettivo di ${formatSignedKcal(goalKcal)} kcal: il marker è dal lato opposto al triangolo dell’obiettivo, ti allontani dall’obiettivo.`;

  return [
    {
      key: 'arcs',
      text: `L’arco arancione sono le calorie consumate, quello verde le assunte: ognuno occupa la sua quota del totale. Il punto in cui si incontrano è ${side}.`,
      tone: 'burned',
    },
    { key: 'goal', text: goalText, tone: 'neutral' },
    {
      key: 'colour',
      text: reading.towardGoal
        ? 'Il colore del marker è verde quando vai verso l’obiettivo, più pieno quanto più ti avvicini.'
        : reading.balanceKcal > 0
          ? 'Il colore del marker diventa blu quando sei in surplus mentre l’obiettivo è un deficit.'
          : 'Il colore del marker diventa magenta quando sei in deficit mentre l’obiettivo è un surplus.',
      tone: reading.towardGoal ? 'goal' : reading.balanceKcal > 0 ? 'surplus' : 'deficit',
    },
  ];
}
