import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { ComponentProps } from 'react';
import Animated from 'react-native-reanimated';

import { FlatCardShadow, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// A milky glass pane: a bright top edge, a white glow just inside the rim
// that fades toward the middle, and a wide, faint shadow under it.
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
