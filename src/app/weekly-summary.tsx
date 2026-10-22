import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDayRange } from '@/lib/mock/dates';
import { buildWeeklySummary } from '@/lib/reports/weekly-summary';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useBodyStore } from '@/store/body-store';
import { useNutritionStore } from '@/store/nutrition-store';
import { usePlanStore } from '@/store/plan-store';
import { useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

export default function WeeklySummaryScreen() {
  const theme = useTheme();
  const dietPlan = usePlanStore((state) => state.dietPlan);
  const trainingPlan = usePlanStore((state) => state.trainingPlan);
  const summary = buildWeeklySummary({
    dietPlan,
    trainingPlan,
    calorieTarget: useUserStore((state) => state.dailyCalorieTarget),
    nutritionEntries: useNutritionStore((state) => state.entries),
    completedExercises: useTrainingProgressStore((state) => state.completed),
    activities: useActivityLogStore((state) => state.entries),
    bodyEntries: useBodyStore((state) => state.entries),
  });

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText type="title">La tua settimana</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {formatDayRange(summary.start, summary.end)} · dati registrati
          </ThemedText>
        </View>
        <PrimaryButton label="Mese" variant="ghost" icon="calendar" dense onPress={() => router.push('/monthly-summary' as Href)} />
      </View>

      <View style={styles.metrics}>
        <MetricCard icon="training" label="Sedute" value={summary.plannedSessions ? `${summary.completedSessions}/${summary.plannedSessions}` : '—'} />
        <MetricCard icon="nutrition" label="Giorni tracciati" value={`${summary.loggedMealDays}/7`} />
        <MetricCard icon="scale" label="Peso" value={summary.weightChangeKg == null ? '—' : `${summary.weightChangeKg > 0 ? '+' : ''}${summary.weightChangeKg.toFixed(1)} kg`} />
      </View>

      <ReportSection icon="trophy" title="Cosa è andato bene" items={summary.wins} tint={theme.successSoft} iconColor={theme.success} />
      <ReportSection icon="sparkle" title="Cosa migliorare" items={summary.improve} tint={theme.accentSoft} iconColor={theme.accent} />
      <ReportSection icon="info" title="Da tenere d'occhio" items={summary.missed} tint={theme.backgroundElement} iconColor={theme.textSecondary} />

      <ThemedText type="small" themeColor="textTertiary" style={styles.note}>
        I giorni senza registrazioni sono indicati come dati mancanti, non come pasti o allenamenti saltati. Il peso può oscillare: conta l&apos;andamento di più settimane.
      </ThemedText>
    </ScreenScroll>
  );
}

function MetricCard({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <FlatCard style={styles.metricCard}>
      <Icon name={icon} size={18} color={theme.textSecondary} />
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>{label}</ThemedText>
    </FlatCard>
  );
}

function ReportSection({ icon, title, items, tint, iconColor }: { icon: IconName; title: string; items: string[]; tint: string; iconColor: string }) {
  return (
    <FlatCard style={styles.section}>
      <View style={styles.sectionTitle}>
        <View style={[styles.sectionIcon, { backgroundColor: tint }]}><Icon name={icon} size={18} color={iconColor} /></View>
        <ThemedText type="subtitle">{title}</ThemedText>
      </View>
      {items.map((item, index) => (
        <View key={`${title}-${index}`} style={styles.item}>
          <View style={[styles.bullet, { backgroundColor: iconColor }]} />
          <ThemedText type="small" style={{ flex: 1 }}>{item}</ThemedText>
        </View>
      ))}
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  metrics: { flexDirection: 'row', gap: Spacing.two },
  metricCard: { flex: 1, minWidth: 0, minHeight: 104, padding: Spacing.three, gap: 6, borderRadius: Radius.large },
  section: { padding: Spacing.four, gap: Spacing.three, borderRadius: Radius.large },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.medium },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  bullet: { width: 6, height: 6, marginTop: 7, borderRadius: 3 },
  note: { lineHeight: 19, paddingHorizontal: Spacing.one },
});
