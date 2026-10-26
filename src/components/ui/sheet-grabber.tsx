import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** The iPhone's sheet grabber: a 36 × 5 pt pill at the top edge that says "this slides down". */
export const GRABBER_WIDTH = 36;
export const GRABBER_HEIGHT = 5;

/**
 * Pinned to the top centre of whatever it is placed in, over the content's
 * own top padding, so adding it moves nothing. Decorative only: the drag that
 * dismisses the sheet is handled by the sheet (see `SwipeDismiss`).
 */
export function SheetGrabber({ top = 6, style }: { top?: number; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View pointerEvents="none" accessible={false} style={[styles.wrap, { top }, style]}>
      <View style={[styles.pill, { backgroundColor: theme.textTertiary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  pill: {
    width: GRABBER_WIDTH,
    height: GRABBER_HEIGHT,
    borderRadius: GRABBER_HEIGHT / 2,
    opacity: 0.6,
  },
});
