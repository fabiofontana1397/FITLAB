import { useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Children, forwardRef, isValidElement, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions, type ScrollView, type ScrollViewProps } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reveal, ScrollRevealContext } from '@/components/motion/reveal';
import { TimingScreen } from '@/constants/motion';
import { ScrollDefaults } from '@/constants/scroll';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Scroll distance over which the top-edge fade comes in.
const TOP_FADE_SCROLL = 24;

export const ScreenScroll = forwardRef<ScrollView, ScreenScrollProps>(function ScreenScroll(
  { children, contentContainerStyle, reveal = false, onLayout, ...rest },
  ref
) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const isFocused = useIsFocused();
  const isLight = theme.tabBarBlur === 'light';

  const scrollY = useSharedValue(0);
  const viewportHeight = useSharedValue(windowHeight);
  const mountedAt = useRef(0);
  const focusProgress = useSharedValue(1);
  const hasBeenFocused = useRef(false);

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  // Coming back to an already-open tab: a short settle of the whole page, so
  // switching tabs reads as a transition rather than a hard cut. The very
  // first focus is left to the per-section Reveals.
  useEffect(() => {
    if (!isFocused) return;
    if (hasBeenFocused.current && !reduceMotion) {
      focusProgress.value = 0;
      focusProgress.value = withTiming(1, TimingScreen);
    }
    hasBeenFocused.current = true;
  }, [isFocused, reduceMotion, focusProgress]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const revealContext = useMemo(() => ({ scrollY, viewportHeight, mountedAt }), [scrollY, viewportHeight]);

  const focusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focusProgress.value, [0, 1], [0.35, 1]),
    transform: [{ translateY: (1 - focusProgress.value) * 8 }],
  }));

  const topFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, TOP_FADE_SCROLL], [0, 1], 'clamp'),
  }));

  // `reveal` wraps each top-level section in its own Reveal so they enter one
  // after another. Only for screens laid out with `gap: 0` (spacing on the
  // sections themselves): a section that renders nothing still gets a wrapper,
  // which a non-zero gap would count as an extra row.
  const content = reveal
    ? Children.toArray(children).map((child, i) => (
        <Reveal key={isValidElement(child) && child.key != null ? child.key : i} index={i}>
          {child}
        </Reveal>
      ))
    : children;

  // The fade blends into the wash's own top colour, not a differently-tinted band.
  const topFadeColor = isLight ? theme.washTop : theme.background;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Soft top-to-bottom grey wash behind every light screen. */}
      {isLight ? (
        <LinearGradient
          colors={[theme.washTop, theme.background, theme.washBottom]}
          locations={[0, 0.45, 1]}
          style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
        />
      ) : null}
      <ScrollRevealContext.Provider value={revealContext}>
        <Animated.ScrollView
          ref={ref}
          style={styles.scrollView}
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}
          {...ScrollDefaults}
          {...rest}
          onScroll={onScroll}
          onLayout={(e) => {
            viewportHeight.value = e.nativeEvent.layout.height;
            onLayout?.(e);
          }}>
          <Animated.View
            style={[
              styles.inner,
              {
                paddingTop: insets.top + Platform.select({ web: Spacing.five, default: Spacing.two }),
                paddingBottom: BottomTabInset + Spacing.six,
              },
              contentContainerStyle,
              focusStyle,
            ]}>
            {content}
          </Animated.View>
        </Animated.ScrollView>
      </ScrollRevealContext.Provider>
      {/* Content scrolling up dissolves under the status bar / top edge
          instead of being sliced off by it; invisible while at the top. */}
      <Animated.View style={[styles.topFade, { height: insets.top + 28, pointerEvents: 'none' }, topFadeStyle]}>
        <LinearGradient colors={[topFadeColor, `${topFadeColor}00`]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
});

type ScreenScrollProps = ScrollViewProps & {
  /** Stagger the top-level sections in on first paint and reveal the ones
   * below the fold as they scroll into view (see the note on `content`). */
  reveal?: boolean;
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
