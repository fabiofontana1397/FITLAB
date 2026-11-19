import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import { RevealBoundary } from '@/components/motion/reveal';
import { SpringSheet, TimingExit } from '@/constants/motion';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSoft } from '@/lib/haptics';

const POPUP_MAX_WIDTH = 420;
/** Gap between the card and the bottom edge (on top of the home-indicator inset), like a notification banner. */
const BOTTOM_GAP = Spacing.three;
/** A long popup can still grow, but never past this share of the screen. */
const MAX_HEIGHT_SHARE = 0.85;

export type GlassPopupProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra styles for the card itself (padding, gap…). */
  style?: StyleProp<ViewStyle>;
  maxWidth?: number;
};

/** The app's popup: a card floating just above the bottom edge that slides up from below, the way an iOS
 * notification or action sheet does. It is as tall as its content, so a short popup (a confirmation, a download)
 * stays in the lower half of the screen instead of reaching the top. The page behind is only dimmed, never
 * blurred: a full-screen blur is the costliest thing to animate and was what made opening and closing stutter.
 * Tapping outside the card, or swiping it down, dismisses it.
 *
 * Only cheap properties move: the card's translateY (on the UI thread, no bounce) and the scrim's opacity. */
export function GlassPopup({ visible, onClose, children, style, maxWidth = POPUP_MAX_WIDTH }: GlassPopupProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // The Modal stays mounted for the exit animation: `visible` going false plays it, then the Modal goes.
  const [mounted, setMounted] = useState(visible);
  // Opening while unmounted: mount in this very render (adjusting state from a changed prop, the way React asks for it).
  if (visible && !mounted) setMounted(true);
  const progress = useSharedValue(0);
  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      hapticSoft();
      progress.value = reduceMotion ? 1 : withSpring(1, SpringSheet);
      return;
    }
    progress.value = withTiming(0, reduceMotion ? { duration: 0 } : TimingExit, (finished) => {
      if (finished) runOnJS(unmount)();
    });
  }, [visible, reduceMotion, progress, unmount]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [0, 1], 'clamp') }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <RevealBoundary>
        <View style={[styles.root, { paddingBottom: insets.bottom + BOTTOM_GAP }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Chiudi">
            <Animated.View style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: theme.scrimSoft }]} />
          </Pressable>
          <PopupCard progress={progress} distance={height} style={[styles.cardWrap, { maxWidth, maxHeight: height * MAX_HEIGHT_SHARE }]}>
            {/* Swiping the card down dismisses it, like an iPhone sheet. */}
            <GlassSurface
              level="overlay"
              radius={Radius.xlarge}
              blur={false}
              style={[styles.card, { backgroundColor: theme.surfacePopup }, style]}
              swipeToDismiss={onClose}>
              {children}
            </GlassSurface>
          </PopupCard>
        </View>
      </RevealBoundary>
    </Modal>
  );
}

/** The card rises from below the bottom edge and settles without overshoot; on exit it slides back down. */
function PopupCard({ progress, distance, style, children }: { progress: SharedValue<number>; distance: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, { pointerEvents: 'box-none' }, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
  },
  cardWrap: {
    width: '100%',
  },
  card: {
    padding: Spacing.four,
  },
});
