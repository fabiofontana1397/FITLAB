import { LinearGradient } from 'expo-linear-gradient';
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
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { SpringSheet, TimingExit } from '@/constants/motion';
import { Layout, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { goBackOr } from '@/lib/navigation/go-back';

/** Strip of the screen underneath left visible above the sheet, like an iOS
 * page sheet — it's what tells you the page you came from is still there.
 * It is a share of the screen (the sheet covers about 95% of it), but never
 * less than the status bar / Dynamic Island plus a small margin. */
const TOP_GAP_SHARE = 0.045;
const TOP_GAP_MIN = 8;
/** Round white close button, pinned to the sheet's top right. */
const CLOSE_SIZE = 44;
const CLOSE_INSET = 16;
const SHEET_RADIUS = 40;
/** Height of the fade under the fixed title, and the scroll distance over which it comes in. */
const EDGE_FADE_HEIGHT = 28;
/** Drag past this (or flick faster than this) and the sheet goes away. */
const DRAG_CLOSE_DISTANCE = 120;
const DRAG_CLOSE_VELOCITY = 0.8;

export type SheetScreenProps = {
  title: string;
  /** Small grey line under the title (what the sheet is about). */
  eyebrow?: string;
  /** A tile (icon, image) to the left of the title, as in the logged-workout sheet. */
  leading?: React.ReactNode;
  /** Content, or a function of the sheet's own `close` for buttons that dismiss it with the usual slide down. */
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  /** Where to land when there's nothing to pop — a deep link, or a web
   * refresh while the sheet is open, starts with an empty history stack. */
  fallbackHref?: Href;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** False for a sheet whose content fits on one screen: it is laid out in the available height and does not scroll. */
  scroll?: boolean;
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
export function SheetScreen({ title, eyebrow, leading, children, fallbackHref = '/', contentContainerStyle, scroll = true }: SheetScreenProps) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
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

  const edgeFade = useSharedValue(0);
  const edgeFadeStyle = useAnimatedStyle(() => ({ opacity: edgeFade.value }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const body = typeof children === 'function' ? children(close) : children;
  const top = Math.max(insets.top + TOP_GAP_MIN, Math.round(height * TOP_GAP_SHARE));

  return (
    <View style={styles.overlay}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { backgroundColor: dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.22)' }, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Chiudi" />
      </Animated.View>

      <View style={[styles.sheetArea, { top }]}>
        <Animated.View style={[styles.sheet, { backgroundColor: theme.background }, sheetStyle]}>
          <View style={styles.header} {...dragHandlers.panHandlers}>
            {leading}
            <View style={styles.headingText}>
              <ThemedText type="display" style={styles.title} accessibilityRole="header">
                {title}
              </ThemedText>
              {eyebrow ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {eyebrow}
                </ThemedText>
              ) : null}
            </View>
          </View>

          <Pressable
            onPress={close}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Chiudi"
            style={[styles.closeButton, { backgroundColor: theme.backgroundElevated }]}>
            <Icon name="close" size={20} color={theme.text} />
          </Pressable>

          {scroll ? (
            <View style={styles.scroll}>
              <ScrollView
                {...ScrollDefaults}
                style={styles.scroll}
                onScroll={(e) => {
                  // eslint-disable-next-line react-hooks/immutability
                  edgeFade.value = Math.min(1, Math.max(0, e.nativeEvent.contentOffset.y / EDGE_FADE_HEIGHT));
                }}
                scrollEventThrottle={16}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.five }, contentContainerStyle]}>
                {body}
              </ScrollView>
              {/* Under the fixed title the content dissolves instead of being cut by a hard edge; the fade grows in as you scroll. */}
              <Animated.View pointerEvents="none" style={[styles.edgeFade, edgeFadeStyle]}>
                <LinearGradient colors={[theme.background, `${theme.background}00`]} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>
          ) : (
            <View style={[styles.scroll, styles.scrollContent, { paddingBottom: insets.bottom + Spacing.three }, contentContainerStyle]}>{body}</View>
          )}
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
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  // The close button floats at the top right; the title sits below it, as in iOS Settings.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Layout.screenGutter,
    paddingTop: CLOSE_INSET + CLOSE_SIZE + Spacing.three,
    paddingBottom: Spacing.three,
  },
  headingText: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  closeButton: {
    position: 'absolute',
    top: CLOSE_INSET,
    right: CLOSE_INSET,
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 10px rgba(0,0,0,0.08)',
  },
  edgeFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: EDGE_FADE_HEIGHT,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Layout.screenGutter,
    gap: Layout.sectionGap,
  },
});
