import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { analyzePhoto } from '@/lib/api/photo-analysis';
import { generatePhotoDetailInsight } from '@/lib/assistant/photo-insight';
import type { BodyMetricSnapshot } from '@/lib/mock/types';
import { formatFullDay } from '@/lib/mock/dates';
import { POSE_LABELS, type BodyPhoto } from '@/store/body-store';

export type PhotoDetailModalProps = {
  photo: BodyPhoto | null;
  allPhotos: BodyPhoto[];
  entries: BodyMetricSnapshot[];
  onClose: () => void;
};

/** Opened by tapping a progress photo: the shot at full size, with the
 * deterministic quick tip shown instantly, plus an on-demand button that
 * calls real Claude vision on the actual pixels — not automatic on every
 * open, since (unlike the quick tip) it's a genuine per-call cost/latency. */
export function PhotoDetailModal({ photo, allPhotos, entries, onClose }: PhotoDetailModalProps) {
  const theme = useTheme();
  const [aiObservation, setAiObservation] = useState<string | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    // Resets the AI panel when a different photo is opened in the same
    // modal instance (Modal stays mounted, only the `photo` prop changes).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop-driven reset, not derived render state
    setAiObservation(null);
    setAiState('idle');
  }, [photo?.id]);

  if (!photo) return null;

  const insight = generatePhotoDetailInsight(photo, allPhotos, entries);

  const samePoseSorted = allPhotos.filter((p) => p.pose === photo.pose).sort((a, b) => a.date.localeCompare(b.date));
  const indexInPose = samePoseSorted.findIndex((p) => p.id === photo.id);
  const previousPhoto = indexInPose > 0 ? samePoseSorted[indexInPose - 1] : undefined;

  const handleAnalyze = async () => {
    setAiState('loading');
    const result = await analyzePhoto(photo.id, previousPhoto?.id);
    if (result) {
      setAiObservation(result);
      setAiState('idle');
    } else {
      setAiState('error');
    }
  };

  return (
    <Modal visible={photo != null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <GlassSurface level="overlay" radius={Radius.xlarge} style={styles.card}>
            <View style={styles.header}>
              <View>
                <ThemedText type="subtitle">{POSE_LABELS[photo.pose] ?? 'Foto'}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {formatFullDay(photo.date)}
                </ThemedText>
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <Icon name="close" size={22} color={theme.text} />
              </Pressable>
            </View>

            <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="cover" />

            <ScrollView style={styles.insightScroll}>
              <View style={styles.insightRow}>
                <Icon name="sparkle" size={16} color={theme.accent} />
                <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
                  {insight}
                </ThemedText>
              </View>

              {aiObservation ? (
                <View style={[styles.insightRow, { marginTop: Spacing.three }]}>
                  <Icon name="camera" size={16} color={theme.accent} />
                  <ThemedText type="small" style={{ flex: 1 }}>
                    {aiObservation}
                  </ThemedText>
                </View>
              ) : null}

              {aiState === 'error' ? (
                <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
                  Analisi non disponibile al momento. Riprova più tardi.
                </ThemedText>
              ) : null}
            </ScrollView>

            {!aiObservation ? (
              <PrimaryButton
                label={aiState === 'loading' ? 'Analisi in corso…' : 'Analizza con AI'}
                icon="sparkle"
                variant="outline"
                disabled={aiState === 'loading'}
                onPress={handleAnalyze}
              />
            ) : null}
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: Spacing.four,
  },
  card: {
    width: 320,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  image: {
    width: '100%',
    height: 340,
    borderRadius: Radius.medium,
  },
  insightScroll: {
    maxHeight: 140,
  },
  insightRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
});
