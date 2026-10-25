import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FoodHero } from '@/components/onboarding/food-hero';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { BrandWordmark } from '@/components/ui/brand-wordmark';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function WelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScreenScroll contentContainerStyle={{ justifyContent: 'space-between', flex: 1, paddingBottom: insets.bottom + Spacing.four }}>
      <FadeInView style={styles.logoRow}>
        <BrandWordmark tagline height={60} />
      </FadeInView>

      <View style={styles.hero}>
        <FoodHero size={228} />
        <FadeInView delay={500} style={styles.copy}>
          <ThemedText type="display" style={styles.centered}>
            Inizia oggi a raggiungere i tuoi obiettivi
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.centered}>
            Il tuo personal operating system per corpo, allenamento e alimentazione.
          </ThemedText>
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
  loginRow: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', paddingVertical: Spacing.two },
});
