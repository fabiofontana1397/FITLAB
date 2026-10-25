import { useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Children, forwardRef, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { BottomTabInset, Layout, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Scroll distance over which the top-edge fade comes in.
const TOP_FADE_SCROLL = 24;
/** With a fixed `header`: the height of the fade under it. */
export const HEADER_FADE_HEIGHT = 18;
/** …and the list's own top padding in that mode (the header already ends with its margin). */
export const HEADER_LIST_TOP = 4;

function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The page's grey wash (the gradient behind a light screen) at `t` (0 top … 1 bottom) of the screen, as hex, so a fade drawn over it matches exactly. */
export function washColorAt(top: string, middle: string, bottom: string, t: number): string {
  const stops: [number, string][] = [[0, top], [0.45, middle], [1, bottom]];
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const a = hexRgb(stops[i - 1][1]);
      const b = hexRgb(stops[i][1]);
      if (!a || !b) return middle;
      const k = (x - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return `#${[0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * k).toString(16).padStart(2, '0')).join('')}`;
    }
  }
  return bottom;
}

export const ScreenScroll = forwardRef<ScrollView, ScreenScrollProps>(function ScreenScroll(
  { children, contentContainerStyle, reveal = false, header, onLayout, ...rest },
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

  // With a fixed header the list scrolls in the region below it and dissolves
  // under it: the fade sits at the region's top, in the wash's colour at that height.
  const [rootHeight, setRootHeight] = useState(0);
  const [regionTop, setRegionTop] = useState(0);
  const headerFadeColor = isLight && rootHeight > 0 ? washColorAt(theme.washTop, theme.background, theme.washBottom, regionTop / rootHeight) : theme.background;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]} onLayout={header ? (e) => setRootHeight(e.nativeEvent.layout.height) : undefined}>
      {/* Soft top-to-bottom grey wash behind every light screen. */}
      {isLight ? (
        <LinearGradient
          colors={[theme.washTop, theme.background, theme.washBottom]}
          locations={[0, 0.45, 1]}
          style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
        />
      ) : null}
      {header ? (
        <View style={[styles.fixedHeader, { paddingTop: insets.top + Platform.select({ web: Spacing.five, default: Spacing.two }) }]}>
          <View style={styles.headerInner}>{header}</View>
        </View>
      ) : null}
      <View style={styles.region} onLayout={header ? (e) => setRegionTop(e.nativeEvent.layout.y) : undefined}>
      <ScrollRevealContext.Provider value={revealContext}>
        <Animated.ScrollView
          ref={ref}
          testID="screen-scroll"
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
                paddingTop: header ? HEADER_LIST_TOP : insets.top + Platform.select({ web: Spacing.five, default: Spacing.two }),
                paddingBottom: BottomTabInset + Spacing.six,
              },
              contentContainerStyle,
              focusStyle,
            ]}>
            {content}
          </Animated.View>
        </Animated.ScrollView>
      </ScrollRevealContext.Provider>
      {/* Content scrolling up dissolves under the fixed header (or, without
          one, under the status bar / top edge) instead of being sliced off
          by it; invisible while at the top. */}
      {header ? (
        <Animated.View testID="screen-top-fade" style={[styles.topFade, { height: HEADER_FADE_HEIGHT, pointerEvents: 'none' }, topFadeStyle]}>
          <LinearGradient colors={[headerFadeColor, `${headerFadeColor}00`]} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      </View>
      {header ? null : (
        <Animated.View style={[styles.topFade, { height: insets.top + 28, pointerEvents: 'none' }, topFadeStyle]}>
          <LinearGradient colors={[topFadeColor, `${topFadeColor}00`]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
    </View>
  );
});

type ScreenScrollProps = ScrollViewProps & {
  /** Pinned above the list, which scrolls (and fades out) under it: the page's top bar. */
  header?: ReactNode;
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
  fixedHeader: {
    alignItems: 'center',
  },
  headerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Layout.screenGutter,
  },
  region: {
    flex: 1,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Layout.screenGutter,
    gap: Layout.sectionGap,
  },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
