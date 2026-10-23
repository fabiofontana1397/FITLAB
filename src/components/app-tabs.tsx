import type { Href } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidGlass } from '@/components/glass/liquid-glass';
import { Icon, type IconName } from '@/components/ui/icon';
import { SpringPressIn, SpringPressOut } from '@/constants/motion';
import { hapticSelection } from '@/lib/haptics';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// The bar is a row of round glass bubbles, one per tab plus ChatFab's as the
// last, each overlapping the next a little so they read as one chain of
// droplets. ChatFab sits in the reserved last slot (see chat-fab.tsx), which
// is why these are exported.
export const TAB_BUBBLE = 54;
export const TAB_BUBBLE_OVERLAP = 6;

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

// Tab focus: settles quickly with just a whisper of overshoot on the pill.
const SpringTab: WithSpringConfig = { damping: 19, mass: 0.7, stiffness: 230 };
const SpringIconPop: WithSpringConfig = { damping: 9, mass: 0.5, stiffness: 300 };

const TAB_ITEMS: { name: string; href: Href; label: string; icon: IconName }[] = [
  { name: 'index', href: '/', label: 'Home', icon: 'tabHome' },
  { name: 'training', href: '/training', label: 'Training', icon: 'tabTraining' },
  { name: 'nutrition', href: '/nutrition', label: 'Nutrizione', icon: 'nutrition' },
  { name: 'progress', href: '/progress', label: 'Progressi', icon: 'progress' },
];

export default function AppTabs({ onBarHeightChange }: { onBarHeightChange?: (height: number) => void }) {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <ScrollFadeMask />
      <TabList asChild>
        <FloatingTabBar onBarHeightChange={onBarHeightChange}>
          {TAB_ITEMS.map((item, i) => (
            <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
              <TabButton label={item.label} icon={item.icon} first={i === 0} />
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
  const lastReportedHeight = useRef<number | null>(null);

  return (
    <View
      style={[
        styles.floatWrapper,
        { paddingBottom: Platform.select({ web: Math.max(insets.bottom, Spacing.four), default: insets.bottom || Spacing.three }) },
        { pointerEvents: 'box-none' },
      ]}>
      <View
        style={styles.row}
        onLayout={(e) => {
          // Only report height changes big enough to be real: sub-pixel
          // re-measurements on tab switches used to re-render ChatFab/ChatOrb
          // on every navigation, which read as the orb's colors "changing".
          const height = e.nativeEvent.layout.height;
          if (lastReportedHeight.current != null && Math.abs(height - lastReportedHeight.current) < 1) return;
          lastReportedHeight.current = height;
          onBarHeightChange?.(height);
        }}>
        {children}
        {/* Reserves ChatFab's bubble, the chain's last. The FAB itself is a
            fully independent overlay painted over this slot, not a sibling
            here, so tapping it can't be misrouted by TabList's own
            tap-resolution (see chat-fab.tsx for why that matters). */}
        <View style={{ width: TAB_BUBBLE - TAB_BUBBLE_OVERLAP, height: TAB_BUBBLE }} />
      </View>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TabButton({
  label,
  icon,
  first,
  isFocused,
  onPressIn,
  onPressOut,
  ...props
}: TabTriggerSlotProps & { label: string; icon: IconName; first?: boolean }) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  // The active bubble is solid white in both schemes, so its icon is dark.
  const color = isFocused ? '#060606' : theme.text;
  const focus = useSharedValue(isFocused ? 1 : 0);
  const pressed = useSharedValue(0);
  const iconPop = useSharedValue(1);
  const wasFocused = useRef(isFocused);

  useEffect(() => {
    focus.value = withSpring(isFocused ? 1 : 0, SpringTab);
    // A small "pop" on the icon the moment its tab becomes active.
    if (isFocused && !wasFocused.current) {
      iconPop.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, SpringIconPop));
    }
    wasFocused.current = isFocused;
  }, [isFocused, focus, iconPop]);

  // The active bubble swells a touch over its neighbours; a press sinks it.
  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: (1 + focus.value * 0.06) * (1 - pressed.value * 0.08) }],
  }));

  const activeStyle = useAnimatedStyle(() => ({ opacity: focus.value }));

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconPop.value }] }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        pressed.value = withSpring(1, SpringPressIn);
        if (!isFocused) hapticSelection();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, SpringPressOut);
        onPressOut?.(e);
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!isFocused }}
      style={[styles.tabButton, first ? null : { marginLeft: -TAB_BUBBLE_OVERLAP }, { zIndex: isFocused ? 2 : 1 }, bubbleStyle]}>
      <LiquidGlass variant="clear" radius={TAB_BUBBLE / 2} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.activeBubble,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.94)' : '#FFFFFF' },
          activeStyle,
        ]}
      />
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={21} color={color} />
      </Animated.View>
    </AnimatedPressable>
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
    justifyContent: 'center',
  },
  tabButton: {
    width: TAB_BUBBLE,
    height: TAB_BUBBLE,
    borderRadius: TAB_BUBBLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBubble: {
    borderRadius: TAB_BUBBLE / 2,
    boxShadow: '0px 4px 14px rgba(20,20,25,0.16), inset 0px -1px 1px rgba(20,20,25,0.05)',
  },
});
