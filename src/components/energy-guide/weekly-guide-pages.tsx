import { View } from 'react-native';

import { WeekBarsChart, WeekTotalBar } from '@/components/energy-guide/weekly-guide-charts';
import type { GuidePage } from '@/components/energy-guide/energy-guide-carousel';
import { BAD_DAY_INDEX, WEEKDAY_NAMES, type WeeklyExample } from '@/lib/energy-guide/weekly-example';
import { formatSignedKcal } from '@/lib/format-kcal';

/**
 * The two pages of "Il grafico della settimana": how the chart reads — a week
 * where the days are all close to their share of the goal, adding up to the
 * weekly goal — and what happens when one day goes far off: nothing, because
 * the total of the week is what counts. Both weeks are built on the person's
 * own weekly goal and add up to it exactly.
 */
export function buildWeeklyPages(example: WeeklyExample): GuidePage[] {
  const bad = example.rough[BAD_DAY_INDEX];
  return [
    {
      id: 'week-chart',
      title: 'Come leggere il grafico',
      body: () =>
        `Ogni colonna è un giorno (calorie assunte meno bruciate): sopra lo zero è surplus, sotto è deficit. La linea tratteggiata è la quota di un giorno. Contano i 7 giorni insieme: il tuo obiettivo è ${formatSignedKcal(example.weeklyGoalKcal)} kcal a settimana.`,
      chart: (_day, play, compact) => (
        <View style={{ gap: 12 }}>
          <WeekBarsChart example={example} days={example.calm} play={play} compact={compact} />
          <WeekTotalBar days={example.calm} goalKcal={example.weeklyGoalKcal} play={play} compact={compact} />
        </View>
      ),
    },
    {
      id: 'week-bad-day',
      title: 'Se sgarri un giorno, non fa niente',
      body: () =>
        `${WEEKDAY_NAMES[BAD_DAY_INDEX]} è andato molto fuori obiettivo (${formatSignedKcal(bad)} kcal): non è un problema. Nei giorni dopo riequilibri un po’ alla volta, senza saltare i pasti, e la settimana arriva comunque al suo obiettivo.`,
      chart: (_day, play, compact) => (
        <View style={{ gap: 12 }}>
          <WeekBarsChart example={example} days={example.rough} play={play} compact={compact} showSides={false} />
          <WeekTotalBar days={example.rough} goalKcal={example.weeklyGoalKcal} play={play} compact={compact} />
        </View>
      ),
    },
  ];
}
