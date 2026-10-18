import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { ComponentProps } from 'react';
import Animated from 'react-native-reanimated';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Near-white card with a white glass edge and a wide, very soft shadow — the
 * app's card language (clean grey page, floating light cards), deliberately
 * distinct from GlassSurface's translucent Liquid Glass. `tint` overrides the
 * default neutral fill for category-colored cards. */
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
  return (
    <Animated.View
      layout={layout}
      style={[
        styles.flatCard,
        { backgroundColor: tint ?? theme.backgroundElevated, borderRadius: radius, borderColor: theme.cardEdge },
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
    ...Platform.select({
      web: { boxShadow: '0px 12px 32px rgba(20,20,25,0.07)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.07,
        shadowRadius: 16,
        elevation: 2,
      },
    }),
  },
});
