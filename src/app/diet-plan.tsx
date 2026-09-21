import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { PlanTimeline } from '@/components/training/plan-timeline';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { InsightCard } from '@/components/ui/insight-card';
import { MonthProgressBar } from '@/components/ui/month-progress-bar';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SectionHeader } from '@/components/ui/section-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { exportDietPlanPdf } from '@/lib/planning/pdf-export';
import { currentMonthIndex, monthProgress } from '@/lib/planning/plan-progress';
import type { PlanMeal, PlanPhaseKind } from '@/lib/planning/types';
import { findQuestion, labelFor } from '@/lib/questionnaire/schema';
import { checkinUnlockedThroughMonth, useMonthlyCheckinStore } from '@/store/monthly-checkin-store';
import { isValidDietPlan, usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';

const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((weekday) => ({ value: weekday, label: weekday }));

const PHASE_LABEL: Record<PlanPhaseKind, string> = {
  adattamento: 'Adattamento',
  progressione: 'Progressione',
  consolidamento: 'Consolidamento',
};

export default function DietPlanScreen() {
  const theme = useTheme();
  const rawPlan = usePlanStore((s) => s.dietPlan);
  // A plan persisted before the day-by-day weeklySplit existed only has the
  // old sampleDay field — treat it the same as no plan rather than crash
  // when the content below reads weeklySplit off it.
  const plan = isValidDietPlan(rawPlan) ? rawPlan : null;
  const currentUser = useUserStore();
  const [exporting, setExporting] = useState(false);

  const completedCheckinMonths = useMonthlyCheckinStore((s) => s.completedMonths);
  const currentMonthIdx = plan ? currentMonthIndex(plan) : 1;
  const checkinUnlockedThrough = checkinUnlockedThroughMonth(completedCheckinMonths);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIdx);
  const selectedMonthData = plan?.months.find((m) => m.monthIndex === selectedMonth);
  // A month needs BOTH real time to have passed AND a completed check-in
  // for the month before it (spec §0.4 punto 2).
  const isTimeElapsed = selectedMonth <= currentMonthIdx;
  const isUnlocked = isTimeElapsed && selectedMonth <= checkinUnlockedThrough;
  const needsCheckin = isTimeElapsed && !isUnlocked;
  const progress = plan ? monthProgress(plan, selectedMonth) : null;

  const [selectedWeekday, setSelectedWeekday] = useState(WEEKDAY_LABELS[0]);
  const selectedDayData = selectedMonthData?.weeklySplit.find((d) => d.weekday === selectedWeekday);

  const handleExport = async () => {
    if (!plan || !selectedMonthData) return;
    setExporting(true);
    try {
      const goalLabel = labelFor(findQuestion('goal'), plan.goal) ?? plan.goal;
      await exportDietPlanPdf({
        userName: currentUser.name,
        goalNote: `Obiettivo: ${goalLabel}`,
        totalMonths: plan.durationMonths,
        monthTitle: selectedMonthData.title,
        monthFocus: selectedMonthData.focusNote,
        calorieTarget: selectedMonthData.calorieTarget,
        macroTargetsG: selectedMonthData.macroTargetsG,
        weeklySplit: selectedMonthData.weeklySplit,
      });
    } catch {
      Alert.alert('Non riesco a generare il PDF', 'Riprova tra qualche istante.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="title">Piano alimentare</ThemedText>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <GlassSurface level="card" radius={Radius.pill} style={styles.closeButton}>
            <View style={styles.closeInner}>
              <Icon name="close" size={18} color={theme.text} />
            </View>
          </GlassSurface>
        </Pressable>
      </View>

      {!plan ? (
        <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.two }}>
          <ThemedText type="smallBold">Nessun piano alimentare</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Hai completato il questionario in modalità “solo allenamento”. Rifallo scegliendo “Piano alimentare” o
            “Entrambi” per generare qui il tuo piano.
          </ThemedText>
        </GlassSurface>
      ) : (
        <>
          <View style={styles.planMetaRow}>
            <View style={{ gap: 2 }}>
              <ThemedText type="caption" themeColor="textSecondary">
                Durata piano totale
              </ThemedText>
              <ThemedText type="smallBold">{plan.durationMonths} mesi</ThemedText>
            </View>
            <View style={{ gap: 2 }}>
              <ThemedText type="caption" themeColor="textSecondary">
                Durata scheda
              </ThemedText>
              <ThemedText type="smallBold">1 mese</ThemedText>
            </View>
          </View>

          <PlanTimeline
            totalMonths={plan.durationMonths}
            currentMonth={currentMonthIdx}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
          />

          {selectedMonthData ? (
            <View style={{ gap: Spacing.one }}>
              <View style={[styles.phaseTag, { backgroundColor: theme.accentSoft, alignSelf: 'flex-start' }]}>
                <ThemedText
                  type="caption"
                  style={{ color: selectedMonthData.phase === 'consolidamento' ? theme.success : theme.accent, fontWeight: '700' }}>
                  {PHASE_LABEL[selectedMonthData.phase]}
                </ThemedText>
              </View>
              <ThemedText type="subtitle">{selectedMonthData.title}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {selectedMonthData.focusNote}
              </ThemedText>
            </View>
          ) : null}

          {isUnlocked && progress ? (
            <View style={{ gap: Spacing.two }}>
              <MonthProgressBar fraction={progress.fraction} />
              <ThemedText type="caption" themeColor="textSecondary">
                Giorno {progress.dayInMonth} di 30
              </ThemedText>
            </View>
          ) : null}

          {!isUnlocked ? (
            <GlassSurface level="card" radius={Radius.large} style={styles.lockedCard}>
              <View style={[styles.lockedIcon, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="lock" size={22} color={theme.textTertiary} />
              </View>
              <ThemedText type="smallBold">{needsCheckin ? 'Fai il check-in per sbloccare' : 'Scheda ancora da sbloccare'}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                {needsCheckin
                  ? `Il Mese ${selectedMonth - 1} è terminato: rispondi al check-in mensile per sbloccare e adattare il Mese ${selectedMonth}.`
                  : `Si sblocca al termine del Mese ${selectedMonth - 1}. I target si adatteranno ai tuoi progressi fino a quel momento.`}
              </ThemedText>
              {needsCheckin ? (
                <PrimaryButton label="Fai il check-in mensile" onPress={() => router.push('/monthly-checkin')} style={{ marginTop: Spacing.two }} />
              ) : null}
            </GlassSurface>
          ) : selectedMonthData ? (
            <>
              <Pressable onPress={handleExport} disabled={exporting} style={styles.exportLink} hitSlop={8}>
                <Icon name="download" size={15} color={theme.textSecondary} />
                <ThemedText type="caption" themeColor="textSecondary">
                  {exporting ? 'Preparazione…' : 'Scarica PDF'}
                </ThemedText>
              </Pressable>

              <View style={styles.targetsRow}>
                <Target label="Calorie" value={`${selectedMonthData.calorieTarget}`} unit="kcal" />
                <Target label="Proteine" value={`${selectedMonthData.macroTargetsG.protein}`} unit="g" />
                <Target label="Carbo" value={`${selectedMonthData.macroTargetsG.carbs}`} unit="g" />
                <Target label="Grassi" value={`${selectedMonthData.macroTargetsG.fats}`} unit="g" />
              </View>

              <SegmentedControl options={WEEKDAY_OPTIONS} value={selectedWeekday} onChange={setSelectedWeekday} />

              {selectedDayData ? (
                <View style={{ gap: Spacing.two }}>
                  {selectedDayData.meals.map((meal) => (
                    <MealCard key={meal.slotId} meal={meal} />
                  ))}
                </View>
              ) : null}

              <View>
                <SectionHeader title="Consigli" />
                <View style={{ gap: Spacing.two }}>
                  <InsightCard
                    icon="refresh"
                    tone="neutral"
                    headline="Sostituzioni tra proteine e grassi"
                    body="Le fonti proteiche (pollo, tacchino, pesce, uova, legumi) e i grassi (olio EVO, frutta secca, avocado) sono intercambiabili a parità di grammi indicati, se preferisci variare rispetto a quanto proposto."
                  />
                  <InsightCard
                    icon="bolt"
                    tone="neutral"
                    headline="Se sgarri o salti un pasto"
                    body="Niente digiuni compensativi: alleggerisci leggermente il pasto successivo o la giornata dopo, mantenendo la regolarità dei pasti."
                  />
                  <InsightCard
                    icon="alert"
                    tone="warning"
                    headline="Cosa evitare"
                    body="Digiuni prolungati per compensare uno sgarro, bevande zuccherate quotidiane e fritture frequenti: rallentano i risultati più di un pasto occasionale fuori piano."
                  />
                </View>
              </View>
            </>
          ) : null}
        </>
      )}
    </ScreenScroll>
  );
}

function MealCard({ meal }: { meal: PlanMeal }) {
  const theme = useTheme();
  return (
    <GlassSurface level="card" radius={Radius.large} style={styles.mealCard}>
      <View style={styles.mealHeader}>
        <ThemedText type="smallBold" style={{ flex: 1 }}>
          {meal.label}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {meal.time}
        </ThemedText>
      </View>

      {meal.isFreeMeal ? (
        <View style={{ gap: 2 }}>
          <ThemedText type="small" style={{ color: theme.accent, fontWeight: '600' }}>
            Pasto libero
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Scegli tu cosa mangiare, restando indicativamente entro ~{meal.totalKcal} kcal e senza eccessi — vedi le
            note del piano per qualche indicazione.
          </ThemedText>
        </View>
      ) : (
        <>
          <View style={{ gap: 6 }}>
            {meal.items.map((item, index) => (
              <MealItemRow key={index} item={item} />
            ))}
          </View>

          <View style={[styles.mealFooterDivider, { borderTopColor: theme.border }]}>
            <ThemedText type="caption" themeColor="textSecondary">
              Totale {meal.totalKcal} kcal
            </ThemedText>
          </View>
        </>
      )}
    </GlassSurface>
  );
}

/** Substitutions are collapsed behind a tap by default (spec request: "un
 * tasto per le sostituzioni") — a long list of alternatives for every item
 * used to always be visible as a caption line, cluttering the meal even
 * when the user never asked to see them. */
function MealItemRow({ item }: { item: PlanMeal['items'][number] }) {
  const theme = useTheme();
  const [showSubstitutes, setShowSubstitutes] = useState(false);
  const hasSubstitutes = (item.substitutes?.length ?? 0) > 0;

  return (
    <View style={{ gap: 4 }}>
      <View style={styles.mealItemRow}>
        <ThemedText type="small" style={{ flex: 1 }}>
          {item.name} <ThemedText type="caption" themeColor="textSecondary">· {item.quantityLabel}</ThemedText>
        </ThemedText>
        {hasSubstitutes ? (
          <Pressable onPress={() => setShowSubstitutes((v) => !v)} hitSlop={8} style={styles.substituteToggle}>
            <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '600' }}>
              Sostituzioni
            </ThemedText>
            <Icon name={showSubstitutes ? 'chevronUp' : 'chevronDown'} size={14} color={theme.accent} />
          </Pressable>
        ) : null}
      </View>
      {showSubstitutes && item.substitutes ? (
        <View style={[styles.substituteList, { borderLeftColor: theme.border }]}>
          {item.substitutes.map((s, i) => (
            <ThemedText key={i} type="caption" themeColor="textSecondary">
              {s.name} · {s.quantityLabel}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Target({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.target}>
      <ThemedText type="smallBold">
        {value}
        <ThemedText type="caption" themeColor="textSecondary">
          {' '}
          {unit}
        </ThemedText>
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 40,
    height: 40,
  },
  closeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planMetaRow: {
    flexDirection: 'row',
    gap: Spacing.five,
  },
  phaseTag: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  lockedCard: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.five,
  },
  lockedIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
  },
  targetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  target: {
    alignItems: 'center',
    gap: 2,
  },
  mealCard: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mealFooterDivider: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mealItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  substituteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  substituteList: {
    gap: 2,
    marginLeft: Spacing.two,
    paddingLeft: Spacing.two,
    borderLeftWidth: 2,
  },
});
