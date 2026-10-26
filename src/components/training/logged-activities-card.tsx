import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { ACTIVITY_ICON } from '@/components/training/activity-presentation';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { ACTIVITY_INTENSITY_OPTIONS, ACTIVITY_TYPE_OPTIONS } from '@/lib/nutrition/activity-log';
import { useActivityLogStore } from '@/store/activity-log-store';

/** "Allenamenti registrati": every activity logged on `date` through
 * "Registra allenamento" — type, intensity, duration and estimated kcal,
 * with a delete button. Renders nothing when the day has none.
 *
 * `inline` is for use inside a day's own section (Allenamento): just the
 * card, with no section title and no top margin, since the section already
 * says which day it is. */
export function LoggedActivitiesCard({ date, title = 'Allenamenti registrati', inline = false }: { date: string; title?: string; inline?: boolean }) {
  const theme = useTheme();
  const allEntries = useActivityLogStore((s) => s.entries);
  const removeEntry = useActivityLogStore((s) => s.removeEntry);
  const entries = allEntries.filter((e) => e.date === date);
  if (entries.length === 0) return null;

  const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
  const totalKcal = entries.reduce((sum, e) => sum + e.estimatedKcal, 0);

  return (
    <View style={inline ? undefined : styles.wrap}>
      {inline ? null : (
        <View style={styles.headRow}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText style={styles.total} themeColor="textTertiary">
            {totalMinutes} min · {Math.round(totalKcal)} kcal
          </ThemedText>
        </View>
      )}
      <FlatCard radius={20} style={styles.card}>
        {entries.map((entry, i) => {
          const label = ACTIVITY_TYPE_OPTIONS.find((o) => o.value === entry.activityType)?.label ?? 'Attività';
          const intensity = ACTIVITY_INTENSITY_OPTIONS.find((o) => o.value === entry.intensity)?.label ?? '';
          return (
            <View key={entry.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              {/* The whole row opens the workout's sheet; the bin stays its own button. */}
              <Pressable
                onPress={() => router.push({ pathname: '/logged-activity', params: { id: entry.id } })}
                accessibilityRole="button"
                accessibilityLabel={`Dettagli: ${label}`}
                style={({ pressed }) => [styles.open, pressed && styles.pressed]}>
                <View style={[styles.icon, { backgroundColor: theme.brandGreen + '1F' }]}>
                  <Icon name={ACTIVITY_ICON[entry.activityType] ?? 'otherSport'} size={22} color={theme.brandGreen} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText style={styles.name} numberOfLines={1}>
                    {label}
                  </ThemedText>
                  <View style={styles.metaRow}>
                    <Icon name="clock" size={13} color={theme.textTertiary} />
                    <ThemedText style={styles.meta} themeColor="textTertiary">
                      {entry.durationMinutes} min{intensity ? ` · ${intensity}` : ''}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.kcalCol}>
                  <View style={styles.metaRow}>
                    <Icon name="flame" size={14} color={theme.accent} />
                    <ThemedText style={styles.kcal}>{Math.round(entry.estimatedKcal)}</ThemedText>
                  </View>
                  <ThemedText style={styles.meta} themeColor="textTertiary">
                    kcal stimate
                  </ThemedText>
                </View>
              </Pressable>
              <Pressable onPress={() => removeEntry(entry.id)} hitSlop={8} accessibilityLabel={`Elimina ${label}`} style={styles.trash}>
                <Icon name="trash" size={18} color={theme.textTertiary} />
              </Pressable>
            </View>
          );
        })}
      </FlatCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 24,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  total: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  card: {
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  open: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
  kcalCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  kcal: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  trash: {
    padding: 4,
  },
});
