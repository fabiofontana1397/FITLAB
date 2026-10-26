import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { SheetGrabber } from '@/components/ui/sheet-grabber';
import { ScrollRegistryContext, useSwipeDismiss } from '@/components/ui/swipe-dismiss';

import { GlassMaterial, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type GlassLevel = 'subtle' | 'card' | 'raised' | 'overlay';

const LEVEL_INTENSITY: Record<GlassLevel, number> = {
  subtle: 26,
  card: 42,
  raised: 60,
  overlay: 82,
};

const LEVEL_SHADOW: Record<GlassLevel, { opacity: number; radius: number; offsetY: number }> = {
  subtle: { opacity: 0.08, radius: 10, offsetY: 3 },
  card: { opacity: 0.16, radius: 18, offsetY: 7 },
  raised: { opacity: 0.22, radius: 26, offsetY: 11 },
  overlay: { opacity: 0.32, radius: 36, offsetY: 16 },
};

export type GlassSurfaceProps = {
  level?: GlassLevel;
  /** Overrides the level's default blur intensity — lower reads as more
   * transparent. Use sparingly; `level` alone keeps every glass surface in
   * the app reading as one coherent material. */
  intensity?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  bordered?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Opt-in: render with the OS's actual Liquid Glass material
   * (`expo-glass-effect`'s GlassView) instead of the BlurView-based
   * approximation, on devices where it's genuinely available (iOS 26+).
   * Everywhere else — Android, web, older iOS, and whenever this is left
   * off — falls back to the normal blur rendering unchanged. Opt-in
   * rather than automatic because real glass has its own look (no
   * gradient sheen, no hairline border) that hasn't been checked against
   * every surface this component is used for yet. */
  nativeGlass?: boolean;
  /** Makes the surface a swipe-to-dismiss popup: it gets the iPhone grabber at
   * the top and slides away when dragged down, then calls this. Give it the
   * popup's close handler. Ignored when `nativeGlass` renders the OS material. */
  swipeToDismiss?: () => void;
};

// Properties that arrange *children* (as opposed to sizing/positioning the
// surface itself) have to land on the inner content wrapper, not the outer
// node — the outer node's only non-absolutely-positioned child is that
// content wrapper, so a `gap`/`alignItems`/etc. set on the outer node has
// nothing to distribute space between and silently does nothing.
const CHILD_LAYOUT_KEYS = ['gap', 'rowGap', 'columnGap', 'flexDirection', 'alignItems', 'justifyContent', 'flexWrap'] as const;

/**
 * The app's Liquid-Glass building block: a blurred, gradient-lit, hairline
 * -bordered surface used for cards, sheets, tab bars and modals. Depth is
 * expressed through `level`, not through ad-hoc opacity tweaks, so every
 * glass surface in the app reads as one coherent material.
 */
export function GlassSurface({
  level = 'card',
  intensity,
  radius = Radius.large,
  style,
  children,
  bordered = true,
  onLayout,
  nativeGlass = false,
  swipeToDismiss,
}: GlassSurfaceProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const useRealGlass = nativeGlass && isLiquidGlassAvailable();
  const swipe = useSwipeDismiss(swipeToDismiss);
  const Outer = swipeToDismiss ? Animated.View : View;

  // A brighter specular band along the top edge fading into a soft wash,
  // the way light catches the top of a curved glass surface.
  const gradientColors = isDark
    ? GlassMaterial.surfaceSheen.dark
    : GlassMaterial.surfaceSheen.light;
  const gradientLocations = [0, 0.18, 1] as const;

  const shadow = LEVEL_SHADOW[level];

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

  // Real glass draws its own light/edge treatment natively — the
  // gradient sheen and hairline border below are this component's own
  // stand-in for that, so they'd not just be redundant but visually
  // fight the system's real effect.
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

  const surface = (
    <Outer
      onLayout={onLayout}
      {...(swipeToDismiss ? swipe.panHandlers : null)}
      style={[
        { borderRadius: radius, overflow: 'hidden' },
        Platform.select({
          // On web box-shadow isn't clipped by this same element's overflow,
          // so the shadow, blur-clip and border-radius can all live on one node.
          web: { boxShadow: `0px ${shadow.offsetY}px ${shadow.radius}px rgba(0,0,0,${shadow.opacity})` },
          default: null,
        }),
        outerStyle,
        swipeToDismiss ? swipe.animatedStyle : null,
      ]}>
      <BlurView
        intensity={intensity ?? LEVEL_INTENSITY[level]}
        tint={isDark ? 'dark' : 'light'}
        blurMethod="dimezisBlurViewSdk31Plus"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={gradientColors}
        locations={gradientLocations}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {bordered ? (
        // An absolute overlay (not a padded child) so the hairline always
        // traces the surface's true outer edge, even when `style` adds
        // padding — a padded sibling would otherwise shrink the border
        // inward, leaving a floating rectangle inside the card.
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              borderWidth: StyleSheet.hairlineWidth * 1.5,
              borderColor: GlassMaterial.surfaceBorder[isDark ? 'dark' : 'light'],
              borderTopColor: GlassMaterial.surfaceBorderTop[isDark ? 'dark' : 'light'],
            },
          ]}
        />
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
      {swipeToDismiss ? <SheetGrabber top={8} /> : null}
    </Outer>
  );

  return swipeToDismiss ? <ScrollRegistryContext.Provider value={swipe.registry}>{surface}</ScrollRegistryContext.Provider> : surface;
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
