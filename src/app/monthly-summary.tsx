import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Verdict } from '@/domain/recalibration';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { daysAgoISO } from '@/lib/mock/dates';
import { computeMonthAdherence, monthWindow, weightsInMonth } from '@/lib/planning/month-adherence';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useBodyStore } from '@/store/body-store';
import { useMonthlyCheckinStore } from '@/store/monthly-checkin-store';
import { useNutritionStore } from '@/store/nutrition-store';
import { usePlanStore } from '@/store/plan-store';
import { useTrainingProgressStore } from '@/store/training-progress-store';

const VERDICT: Record<Verdict, string> = {
  on_track: 'Progressi in linea con il piano',
  too_slow: 'Progressi più lenti del previsto',
  plateau: 'Trend del peso stabile',
  wrong_direction: 'Trend diverso dall’obiettivo',
  too_fast: 'Progressi più rapidi del previsto',
  low_adherence: 'Dati di aderenza parziali',
  insufficient_data: 'Dati insufficienti per valutare il trend',
};

export default function MonthlySummaryScreen() {
  const theme = useTheme();
  const dietPlan = usePlanStore((state) => state.dietPlan);
  const trainingPlan = usePlanStore((state) => state.trainingPlan);
  const checkins = useMonthlyCheckinStore((state) => state.checkins);
  const bodyEntries = useBodyStore((state) => state.entries);
  const nutritionEntries = useNutritionStore((state) => state.entries);
  const completedExercises = useTrainingProgressStore((state) => state.completed);
  const activityLog = useActivityLogStore((state) => state.entries);

  const history = dietPlan?.recalibrations ?? trainingPlan?.recalibrations ?? [];
  const latest = [...history].sort((a, b) => b.monthIndex - a.monthIndex)[0];
  const plan = dietPlan ?? trainingPlan;
  const checkin = latest ? checkins.find((item) => item.monthIndex === latest.monthIndex) : undefined;
  const window = latest && plan ? monthWindow(plan, latest.monthIndex) : null;
  const adherence = latest && window
    ? computeMonthAdherence({
        training: trainingPlan,
        monthIndex: latest.monthIndex,
        window,
        today: daysAgoISO(0),
        nutritionEntries,
        completedExercises,
        activityLog,
      })
    : null;
  const weights = latest && window ? weightsInMonth(bodyEntries, window) : [];
  const currentDietMonth = dietPlan?.months.find((month) => month.monthIndex === (latest?.monthIndex ?? 0) + 1);

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText type="title">Riepilogo mensile</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">Progressi osservati e prossimi passi del piano</ThemedText>
        </View>
        <PrimaryButton label="Settimana" variant="ghost" icon="calendar" dense onPress={() => router.push('/weekly-summary' as Href)} />
      </View>

      {!latest ? (
        <FlatCard style={styles.card}>
          <ThemedText type="subtitle">Il primo riepilogo arriverà al check-in</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Alla fine del primo mese confronteremo pesate, sedute registrate, pasti tracciati e come ti sei sentito. Il piano successivo verrà ricalibrato su questi dati.
          </ThemedText>
          <PrimaryButton label="Apri check-in mensile" icon="calendar" onPress={() => router.push('/monthly-checkin')} />
        </FlatCard>
      ) : (
        <>
          <FlatCard style={styles.card}>
            <View style={styles.verdictRow}>
              <View style={[styles.verdictIcon, { backgroundColor: theme.accentSoft }]}><Icon name="progress" size={20} color={theme.accent} /></View>
              <View style={{ flex: 1, gap: 3 }}>
                <ThemedText type="subtitle">{VERDICT[latest.verdict]}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">Mese {latest.monthIndex} · aggiornato il {latest.date}</ThemedText>
              </View>
            </View>
            {latest.weeklyRateKg != null ? (
              <ThemedText type="small">Trend stimato: {latest.weeklyRateKg > 0 ? '+' : ''}{latest.weeklyRateKg.toFixed(2)} kg/settimana · previsto {latest.expectedWeeklyKg > 0 ? '+' : ''}{latest.expectedWeeklyKg.toFixed(2)} kg/settimana</ThemedText>
            ) : null}
            {adherence ? (
              <View style={styles.metrics}>
                <MiniMetric label="Sedute" value={adherence.trainingCompletion == null ? '—' : `${Math.round(adherence.trainingCompletion * 100)}%`} />
                <MiniMetric label="Giorni pasti tracciati" value={`${adherence.mealDaysTracked}/${adherence.daysInMonth}`} />
                <MiniMetric label="Pesate" value={`${weights.filter((item) => item.kg > 0).length}`} />
              </View>
            ) : null}
          </FlatCard>

          {checkin ? (
            <FlatCard style={styles.card}>
              <ThemedText type="subtitle">Come ti sei sentito</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Aderenza: {String(checkin.answers.checkinAdherence ?? '—')}/5 · Energia: {String(checkin.answers.checkinEnergyLevel ?? 'non indicata')} · Fame: {String(checkin.answers.checkinHungerLevel ?? 'non indicata')}</ThemedText>
              {Array.isArray(checkin.answers.checkinDifficulty) && checkin.answers.checkinDifficulty.length > 0 ? (
                <ThemedText type="small">Difficoltà indicate: {(checkin.answers.checkinDifficulty as string[]).join(', ')}.</ThemedText>
              ) : null}
            </FlatCard>
          ) : null}

          <FlatCard style={styles.card}>
            <ThemedText type="subtitle">Cosa cambia nel piano</ThemedText>
            {latest.changes.length > 0 ? latest.changes.map((change, index) => (
              <View key={`${change.area}-${index}`} style={styles.changeRow}>
                <Icon name={change.area === 'dieta' ? 'nutrition' : 'training'} size={18} color={theme.accent} />
                <ThemedText type="small" style={{ flex: 1 }}>{change.text}</ThemedText>
              </View>
            )) : <ThemedText type="small" themeColor="textSecondary">Il piano resta invariato: i dati raccolti non indicano una correzione utile in questo momento.</ThemedText>}
            {currentDietMonth ? (
              <ThemedText type="caption" themeColor="textSecondary">Prossimo target alimentare: {currentDietMonth.calorieTarget} kcal · {currentDietMonth.macroTargetsG.protein} g proteine, {currentDietMonth.macroTargetsG.carbs} g carboidrati, {currentDietMonth.macroTargetsG.fats} g grassi.</ThemedText>
            ) : null}
          </FlatCard>
        </>
      )}
    </ScreenScroll>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.miniMetric}><ThemedText type="subtitle">{value}</ThemedText><ThemedText type="caption" themeColor="textSecondary">{label}</ThemedText></View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  card: { padding: Spacing.four, gap: Spacing.three, borderRadius: Radius.large },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  verdictIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium },
  metrics: { flexDirection: 'row', gap: Spacing.two },
  miniMetric: { flex: 1, gap: 3 },
  changeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
});
