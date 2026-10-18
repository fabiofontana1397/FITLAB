import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { SpringPressIn, SpringPressOut } from '@/constants/motion';
import { hapticPress, hapticTap } from '@/lib/haptics';
import { Radius, Spacing } from '@/constants/theme';
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
        <ThemedText type="smallBold" numberOfLines={1} style={{ color: textColor }}>
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
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
  },
  baseDense: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.two,
  },
});
