import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScreenHeaderProps = {
  eyebrow?: string;
  title: string;
  showProfile?: boolean;
  /** Overrides the default profile-avatar button with a different icon
   * (e.g. Nutrition's calendar shortcut) while keeping the exact same
   * circular glass-button treatment every screen's header uses. */
  icon?: IconName;
  onIconPress?: () => void;
};

export function ScreenHeader({ eyebrow, title, showProfile = true, icon = 'profile', onIconPress }: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={{ gap: 2 }}>
        {eyebrow ? (
          <ThemedText type="label" themeColor="textSecondary">
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText type="display">{title}</ThemedText>
      </View>

      {showProfile ? (
        <Pressable onPress={onIconPress ?? (() => router.push('/profile'))} hitSlop={8}>
          <GlassSurface level="card" radius={Radius.pill} style={styles.avatarWrap}>
            <View style={styles.avatarInner}>
              <Icon name={icon} size={22} color={theme.text} />
            </View>
          </GlassSurface>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  avatarWrap: {
    width: 44,
    height: 44,
  },
  avatarInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
