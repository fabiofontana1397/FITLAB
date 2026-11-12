import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ExerciseSummaryCard, MealCard } from '@/components/plans/plan-day-cards';
import { PlanView } from '@/components/plans/plan-view';
import { ThemedText } from '@/components/themed-text';
import { PHASE_SHORT_LABEL } from '@/components/training/plan-month-stepper';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { InsightCard } from '@/components/ui/insight-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Goal } from '@/lib/mock/types';
import {
  DIET_GOAL_COPY,
  DIET_GOAL_TEXT,
  DIET_PHASE_DETAIL,
  DIET_PHASE_SHORT_LABEL,
  DIET_STRATEGY,
  GOAL_NAME,
  TRAINING_GOAL_COPY,
  TRAINING_GOAL_TEXT,
  TRAINING_PHASE_DETAIL,
} from '@/lib/planning/plan-copy';
import { exportDietPlanPdf, exportTrainingPlanPdf, type TrainingPlanPdfRow } from '@/lib/planning/pdf-export';
import { inMealOrder } from '@/lib/planning/meal-slots';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import type { DietPlan, TrainingPlan } from '@/lib/planning/types';
import { findQuestion, labelFor } from '@/lib/questionnaire/schema';
import { useOnboardingStore } from '@/store/onboarding-store';
import { latestWeightForExercise, useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

type PlanActions = {
  /** The ended month still waiting for its check-in, or null when none is due. */
  checkinPendingMonth: number | null;
  onCheckin: () => void;
};

const restLabel = (sec: number) => (sec < 60 ? `${sec}s` : `${Math.round(sec / 60)} min`);

/** The Piani page for the training program. */
export function TrainingPlanView({ plan, goal, checkinPendingMonth, onCheckin }: PlanActions & { plan: TrainingPlan; goal: Goal }) {
  const theme = useTheme();
  const answers = useOnboardingStore((s) => s.answers);
  const userName = useUserStore((s) => s.name);
  const progressSets = useTrainingProgressStore((s) => s.sets);
  const monthOf = (monthIndex: number) => plan.months.find((m) => m.monthIndex === monthIndex) ?? plan.months[0];

  // "Upper A" / "Upper B" are the same split: show each pattern once.
  const current = monthOf(currentMonthIndex(plan));
  const workoutsNow = current.weeklySplit.filter((d) => d.type === 'workout');
  const runsNow = current.weeklySplit.filter((d) => d.type === 'cardio').length;
  const splits = [...new Set(workoutsNow.map((d) => d.title.replace(/ [AB]$/, '')))];
  const subtitle = [splits.length > 0 ? splits.join(' · ') : null, runsNow > 0 ? `${runsNow} ${runsNow === 1 ? 'corsa' : 'corse'}` : null].filter(Boolean).join(' + ');

  const exportPdf = async (monthIndex: number) => {
    const month = monthOf(monthIndex);
    const rows: TrainingPlanPdfRow[] = month.weeklySplit.flatMap((day): TrainingPlanPdfRow[] => {
      if (day.type === 'workout') {
        return (day.exercises ?? []).map((ex) => {
          const logged = latestWeightForExercise(progressSets, ex.id);
          const carico = logged != null ? `Ultimo carico: ${logged}kg` : ex.suggestedKg != null ? `Consigliato: ${ex.suggestedKg}kg` : '—';
          return { weekday: day.weekday, dayTitle: day.title, name: ex.name, sets: ex.sets, reps: ex.reps, rest: restLabel(ex.restSec), tempo: ex.tempo, carico };
        });
      }
      if (day.type === 'cardio') {
        return [{ weekday: day.weekday, dayTitle: day.title, name: day.note ?? 'Corsa', sets: null, reps: null, rest: null, tempo: null, carico: null }];
      }
      return [];
    });
    await exportTrainingPlanPdf({
      userName,
      goalNote: `Obiettivo: ${labelFor(findQuestion('goal'), answers.goal) ?? ''}`,
      totalMonths: plan.durationMonths,
      monthIndex,
      monthTitle: month.title,
      monthFocus: month.focusNote,
      rows,
    });
  };

  return (
    <PlanView
      kind="training"
      plan={plan}
      tag="IL TUO PROGRAMMA"
      title={GOAL_NAME[goal]}
      subtitle={subtitle}
      description={TRAINING_GOAL_COPY[goal].why}
      objective={TRAINING_GOAL_TEXT[goal]}
      phaseLabels={PHASE_SHORT_LABEL}
      phaseDetail={TRAINING_PHASE_DETAIL}
      monthStats={(monthIndex) => {
        const split = monthOf(monthIndex).weeklySplit;
        const workouts = split.filter((d) => d.type === 'workout');
        const runs = split.filter((d) => d.type === 'cardio').length;
        const exercises = workouts.length > 0 ? Math.round(workouts.reduce((sum, d) => sum + (d.exercises?.length ?? 0), 0) / workouts.length) : 0;
        return [
          { icon: 'barbell', label: 'Sedute/sett.', value: workouts.length + runs },
          { icon: 'categoryAll', label: 'Esercizi/seduta', value: exercises },
          { icon: 'moon', label: 'Giorni di riposo', value: split.filter((d) => d.type === 'rest').length },
        ];
      }}
      renderDay={(monthIndex, weekday) => {
        const day = monthOf(monthIndex).weeklySplit.find((d) => d.weekday === weekday);
        if (day?.type === 'workout') {
          return (
            <>
              <ThemedText style={styles.dayTitle}>{day.title}</ThemedText>
              {(day.exercises ?? []).map((ex) => (
                <ExerciseSummaryCard
                  key={ex.id}
                  item={{
                    key: ex.id,
                    exerciseId: ex.id,
                    name: ex.name,
                    subtitle: `${ex.sets}×${ex.reps} · recupero ${restLabel(ex.restSec)}`,
                    sets: ex.sets,
                    reps: ex.reps,
                    tempo: ex.tempo,
                    restLabel: restLabel(ex.restSec),
                  }}
                />
              ))}
            </>
          );
        }
        if (day?.type === 'cardio') return <ExerciseSummaryCard item={{ key: day.weekday, name: day.title, subtitle: day.note ?? '' }} />;
        if (day?.type === 'rest') {
          return (
            <FlatCard radius={24} style={styles.restCard}>
              <View style={[styles.restIcon, { backgroundColor: theme.backgroundElement }]}>
                <Icon name="moon" size={22} color={theme.textSecondary} />
              </View>
              <ThemedText style={styles.dayTitle}>Giorno di riposo</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
                Il recupero fa parte del piano: dormi bene e resta idratato.
              </ThemedText>
            </FlatCard>
          );
        }
        return null;
      }}
      exportPdf={exportPdf}
      notice={
        plan.needsManualReview ? (
          <GlassSurface level="card" radius={Radius.large} style={[styles.notice, { borderColor: theme.danger, borderWidth: 1 }]}>
            <ThemedText style={[styles.dayTitle, { color: theme.danger }]}>Revisione consigliata</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              Per alcuni giorni non abbiamo trovato un esercizio compatibile con i vincoli che hai indicato (dolori/infortuni/attrezzatura). Ti abbiamo proposto un esercizio a corpo libero sicuro come placeholder:
              parlane con un professionista prima di seguirlo, o rifai il questionario indicando l&apos;attrezzatura o i vincoli in modo più preciso.
            </ThemedText>
          </GlassSurface>
        ) : null
      }
      footer={
        <PrimaryButton
          label={plan.source === 'custom' ? 'Cambia la tua scheda' : 'Inserisci la tua scheda'}
          icon="plus"
          variant="outline"
          onPress={() => router.push('/custom-workout')}
        />
      }
      checkinPendingMonth={checkinPendingMonth}
      onCheckin={onCheckin}
    />
  );
}

/** The Piani page for the nutrition plan. */
export function DietPlanView({ plan, goal, checkinPendingMonth, onCheckin }: PlanActions & { plan: DietPlan; goal: Goal }) {
  const theme = useTheme();
  const userName = useUserStore((s) => s.name);
  const monthOf = (monthIndex: number) => plan.months.find((m) => m.monthIndex === monthIndex) ?? plan.months[0];

  const current = monthOf(currentMonthIndex(plan));
  const meals = current.weeklySplit[0]?.meals.length ?? 0;
  const kcal = Math.round(current.calorieTarget).toLocaleString('it-IT');

  const exportPdf = async (monthIndex: number) => {
    const month = monthOf(monthIndex);
    await exportDietPlanPdf({
      userName,
      goalNote: `Obiettivo: ${labelFor(findQuestion('goal'), plan.goal) ?? plan.goal}`,
      totalMonths: plan.durationMonths,
      monthTitle: month.title,
      monthFocus: month.focusNote,
      calorieTarget: month.calorieTarget,
      macroTargetsG: month.macroTargetsG,
      weeklySplit: month.weeklySplit,
    });
  };

  return (
    <PlanView
      kind="diet"
      plan={plan}
      tag="IL TUO PIANO ALIMENTARE"
      title={DIET_STRATEGY[goal]}
      subtitle={`~${kcal} kcal al giorno${meals > 0 ? ` · ${meals} pasti` : ''}`}
      description={DIET_GOAL_COPY[goal].why}
      objective={DIET_GOAL_TEXT[goal]}
      phaseLabels={DIET_PHASE_SHORT_LABEL}
      phaseDetail={DIET_PHASE_DETAIL}
      monthStats={(monthIndex) => {
        const m = monthOf(monthIndex);
        return [
          { icon: 'flame', label: 'Calorie', value: Math.round(m.calorieTarget), unit: 'kcal' },
          { icon: 'protein', label: 'Proteine', value: Math.round(m.macroTargetsG.protein), unit: 'g' },
          { icon: 'carbs', label: 'Carboidrati', value: Math.round(m.macroTargetsG.carbs), unit: 'g' },
          { icon: 'fats', label: 'Grassi', value: Math.round(m.macroTargetsG.fats), unit: 'g' },
        ];
      }}
      renderDay={(monthIndex, weekday) => {
        const day = monthOf(monthIndex).weeklySplit.find((d) => d.weekday === weekday);
        if (!day) return null;
        return (
          <>
            <ThemedText style={styles.dayTitle}>
              {day.isTrainingDay ? 'Giorno di allenamento' : 'Giorno di riposo'}
              {day.calorieTarget ? <ThemedText style={[styles.dayTitle, { color: theme.accent }]}>{` · ${day.calorieTarget} kcal`}</ThemedText> : null}
            </ThemedText>
            {inMealOrder(day.meals).map((meal) => (
              <MealCard key={meal.slotId} meal={meal} />
            ))}
          </>
        );
      }}
      exportPdf={exportPdf}
      footer={
        <View style={{ gap: Spacing.two }}>
          <ThemedText style={styles.sectionTitle}>Consigli</ThemedText>
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
      }
      checkinPendingMonth={checkinPendingMonth}
      onCheckin={onCheckin}
    />
  );
}

const styles = StyleSheet.create({
  dayTitle: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  notice: { padding: Spacing.four, gap: Spacing.two },
  restCard: { alignItems: 'center', gap: Spacing.two, padding: Spacing.five },
  restIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
