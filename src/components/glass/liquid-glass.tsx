import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale, type PressableScaleProps } from '@/components/motion/pressable-scale';
import { GlassMaterial, Radius, type GlassTone } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// The material's look follows liquid-glass-js (github.com/dashersw/liquid-glass-js):
// a light blur (its blurRadius 5), a top-white → bottom-grey tint at low
// opacity (its tintOpacity 0.2 gradient), and a bright rim that falls off
// fast from the edge (its rim/edge intensity terms). That library refracts
// one html2canvas snapshot of the page taken at load, which goes stale as
// soon as a screen changes or scrolls inside a ScrollView, and it opens a
// WebGL context per element — so the same terms are drawn here as layers
// the browser composites live instead. On iOS 26+ the OS's own Liquid Glass
// replaces all of it.

export type LiquidGlassVariant = 'regular' | 'clear';

export type LiquidGlassProps = {
  radius?: number;
  /** `clear` blurs less and lets more of what's behind through; `regular`
   * is the frosted default. Native iOS 26 glass always uses the system's
   * regular style, which the tab bar used before. */
  variant?: LiquidGlassVariant;
  /** Colored glass (a selected segment, a primary control). Text on it
   * should use the matching on-color. */
  tintColor?: string;
  /** Native glass reacts to touch (iOS 26+). */
  interactive?: boolean;
  /** The soft drop shadow that lifts the glass off the page. */
  floating?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
};

const BLUR_INTENSITY: Record<LiquidGlassVariant, number> = {
  regular: 30,
  clear: 16,
};

// Props that arrange the children belong on the content wrapper, not the
// outer node (see the same split in glass-surface.tsx).
const CHILD_LAYOUT_KEYS = ['gap', 'rowGap', 'columnGap', 'flexDirection', 'alignItems', 'justifyContent', 'flexWrap'] as const;

type Tone = GlassTone;

const TINT = GlassMaterial.tint;
const SPECULAR = GlassMaterial.specular;
const RIM = GlassMaterial.rim;
const DROP_SHADOW = GlassMaterial.dropShadow;

/** Apple-style Liquid Glass for controls: tab bars, pill buttons, round
 * icon buttons, segmented tracks. Uses the system material where iOS 26
 * provides it and a layered blur / tint / specular / rim stack everywhere
 * else, so the same control reads as the same glass on every platform. */
export function LiquidGlass({
  radius = Radius.pill,
  variant = 'regular',
  tintColor,
  interactive = false,
  floating = true,
  style,
  children,
  onLayout,
}: LiquidGlassProps) {
  const isDark = useColorScheme() === 'dark';
  const scheme = isDark ? 'dark' : 'light';
  const tone: Tone = tintColor ? 'tinted' : scheme;

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

  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        onLayout={onLayout}
        glassEffectStyle="regular"
        tintColor={tintColor}
        isInteractive={interactive}
        colorScheme={scheme}
        style={[{ borderRadius: radius, overflow: 'hidden' }, outerStyle]}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </GlassView>
    );
  }

  return (
    <View
      onLayout={onLayout}
      style={[{ borderRadius: radius }, floating ? { boxShadow: DROP_SHADOW[scheme] } : null, outerStyle]}>
      {/* The shadow lives on the outer node and the clipping on this layer,
          so the rounded clip can't cut the shadow off on native. */}
      <View style={[StyleSheet.absoluteFill, styles.layer, { borderRadius: radius, overflow: 'hidden' }]}>
        <BlurView
          intensity={BLUR_INTENSITY[variant]}
          tint={scheme}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
        {tintColor ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor, opacity: 0.9 }]} /> : null}
        <LinearGradient colors={TINT[tone]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={SPECULAR[tone]}
          locations={[0, 0.55]}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: RIM[tone] }]} />
      </View>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

/** A brighter glass lens set into a LiquidGlass surface: the selected tab's
 * capsule. Drawn without its own blur, since the surface beneath already
 * blurs, so it can be animated freely. */
export function liquidLensStyle(isDark: boolean): ViewStyle {
  return {
    backgroundColor: GlassMaterial.lens[isDark ? 'dark' : 'light'].fill,
    boxShadow: GlassMaterial.lens[isDark ? 'dark' : 'light'].shadow,
  };
}

export type LiquidGlassButtonProps = PressableScaleProps & {
  /** A round button `size` points across; leave out for a pill sized by
   * its content and `glassStyle` padding. */
  size?: number;
  radius?: number;
  variant?: LiquidGlassVariant;
  tintColor?: string;
  /** Layout of the glass itself (padding, gap, row direction…); `style`
   * places the button among its siblings. */
  glassStyle?: StyleProp<ViewStyle>;
};

/** A tappable LiquidGlass: round icon buttons and small pills. */
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
        interactive
        style={[styles.center, round, glassStyle]}>
        {children}
      </LiquidGlass>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  layer: {
    pointerEvents: 'none',
  },
  content: {
    flexGrow: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
