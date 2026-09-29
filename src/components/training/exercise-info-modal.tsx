import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ExerciseMedia } from '@/lib/exercise-media/exercise-media';

const SHEET_MAX_WIDTH = 440;

/** "2-0-1" / "3-1-1-0" — the standard tempo notation used across the
 * plan: eccentric (lowering) - pause at the bottom - concentric
 * (lifting) - an optional final pause at the top. Returns null for any
 * value that doesn't parse as 3 or 4 dash-separated numbers, so a
 * custom/free-text tempo just renders as-is with no breakdown rather
 * than a broken one. */
const TEMPO_PHASE_LABELS: Record<3 | 4, string[]> = {
  3: ['Fase eccentrica (discesa)', 'Pausa in basso', 'Fase concentrica (spinta)'],
  4: ['Fase eccentrica (discesa)', 'Pausa in basso', 'Fase concentrica (spinta)', 'Pausa in alto'],
};
function describeTempo(tempo: string): { phase: string; seconds: string }[] | null {
  const parts = tempo.split('-').map((p) => p.trim());
  if ((parts.length !== 3 && parts.length !== 4) || parts.some((p) => p === '' || Number.isNaN(Number(p)))) return null;
  const labels = TEMPO_PHASE_LABELS[parts.length as 3 | 4];
  return parts.map((seconds, i) => ({ phase: labels[i], seconds }));
}

export type ExerciseInfoModalProps = {
  visible: boolean;
  exerciseName: string;
  media: ExerciseMedia | undefined;
  sets: number;
  reps: string;
  tempo: string;
  restLabel: string;
  onClose: () => void;
};

export function ExerciseInfoModal({ visible, exerciseName, media, sets, reps, tempo, restLabel, onClose }: ExerciseInfoModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tempoPhases = describeTempo(tempo);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <GlassSurface
          level="overlay"
          radius={Radius.xlarge}
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={{ flex: 1 }}>
              {exerciseName}
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.detailsCard, { backgroundColor: theme.backgroundElement }]}>
              <DetailRow icon="repsHash" label="Serie e ripetizioni" value={`${sets} serie × ${reps} rip.`} />
              <DetailRow icon="hourglass" label="Modalità di esecuzione" value={tempo} />
              {tempoPhases ? (
                <View style={styles.tempoBreakdown}>
                  {tempoPhases.map((p) => (
                    <View key={p.phase} style={styles.tempoPhaseRow}>
                      <ThemedText type="caption" themeColor="textSecondary" style={{ flex: 1 }}>
                        {p.phase}
                      </ThemedText>
                      <ThemedText type="caption" style={{ fontWeight: '700' }}>
                        {p.seconds}s
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
              <DetailRow icon="clockOutline" label="Recupero tra le serie" value={restLabel} />
            </View>

            {media ? (
              <>
                <Image source={{ uri: media.gifUrl }} style={[styles.gif, { backgroundColor: theme.backgroundElement }]} resizeMode="cover" />

                <View style={[styles.targetChip, { backgroundColor: theme.accentSoft }]}>
                  <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '700' }}>
                    {media.target}
                  </ThemedText>
                </View>

                <ThemedText type="smallBold" style={{ marginTop: Spacing.four }}>
                  Come si esegue
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 4 }}>
                  {media.instructions}
                </ThemedText>

                <ThemedText type="smallBold" style={[styles.sectionTitle, { color: theme.success }]}>
                  Cosa fare
                </ThemedText>
                {media.doTips.map((tip) => (
                  <TipRow key={tip} icon="checkCircle" color={theme.success} text={tip} />
                ))}

                <ThemedText type="smallBold" style={[styles.sectionTitle, { color: theme.danger }]}>
                  Cosa evitare
                </ThemedText>
                {media.dontTips.map((tip) => (
                  <TipRow key={tip} icon="close" color={theme.danger} text={tip} />
                ))}

                <ThemedText type="caption" themeColor="textTertiary" style={{ marginTop: Spacing.four }}>
                  {media.attribution}
                </ThemedText>
              </>
            ) : (
              <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: Spacing.three }}>
                Descrizione non ancora disponibile per questo esercizio.
              </ThemedText>
            )}
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  );
}

function DetailRow({ icon, label, value }: { icon: 'repsHash' | 'hourglass' | 'clockOutline'; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.detailRow}>
      <Icon name={icon} size={15} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

function TipRow({ icon, color, text }: { icon: 'checkCircle' | 'close'; color: string; text: string }) {
  return (
    <View style={styles.tipRow}>
      <Icon name={icon} size={14} color={color} />
      <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    maxHeight: '85%',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  gif: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.large,
  },
  targetChip: {
    alignSelf: 'flex-start',
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  sectionTitle: {
    marginTop: Spacing.four,
    marginBottom: 4,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: 3,
  },
  detailsCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tempoBreakdown: {
    gap: 2,
    marginLeft: Spacing.four,
  },
  tempoPhaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
