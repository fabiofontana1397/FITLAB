import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { ComponentProps } from 'react';
import Animated from 'react-native-reanimated';

import { Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// Barely-there depth: the hairline does the separating, the shadow only
// lifts the card off the page by a hair. Anything heavier reads as a
// business dashboard rather than a native iOS surface.
const CARD_SHADOW = {
  light: '0px 1px 2px rgba(28,28,30,0.04), 0px 6px 16px rgba(28,28,30,0.03)',
  dark: '0px 1px 2px rgba(0,0,0,0.5)',
} as const;

/** The app's card: a flat surface a shade lighter than the page, set off by
 * a delicate hairline and an almost imperceptible shadow.
 * `tint` overrides the default fill for category-colored cards. */
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
  return (
    <Animated.View
      layout={layout}
      style={[
        styles.flatCard,
        {
          backgroundColor: tint ?? theme.backgroundElevated,
          borderRadius: radius,
          borderColor: theme.cardEdge,
          boxShadow: CARD_SHADOW[scheme],
        },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flatCard: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
