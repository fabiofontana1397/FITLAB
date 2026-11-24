import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { SheetGrabber } from '@/components/ui/sheet-grabber';
import { ScrollRegistryContext, useSwipeDismiss } from '@/components/ui/swipe-dismiss';

import { FlatCardShadow, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export type GlassLevel = 'subtle' | 'card' | 'raised' | 'overlay';

export type GlassSurfaceProps = {
  /** 'overlay' is a popup or sheet (the popups' dark grey); every other level is a box on the page (the cards' grey). */
  level?: GlassLevel;
  /** Kept for existing callers; surfaces are solid now, so it no longer changes anything. */
  intensity?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  bordered?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Opt-in: render with the OS's actual Liquid Glass material
   * (`expo-glass-effect`'s GlassView) instead, on devices where it's genuinely available (iOS 26+). */
  nativeGlass?: boolean;
  /** Makes the surface a swipe-to-dismiss popup: it gets the iPhone grabber at
   * the top and slides away when dragged down, then calls this. Give it the
   * popup's close handler. Ignored when `nativeGlass` renders the OS material. */
  swipeToDismiss?: () => void;
  /** Kept for existing callers; surfaces are solid now, so it no longer changes anything. */
  blur?: boolean;
};

// Properties that arrange *children* (as opposed to sizing/positioning the
// surface itself) have to land on the inner content wrapper, not the outer
// node — the outer node's only non-absolutely-positioned child is that
// content wrapper, so a `gap`/`alignItems`/etc. set on the outer node has
// nothing to distribute space between and silently does nothing.
const CHILD_LAYOUT_KEYS = ['gap', 'rowGap', 'columnGap', 'flexDirection', 'alignItems', 'justifyContent', 'flexWrap'] as const;

/**
 * The app's surface for boxes and popups. It used to be a blurred, gradient-lit pane meant to imitate glass; on the
 * phone that read as a muddy, uneven grey that matched neither the cards nor the popups. Now it is solid, in the
 * same colours as the rest of the app: a box on the page is the cards' grey (like FlatCard), a popup or sheet
 * (`level="overlay"`) the popups' dark grey. A caller's own `backgroundColor` / `borderColor` still wins.
 */
export function GlassSurface({
  level = 'card',
  radius = Radius.large,
  style,
  children,
  bordered = true,
  onLayout,
  nativeGlass = false,
  swipeToDismiss,
}: GlassSurfaceProps) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const useRealGlass = nativeGlass && isLiquidGlassAvailable();
  const swipe = useSwipeDismiss(swipeToDismiss);
  const popup = level === 'overlay';

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

  if (useRealGlass) {
    return (
      <GlassView
        onLayout={onLayout}
        glassEffectStyle="regular"
        style={[{ borderRadius: radius, overflow: 'hidden' }, outerStyle]}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </GlassView>
    );
  }

  const fill = {
    backgroundColor: popup ? theme.surfacePopup : theme.backgroundElevated,
    borderRadius: radius,
    borderCurve: 'continuous' as const,
    // The hairline only shows in light mode (boxEdge is transparent in dark), as on the cards.
    borderWidth: bordered && !popup ? StyleSheet.hairlineWidth : 0,
    borderColor: theme.boxEdge,
    // Boxes sit on the page with the cards' soft shadow; a popup is set off by the dimmed page behind it.
    boxShadow: popup ? undefined : FlatCardShadow[isDark ? 'dark' : 'light'],
  };

  const body = (
    <>
      <View style={[styles.content, contentStyle]}>{children}</View>
      {swipeToDismiss ? <SheetGrabber top={8} /> : null}
    </>
  );

  if (!swipeToDismiss) {
    return (
      <View onLayout={onLayout} style={[fill, styles.clip, outerStyle]}>
        {body}
      </View>
    );
  }

  return (
    <ScrollRegistryContext.Provider value={swipe.registry}>
      <GestureDetector gesture={swipe.gesture}>
        <Animated.View onLayout={onLayout} style={[fill, styles.clip, outerStyle, swipe.animatedStyle]}>
          {body}
        </Animated.View>
      </GestureDetector>
    </ScrollRegistryContext.Provider>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  clip: {
    overflow: 'hidden',
  },
});
