import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { useUserStore } from '@/store/user-store';

/** The round top-right shortcut to Profilo on the tab screens: the person's photo when they set one, otherwise the filled person glyph. */
export function ProfileAvatarButton({ size = 36 }: { size?: number }) {
  const theme = useTheme();
  const avatarUri = useUserStore((s) => s.avatarUri);

  return (
    <Pressable
      onPress={() => router.push('/profile')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Profilo"
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.text }]}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <Icon name="personFilled" size={Math.round(size * 0.6)} color={theme.background} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
