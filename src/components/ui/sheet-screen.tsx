import { type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScrollDefaults } from '@/constants/scroll';
import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { SpringSheet, TimingExit } from '@/constants/motion';
import { MaxContentWidth, Radius, SheetShadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { goBackOr } from '@/lib/navigation/go-back';

/** Strip of the screen underneath left visible above the sheet, like an iOS
 * page sheet — it's what tells you the page you came from is still there. */
const TOP_GAP = 12;
/** Drag past this (or flick faster than this) and the sheet goes away. */
const DRAG_CLOSE_DISTANCE = 120;
const DRAG_CLOSE_VELOCITY = 0.8;

export type SheetScreenProps = {
  title: string;
  /** Small grey line under the title (what the sheet is about). */
  eyebrow?: string;
  children: React.ReactNode;
  /** Where to land when there's nothing to pop — a deep link, or a web
   * refresh while the sheet is open, starts with an empty history stack. */
  fallbackHref?: Href;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * A modal route presented as a bottom sheet: it rises from the bottom edge
 * over the dimmed page you came from, which stays visible in the strip
 * above it. Closes by the round button, by tapping that strip, by dragging
 * the header down, or (Android) with the back button — every one of them
 * through the same slide-back-down.
 *
 * The route itself is a `transparentModal` with `animation: 'none'` (see
 * app/_layout.tsx) so the movement here is the only one, and it runs the
 * same way on iOS, Android and web rather than leaving the sheet to each
 * platform's own modal presentation.
 */
export function SheetScreen({ title, eyebrow, children, fallbackHref = '/', contentContainerStyle }: SheetScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Distance below its resting place, in px: `height` is fully off-screen,
  // 0 is open. The backdrop reads its opacity off the same value, so a drag
  // dims and undims the page behind along with the sheet.
  const translateY = useSharedValue(height);
  const [closing, setClosing] = useState(false);

  // Shared values are stable handles meant to be reassigned via `.value`
  // from effects, gestures and callbacks alike — that's the reanimated
  // idiom, not the dependency mutation this lint rule guards against.
  const moveTo = useCallback(
    (value: number) => {
      // eslint-disable-next-line react-hooks/immutability
      translateY.value = value;
    },
    [translateY]
  );

  useEffect(() => {
    moveTo(withSpring(0, SpringSheet));
  }, [moveTo]);

  const close = useCallback(() => {
    // Guard against a second close (button tapped mid-drag, back pressed
    // twice…) restarting the animation and popping two screens.
    if (closing) return;
    setClosing(true);
    moveTo(
      withTiming(height, TimingExit, (finished) => {
        if (finished) runOnJS(goBackOr)(fallbackHref);
      })
    );
  }, [closing, fallbackHref, height, moveTo]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close]);

  // Only the header drags — hanging this off the whole sheet would fight
  // the scroll view for every vertical swipe.
  const dragHandlers = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          // Downwards only: dragging up would lift the sheet off the bottom edge.
          moveTo(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > DRAG_CLOSE_DISTANCE || gesture.vy > DRAG_CLOSE_VELOCITY) close();
          else moveTo(withSpring(0, SpringSheet));
        },
        onPanResponderTerminate: () => {
          moveTo(withSpring(0, SpringSheet));
        },
      }),
    [close, moveTo]
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, height], [1, 0], 'clamp'),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const top = insets.top + TOP_GAP;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { backgroundColor: theme.scrim }, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Chiudi" />
      </Animated.View>

      <View style={[styles.sheetArea, { top }]}>
        <Animated.View style={[styles.sheet, { backgroundColor: theme.background }, sheetStyle]}>
          <View style={styles.header} {...dragHandlers.panHandlers}>
            <View style={styles.headingText}>
              <ThemedText type="display">{title}</ThemedText>
              {eyebrow ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  {eyebrow}
                </ThemedText>
              ) : null}
            </View>
            <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Chiudi">
              <GlassSurface level="card" radius={Radius.pill} style={styles.closeButton}>
                <View style={styles.closeInner}>
                  <Icon name="close" size={18} color={theme.text} />
                </View>
              </GlassSurface>
            </Pressable>
          </View>

          <ScrollView
            {...ScrollDefaults}
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.six }, contentContainerStyle]}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
  },
  // The space the sheet occupies, from under the status bar to the bottom
  // edge. It must not carry `alignSelf`: on web an align-self on an
  // absolutely positioned element makes the browser size it from its content
  // instead of from `top`/`bottom`, so the sheet grew past the bottom of the
  // screen — its header pushed up under the status bar and the ScrollView
  // inside stretched to its full content height, which left it with nothing
  // to scroll. The width cap and the centering on a wide window belong to
  // the card inside instead (same split as the tab bar in app-tabs.tsx).
  // Plain (not animated) so this style compiles to a class and `box-none`
  // survives: beside the card, the backdrop underneath stays tappable.
  sheetArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: Radius.xlarge,
    borderTopRightRadius: Radius.xlarge,
    overflow: 'hidden',
    boxShadow: SheetShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  headingText: {
    flexShrink: 1,
    gap: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
  },
  closeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
});
