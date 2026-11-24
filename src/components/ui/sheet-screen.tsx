import { LinearGradient } from 'expo-linear-gradient';
import { type Href } from 'expo-router';
import { startTransition, useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
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

import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { GlassCloseButton } from '@/components/glass/liquid-glass';
import { FadeLayer } from '@/components/motion/fade-chain';
import { RevealBoundary } from '@/components/motion/reveal';
import { PopupScrollView, ScrollRegistryContext, useDismissDrag } from '@/components/ui/swipe-dismiss';
import { ScrollDefaults } from '@/constants/scroll';
import { ThemedText } from '@/components/themed-text';
import { SheetGrabber } from '@/components/ui/sheet-grabber';
import { SpringSheet, TimingExit } from '@/constants/motion';
import { Layout, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSoft } from '@/lib/haptics';
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
/** How long after opening the sheet's content is built (the sheet takes about this long to rise). */
const BODY_DELAY_MS = 220;

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
  /** Called once the sheet has slid away, instead of going back in the router: for a sheet shown inside a Modal rather than as a route. */
  onClose?: () => void;
  /** False for a sheet whose content fits on one screen: it is laid out in the available height and does not scroll. */
  scroll?: boolean;
  /** Fixed at the bottom of the sheet, under the scrolling content (the content fades out above it): a main action. */
  footer?: React.ReactNode | ((close: () => void) => React.ReactNode);
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
export function SheetScreen({ title, eyebrow, leading, children, fallbackHref = '/', contentContainerStyle, onClose, scroll = true, footer }: SheetScreenProps) {
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
    hapticSoft();
  }, [moveTo]);

  const finish = useCallback(() => {
    if (onClose) onClose();
    else goBackOr(fallbackHref);
  }, [onClose, fallbackHref]);

  const close = useCallback(() => {
    // Guard against a second close (button tapped mid-drag, back pressed
    // twice…) restarting the animation and popping two screens.
    if (closing) return;
    setClosing(true);
    hapticSoft();
    moveTo(
      withTiming(height, TimingExit, (finished) => {
        if (finished) runOnJS(finish)();
      })
    );
  }, [closing, finish, height, moveTo]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [close]);

  // The whole sheet drags down, but only from the top of its content: while the
  // list is scrolled, a downward swipe belongs to the list (see useDismissDrag).
  const { gesture: dragGesture, registry: scrollRegistry } = useDismissDrag(translateY, close, DRAG_CLOSE_DISTANCE);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, height], [1, 0], 'clamp'),
  }));

  const edgeFade = useSharedValue(0);
  const edgeFadeStyle = useAnimatedStyle(() => ({ opacity: edgeFade.value }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // The content mounts once the sheet has risen: building a long page while the sheet springs up cost frames at
  // the start of the movement. It then fades in.
  const [bodyReady, setBodyReady] = useState(false);
  const bodyOpacity = useSharedValue(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      // As a transition the content is built in small slices between frames instead of one long task.
      startTransition(() => setBodyReady(true));
      bodyOpacity.value = withTiming(1, { duration: 180 });
    }, BODY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [bodyOpacity]);
  const bodyStyle = useAnimatedStyle(() => ({ opacity: bodyOpacity.value }));
  const body = bodyReady ? (typeof children === 'function' ? children(close) : children) : null;
  const footerNode = footer ? (typeof footer === 'function' ? footer(close) : footer) : null;
  const top = Math.max(insets.top + TOP_GAP_MIN, Math.round(height * TOP_GAP_SHARE));

  return (
    <RevealBoundary>
    {/* Its own gesture root: the sheet is often shown inside a Modal, where gestures need one (Android). */}
    <GestureHandlerRootView style={styles.overlay}>
    <ScrollRegistryContext.Provider value={scrollRegistry}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { backgroundColor: dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.22)' }, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Chiudi" />
      </Animated.View>

      <View style={[styles.sheetArea, { top }]}>
        <GestureDetector gesture={dragGesture}>
        <Animated.View style={[styles.sheet, { backgroundColor: theme.surfacePopup }, sheetStyle]}>
          <View style={styles.header}>
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

          <SheetGrabber top={8} />

          <GlassCloseButton onPress={close} size={CLOSE_SIZE} style={styles.closeButton} />

          {scroll ? (
            <Animated.View style={[styles.scroll, bodyStyle]}>
              <PopupScrollView
                {...ScrollDefaults}
                style={styles.scroll}
                onScroll={(e) => {
                  // eslint-disable-next-line react-hooks/immutability
                  edgeFade.value = Math.min(1, Math.max(0, e.nativeEvent.contentOffset.y / EDGE_FADE_HEIGHT));
                }}
                scrollEventThrottle={16}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: footerNode ? Spacing.four : insets.bottom + Spacing.five }, contentContainerStyle]}>
                <FadeLayer opacity={bodyOpacity}>{body}</FadeLayer>
              </PopupScrollView>
              {/* Under the fixed title the content dissolves instead of being cut by a hard edge; the fade grows in as you scroll. */}
              <Animated.View pointerEvents="none" style={[styles.edgeFade, edgeFadeStyle]}>
                <LinearGradient colors={[theme.surfacePopup, `${theme.surfacePopup}00`]} style={StyleSheet.absoluteFill} />
              </Animated.View>
              {footerNode ? (
                <View pointerEvents="none" style={styles.footerFade}>
                  <LinearGradient colors={[`${theme.surfacePopup}00`, theme.surfacePopup]} style={StyleSheet.absoluteFill} />
                </View>
              ) : null}
            </Animated.View>
          ) : (
            <Animated.View style={[styles.scroll, styles.scrollContent, { paddingBottom: footerNode ? Spacing.three : insets.bottom + Spacing.three }, contentContainerStyle, bodyStyle]}>
              <FadeLayer opacity={bodyOpacity}>{body}</FadeLayer>
            </Animated.View>
          )}
          {footerNode ? (
            <Animated.View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three, backgroundColor: theme.surfacePopup }, bodyStyle]}>
              <FadeLayer opacity={bodyOpacity}>{footerNode}</FadeLayer>
            </Animated.View>
          ) : null}
        </Animated.View>
        </GestureDetector>
      </View>
    </ScrollRegistryContext.Provider>
    </GestureHandlerRootView>
    </RevealBoundary>
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
  },
  edgeFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: EDGE_FADE_HEIGHT,
  },
  footer: {
    paddingHorizontal: Layout.screenGutter,
    paddingTop: Spacing.two,
  },
  footerFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
