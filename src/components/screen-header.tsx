import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type HeaderIconButtonProps = {
  icon: IconName;
  onPress: () => void;
  /** Defaults to the primary text color; shortcut buttons pass the accent. */
  color?: string;
  accessibilityLabel?: string;
};

/** The circular glass button every screen header uses for its top-right
 * shortcut (profile, plan pages…). */
export function HeaderIconButton({ icon, onPress, color, accessibilityLabel }: HeaderIconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <GlassSurface level="card" radius={Radius.pill} style={styles.avatarWrap}>
        <View style={styles.avatarInner}>
          <Icon name={icon} size={22} color={color ?? theme.text} />
        </View>
      </GlassSurface>
    </Pressable>
  );
}

export type ScreenHeaderProps = {
  eyebrow?: string;
  title: string;
  showProfile?: boolean;
  /** Overrides the default profile-avatar button with a different icon
   * (e.g. a plan-page shortcut) while keeping the exact same circular
   * glass-button treatment every screen's header uses. */
  icon?: IconName;
  iconColor?: string;
  onIconPress?: () => void;
};

export function ScreenHeader({ eyebrow, title, showProfile = true, icon = 'profile', iconColor, onIconPress }: ScreenHeaderProps) {
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

      {showProfile ? <HeaderIconButton icon={icon} color={iconColor} onPress={onIconPress ?? (() => router.push('/profile'))} /> : null}
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
