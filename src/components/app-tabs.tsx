import type { Href } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidGlass, liquidLensStyle } from '@/components/glass/liquid-glass';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { SpringIconPop, SpringPressIn, SpringPressOut, TimingTap } from '@/constants/motion';
import { hapticSelection } from '@/lib/haptics';
import { BottomTabInset, Layout, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// Same total ScreenScroll already reserves as bottom padding (see
// screen-scroll.tsx) so this mask's fade zone lines up with exactly the
// area every screen already keeps clear for the floating bar.
const FADE_HEIGHT = BottomTabInset + Spacing.six;

// A single BlurView turns on at full strength the instant content crosses
// its top edge — a visible seam. On the web the blur is therefore one layer
// whose own opacity is masked with a smooth ramp (nothing to see a step in).
// Native has no mask, so there the fade zone is cut into many thin stripes,
// each a hair stronger than the one above it on an eased curve, so no single
// step is large enough to read as an edge. Stripes never overlap: stacking
// translucent tinted blurs brightened scrolled content ("i colori si
// accendono"). The tint stays light for the same reason.
const NATIVE_BANDS = 16;
const MAX_BLUR = { web: 22, default: 26 };
const bandIntensity = (i: number, max: number) => Math.max(1, Math.round(max * Math.pow((i + 1) / NATIVE_BANDS, 2)));
/** Eased 0→1 ramp for the colour wash and the web mask: slow start, no kink. */
const EASE_STOPS = [0, 0.1, 0.25, 0.45, 0.7, 1] as const;
const easeAt = (t: number) => t * t * (3 - 2 * t);
/** How much of the page colour the wash reaches at the bar — less than 1, so content under the glass keeps its colour. */
const WASH_MAX_ALPHA = 0.78;

/** Height of one tab button; with the bar's 3 pt padding the whole bar is 49 pt, the iPhone tab bar's height. */
const TAB_HEIGHT = 43;

// Tab focus: settles quickly with just a whisper of overshoot on the pill.
const SpringTab: WithSpringConfig = { damping: 19, mass: 0.7, stiffness: 230 };

const TAB_ITEMS: { name: string; href: Href; label: string; icon: IconName }[] = [
  { name: 'index', href: '/', label: 'Home', icon: 'home' },
  { name: 'training', href: '/training', label: 'Training', icon: 'training' },
  { name: 'nutrition', href: '/nutrition', label: 'Nutrizione', icon: 'nutrition' },
  { name: 'progress', href: '/progress', label: 'Progressi', icon: 'progress' },
];

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <ScrollFadeMask />
      <TabList asChild>
        <FloatingTabBar>
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
  const web = Platform.OS === 'web';
  const stripeHeight = FADE_HEIGHT / NATIVE_BANDS;
  const wash = EASE_STOPS.map((t) => withAlpha(theme.background, easeAt(t) * WASH_MAX_ALPHA));
  const webMask = `linear-gradient(to bottom, rgba(0,0,0,0) 0%, ${EASE_STOPS.map((t) => `rgba(0,0,0,${easeAt(t).toFixed(3)}) ${Math.round(t * 100)}%`).join(', ')})`;
  return (
    <View pointerEvents="none" style={[styles.fadeMask, { height: FADE_HEIGHT }]}>
      {web ? (
        <BlurView
          intensity={MAX_BLUR.web}
          tint={isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { maskImage: webMask, WebkitMaskImage: webMask } as object]}
        />
      ) : (
        Array.from({ length: NATIVE_BANDS }, (_, i) => (
          <BlurView
            key={i}
            intensity={bandIntensity(i, MAX_BLUR.default)}
            tint={isDark ? 'dark' : 'light'}
            blurMethod="dimezisBlurViewSdk31Plus"
            style={{ position: 'absolute', top: stripeHeight * i, left: 0, right: 0, height: stripeHeight + 0.5 }}
          />
        ))
      )}
      {/* The colour wash over the whole zone, eased and never fully opaque. */}
      <LinearGradient colors={wash as [string, string, ...string[]]} locations={EASE_STOPS as unknown as [number, number, ...number[]]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** `#rrggbb` + alpha → `rgba()`; any other colour string is returned as is. */
function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(3)})`;
}

/** The bar spans the screen between the same side gutters as the page's
 * cards, so its edges line up with them. */
function FloatingTabBar({ children }: { children?: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.floatWrapper,
        { paddingBottom: Platform.select({ web: Math.max(insets.bottom, Spacing.three), default: insets.bottom || Spacing.three }) },
        { pointerEvents: 'box-none' },
      ]}>
      <View style={styles.row}>
        <LiquidGlass variant="clear" radius={Radius.xlarge} style={styles.bar}>
          <View style={styles.barRow}>{children}</View>
        </LiquidGlass>
      </View>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TabButton({
  label,
  icon,
  isFocused,
  onPressIn,
  onPressOut,
  ...props
}: TabTriggerSlotProps & { label: string; icon: IconName }) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const color = isFocused ? theme.text : theme.textSecondary;
  const focus = useSharedValue(isFocused ? 1 : 0);
  const pressed = useSharedValue(0);
  const iconPop = useSharedValue(1);
  const wasFocused = useRef(isFocused);

  useEffect(() => {
    focus.value = withSpring(isFocused ? 1 : 0, SpringTab);
    // A small "pop" on the icon the moment its tab becomes active.
    if (isFocused && !wasFocused.current) {
      iconPop.value = withSequence(withTiming(0.82, TimingTap), withSpring(1, SpringIconPop));
    }
    wasFocused.current = isFocused;
  }, [isFocused, focus, iconPop]);

  // The active tab widens to make room for its label; animating the grow
  // factor makes the neighbours slide over instead of jumping.
  const buttonStyle = useAnimatedStyle(() => ({ flexGrow: 1 + focus.value * 1.1 }));

  const pillStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
    transform: [{ scaleX: 0.7 + focus.value * 0.3 }, { scaleY: 0.85 + focus.value * 0.15 }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.08 }],
  }));

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
      style={[styles.tabButton, buttonStyle]}>
      <Animated.View style={[styles.focusPill, liquidLensStyle(isDark), pillStyle]} />
      <Animated.View style={[styles.tabContent, contentStyle]}>
        <Animated.View style={iconStyle}>
          <Icon name={icon} size={19} color={color} />
        </Animated.View>
        {isFocused ? (
          <Animated.View entering={FadeIn.duration(220).delay(60)} exiting={FadeOut.duration(90)}>
            <ThemedText type="smallBold" style={[styles.tabLabel, { color }]} numberOfLines={1}>
              {label}
            </ThemedText>
          </Animated.View>
        ) : null}
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
    paddingHorizontal: Layout.screenGutter,
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
    padding: 3,
  },
  // 43 pt of button in 3 pt of padding makes a 49 pt bar.
  tabButton: {
    flexBasis: 0,
    height: TAB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  focusPill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: TAB_HEIGHT / 2,
  },
  tabLabel: {
    fontSize: 12,
  },
});
