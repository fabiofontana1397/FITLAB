import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { SpringPressIn, SpringPressOut } from '@/constants/motion';
import { hapticPress, hapticTap } from '@/lib/haptics';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'filled' | 'ghost' | 'outline';
  icon?: IconName;
  /** An extra icon at the trailing edge (e.g. a "›" chevron hinting the
   * button opens a detail screen), independent of the leading `icon`. */
  trailingIcon?: IconName;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Tighter padding + smaller label, for narrow contexts (e.g. a half-width card) where the default size would wrap. */
  dense?: boolean;
};

export function PrimaryButton({
  label,
  onPress,
  variant = 'filled',
  icon,
  trailingIcon,
  style,
  disabled,
  dense,
}: PrimaryButtonProps) {
  const theme = useTheme();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.04 }],
    opacity: disabled ? 0.5 : 1 - pressed.value * 0.08,
  }));

  const background =
    variant === 'filled' ? theme.accent : variant === 'outline' ? 'transparent' : theme.accentSoft;
  const textColor = variant === 'filled' ? theme.onAccent : theme.accent;

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        disabled={disabled}
        onPressIn={() => (pressed.value = withSpring(1, SpringPressIn))}
        onPressOut={() => (pressed.value = withSpring(0, SpringPressOut))}
        onPress={() => {
          if (variant === 'filled') hapticPress();
          else hapticTap();
          onPress?.();
        }}
        style={[
          styles.base,
          dense && styles.baseDense,
          {
            backgroundColor: background,
            borderWidth: variant === 'outline' ? 1.5 : 0,
            borderColor: theme.accent,
          },
        ]}>
        {icon ? <Icon name={icon} size={18} color={textColor} /> : null}
        <ThemedText type="smallBold" numberOfLines={1} style={[dense ? styles.labelDense : styles.label, { color: textColor }]}>
          {label}
        </ThemedText>
        {trailingIcon ? <Icon name={trailingIcon} size={18} color={textColor} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    // 50 pt: the height of iOS's large filled buttons, comfortably past the
    // 44 pt touch minimum even when the label is a single short word.
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
  },
  baseDense: {
    minHeight: Layout.minTouch,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
  },
  label: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },
  labelDense: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
});
