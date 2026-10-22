import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { BrandWordmark } from '@/components/ui/brand-wordmark';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  return (
    <ScreenScroll contentContainerStyle={{ justifyContent: 'space-between', flex: 1 }}>
      <View style={{ flex: 1 }} />

      <View style={styles.hero}>
        <BrandWordmark tagline style={styles.logo} />
        <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          Il tuo personal operating system per corpo, allenamento e alimentazione.
        </ThemedText>
      </View>

      <View style={{ gap: Spacing.three, marginTop: Spacing.six }}>
        <PrimaryButton label="Accedi" onPress={() => router.push('/login')} />
        <PrimaryButton label="Crea un account" variant="outline" onPress={() => router.push('/register')} />
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  logo: {
    width: 260,
    height: 63,
  },
});
