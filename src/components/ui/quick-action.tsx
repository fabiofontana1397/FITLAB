import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type QuickActionProps = {
  icon: IconName;
  label: string;
  /** One short line under the label. */
  hint?: string;
  onPress: () => void;
  /** The primary pair (register a meal, register a workout) is filled with
   * its colour; everything else is a quiet card. */
  tone?: 'accent' | 'green' | 'neutral';
};

/**
 * One shortcut on the Home grid: an icon tile, a label, and nothing else.
 * Two filled tiles carry the day's two main actions, the rest stay quiet so
 * the hierarchy reads at a glance.
 */
export function QuickAction({ icon, label, hint, onPress, tone = 'neutral' }: QuickActionProps) {
  const theme = useTheme();
  const filled = tone !== 'neutral';
  const fill = tone === 'accent' ? theme.accent : tone === 'green' ? theme.brandGreen : theme.backgroundElevated;
  const labelColor = filled ? theme.onAccent : theme.text;
  const iconColor = filled ? theme.onAccent : theme.accent;

  return (
    <PressableScale
      onPress={onPress}
      haptic={filled ? 'press' : 'tap'}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.tile,
        {
          backgroundColor: fill,
          borderColor: filled ? 'transparent' : theme.cardEdge,
          borderWidth: filled ? 0 : 1,
        },
      ]}>
      <View
        style={[
          styles.iconBox,
          { backgroundColor: filled ? 'rgba(255,255,255,0.22)' : theme.backgroundElement },
        ]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.textCol}>
        <ThemedText type="smallBold" style={{ color: labelColor }} numberOfLines={2}>
          {label}
        </ThemedText>
        {hint ? (
          <ThemedText
            type="caption"
            style={{ color: filled ? 'rgba(255,255,255,0.86)' : theme.textTertiary }}
            numberOfLines={1}>
            {hint}
          </ThemedText>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 92,
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    gap: 1,
  },
});
