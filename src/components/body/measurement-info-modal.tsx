import { Pressable, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDayMonth } from '@/lib/mock/dates';
import type { BodyMetricSnapshot } from '@/lib/mock/types';
import { BodySilhouette, type MeasurementZone } from './body-silhouette';
import { MeasurementTrendChart } from './measurement-trend-chart';

const COPY: Record<MeasurementZone, { title: string; instructions: string }> = {
  shouldersCm: {
    title: 'Spalle',
    instructions:
      'Misura la circonferenza delle spalle passando il metro sopra i deltoidi, nel punto più largo, con le braccia rilassate lungo i fianchi.',
  },
  chestCm: {
    title: 'Petto',
    instructions:
      'Misura intorno al punto più sporgente del petto, passando il metro sotto le ascelle e mantenendolo parallelo al pavimento. Non trattenere il respiro.',
  },
  bicepsCm: {
    title: 'Bicipite',
    instructions:
      'Misura la circonferenza del braccio nel punto più largo del bicipite. Usa sempre la stessa modalità (rilassato o flesso) per confrontare le misure nel tempo.',
  },
  waistCm: {
    title: 'Vita',
    instructions:
      'Misura il punto più stretto della vita, solitamente circa 2 dita sopra l’ombelico. Tieni il metro parallelo al pavimento, senza stringere, e respira normalmente prima di leggere il valore.',
  },
  hipsCm: {
    title: 'Fianchi',
    instructions:
      'Misura intorno al punto più largo di fianchi e glutei, con i piedi uniti e il metro ben orizzontale.',
  },
  thighCm: {
    title: 'Coscia',
    instructions:
      'Misura la circonferenza della coscia nel punto più largo, subito sotto il gluteo, con il peso distribuito su entrambe le gambe.',
  },
};

export type MeasurementInfoModalProps = {
  zone: MeasurementZone | null;
  /** Logged entries: the latest value and the trend come from here. */
  entries: BodyMetricSnapshot[];
  onClose: () => void;
  /** Opens the sheet to log a new value for this zone. */
  onAdd: (zone: MeasurementZone) => void;
};

/**
 * The one popup of a body measurement, opened by tapping its tile: where and how to measure (figure and
 * instructions), the latest value, the trend over time and the button to log a new value.
 */
export function MeasurementInfoModal({ zone, entries, onClose, onAdd }: MeasurementInfoModalProps) {
  const theme = useTheme();
  if (!zone) return null;
  const copy = COPY[zone];
  const logged = entries.filter((e) => Number.isFinite(Number(e[zone])));
  const last = logged[logged.length - 1];

  return (
    <GlassPopup visible={zone != null} onClose={onClose} style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="subtitle">{copy.title}</ThemedText>
        <Pressable onPress={onClose} hitSlop={11} accessibilityRole="button" accessibilityLabel="Chiudi">
          <Icon name="close" size={22} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.howTo}>
        <BodySilhouette zone={zone} height={150} />
        <View style={styles.howToText}>
          <ThemedText type="smallBold">Come misurare</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {copy.instructions}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.valueRow}>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            {last ? `Ultima misura · ${formatDayMonth(last.date)}` : 'Ultima misura'}
          </ThemedText>
          {last ? (
            <View style={styles.value}>
              <ThemedText style={styles.valueNumber}>{String(last[zone]).replace('.', ',')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                cm
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.valueNumber} themeColor="textTertiary">
              —
            </ThemedText>
          )}
        </View>
      </View>

      <MeasurementTrendChart zone={zone} entries={entries} color={theme.accent} />

      <PrimaryButton label="Aggiungi misura" icon="plus" onPress={() => onAdd(zone)} />
    </GlassPopup>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  howTo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  howToText: {
    flex: 1,
    gap: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  value: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  valueNumber: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
});
