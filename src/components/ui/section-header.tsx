import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SectionHeaderProps = {
  title: string;
  action?: string;
  onActionPress?: () => void;
  icon?: IconName;
  iconLabel?: string;
  onIconPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, action, onActionPress, icon, iconLabel, onIconPress, style }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View style={[styles.row, style]}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {action ? (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            {action}
          </ThemedText>
        </Pressable>
      ) : null}
      {icon ? (
        <Pressable onPress={onIconPress} hitSlop={8} style={styles.iconGroup}>
          {iconLabel ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {iconLabel}
            </ThemedText>
          ) : null}
          <View style={[styles.iconButton, { backgroundColor: theme.backgroundElement }]}>
            <Icon name={icon} size={16} color={theme.text} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
