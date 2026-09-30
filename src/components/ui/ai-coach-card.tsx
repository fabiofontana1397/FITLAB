import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AiCoachCardProps = {
  headline: string;
  body: string;
  ctaLabel?: string;
};

/** The same dark "AI Coach" surface Home uses for its generated insights
 * (glow, bulb icon, title), reused here as a single screen-level prompt
 * toward the real chat — one box at the bottom of the page instead of a
 * tip repeated on every exercise/meal card. */
export function AiCoachCard({ headline, body, ctaLabel = 'Apri la chat' }: AiCoachCardProps) {
  const theme = useTheme();
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
