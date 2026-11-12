import { WeekBarsChart, WeekRules, WeekTotalChart } from '@/components/energy-guide/weekly-guide-charts';
import type { GuidePage } from '@/components/energy-guide/energy-guide-carousel';
import { BAD_DAY_INDEX, RECOVERY_DAY_INDEX, WEEKDAY_NAMES, type WeeklyExample } from '@/lib/energy-guide/weekly-example';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';

/**
 * The four pages of "Il grafico della settimana": how the chart reads, why one
 * wrong day is not a problem, what the running total shows, and what to
 * remember. They all derive from the same example week (built on the person's
 * weekly goal), so swiping back and forth always lands on agreeing numbers.
 */
export function buildWeeklyPages(example: WeeklyExample): GuidePage[] {
  const bad = example.days[BAD_DAY_INDEX];
  const recovery = example.days[RECOVERY_DAY_INDEX];
  return [
    {
      id: 'week-chart',
      title: 'Il grafico della settimana',
      body: () =>
        `Ogni colonna è un giorno: calorie assunte meno calorie bruciate. Sotto la linea dello zero sei in deficit, sopra in surplus. La linea tratteggiata è l’obiettivo di un giorno: ${formatSignedKcal(example.dailyGoalKcal)} kcal.`,
      chart: (_day, play, compact) => <WeekBarsChart example={example} play={play} compact={compact} />,
    },
    {
      id: 'week-bad-day',
      title: 'Un giorno storto non rovina la settimana',
      body: () =>
        `${WEEKDAY_NAMES[BAD_DAY_INDEX]} è andato dalla parte opposta (${formatSignedKcal(bad)} kcal, ${example.oppositeWord}): succede. ${WEEKDAY_NAMES[RECOVERY_DAY_INDEX]} si riequilibra con ${formatSignedKcal(recovery)} kcal.`,
      chart: (_day, play, compact) => <WeekBarsChart example={example} play={play} compact={compact} highlight={[BAD_DAY_INDEX, RECOVERY_DAY_INDEX]} showSides={false} />,
    },
    {
      id: 'week-total',
      title: 'Conta il totale della settimana',
      body: () =>
        `L’obiettivo principale è quello della settimana: ${formatSignedKcal(example.weeklyGoalKcal)} kcal. Il totale si accumula giorno dopo giorno: un giorno storto lo fa scendere, i giorni dopo lo riportano su.`,
      skipBodyWhenCompact: true,
      chart: (_day, play, compact) => <WeekTotalChart example={example} play={play} compact={compact} />,
    },
    {
      id: 'week-rules',
      title: 'Cosa tenere a mente',
      body: () =>
        `Il tuo ${example.goalWord} della settimana è ${formatKcal(example.weeklyGoalKcal)} kcal. Se un giorno non rispetti il suo, l’importante è che lo rispetti la settimana.`,
      skipBodyWhenCompact: true,
      chart: (_day, play, compact) => <WeekRules example={example} play={play} compact={compact} />,
    },
  ];
}
