import { useMemo } from 'react';

import { EnergyGuideCarousel } from '@/components/energy-guide/energy-guide-carousel';
import { buildWeeklyPages } from '@/components/energy-guide/weekly-guide-pages';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { useWeeklyEnergy } from '@/hooks/use-weekly-energy';
import { buildWeeklyExample } from '@/lib/energy-guide/weekly-example';
import { goBackOr } from '@/lib/navigation/go-back';

/** "Il grafico della settimana": the weekly deficit/surplus chart explained on an example built on the person's own weekly goal (opened from Home's "Questa settimana"). */
export default function WeeklyGuideScreen() {
  const { weeklyGoalKcal } = useWeeklyEnergy();
  const pages = useMemo(() => buildWeeklyPages(buildWeeklyExample(weeklyGoalKcal)), [weeklyGoalKcal]);
  return (
    <SheetScreen title="Obiettivo settimanale" scroll={false}>
      <EnergyGuideCarousel onDone={() => goBackOr('/')} pages={pages} footnote="Giorni di esempio costruiti sul tuo obiettivo settimanale: non sono i tuoi dati." />
    </SheetScreen>
  );
}
