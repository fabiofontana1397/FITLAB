import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

function formatKcal(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 150 -> "2h 30m", 45 -> "45m". */
export function formatDuration(totalMinutes: number): string {
  const m = Math.round(totalMinutes);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  return `${h}h ${String(rest).padStart(2, '0')}m`;
}

export type TrainingWeekStatsProps = {
  sessionsDone: number;
  sessionsPlanned: number;
  kcal: number;
  minutes: number;
  onSeeAll: () => void;
};

function Stat({ icon, tint, value, label }: { icon: IconName; tint: string; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.iconTile, { backgroundColor: `${tint}22` }]}>
        <Icon name={icon} size={19} color={tint} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <ThemedText style={styles.value} numberOfLines={1}>
          {value}
        </ThemedText>
        <ThemedText style={styles.label} themeColor="textTertiary" numberOfLines={2}>
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

/** "I tuoi allenamenti di questa settimana": sessions done, kcal burned and
 * total time, with a "Vedi tutti" link. */
export function TrainingWeekStats({ sessionsDone, sessionsPlanned, kcal, minutes, onSeeAll }: TrainingWeekStatsProps) {
  const theme = useTheme();
  return (
    <FlatCard radius={20} style={styles.card}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.heading}>I tuoi allenamenti di questa settimana</ThemedText>
        <ThemedText onPress={onSeeAll} style={[styles.link, { color: BLUE }]}>
          Vedi tutti ›
        </ThemedText>
      </View>
      <View style={styles.row}>
        <Stat icon="barbell" tint={theme.accent} value={`${sessionsDone}/${sessionsPlanned}`} label="Sessioni completate" />
        <Stat icon="flame" tint="#E5392D" value={formatKcal(kcal)} label="kcal bruciate" />
        <Stat icon="clock" tint="#F59E0B" value={formatDuration(minutes)} label="Tempo totale" />
      </View>
    </FlatCard>
  );
}

const BLUE = '#2E6BEA';

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heading: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  link: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  label: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '500',
  },
});
