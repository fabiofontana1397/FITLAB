import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WelcomeHero } from '@/components/onboarding/welcome-hero';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { BrandWordmark } from '@/components/ui/brand-wordmark';
import { FadeInView } from '@/components/ui/fade-in-view';
import { Icon, type IconName } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FEATURES: { icon: IconName; label: string }[] = [
  { icon: 'barbell', label: 'Allenamenti\nsu misura' },
  { icon: 'utensils', label: 'Piani nutrizionali\npersonalizzati' },
  { icon: 'barChart', label: 'Monitora\ni progressi' },
];

export default function WelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScreenScroll contentContainerStyle={{ justifyContent: 'space-between', flex: 1, paddingBottom: insets.bottom + Spacing.four }}>
      <FadeInView style={styles.logoRow}>
        <BrandWordmark name tagline height={56} />
      </FadeInView>

      <View style={styles.hero}>
        <WelcomeHero />
        <FadeInView delay={500} style={styles.copy}>
          <ThemedText type="display" style={[styles.centered, styles.title]}>
            Inizia oggi a raggiungere i tuoi obiettivi
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centered}>
            Dieta, allenamento e progressi in un’unica app, semplice e personalizzata.
          </ThemedText>
        </FadeInView>
        <FadeInView delay={650} style={styles.features}>
          {FEATURES.map((feature, i) => (
            <View key={feature.label} style={[styles.feature, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.borderStrong }]}>
              <Icon name={feature.icon} size={30} color={theme.accent} />
              <ThemedText style={styles.featureLabel}>{feature.label}</ThemedText>
            </View>
          ))}
        </FadeInView>
      </View>

      <FadeInView delay={750} style={{ gap: Spacing.three }}>
        <PrimaryButton label="Crea un account" onPress={() => router.push('/register')} />
        <Pressable onPress={() => router.push('/login')} hitSlop={8} accessibilityRole="button" style={styles.loginRow}>
          <ThemedText type="small" themeColor="textSecondary">
            Hai già un account?{' '}
          </ThemedText>
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Accedi
          </ThemedText>
        </Pressable>
      </FadeInView>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  logoRow: { alignItems: 'center', paddingTop: Spacing.two },
  hero: { alignItems: 'center', gap: Spacing.three },
  copy: { gap: Spacing.two, alignItems: 'center' },
  centered: { textAlign: 'center' },
  title: { fontSize: 27, lineHeight: 33, letterSpacing: -0.6 },
  features: { flexDirection: 'row', alignSelf: 'stretch', marginTop: Spacing.two },
  feature: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  featureLabel: { fontSize: 13, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  loginRow: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', paddingVertical: Spacing.two },
});
