import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { GlassSurface } from '@/components/glass/glass-surface';
import { SpringPopup } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSoft } from '@/lib/haptics';

const POPUP_MAX_WIDTH = 380;
/** The web draws the backdrop blur with `backdrop-filter`, which is costly to repaint while anything moves: there it
 * comes in only once the popup has landed, and goes first when it leaves. */
const WEB = Platform.OS === 'web';
const BLUR_IN_DELAY_MS = 300;
const BLUR_FADE_MS = 220;
const EXIT_MS = 170;

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
 * outside the card, or swiping it down, dismisses it. Used for calendars, "Registra allenamento"
 * and the "Registra pasto" meal picker.
 *
 * It animates only what is cheap to animate: the scrim fades, the card rises
 * and grows, and nothing is faded on top of a live backdrop blur (the Modal's
 * own fade did exactly that, over a full-screen blur and a second one inside
 * the card). On the web the card carries no blur of its own, since its
 * backdrop is already blurred. */
export function GlassPopup({ visible, onClose, children, style, maxWidth = POPUP_MAX_WIDTH }: GlassPopupProps) {
  const isDark = useColorScheme() === 'dark';
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  // The Modal stays mounted for the exit animation: `visible` going false plays it, then the Modal goes.
  const [mounted, setMounted] = useState(visible);
  // Opening while unmounted: mount in this very render (adjusting state from a changed prop, the way React asks for it).
  if (visible && !mounted) setMounted(true);
  const progress = useSharedValue(0);
  const blur = useSharedValue(WEB ? 0 : 1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    if (visible) {
      hapticSoft();
      progress.value = reduceMotion ? 1 : withSpring(1, SpringPopup);
      if (WEB) blurTimer.current = setTimeout(() => (blur.value = reduceMotion ? 1 : withTiming(1, { duration: BLUR_FADE_MS })), reduceMotion ? 0 : BLUR_IN_DELAY_MS);
      else blur.value = 1;
      return;
    }
    // Leaving: the blur first (fast), the card and scrim alongside, then the Modal.
    if (WEB) blur.value = withTiming(0, { duration: 90 });
    progress.value = withTiming(0, { duration: reduceMotion ? 0 : EXIT_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(unmount)();
    });
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, [visible, reduceMotion, progress, blur, unmount]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [0, 1], 'clamp') }));
  const blurStyle = useAnimatedStyle(() => ({ opacity: blur.value }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: theme.scrimSoft }]} />
          <Animated.View style={[StyleSheet.absoluteFill, blurStyle]} pointerEvents="none">
            <BlurView intensity={WEB ? 40 : 55} tint={isDark ? 'dark' : 'light'} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
          </Animated.View>
        </Pressable>
        <PopupCard progress={progress} style={[styles.cardWrap, { maxWidth }]}>
          {/* Swiping the card down dismisses it, like an iPhone sheet; the grabber says so. */}
          <GlassSurface
            level="overlay"
            radius={Radius.xlarge}
            blur={!WEB}
            style={[styles.card, WEB && !isDark && styles.cardFillLight, isDark && { backgroundColor: theme.surfacePopup }, style]}
            swipeToDismiss={onClose}>
            {children}
          </GlassSurface>
        </PopupCard>
      </View>
    </Modal>
  );
}

/** The card springs up from slightly smaller and lower as the scrim comes in — it lands, rather than just appearing —
 * and eases back the other way on exit. */
function PopupCard({ progress, style, children }: { progress: SharedValue<number>; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5], [0, 1], 'clamp'),
    transform: [{ translateY: (1 - progress.value) * 18 }, { scale: 0.94 + progress.value * 0.06 }],
  }));

  return <Animated.View style={[style, { pointerEvents: 'box-none' }, animatedStyle]}>{children}</Animated.View>;
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
  // Without its own blur the card needs a base fill to read over the (already blurred) page behind it.
  cardFillLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
});
