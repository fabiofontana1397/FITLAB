import { type Href } from 'expo-router';
import { Children, useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenScroll } from '@/components/screen-scroll';
import { TabHeader } from '@/components/tab-header';
import { Layout, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticTap } from '@/lib/haptics';
import { goBackOr } from '@/lib/navigation/go-back';

/** The back slide: long enough to read as a movement, short enough not to keep you waiting. */
const BACK_MS = 340;
/** How far the page underneath starts shifted to the left and dimmed, as in the iOS back transition. */
const UNDER_DIM = 0.14;
/** The shadow the page's left edge casts on the tab while it slides away. */
const PAGE_SHADOW = 0.18;

export type PageScreenProps = {
  title: string;
  subtitle?: string;
  /** The page's sections, top to bottom: each one enters on its own, one after another, as on the main tabs. */
  children: React.ReactNode;
  /** Modals and sheets opened from the page, kept out of the staggered sections. */
  overlays?: React.ReactNode;
  /** Where the back button lands when there is nothing to go back to (a deep link, a web refresh). */
  fallbackHref?: Href;
};

/**
 * A full page reached from the header menu (Profilo, Notifiche, Impostazioni). It looks and moves like the
 * main tabs: the same fixed top bar — with a back button where the logo is — and the sections entering one
 * at a time from the top, rather than a sheet rising from the bottom.
 *
 * Going back (the arrow, or Android's back button) slides the page off to the right, uncovering the tab you
 * came from, which brightens as it comes back — the route is a transparent modal, so that tab is really there
 * underneath. With "reduce motion" on, the page fades instead.
 */
export function PageScreen({ title, subtitle, children, overlays, fallbackHref = '/' }: PageScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0); // 0 open … 1 gone
  const closing = useRef(false);

  const leave = useCallback(() => goBackOr(fallbackHref), [fallbackHref]);

  const back = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    hapticTap();
    // Shared values are reassigned through `.value`: the reanimated idiom, not the mutation this rule guards against.
    // eslint-disable-next-line react-hooks/immutability
    progress.value = withTiming(
      1,
      { duration: reduceMotion ? 180 : BACK_MS, easing: Easing.bezier(0.32, 0.72, 0, 1) },
      (finished) => {
        if (finished) runOnJS(leave)();
      }
    );
  }, [progress, reduceMotion, leave]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [back]);

  // The edge shadow exists only while the page slides away. At rest it stays off: an iOS shadow on a full-screen
  // view has no fixed outline, so every scrolled frame the system re-traced the whole page offscreen to draw it,
  // and that is what made scrolling Profilo (and the other pages here) stutter.
  const pageStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (reduceMotion) return { opacity: 1 - p, shadowOpacity: 0 };
    return { transform: [{ translateX: p * width }], shadowOpacity: p > 0 ? PAGE_SHADOW : 0 };
  });
  // A dark veil over the tab underneath that lifts as the page slides away. Hidden while the page covers it, so the
  // compositor is not blending a full-screen layer nobody can see on every scrolled frame.
  const veilStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return { opacity: p > 0 ? interpolate(p, [0, 1], [UNDER_DIM, 0]) : 0 };
  });

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', pointerEvents: 'none' }, veilStyle]} />
      <Animated.View style={[styles.page, { backgroundColor: theme.background }, pageStyle]}>
        <ScreenScroll
          reveal
          header={<TabHeader title={title} subtitle={subtitle} onBack={back} />}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.six }]}>
          {Children.toArray(children).map((child, i) => (
            <View key={i} style={i === 0 ? styles.first : styles.section}>
              {child}
            </View>
          ))}
        </ScreenScroll>
      </Animated.View>
      {overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: {
    flex: 1,
    // The page's left edge casts a soft shadow on the tab while it slides away (opacity set by `pageStyle`).
    shadowColor: '#000',
    shadowOpacity: 0,
    shadowRadius: 18,
    shadowOffset: { width: -6, height: 0 },
  },
  // Reveal needs the sections spaced by their own margins, not the list's gap (see ScreenScroll).
  list: { paddingHorizontal: Layout.screenGutter, gap: 0 },
  first: { marginTop: Spacing.two },
  section: { marginTop: Layout.sectionGap },
});
