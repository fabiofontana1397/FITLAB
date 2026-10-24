import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale, type PressableScaleProps } from '@/components/motion/pressable-scale';
import { Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// Controls follow the same flat, Apple-inspired language as the cards: a
// solid fill, a hairline, and a shadow soft enough that you read the shape
// rather than the depth. The blur/sheen/rim stack this file used to draw
// (and the OS's own Liquid Glass on iOS 26) made small controls fight the
// content behind them; legibility wins over the material.

export type LiquidGlassVariant = 'regular' | 'clear';

export type LiquidGlassProps = {
  radius?: number;
  /** `clear` sits flush with the page (segmented tracks, grouped wells);
   * `regular` is the raised control fill. */
  variant?: LiquidGlassVariant;
  /** Colored control (a selected segment, a primary action). Text on it
   * should use the matching on-color. */
  tintColor?: string;
  /** Kept for call-site compatibility; nothing reacts to touch at this
   * level any more (PressableScale below does the press feedback). */
  interactive?: boolean;
  /** The soft drop shadow that lifts the control off the page. */
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
};

const DROP_SHADOW: Record<'light' | 'dark', string> = {
  light: '0px 1px 2px rgba(28,28,30,0.05), 0px 6px 16px rgba(28,28,30,0.05)',
  dark: '0px 2px 10px rgba(0,0,0,0.5)',
};

// Props that arrange the children belong on the content wrapper, not the
// outer node (see the same split in glass-surface.tsx).
const CHILD_LAYOUT_KEYS = ['gap', 'rowGap', 'columnGap', 'flexDirection', 'alignItems', 'justifyContent', 'flexWrap'] as const;

/** A control surface: tab bars, pill buttons, round icon buttons,
 * segmented tracks. One flat material everywhere, so the same control
 * reads the same on every platform. */
export function LiquidGlass({
  radius = Radius.pill,
  variant = 'regular',
  tintColor,
  floating = true,
  style,
  children,
  onLayout,
}: LiquidGlassProps) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const scheme = isDark ? 'dark' : 'light';

  const flatStyle = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outerStyle: Record<string, unknown> = {};
  const contentStyle: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flatStyle)) {
    if ((CHILD_LAYOUT_KEYS as readonly string[]).includes(key)) {
      contentStyle[key] = value;
    } else {
      outerStyle[key] = value;
    }
  }

  const background = tintColor ?? (variant === 'clear' ? theme.backgroundElement : theme.iconButton);

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          borderRadius: radius,
          backgroundColor: background,
          borderWidth: tintColor ? 0 : 1,
          borderColor: theme.cardEdge,
        },
        floating && !tintColor ? { boxShadow: DROP_SHADOW[scheme] } : null,
        outerStyle,
      ]}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

/** The selected chip inside a segmented track: white, lifted off the
 * recessed grey track by a hairline shadow — the iOS convention. */
export function liquidLensStyle(isDark: boolean): ViewStyle {
  return {
    backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : '#FFFFFF',
    boxShadow: isDark ? 'none' : '0px 1px 2px rgba(28,28,30,0.10)',
  };
}

export type LiquidGlassButtonProps = PressableScaleProps & {
  /** A round button `size` points across; leave out for a pill sized by
   * its content and `glassStyle` padding. */
  size?: number;
  radius?: number;
  variant?: LiquidGlassVariant;
  tintColor?: string;
  /** Layout of the control itself (padding, gap, row direction…); `style`
   * places the button among its siblings. */
  glassStyle?: StyleProp<ViewStyle>;
};

/** A tappable control surface: round icon buttons and small pills. */
export function LiquidGlassButton({
  size,
  radius,
  variant,
  tintColor,
  glassStyle,
  style,
  children,
  ...pressable
}: LiquidGlassButtonProps) {
  const round = size != null ? { width: size, height: size } : null;
  return (
    <PressableScale accessibilityRole="button" {...pressable} style={style}>
      <LiquidGlass
        radius={radius ?? (size != null ? size / 2 : Radius.pill)}
        variant={variant}
        tintColor={tintColor}
        style={[styles.center, round, glassStyle]}>
        {children}
      </LiquidGlass>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
