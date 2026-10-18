import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Radius, Spacing } from '@/constants/theme';

const POPUP_MAX_WIDTH = 380;

export type GlassPopupProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra styles for the glass card itself (padding, gap…). */
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
};

/** The app's centered popup: a frosted-glass card floating in the middle of
 * the screen. The app behind it stays exactly as it is (no dimming, no blur);
 * only the card's own background is a see-through blur of what sits under it.
 * Tapping outside the card dismisses it. Used for calendars, "Registra
 * allenamento" and the "Registra pasto" meal picker. */
export function GlassPopup({ visible, onClose, children, style, maxWidth = POPUP_MAX_WIDTH }: GlassPopupProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Chiudi" />
        <View style={[styles.cardWrap, { maxWidth }]} pointerEvents="box-none">
          <GlassSurface level="frosted" radius={Radius.xlarge} style={[styles.card, style]}>
            {children}
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  cardWrap: {
    width: '100%',
    maxHeight: '90%',
  },
  card: {
    padding: Spacing.four,
  },
});
