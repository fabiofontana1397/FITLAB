import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';

export type HeaderIconButtonProps = {
  icon: IconName;
  onPress: () => void;
  /** Defaults to the primary text color; shortcut buttons pass the accent. */
  color?: string;
  accessibilityLabel?: string;
};

/** The round white button every screen header uses for its top-right
 * shortcut (profile, plan pages…): 44 pt, soft shadow, white edge. */
export function HeaderIconButton({ icon, onPress, color, accessibilityLabel }: HeaderIconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: theme.iconButton, borderColor: theme.cardEdge },
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={20} color={color ?? theme.text} />
    </Pressable>
  );
}

export type ScreenHeaderProps = {
  /** Small grey line under the title (what the screen is about). */
  eyebrow?: string;
  title: string;
  showProfile?: boolean;
  /** Overrides the default profile-avatar button with a different icon
   * (e.g. a plan-page shortcut) while keeping the exact same round-button
   * treatment every screen's header uses. */
  icon?: IconName;
  iconColor?: string;
  onIconPress?: () => void;
};

export function ScreenHeader({ eyebrow, title, showProfile = true, icon = 'profile', iconColor, onIconPress }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={{ gap: 3, flexShrink: 1 }}>
        <ThemedText type="title" style={styles.title}>
          {title}
        </ThemedText>
        {eyebrow ? (
          <ThemedText type="small" themeColor="textSecondary">
            {eyebrow}
          </ThemedText>
        ) : null}
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
  title: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { boxShadow: '0px 6px 16px rgba(20,20,25,0.08)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  pressed: {
    opacity: 0.6,
  },
});
