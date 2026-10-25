import { EnergyGuideCarousel } from '@/components/energy-guide/energy-guide-carousel';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { goBackOr } from '@/lib/navigation/go-back';

/** "Come leggere il grafico": the calorie chart explained on a worked example (opened from Home). */
export default function EnergyGuideScreen() {
  return (
    <SheetScreen title="Il grafico delle calorie" scroll={false}>
      <EnergyGuideCarousel onDone={() => goBackOr('/')} />
    </SheetScreen>
  );
}
