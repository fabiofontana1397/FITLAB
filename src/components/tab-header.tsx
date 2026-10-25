import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { LiquidGlassButton } from '@/components/glass/liquid-glass';
import { ThemedText } from '@/components/themed-text';
import { BrandMark } from '@/components/ui/brand-mark';
import { Icon } from '@/components/ui/icon';
import { ProfileAvatarButton } from '@/components/ui/profile-avatar-button';
import { useTheme } from '@/hooks/use-theme';

const BUTTON = 40;

export type TabHeaderProps = {
  title: string;
  /** Small grey line under the title. */
  subtitle?: string;
  /** Sits right after the title (Home puts its calendar button here). */
  accessory?: ReactNode;
};

/**
 * The top of every main page: the FitLab mark at the top left, notifications
 * and profile at the top right on the same line, and the page title under the
 * mark, with an optional button right next to it.
 */
export function TabHeader({ title, subtitle, accessory }: TabHeaderProps) {
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <BrandMark height={26} />
        <View style={styles.actions}>
          <LiquidGlassButton onPress={() => router.push('/notification-settings' as Href)} hitSlop={8} scaleTo={0.9} accessibilityLabel="Notifiche" size={BUTTON}>
            <Icon name="bell" size={19} color={theme.text} />
          </LiquidGlassButton>
          <ProfileAvatarButton size={BUTTON} />
        </View>
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText style={styles.subtitle} themeColor="textSecondary" numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {accessory}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  titleText: { flexShrink: 1 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 19, fontWeight: '400', marginTop: 1 },
});
