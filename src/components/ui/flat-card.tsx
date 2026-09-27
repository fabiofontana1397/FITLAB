import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Flat, opaque, drop-shadowed card — the redesigned screens' own card
 * language (matching the reference mockups: solid white/tinted cards, no
 * blur), deliberately distinct from GlassSurface's translucent Liquid Glass
 * used everywhere else in the app. `tint` overrides the default neutral fill
 * for category-colored cards. */
export function FlatCard({
  tint,
  radius = Radius.large,
  style,
  children,
}: {
  tint?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.flatCard,
        { backgroundColor: tint ?? theme.backgroundElevated, borderRadius: radius, borderColor: theme.border },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flatCard: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      web: { boxShadow: '0px 8px 20px rgba(20,20,25,0.08)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
      },
    }),
  },
});
