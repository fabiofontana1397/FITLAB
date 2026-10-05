import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { InsightCard } from '@/components/ui/insight-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useCoachInsights } from '@/hooks/use-coach-insights';
import { useTheme } from '@/hooks/use-theme';

/** The dark "AI Coach" card at the bottom of Home — deliberately always
 * dark regardless of the app's own light/dark setting (a distinct "AI
 * feature" surface, like the chat FAB's own orb), with a soft glowing
 * accent circle bleeding off the bottom-right corner. Shows the latest
 * generated insight and opens the full list in a popup. */
export function HomeCoachCard({ isWorkoutDayIncomplete }: { isWorkoutDayIncomplete: boolean }) {
  const theme = useTheme();
  const { insights, isLoading, refresh } = useCoachInsights();
  const [modalOpen, setModalOpen] = useState(false);
  const topInsight = insights[0];

  return (
    <>
      <View style={styles.card}>
        <View pointerEvents="none" style={styles.glow} />
        <Pressable style={styles.headerRow} onPress={() => setModalOpen(true)} hitSlop={4}>
          <Icon name="bulb" size={16} color={theme.accent} />
          <ThemedText style={styles.title}>AI Coach</ThemedText>
          <View style={styles.pill}>
            <ThemedText style={styles.pillLabel}>Nuovo insight</ThemedText>
          </View>
        </Pressable>
        <ThemedText numberOfLines={1} style={styles.headline}>
          {topInsight?.headline ?? 'Nessun consiglio ancora'}
        </ThemedText>
        <ThemedText style={styles.body} numberOfLines={3}>
          {topInsight?.body ?? 'Apri per generare un consiglio personalizzato dal coach AI.'}
        </ThemedText>
        <PrimaryButton
          label={isWorkoutDayIncomplete ? "Recupera l'allenamento" : 'Vedi il consiglio'}
          onPress={() => (isWorkoutDayIncomplete ? router.push('/training') : setModalOpen(true))}
          style={styles.button}
        />
      </View>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalWrap}>
            <FlatCard style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <ThemedText type="smallBold">Consigli del coach AI</ThemedText>
                <Pressable onPress={() => setModalOpen(false)} hitSlop={8}>
                  <Icon name="close" size={20} color={theme.textTertiary} />
                </Pressable>
              </View>
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <View style={{ gap: Spacing.three }}>
                  {insights.length === 0 ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      Nessun consiglio disponibile al momento.
                    </ThemedText>
                  ) : null}
                  {insights.map((insight) => (
                    <InsightCard key={insight.id} tone={insight.tone} headline={insight.headline} body={insight.body} />
                  ))}
                </View>
              </ScrollView>
              <Pressable onPress={isLoading ? undefined : refresh} hitSlop={8}>
                <ThemedText type="caption" style={{ color: theme.accent, textAlign: 'center', fontWeight: '700' }}>
                  {isLoading ? 'Aggiornamento…' : 'Aggiorna consigli'}
                </ThemedText>
              </Pressable>
            </FlatCard>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#15161A',
    borderRadius: Radius.large,
    padding: Spacing.four,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    bottom: -70,
    right: -50,
    backgroundColor: '#FF7A00',
    opacity: 0.3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  pill: {
    backgroundColor: 'rgba(255,122,0,0.22)',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  pillLabel: {
    color: '#FF7A00',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  button: {
    marginTop: Spacing.one,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: Spacing.four,
  },
  modalWrap: {
    width: '100%',
    maxWidth: 380,
  },
  modalCard: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalScroll: {
    maxHeight: 420,
  },
});
