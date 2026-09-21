import type { Href } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { SpringSnappy } from '@/constants/motion';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// Matches ChatFab's own DEFAULT_SIZE fallback, used before the bar's real
// height has been measured for the very first frame.
const DEFAULT_BAR_HEIGHT = 48;

// Same total ScreenScroll already reserves as bottom padding (see
// screen-scroll.tsx) so this mask's fade zone lines up with exactly the
// area every screen already keeps clear for the floating bar.
const FADE_HEIGHT = BottomTabInset + Spacing.six;

// A single BlurView turns on at full strength the instant content crosses
// its top edge — a visible seam, since there's nothing to ramp through.
// Slicing the fade zone into several non-overlapping horizontal stripes,
// each a little stronger than the one above it, approximates a blur that
// gradually deepens instead of cutting on. Each stripe is drawn ONLY across
// its own slice (never down to the bottom of the mask) — stacking them
// cumulatively was the previous approach, but compositing multiple
// translucent tinted BlurViews on top of each other visibly brightened
// scrolled content ("i colori si accendono") instead of just blurring it,
// worst right above the bar where every band overlapped at once. Seven
// stripes starting from a barely-there first step (rather than four
// starting stronger) so even that very first step is too small to read as
// a seam. web/native use different absolute scales for `intensity`, so
// each is its own progression.
const BLUR_BANDS = {
  web: [1, 2, 3, 5, 8, 12, 17],
  default: [2, 3, 5, 8, 12, 17, 23],
} as const;

const TAB_ITEMS: { name: string; href: Href; label: string; icon: IconName }[] = [
  { name: 'index', href: '/', label: 'Home', icon: 'home' },
  { name: 'training', href: '/training', label: 'Training', icon: 'training' },
  { name: 'nutrition', href: '/nutrition', label: 'Nutrizione', icon: 'nutrition' },
  { name: 'body', href: '/body', label: 'Corpo', icon: 'body' },
  { name: 'progress', href: '/progress', label: 'Progressi', icon: 'progress' },
];

export default function AppTabs({ onBarHeightChange }: { onBarHeightChange?: (height: number) => void }) {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <ScrollFadeMask />
      <TabList asChild>
        <FloatingTabBar onBarHeightChange={onBarHeightChange}>
          {TAB_ITEMS.map((item) => (
            <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
              <TabButton label={item.label} icon={item.icon} />
            </TabTrigger>
          ))}
        </FloatingTabBar>
      </TabList>
    </Tabs>
  );
}

/** Blurs, then fades, scrolled content well before it would reach the
 * floating bar, instead of it staying crisp and peeking through the bar's
 * translucent glass — text only turns fully legible once the user has
 * scrolled it above this zone, clear of the bar entirely. Sits above the
 * screen content but below the bar itself, and never intercepts touches
 * (the scroll view underneath keeps handling them). */
function ScrollFadeMask() {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const bands = Platform.OS === 'web' ? BLUR_BANDS.web : BLUR_BANDS.default;
  const stripeHeight = FADE_HEIGHT / bands.length;
  return (
    <View pointerEvents="none" style={[styles.fadeMask, { height: FADE_HEIGHT }]}>
      {bands.map((intensity, i) => (
        <BlurView
          key={i}
          intensity={intensity}
          tint={isDark ? 'dark' : 'light'}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={{ position: 'absolute', top: stripeHeight * i, left: 0, right: 0, height: stripeHeight }}
        />
      ))}
      {/* Spans the full mask height (not just its lower portion) so the
          color ramp itself has no flat, fully-opaque stretch right above
          the bar — that flat zone next to the bar's own translucent glass
          was the other half of the reported hard edge. */}
      <LinearGradient colors={['transparent', theme.background]} locations={[0, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

function FloatingTabBar({
  children,
  onBarHeightChange,
}: {
  children?: React.ReactNode;
  onBarHeightChange?: (height: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [barHeight, setBarHeight] = useState<number | null>(null);
  const lastReportedHeight = useRef<number | null>(null);

  return (
    <View
      style={[
        styles.floatWrapper,
        { paddingBottom: Platform.select({ web: Spacing.four, default: insets.bottom || Spacing.three }) },
        { pointerEvents: 'box-none' },
      ]}>
      <View style={styles.row}>
        <GlassSurface
          level="overlay"
          intensity={16}
          radius={Radius.xlarge}
          style={styles.bar}
          onLayout={(e) => {
            // The row re-measures on every tab switch (the focused
            // TabButton's own layout shifts slightly), which can report a
            // height a fraction of a pixel off the last one purely from
            // sub-pixel rounding. Propagating that non-change downstream
            // used to re-render ChatFab/ChatOrb on every navigation, which
            // read as the orb's colors "changing" when a tab was tapped —
            // so only report height changes big enough to be real.
            const height = e.nativeEvent.layout.height;
            if (lastReportedHeight.current != null && Math.abs(height - lastReportedHeight.current) < 1) return;
            lastReportedHeight.current = height;
            setBarHeight(height);
            onBarHeightChange?.(height);
          }}>
          <View style={styles.barRow}>{children}</View>
        </GlassSurface>
        {/* Reserves the room ChatFab occupies (see _layout.tsx) — the FAB
            itself is a fully independent overlay painted on top of this gap,
            not a sibling here, so tapping it can't be misrouted by TabList's
            own tap-resolution (see chat-fab.tsx for why that matters). Sized
            to the FAB's own footprint (it matches this same bar height) plus
            a visible gap, so the two never crowd or overlap each other. */}
        <View style={{ width: (barHeight ?? DEFAULT_BAR_HEIGHT) + Spacing.two }} />
      </View>
    </View>
  );
}

function TabButton({ label, icon, isFocused, ...props }: TabTriggerSlotProps & { label: string; icon: IconName }) {
  const theme = useTheme();
  const color = isFocused ? theme.accent : theme.textTertiary;
  const focus = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    focus.value = withSpring(isFocused ? 1 : 0, SpringSnappy);
  }, [isFocused, focus]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scale: 0.7 + focus.value * 0.3 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + focus.value * 0.16 }, { translateY: focus.value * -1.5 }],
  }));

  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <Animated.View style={[styles.focusPill, { backgroundColor: theme.accentSoft }, pillStyle]} />
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={19} color={color} />
      </Animated.View>
      <ThemedText type="caption" style={[styles.tabLabel, { color }]} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fadeMask: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  floatWrapper: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  bar: {
    flex: 1,
  },
  barRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
  },
  pressed: {
    opacity: 0.6,
  },
  focusPill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 6,
    right: 6,
    borderRadius: Radius.medium,
  },
  tabLabel: {
    fontSize: 10,
  },
});
