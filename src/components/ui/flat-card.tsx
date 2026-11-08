import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { ComponentProps } from 'react';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { useRevealProgress } from '@/components/motion/reveal';

import { FlatCardShadow, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// A milky glass pane: a bright top edge, a white glow just inside the rim
// that fades toward the middle, and a wide, faint shadow under it.
/** The style keys that lay out a card's content: they move to the inner wrapper that fades in after the card. */
const INNER_KEYS = new Set([
  'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'paddingHorizontal', 'paddingVertical', 'paddingStart', 'paddingEnd',
  'gap', 'rowGap', 'columnGap', 'flexDirection', 'flexWrap', 'alignItems', 'alignContent', 'justifyContent',
]);

/** A Reanimated animated style somewhere in the tree: it cannot be flattened without losing its animation. */
function hasAnimatedStyle(style: unknown): boolean {
  if (Array.isArray(style)) return style.some(hasAnimatedStyle);
  return style != null && typeof style === 'object' && 'viewDescriptors' in (style as object);
}

function splitStyle(style: StyleProp<ViewStyle>): { outer: ViewStyle; inner: ViewStyle } {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const key of Object.keys(flat)) (INNER_KEYS.has(key) ? inner : outer)[key] = flat[key];
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

const CARD_SHADOW = {
  light: FlatCardShadow.light,
  dark: FlatCardShadow.dark,
} as const;

/** Milky Liquid Glass card: a translucent pane a shade lighter than the
 * page, set off by its white rim and inner glow — the app's card language.
 * `tint` overrides the default glass fill for category-colored cards. */
export function FlatCard({
  tint,
  radius = Radius.large,
  style,
  layout,
  children,
}: {
  tint?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** A Reanimated layout transition, for cards whose height changes (e.g.
   * expanding) so the card and the ones below glide instead of jumping. */
  layout?: ComponentProps<typeof Animated.View>['layout'];
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const reveal = useRevealProgress();
  // Inside a Reveal the card enters first and its content a beat later, as in the reference animation.
  const innerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0.4, 0.95], [0, 1], 'clamp'),
    transform: [{ translateY: (1 - Math.min(reveal.value, 1)) * 12 }],
  }));
  const split = hasAnimatedStyle(style) ? null : splitStyle(style);
  const frame = {
    backgroundColor: tint ?? theme.backgroundElevated,
    borderRadius: radius,
    borderColor: theme.cardEdge,
    boxShadow: CARD_SHADOW[scheme],
  };

  if (!split) {
    return (
      <Animated.View layout={layout} style={[styles.flatCard, frame, style]}>
        {children}
      </Animated.View>
    );
  }
  return (
    <Animated.View layout={layout} style={[styles.flatCard, frame, split.outer]}>
      <Animated.View style={[split.inner, styles.inner, innerStyle]}>{children}</Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flatCard: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  inner: {
    flexGrow: 1,
  },
});
