import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export type GlassLevel = 'subtle' | 'card' | 'raised' | 'overlay';

// Depth, in the flat Apple-inspired language: a hairline does the
// separating and the shadow only lifts the surface off the page. The step
// from one level to the next is what says "this sits above that" — not a
// change of material.
const LEVEL_SHADOW: Record<GlassLevel, { light: string; dark: string }> = {
  subtle: {
    light: '0px 1px 2px rgba(28,28,30,0.03)',
    dark: '0px 1px 2px rgba(0,0,0,0.4)',
  },
  card: {
    light: '0px 1px 2px rgba(28,28,30,0.04), 0px 6px 16px rgba(28,28,30,0.03)',
    dark: '0px 2px 6px rgba(0,0,0,0.5)',
  },
  raised: {
    light: '0px 2px 6px rgba(28,28,30,0.06), 0px 10px 24px rgba(28,28,30,0.05)',
    dark: '0px 6px 18px rgba(0,0,0,0.55)',
  },
  overlay: {
    light: '0px 8px 28px rgba(28,28,30,0.12), 0px 24px 60px rgba(28,28,30,0.10)',
    dark: '0px 12px 36px rgba(0,0,0,0.7)',
  },
};

export type GlassSurfaceProps = {
  level?: GlassLevel;
  /** Kept for call-site compatibility; the surface is flat, so there is no
   * blur to tune. */
  intensity?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  bordered?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Kept for call-site compatibility: the app no longer renders the OS's
   * Liquid Glass material anywhere, so every surface reads the same on
   * iOS, Android and web. */
  nativeGlass?: boolean;
};

// Properties that arrange *children* (as opposed to sizing/positioning the
// surface itself) have to land on the inner content wrapper, not the outer
// node — the outer node's only non-absolutely-positioned child is that
// content wrapper, so a `gap`/`alignItems`/etc. set on the outer node has
// nothing to distribute space between and silently does nothing.
const CHILD_LAYOUT_KEYS = ['gap', 'rowGap', 'columnGap', 'flexDirection', 'alignItems', 'justifyContent', 'flexWrap'] as const;

/**
 * The app's surface building block: cards, sheets, tab bars and popups.
 * Flat fill + hairline + a shadow sized by `level`, so every surface in the
 * app reads as one coherent, quiet material instead of each screen inventing
 * its own translucency.
 */
export function GlassSurface({
  level = 'card',
  radius = Radius.large,
  style,
  children,
  bordered = true,
  onLayout,
}: GlassSurfaceProps) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';

  // The surfaces that float over content (popups, sheets, the tab bar) sit
  // on the brighter fill; a plain card stays a shade off the page.
  const background = level === 'subtle' || level === 'card' ? theme.surfaceGlass : theme.surfaceGlassStrong;

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

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: background,
          boxShadow: LEVEL_SHADOW[level][isDark ? 'dark' : 'light'],
        },
        bordered ? { borderWidth: 1, borderColor: theme.cardEdge } : null,
        outerStyle,
      ]}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
