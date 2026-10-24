import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScrollDefaults } from '@/constants/scroll';
import { CoachOrb } from '@/components/chat/coach-orb';
import { CoachAura, PulseDot } from '@/components/home/coach-aura';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { InsightCard } from '@/components/ui/insight-card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useMotionPreference } from '@/hooks/use-motion-preference';
import { useCoachInsights } from '@/hooks/use-coach-insights';
import { useTheme } from '@/hooks/use-theme';

/** The dark "AI Coach" card at the bottom of Home — deliberately always
 * dark regardless of the app's own light/dark setting (a distinct "AI
 * feature" surface). Alive like the chat FAB: the same orange orb as its
 * avatar and slowly drifting orange light behind the text (coach-aura.tsx).
 * Shows the latest generated insight and opens the full list in a popup. */
export function HomeCoachCard({ isWorkoutDayIncomplete }: { isWorkoutDayIncomplete: boolean }) {
  const { modalAnimation } = useMotionPreference();
  const theme = useTheme();
  const { insights, isLoading, refresh } = useCoachInsights();
  const [modalOpen, setModalOpen] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const topInsight = insights[0];

  return (
    <>
      <View style={[styles.card, { backgroundColor: theme.spotlight }]} onLayout={(e) => setLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        <CoachAura width={layout.width} height={layout.height} />
        <View pointerEvents="none" style={[styles.rim, { borderColor: theme.accentRim }]} />
        <Pressable style={styles.headerRow} onPress={() => setModalOpen(true)} hitSlop={4}>
          <View style={styles.orbHalo}>
            <CoachOrb size={30} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.title, { color: theme.spotlightText }]}>AI Coach</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.spotlightTextFaint }]}>Il tuo consiglio di oggi</ThemedText>
          </View>
          <View style={[styles.pill, { backgroundColor: theme.accentSoft }]}>
            <PulseDot color={theme.accent} />
            <ThemedText style={[styles.pillLabel, { color: theme.accent }]}>Nuovo insight</ThemedText>
          </View>
        </Pressable>
        <ThemedText numberOfLines={1} style={[styles.headline, { color: theme.spotlightText }]}>
          {topInsight?.headline ?? 'Nessun consiglio ancora'}
        </ThemedText>
        <ThemedText style={[styles.body, { color: theme.spotlightTextMuted }]} numberOfLines={3}>
          {topInsight?.body ?? 'Apri per generare un consiglio personalizzato dal coach AI.'}
        </ThemedText>
        <PrimaryButton
          label={isWorkoutDayIncomplete ? "Recupera l'allenamento" : 'Vedi il consiglio'}
          onPress={() => (isWorkoutDayIncomplete ? router.push('/training') : setModalOpen(true))}
          style={styles.button}
        />
      </View>

      <Modal visible={modalOpen} transparent animationType={modalAnimation('fade')} onRequestClose={() => setModalOpen(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.scrim }]} onPress={() => setModalOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalWrap}>
            <FlatCard style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <ThemedText type="smallBold">Consigli del coach AI</ThemedText>
                <Pressable onPress={() => setModalOpen(false)} hitSlop={11} accessibilityRole="button" accessibilityLabel="Chiudi">
                  <Icon name="close" size={20} color={theme.textTertiary} />
                </Pressable>
              </View>
              <ScrollView {...ScrollDefaults} style={styles.modalScroll}>
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
    borderRadius: Radius.large,
    padding: Spacing.four,
    gap: Spacing.two + 2,
    overflow: 'hidden',
  },
  rim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  orbHalo: {
    borderRadius: 999,
    shadowColor: Brand.accentGlow,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  pillLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  headline: {
    marginTop: Spacing.one,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  body: {
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
