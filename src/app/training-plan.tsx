import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ExerciseInfoModal } from '@/components/training/exercise-info-modal';
import { PlanTimeline } from '@/components/training/plan-timeline';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { MonthProgressBar } from '@/components/ui/month-progress-bar';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getExerciseMedia } from '@/lib/exercise-media/exercise-media';
import { goBackOr } from '@/lib/navigation/go-back';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { exportTrainingPlanPdf, type TrainingPlanPdfRow } from '@/lib/planning/pdf-export';
import { currentMonthIndex, monthProgress } from '@/lib/planning/plan-progress';
import { findQuestion, labelFor } from '@/lib/questionnaire/schema';
import { checkinUnlockedThroughMonth, useMonthlyCheckinStore } from '@/store/monthly-checkin-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { latestWeightForExercise, useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

type DayItem = { key: string; exerciseId?: string; name: string; subtitle: string };

const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((weekday) => ({ value: weekday, label: weekday }));

export default function TrainingPlanScreen() {
  const theme = useTheme();
  const plan = usePlanStore((s) => s.trainingPlan);
  const answers = useOnboardingStore((s) => s.answers);
  const currentUser = useUserStore();
  const progressSets = useTrainingProgressStore((s) => s.sets);
  const [exporting, setExporting] = useState(false);

  const completedCheckinMonths = useMonthlyCheckinStore((s) => s.completedMonths);
  const currentMonthIdx = plan ? currentMonthIndex(plan) : 1;
  const checkinUnlockedThrough = checkinUnlockedThroughMonth(completedCheckinMonths);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthIdx);
  const selectedMonthData = plan?.months.find((m) => m.monthIndex === selectedMonth);
  // A month needs BOTH real time to have passed AND a completed check-in
  // for the month before it (spec §0.4 punto 2) — time alone no longer
  // unlocks a month past the first one.
  const isTimeElapsed = selectedMonth <= currentMonthIdx;
  const isUnlocked = isTimeElapsed && selectedMonth <= checkinUnlockedThrough;
  const needsCheckin = isTimeElapsed && !isUnlocked;
  const progress = plan ? monthProgress(plan, selectedMonth) : null;

  const [selectedWeekday, setSelectedWeekday] = useState(WEEKDAY_LABELS[0]);
  const selectedDay = selectedMonthData?.weeklySplit.find((d) => d.weekday === selectedWeekday);

  const goalLabel = labelFor(findQuestion('goal'), answers.goal) ?? '';

  const handleExport = async () => {
    if (!plan || !selectedMonthData) return;
    setExporting(true);
    try {
      const rows: TrainingPlanPdfRow[] = selectedMonthData.weeklySplit.flatMap((day): TrainingPlanPdfRow[] => {
        if (day.type === 'workout') {
          return (day.exercises ?? []).map((ex) => {
            const logged = latestWeightForExercise(progressSets, ex.id);
            const carico =
              logged != null ? `Ultimo carico: ${logged}kg` : ex.suggestedKg != null ? `Consigliato: ${ex.suggestedKg}kg` : '—';
            return {
              weekday: day.weekday,
              dayTitle: day.title,
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              rest: ex.restSec < 60 ? `${ex.restSec}s` : `${Math.round(ex.restSec / 60)} min`,
              tempo: ex.tempo,
              carico,
            };
          });
        }
        if (day.type === 'cardio') {
          return [
            {
              weekday: day.weekday,
              dayTitle: day.title,
              name: day.note ?? 'Corsa',
              sets: null,
              reps: null,
              rest: null,
              tempo: null,
              carico: null,
            },
          ];
        }
        return [];
      });
      await exportTrainingPlanPdf({
        userName: currentUser.name,
        goalNote: `Obiettivo: ${goalLabel}`,
        totalMonths: plan.durationMonths,
        monthIndex: selectedMonth,
        monthTitle: selectedMonthData.title,
        monthFocus: selectedMonthData.focusNote,
        rows,
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
          <ThemedText type="title">Piano di allenamento</ThemedText>
        </View>
        <Pressable onPress={() => goBackOr('/')} hitSlop={8}>
          <GlassSurface level="card" radius={Radius.pill} style={styles.closeButton}>
            <View style={styles.closeInner}>
              <Icon name="close" size={18} color={theme.text} />
            </View>
          </GlassSurface>
        </Pressable>
      </View>

      {!plan ? (
        <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.two }}>
          <ThemedText type="smallBold">Nessun programma generato</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Hai completato il questionario in modalità “solo dieta”, oppure non hai selezionato sala pesi o corsa tra
            le attività. Rifai il questionario per generare qui il tuo programma.
          </ThemedText>
        </GlassSurface>
      ) : (
        <>
          {plan.needsManualReview ? (
            <GlassSurface level="card" radius={Radius.large} style={{ padding: Spacing.four, gap: Spacing.two, borderColor: theme.danger, borderWidth: 1 }}>
              <ThemedText type="smallBold" style={{ color: theme.danger }}>
                Revisione consigliata
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                Per alcuni giorni non abbiamo trovato un esercizio compatibile con i vincoli che hai indicato
                (dolori/infortuni/attrezzatura). Ti abbiamo proposto un esercizio a corpo libero sicuro come
                placeholder: parlane con un professionista prima di seguirlo, o rifai il questionario indicando
                l&apos;attrezzatura o i vincoli in modo più preciso.
              </ThemedText>
            </GlassSurface>
          ) : null}

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
                  : `Si sblocca al termine del Mese ${selectedMonth - 1}. I dettagli si adatteranno ai tuoi progressi fino a quel momento.`}
              </ThemedText>
              {needsCheckin ? (
                <PrimaryButton label="Fai il check-in mensile" onPress={() => router.push('/monthly-checkin')} style={{ marginTop: Spacing.two }} />
              ) : null}
            </GlassSurface>
          ) : (
            <>
              <Pressable onPress={handleExport} disabled={exporting} style={styles.exportLink} hitSlop={8}>
                <Icon name="download" size={15} color={theme.textSecondary} />
                <ThemedText type="caption" themeColor="textSecondary">
                  {exporting ? 'Preparazione…' : 'Scarica PDF'}
                </ThemedText>
              </Pressable>

              <SegmentedControl options={WEEKDAY_OPTIONS} value={selectedWeekday} onChange={setSelectedWeekday} />

              {selectedDay?.type === 'workout' ? (
                <View style={{ gap: Spacing.two }}>
                  {(selectedDay.exercises ?? []).map((ex) => {
                    const rest = ex.restSec < 60 ? `${ex.restSec}s` : `${Math.round(ex.restSec / 60)} min`;
                    return (
                      <ExerciseSummaryCard
                        key={ex.id}
                        item={{
                          key: ex.id,
                          exerciseId: ex.id,
                          name: ex.name,
                          subtitle: `${ex.sets}×${ex.reps} · recupero ${rest}`,
                        }}
                      />
                    );
                  })}
                </View>
              ) : selectedDay?.type === 'cardio' ? (
                <ExerciseSummaryCard item={{ key: selectedDay.weekday, name: selectedDay.title, subtitle: selectedDay.note ?? '' }} />
              ) : selectedDay?.type === 'rest' ? (
                <GlassSurface level="card" radius={Radius.large} style={styles.lockedCard}>
                  <View style={[styles.lockedIcon, { backgroundColor: theme.backgroundElement }]}>
                    <Icon name="moon" size={22} color={theme.textSecondary} />
                  </View>
                  <ThemedText type="smallBold">Giorno di riposo</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                    Il recupero fa parte del piano: dormi bene e resta idratato.
                  </ThemedText>
                </GlassSurface>
              ) : null}
            </>
          )}
        </>
      )}
    </ScreenScroll>
  );
}

function ExerciseSummaryCard({ item }: { item: DayItem }) {
  const theme = useTheme();
  const [infoOpen, setInfoOpen] = useState(false);
  const media = item.exerciseId ? getExerciseMedia(item.exerciseId) : undefined;

  return (
    <GlassSurface level="card" radius={Radius.large} style={styles.exerciseCard}>
      {media ? (
        <Image source={{ uri: media.gifUrl }} style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="smallBold">{item.name}</ThemedText>
        {item.subtitle ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {item.subtitle}
          </ThemedText>
        ) : null}
      </View>
      {item.exerciseId ? (
        <Pressable onPress={() => setInfoOpen(true)} hitSlop={8} style={styles.infoButton}>
          <Icon name="info" size={20} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      <ExerciseInfoModal
        visible={infoOpen}
        exerciseName={item.name}
        media={media}
        onClose={() => setInfoOpen(false)}
      />
    </GlassSurface>
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
  exportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.medium,
  },
  infoButton: {
    padding: 4,
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
});
