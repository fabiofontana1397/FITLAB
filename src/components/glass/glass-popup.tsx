import { BlurView } from 'expo-blur';
import { Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const POPUP_MAX_WIDTH = 380;

export type GlassPopupProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra styles for the glass card itself (padding, gap…). */
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
};

/** The app's centered popup: a Liquid-Glass card floating in the middle of
 * the screen while everything behind it is blurred (and slightly dimmed, so
 * the card still reads on Android, where blur support is partial). Tapping
 * outside the card dismisses it. Used for calendars, "Registra allenamento"
 * and the "Registra pasto" meal picker. */
export function GlassPopup({ visible, onClose, children, style, maxWidth = POPUP_MAX_WIDTH }: GlassPopupProps) {
  const isDark = useColorScheme() === 'dark';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView
            intensity={Platform.OS === 'web' ? 40 : 55}
            tint={isDark ? 'dark' : 'light'}
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.38)' : 'rgba(20,20,30,0.18)' }]} />
        </Pressable>
        <View style={[styles.cardWrap, { maxWidth }]} pointerEvents="box-none">
          <GlassSurface level="overlay" radius={Radius.xlarge} style={[styles.card, style]}>
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
