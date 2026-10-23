import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LiquidGlassButton } from '@/components/glass/liquid-glass';
import { Icon } from '@/components/ui/icon';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useUserStore } from '@/store/user-store';

/** The round top-right shortcut to Profilo on the tab screens: a Liquid Glass
 * button holding the person's photo when they set one (inset so the glass
 * rim stays visible around it), otherwise the filled person glyph. */
export function ProfileAvatarButton({ size = 36 }: { size?: number }) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const avatarUri = useUserStore((s) => s.avatarUri);
  const photoSize = size - 4;

  return (
    <LiquidGlassButton
      onPress={() => router.push('/profile')}
      scaleTo={0.9}
      hitSlop={8}
      accessibilityLabel="Profilo"
      size={size}>
      {avatarUri ? (
        <View style={[styles.photo, { width: photoSize, height: photoSize, borderRadius: photoSize / 2 }]}>
          <Image source={{ uri: avatarUri }} style={{ width: photoSize, height: photoSize }} contentFit="cover" />
          {/* The glass's specular sheen continues over the photo. */}
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.sheen,
              { boxShadow: isDark ? 'inset 0px 1px 1px rgba(255,255,255,0.25)' : 'inset 0px 1px 1px rgba(255,255,255,0.6)' },
            ]}
          />
        </View>
      ) : (
        <Icon name="personFilled" size={Math.round(size * 0.55)} color={theme.text} />
      )}
    </LiquidGlassButton>
  );
}

const styles = StyleSheet.create({
  photo: {
    overflow: 'hidden',
  },
  sheen: {
    borderRadius: 999,
    pointerEvents: 'none',
  },
});
