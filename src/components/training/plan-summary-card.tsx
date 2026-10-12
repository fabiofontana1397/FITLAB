import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import type { Goal } from '@/lib/mock/types';
import { currentMonthIndex, currentMonthProgress } from '@/lib/planning/plan-progress';
import type { TrainingPlan } from '@/lib/planning/types';

const GOAL_NAME: Record<Goal, string> = {
  loseFat: 'Definizione',
  gainMuscle: 'Ipertrofia',
  maintainImprove: 'Mantenimento',
  gainStrength: 'Forza',
  improveEndurance: 'Resistenza',
  generalHealth: 'Benessere',
};

/** The training plan screen's header card: where the Training tab sells the
 * journey ("Il tuo percorso"), this is the program's spec sheet — goal,
 * weekly structure, progress through the whole plan and key numbers.
 * Tapping it opens the full program description. */
export function PlanSummaryCard({ plan, goal, onPress }: { plan: TrainingPlan; goal: Goal; onPress: () => void }) {
  const monthIndex = currentMonthIndex(plan);
  const month = plan.months.find((m) => m.monthIndex === monthIndex) ?? plan.months[0];
  const workouts = month.weeklySplit.filter((d) => d.type === 'workout');
  const runs = month.weeklySplit.filter((d) => d.type === 'cardio').length;
  // "Upper A" / "Upper B" are the same split: show each pattern once.
  const splits = [...new Set(workouts.map((d) => d.title.replace(/ [AB]$/, '')))];
  const avgExercises = workouts.length > 0 ? Math.round(workouts.reduce((sum, d) => sum + (d.exercises?.length ?? 0), 0) / workouts.length) : 0;

  const totalDays = plan.durationMonths * 30;
  const day = Math.min((monthIndex - 1) * 30 + currentMonthProgress(plan).dayInMonth, totalDays);
  const fraction = day / totalDays;

  const structure = [
    splits.length > 0 ? splits.join(' · ') : null,
    runs > 0 ? `${runs} ${runs === 1 ? 'corsa' : 'corse'}` : null,
  ]
    .filter(Boolean)
    .join(' + ');

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Dettagli del programma">
      <LinearGradient colors={['#FF8F2A', '#FF6A13', '#F25A00']} locations={[0, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.topRow}>
          <ThemedText style={styles.tag}>IL TUO PROGRAMMA</ThemedText>
          <View style={styles.details}>
            <ThemedText style={styles.detailsText}>Dettagli</ThemedText>
            <Icon name="chevronRight" size={13} color="#FFFFFF" />
          </View>
        </View>

        <View style={{ gap: 2 }}>
          <ThemedText style={styles.goal}>{GOAL_NAME[goal]}</ThemedText>
          {structure ? <ThemedText style={styles.structure}>{structure}</ThemedText> : null}
        </View>

        <View style={{ gap: 6 }}>
          <View style={styles.progressLabels}>
            <ThemedText style={styles.progressStrong}>
              Mese {monthIndex} di {plan.durationMonths}
            </ThemedText>
            <ThemedText style={styles.progressSoft}>
              Giorno {day} di {totalDays}
            </ThemedText>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(fraction, 0.02) * 100}%` }]} />
            {Array.from({ length: plan.durationMonths - 1 }, (_, i) => (
              <View key={i} style={[styles.tick, { left: `${((i + 1) / plan.durationMonths) * 100}%` }]} />
            ))}
          </View>
        </View>

        <View style={styles.stats}>
          <Stat icon="calendar" value={`${plan.durationMonths} mesi`} label="Durata" />
          <Stat icon="barbell" value={`${workouts.length + runs}/sett.`} label="Sedute" />
          <Stat icon="repsHash" value={avgExercises > 0 ? `~${avgExercises}` : '—'} label="Esercizi" />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={15} color="#FFFFFF" />
      <View>
        <ThemedText style={styles.statValue}>{value}</ThemedText>
        <ThemedText style={styles.statLabel}>{label}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tag: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  detailsText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  goal: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  structure: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  progressStrong: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  progressSoft: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  // Month boundaries on the plan-wide progress bar.
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: 'rgba(242,90,0,0.55)',
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '600',
  },
});
