import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';

export default function WelcomeScreen() {
  return (
    <ScreenScroll contentContainerStyle={{ justifyContent: 'space-between', flex: 1 }}>
      <View style={{ flex: 1 }} />

      <View style={styles.hero}>
        <Image source={require('@/assets/images/logo-wordmark.png')} style={styles.logo} resizeMode="contain" />
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
    height: 71,
  },
});
