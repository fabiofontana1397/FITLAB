import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AiCoachCardProps = {
  headline: string;
  body: string;
  ctaLabel?: string;
  /** 'compact': the one-tap row used on Training — bulb, BETA tag, headline,
   * body and a chevron, the whole card opening the chat. */
  variant?: 'default' | 'compact';
};

/** The same dark "AI Coach" surface Home uses for its generated insights
 * (glow, bulb icon, title), reused here as a single screen-level prompt
 * toward the real chat — one box at the bottom of the page instead of a
 * tip repeated on every exercise/meal card. */
export function AiCoachCard({ headline, body, ctaLabel = 'Apri la chat', variant = 'default' }: AiCoachCardProps) {
  const theme = useTheme();
  if (variant === 'compact') {
    return (
      <Pressable onPress={() => router.push('/chat')} style={styles.compactCard}>
        <View style={styles.compactBulb}>
          <Icon name="bulb" size={24} color="#F6B21B" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.headerRow}>
            <ThemedText style={styles.compactTitle}>AI Coach</ThemedText>
            <View style={styles.betaPill}>
              <ThemedText style={styles.betaText}>BETA</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.compactHeadline}>{headline}</ThemedText>
          <ThemedText style={styles.compactBody}>{body}</ThemedText>
        </View>
        <View style={styles.compactChevron}>
          <Icon name="chevronRight" size={16} color="#FFFFFF" />
        </View>
      </Pressable>
    );
  }
  return (
    <View style={styles.card}>
      <View pointerEvents="none" style={styles.glow} />
      <View style={styles.headerRow}>
        <Icon name="bulb" size={16} color={theme.accent} />
        <ThemedText style={styles.title}>AI Coach</ThemedText>
      </View>
      <ThemedText style={styles.headline}>{headline}</ThemedText>
      <ThemedText style={styles.body}>{body}</ThemedText>
      <PrimaryButton label={ctaLabel} onPress={() => router.push('/chat')} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    backgroundColor: '#15161A',
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  compactBulb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  betaPill: {
    backgroundColor: 'rgba(124,92,250,0.35)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  betaText: {
    color: '#CBBEFF',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  compactHeadline: {
    color: '#FFFFFF',
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '700',
  },
  compactBody: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '500',
  },
  compactChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  cta: {
    marginTop: Spacing.one,
  },
});
