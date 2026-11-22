import { Pressable, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BodySilhouette, type MeasurementZone } from './body-silhouette';

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
  onClose: () => void;
};

export function MeasurementInfoModal({ zone, onClose }: MeasurementInfoModalProps) {
  const theme = useTheme();
  if (!zone) return null;
  const copy = COPY[zone];

  return (
    <GlassPopup visible={zone != null} onClose={onClose} style={styles.card}>
            <View style={styles.header}>
              <ThemedText type="subtitle">Come misurare: {copy.title}</ThemedText>
              <Pressable onPress={onClose} hitSlop={11} accessibilityRole="button" accessibilityLabel="Chiudi">
                <Icon name="close" size={22} color={theme.text} />
              </Pressable>
            </View>
            <View style={styles.silhouetteWrap}>
              <BodySilhouette zone={zone} width={200} radius={16} />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {copy.instructions}
            </ThemedText>
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
  silhouetteWrap: {
    alignItems: 'center',
  },
});
