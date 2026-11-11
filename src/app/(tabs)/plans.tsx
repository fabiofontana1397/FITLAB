import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DietPlanHeroCard, TrainingPlanHeroCard } from '@/components/plans/plan-hero-card';
import { ScreenScroll } from '@/components/screen-scroll';
import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useEnsurePlan } from '@/hooks/use-ensure-plan';
import { Layout } from '@/constants/theme';
import { useIsSelectedTab } from '@/hooks/use-is-selected-tab';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { usePlanStore } from '@/store/plan-store';
import { useMonthlyCheckinStore } from '@/store/monthly-checkin-store';
import { useUserStore } from '@/store/user-store';

type PlanKind = 'training' | 'diet';

/** Piani: the training and the nutrition plan, one at a time behind a switch, each as a big card with its
 * months, the running month, its goal and the plan's goal. The card replays its entrance every time the page opens. */
export default function PlansScreen() {
  const goal = useUserStore((s) => s.goal);
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const completedMonths = useMonthlyCheckinStore((s) => s.completedMonths);
  const [kind, setKind] = useState<PlanKind>('training');

  useEnsurePlan('training');
  useEnsurePlan('diet');
  const shownDietPlan = dietPlan && dietPlan.months.length > 0 && dietPlan.months.every((m) => Array.isArray(m.weeklySplit)) ? dietPlan : null;

  // Each time the page becomes the selected tab again, the card is remounted so its bars, ring and numbers play anew.
  const selected = useIsSelectedTab();
  const [replay, setReplay] = useState(0);
  const wasSelected = useRef(selected);
  useEffect(() => {
    if (selected && !wasSelected.current) setReplay((n) => n + 1);
    wasSelected.current = selected;
  }, [selected]);

  const plan = kind === 'training' ? trainingPlan : shownDietPlan;
  // The month that just ended and has no check-in yet: the plan's "current" month is already the next one.
  const endedMonth = plan ? currentMonthIndex(plan) - 1 : 0;
  const checkinPendingMonth = endedMonth >= 1 && !completedMonths.includes(endedMonth) ? endedMonth : null;
  const cardKey = `${kind}-${replay}`;

  return (
    <ScreenScroll reveal header={<TabHeader title="Piani" />} contentContainerStyle={styles.page}>
      <View style={styles.switcher}>
        <SegmentedControl
          options={[
            { value: 'training', label: 'Allenamento' },
            { value: 'diet', label: 'Nutrizione' },
          ]}
          value={kind}
          onChange={(v) => setKind(v as PlanKind)}
        />
      </View>

      {kind === 'training' && trainingPlan ? (
        <TrainingPlanHeroCard
          key={cardKey}
          plan={trainingPlan}
          goal={goal}
          checkinPendingMonth={checkinPendingMonth}
          onPress={() => router.push('/training-plan')}
          onCheckin={() => router.push('/monthly-checkin')}
        />
      ) : kind === 'diet' && shownDietPlan ? (
        <DietPlanHeroCard
          key={cardKey}
          plan={shownDietPlan}
          goal={goal}
          checkinPendingMonth={checkinPendingMonth}
          onPress={() => router.push('/diet-plan')}
          onCheckin={() => router.push('/monthly-checkin')}
        />
      ) : (
        <FlatCard radius={28} style={styles.empty}>
          <ThemedText type="smallBold">{kind === 'training' ? 'Nessun programma di allenamento' : 'Nessun piano alimentare'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Il piano è in preparazione o non è previsto dalle tue risposte al questionario.
          </ThemedText>
        </FlatCard>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: Layout.screenGutter, gap: 0 },
  switcher: { marginTop: 16, marginBottom: 14 },
  empty: { padding: 20, gap: 6 },
});
