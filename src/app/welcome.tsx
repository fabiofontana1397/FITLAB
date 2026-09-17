import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function WelcomeScreen() {
  const theme = useTheme();

  return (
    <ScreenScroll contentContainerStyle={{ justifyContent: 'space-between', flex: 1 }}>
      <View style={{ flex: 1 }} />

      <View style={styles.hero}>
        <GlassSurface level="raised" radius={Radius.pill} style={styles.logoBadge}>
          <View style={styles.logoInner}>
            <Icon name="bolt" size={32} color={theme.accent} />
          </View>
        </GlassSurface>
        <ThemedText type="hero" style={{ textAlign: 'center' }}>
          FITLAB
        </ThemedText>
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
  logoBadge: {
    width: 72,
    height: 72,
  },
  logoInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
