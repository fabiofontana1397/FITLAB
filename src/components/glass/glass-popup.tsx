import { BlurView } from 'expo-blur';
import { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { GlassSurface } from '@/components/glass/glass-surface';
import { SpringPopup } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { useMotionPreference } from '@/hooks/use-motion-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

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
  const { modalAnimation } = useMotionPreference();
  const isDark = useColorScheme() === 'dark';
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType={modalAnimation('fade')} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView
            intensity={Platform.OS === 'web' ? 40 : 55}
            tint={isDark ? 'dark' : 'light'}
            blurMethod="dimezisBlurViewSdk31Plus"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrimSoft }]} />
        </Pressable>
        <PopupCard style={[styles.cardWrap, { maxWidth }]}>
          <GlassSurface level="overlay" radius={Radius.xlarge} style={[styles.card, style]}>
            {children}
          </GlassSurface>
        </PopupCard>
      </View>
    </Modal>
  );
}

/** While the backdrop fades in, the card itself springs up from slightly
 * smaller and lower — it lands, rather than just appearing. Mounted fresh on
 * every open (the Modal unmounts its content when hidden). */
function PopupCard({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(1, SpringPopup);
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5], [0, 1], 'clamp'),
    transform: [{ translateY: (1 - progress.value) * 18 }, { scale: 0.94 + progress.value * 0.06 }],
  }));

  return (
    <Animated.View style={[style, { pointerEvents: 'box-none' }, animatedStyle]}>
      {children}
    </Animated.View>
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
