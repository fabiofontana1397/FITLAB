import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassCloseButton } from '@/components/glass/liquid-glass';
import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { PopupScrollView } from '@/components/ui/swipe-dismiss';
import { ScrollDefaults } from '@/constants/scroll';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticTap } from '@/lib/haptics';
import { measurementHistory } from '@/lib/mock/body';
import { formatDayMonth, formatFullDay } from '@/lib/mock/dates';
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
  /** Deletes the measurement of one day for this zone. */
  onDelete: (zone: MeasurementZone, date: string) => void;
};

/**
 * The one popup of a body measurement, opened by tapping its tile: where and how to measure (figure and
 * instructions), the latest value, the trend over time and the button to log a new value.
 */
export function MeasurementInfoModal({ zone, entries, onClose, onAdd, onDelete }: MeasurementInfoModalProps) {
  const theme = useTheme();
  // The row asking "Eliminare?" (one at a time), reset when the popup changes zone.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [shownZone, setShownZone] = useState(zone);
  if (zone !== shownZone) {
    setShownZone(zone);
    setConfirming(null);
  }
  if (!zone) return null;
  const copy = COPY[zone];
  const history = measurementHistory(entries, zone);
  const last = history[history.length - 1];

  return (
    <GlassPopup visible={zone != null} onClose={onClose} style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="subtitle">{copy.title}</ThemedText>
        <GlassCloseButton onPress={onClose} />
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
              <ThemedText style={styles.valueNumber}>{String(last.value).replace('.', ',')}</ThemedText>
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

      {history.length > 0 ? (
        <View style={styles.history}>
          <ThemedText type="smallBold">Misure registrate</ThemedText>
          <PopupScrollView {...ScrollDefaults} style={styles.historyScroll}>
            {[...history].reverse().map((h, i) => {
              const asking = confirming === h.date;
              return (
                <View key={h.date} style={[styles.historyRow, i > 0 ? { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.historyDate}>
                    {formatFullDay(h.date)}
                  </ThemedText>
                  {asking ? (
                    <View style={styles.confirm}>
                      <Pressable onPress={() => setConfirming(null)} hitSlop={8} accessibilityRole="button">
                        <ThemedText type="small" themeColor="textSecondary">
                          Annulla
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          hapticTap();
                          setConfirming(null);
                          onDelete(zone, h.date);
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Elimina la misura del ${formatFullDay(h.date)}`}
                      >
                        <ThemedText type="smallBold" style={{ color: theme.danger }}>
                          Elimina
                        </ThemedText>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.confirm}>
                      <ThemedText type="smallBold" style={styles.tabular}>{`${String(h.value).replace('.', ',')} cm`}</ThemedText>
                      <Pressable
                        onPress={() => setConfirming(h.date)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={`Elimina ${String(h.value).replace('.', ',')} centimetri del ${formatFullDay(h.date)}`}
                      >
                        <Icon name="trash" size={17} color={theme.textTertiary} />
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </PopupScrollView>
        </View>
      ) : null}

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
  history: {
    gap: 4,
  },
  historyScroll: {
    maxHeight: 168,
  },
  historyRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  historyDate: {
    flexShrink: 1,
  },
  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  valueNumber: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
});
