import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WelcomeHero } from '@/components/onboarding/welcome-hero';
import { ThemedText } from '@/components/themed-text';
import { BrandWordmark } from '@/components/ui/brand-wordmark';
import { FadeInView } from '@/components/ui/fade-in-view';
import { Icon, type IconName } from '@/components/ui/icon';
import { SocialAuthButtons } from '@/components/auth/social-auth-buttons';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Layout, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const FEATURES: { icon: IconName; label: string }[] = [
  { icon: 'barbell', label: 'Allenamenti\nsu misura' },
  { icon: 'utensils', label: 'Piani nutrizionali\npersonalizzati' },
  { icon: 'barChart', label: 'Monitora\ni progressi' },
];

export default function WelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // The hero takes whatever height is left once logo, copy and buttons are laid out, so the page always fits one screen.
  const [heroSpace, setHeroSpace] = useState(0);
  // Only the tallest phones (Plus / Pro Max) keep the roomier type and logo; the others tighten them so the plate
  // stays large once the Apple button is in, and nothing scrolls. Measured on the usable height (no notch, no home bar).
  const roomy = useWindowDimensions().height - insets.top - insets.bottom >= 800;
  const isLight = theme.tabBarBlur === 'light';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {isLight ? (
        <LinearGradient
          colors={[theme.washTop, theme.background, theme.washBottom]}
          locations={[0, 0.45, 1]}
          style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
        />
      ) : null}
      <View style={[styles.page, { paddingTop: insets.top + (roomy ? Spacing.three : Spacing.two), paddingBottom: insets.bottom + Spacing.three }]}>
        <FadeInView style={styles.logoRow}>
          <BrandWordmark name tagline height={roomy ? 58 : 46} />
        </FadeInView>

        <View style={styles.heroSlot} onLayout={(e) => setHeroSpace(e.nativeEvent.layout.height)}>
          {heroSpace > 0 ? <WelcomeHero maxHeight={heroSpace - Spacing.two} /> : null}
        </View>

        <FadeInView delay={500} style={styles.copy}>
          <ThemedText type="display" style={[styles.centered, styles.title, roomy && styles.titleRoomy]}>
            Inizia oggi a raggiungere i tuoi obiettivi
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={[styles.centered, styles.subtitle]}>
            Dieta, allenamento e progressi in un’unica app, semplice e personalizzata.
          </ThemedText>
        </FadeInView>
        <FadeInView delay={650} style={[styles.features, roomy && styles.featuresRoomy]}>
          {FEATURES.map((feature, i) => (
            <View key={feature.label} style={[styles.feature, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.borderStrong }]}>
              <Icon name={feature.icon} size={roomy ? 30 : 24} color={theme.accent} />
              <ThemedText style={[styles.featureLabel, roomy && styles.featureLabelRoomy]}>{feature.label}</ThemedText>
            </View>
          ))}
        </FadeInView>

        <FadeInView delay={750} style={styles.actions}>
          <SocialAuthButtons />
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  page: { flex: 1, width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Layout.screenGutter },
  logoRow: { alignItems: 'center' },
  heroSlot: { flex: 1, minHeight: 170, justifyContent: 'center', marginVertical: Spacing.two },
  copy: { gap: 6, alignItems: 'center' },
  centered: { textAlign: 'center' },
  title: { fontSize: 25, lineHeight: 30, letterSpacing: -0.6 },
  titleRoomy: { fontSize: 28, lineHeight: 34 },
  subtitle: { fontSize: 15, lineHeight: 20 },
  features: { flexDirection: 'row', alignSelf: 'stretch', marginTop: Spacing.three, marginBottom: Spacing.three },
  featuresRoomy: { marginTop: Spacing.four, marginBottom: Spacing.four },
  feature: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  featureLabel: { fontSize: 12, lineHeight: 15, fontWeight: '700', textAlign: 'center' },
  featureLabelRoomy: { fontSize: 13, lineHeight: 17 },
  actions: { gap: 10 },
  loginRow: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', paddingTop: Spacing.one },
});
