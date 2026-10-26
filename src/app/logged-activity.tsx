import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ACTIVITY_CATEGORY, ACTIVITY_ICON } from '@/components/training/activity-presentation';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Layout, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { daysAgoISO } from '@/lib/mock/dates';
import { ACTIVITY_INTENSITY_OPTIONS, ACTIVITY_TYPE_OPTIONS } from '@/lib/nutrition/activity-log';
import { useActivityLogStore } from '@/store/activity-log-store';

/** The tile beside the title: the activity's glyph in the training green. */
const TILE = 64;

/**
 * "Allenamento registrato": a workout the user logged with "Registra
 * allenamento", opened from its box on the Allenamento page. The same sheet
 * as Profilo and Promemoria; inside, the estimated kcal as the figure, the
 * duration / intensity / kind of effort under it, then the details as a list.
 */
export default function LoggedActivityScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const entry = useActivityLogStore((s) => s.entries.find((e) => e.id === id));
  const removeEntry = useActivityLogStore((s) => s.removeEntry);

  const typeLabel = ACTIVITY_TYPE_OPTIONS.find((o) => o.value === entry?.activityType)?.label ?? 'Attività';
  const intensityLabel = ACTIVITY_INTENSITY_OPTIONS.find((o) => o.value === entry?.intensity)?.label ?? '';
  const dayLabel = !entry
    ? ''
    : entry.date === daysAgoISO(0)
      ? 'Oggi'
      : (() => {
          const label = new Date(entry.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
          return label.charAt(0).toUpperCase() + label.slice(1);
        })();

  return (
    <SheetScreen
      title={entry ? typeLabel : 'Allenamento'}
      eyebrow={entry ? 'Allenamento registrato' : 'Questo allenamento non c’è più.'}
      fallbackHref="/training"
      leading={
        entry ? (
          <View style={[styles.tile, { backgroundColor: theme.brandGreen + '1F' }]}>
            <Icon name={ACTIVITY_ICON[entry.activityType] ?? 'otherSport'} size={34} color={theme.brandGreen} />
          </View>
        ) : undefined
      }>
      {(close) =>
        entry ? (
          <>
            <FlatCard radius={24} style={styles.hero}>
              <View style={[styles.flame, { backgroundColor: theme.accentSoft }]}>
                <Icon name="flame" size={26} color={theme.accent} />
              </View>
              <ThemedText style={styles.kcal} accessibilityLabel={`${Math.round(entry.estimatedKcal)} kcal stimate`}>
                {Math.round(entry.estimatedKcal)}
              </ThemedText>
              <ThemedText style={styles.kcalUnit} themeColor="textSecondary">
                kcal stimate
              </ThemedText>

              <View style={[styles.rule, { backgroundColor: theme.border }]} />

              <View style={styles.stats}>
                <Stat icon="clock" label="Durata" value={`${entry.durationMinutes} min`} />
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <Stat icon="gauge" label="Intensità" value={intensityLabel} />
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <Stat icon={ACTIVITY_ICON[entry.activityType] ?? 'otherSport'} label="Attività" value={ACTIVITY_CATEGORY[entry.activityType]} />
              </View>
            </FlatCard>

            <FlatCard radius={24} style={styles.details}>
              <ThemedText style={styles.detailsTitle} accessibilityRole="header">
                Dettagli allenamento
              </ThemedText>
              <DetailRow label="Tipo di attività" value={typeLabel} first />
              <DetailRow label="Data" value={dayLabel} />
              <DetailRow label="Durata" value={`${entry.durationMinutes} minuti`} />
              <DetailRow label="Intensità" value={intensityLabel} />
              <DetailRow label="Calorie bruciate" value={`${Math.round(entry.estimatedKcal)} kcal stimate`} />
            </FlatCard>

            <View style={styles.note}>
              <Icon name="info" size={20} color={theme.textTertiary} />
              <ThemedText style={styles.noteText} themeColor="textSecondary">
                Il consumo calorico è una stima e può variare in base a peso, ritmo e percorso.
              </ThemedText>
            </View>

            <View style={styles.actions}>
              <PrimaryButton label="Fatto" onPress={close} />
              <Pressable
                onPress={() => {
                  removeEntry(entry.id);
                  close();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Elimina ${typeLabel}`}
                style={styles.remove}>
                <ThemedText style={[styles.removeLabel, { color: theme.danger }]}>Elimina allenamento</ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <PrimaryButton label="Chiudi" onPress={close} />
        )
      }
    </SheetScreen>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={26} color={theme.textTertiary} />
      <ThemedText style={styles.statLabel} themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.statValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function DetailRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.detailRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <ThemedText style={styles.detailValue} themeColor="textSecondary">
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    paddingTop: Layout.cardPadding,
    paddingBottom: Layout.cardPadding,
    paddingHorizontal: Layout.cardPadding,
  },
  flame: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kcal: {
    marginTop: Spacing.two,
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '800',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  kcalUnit: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
  },
  rule: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
  },
  stats: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    lineHeight: 21,
    textAlign: 'center',
    fontWeight: '700',
  },
  details: {
    paddingHorizontal: Layout.cardPadding,
    paddingTop: Layout.cardPadding,
    paddingBottom: 4,
  },
  detailsTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  detailRow: {
    minHeight: Layout.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: 10,
  },
  detailLabel: {
    flexShrink: 0,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
  },
  detailValue: {
    flexShrink: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'right',
  },
  note: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: 4,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  actions: {
    gap: Spacing.one,
    alignItems: 'stretch',
  },
  remove: {
    minHeight: Layout.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeLabel: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
});
