import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DietPlanView, TrainingPlanView } from '@/components/plans/plan-kinds';
import { NutritionSupervisionCard } from '@/components/plans/nutrition-supervision-card';
import { TargetsPlanView } from '@/components/plans/targets-plan-view';
import { CreatePlanPopup, PlanSourceBanner, usePlanNeverRequested } from '@/components/plans/plan-source-banner';
import { ScreenScroll } from '@/components/screen-scroll';
import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useEnsurePlan } from '@/hooks/use-ensure-plan';
import { Layout } from '@/constants/theme';
import { supervisionReasons } from '@/domain/nutrition/safety';
import { buildUserContext } from '@/domain/user-context';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useIsSelectedTab } from '@/hooks/use-is-selected-tab';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { isTargetsPlan } from '@/lib/planning/targets-plan';
import { usePlanStore } from '@/store/plan-store';
import { useMonthlyCheckinStore } from '@/store/monthly-checkin-store';
import { useUserStore } from '@/store/user-store';

type PlanKind = 'training' | 'diet';

/** Piani: the training and the nutrition plan, one at a time behind a switch. Under the switch, a line to load a card or
 * diet the person already has, build their own, or go back to FitLab's plan. Each plan opens with a small box for the macro
 * plan (name, progress, month selector, the chosen month), then the week of workouts or meals, and the check-in.
 * The page replays its entrance every time it opens. */
export default function PlansScreen() {
  const goal = useUserStore((s) => s.goal);
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const completedMonths = useMonthlyCheckinStore((s) => s.completedMonths);
  const [kind, setKind] = useState<PlanKind>('training');

  useEnsurePlan('training');
  useEnsurePlan('diet');
  const neverRequested = usePlanNeverRequested(kind);
  const [createOpen, setCreateOpen] = useState(false);
  const answers = useOnboardingStore((s) => s.answers);
  // safety engine: a frozen plan, or a questionnaire condition that needs a professional, replaces the plan view
  const questionnaireSupervision = Object.keys(answers).length > 0 ? supervisionReasons(buildUserContext(answers)) : [];
  const supervision = dietPlan?.supervision ? { reasons: dietPlan.supervision.reasons, frozen: true } : questionnaireSupervision.length > 0 ? { reasons: questionnaireSupervision, frozen: false } : null;
  const shownDietPlan = !supervision && dietPlan && dietPlan.months.length > 0 && dietPlan.months.every((m) => Array.isArray(m.weeklySplit)) ? dietPlan : null;

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
    <ScreenScroll
      contentContainerStyle={styles.page}
      header={
        <>
          <TabHeader title="Piani" />
          {/* Fixed under the title, as in Allenamento and Nutrizione. */}
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
        </>
      }>
      {/* The three ways to have the plan (FitLab, loaded, built by the person), the one in use highlighted. */}
      <View style={styles.banner}>
        <PlanSourceBanner kind={kind} />
      </View>

      {kind === 'training' && trainingPlan ? (
        <TrainingPlanView
          key={cardKey}
          plan={trainingPlan}
          goal={goal}
          checkinPendingMonth={checkinPendingMonth}
          onCheckin={() => router.push('/monthly-checkin')}
        />
      ) : kind === 'diet' && supervision ? (
        <NutritionSupervisionCard reasons={supervision.reasons} frozen={supervision.frozen} />
      ) : kind === 'diet' && shownDietPlan && isTargetsPlan(shownDietPlan) ? (
        <TargetsPlanView key={cardKey} plan={shownDietPlan} checkinPendingMonth={checkinPendingMonth} onCheckin={() => router.push('/monthly-checkin')} />
      ) : kind === 'diet' && shownDietPlan ? (
        <DietPlanView
          key={cardKey}
          plan={shownDietPlan}
          goal={goal}
          checkinPendingMonth={checkinPendingMonth}
          onCheckin={() => router.push('/monthly-checkin')}
        />
      ) : (
        <FlatCard radius={28} style={styles.empty}>
          <ThemedText type="smallBold">{kind === 'training' ? 'Nessun programma di allenamento' : 'Nessun piano alimentare'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {neverRequested ? 'Il tuo percorso non lo prevede. Con “Cambia” puoi crearne uno o caricare il tuo.' : 'Il piano è in preparazione.'}
          </ThemedText>
          {neverRequested ? <PrimaryButton label="Piano creato da FitLab" variant="ghost" dense onPress={() => setCreateOpen(true)} style={styles.emptyAction} /> : null}
        </FlatCard>
      )}
      <CreatePlanPopup kind={kind} visible={createOpen} onClose={() => setCreateOpen(false)} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: Layout.screenGutter, gap: 0 },
  switcher: { marginTop: -4, marginBottom: 10 },
  banner: { marginBottom: 12 },
  empty: { padding: 20, gap: 6 },
  emptyAction: { marginTop: 8, alignSelf: 'flex-start' },
});
