import { createContext, useCallback, useContext, useId, useMemo } from 'react';
import { PanResponder, ScrollView, useWindowDimensions, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { SheetGrabber } from '@/components/ui/sheet-grabber';
import { SpringSheet, TimingExit } from '@/constants/motion';
import { hapticSelection, hapticSoft } from '@/lib/haptics';

/** Drag past this (or flick faster than this) and the popup goes away. */
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 0.8;
/** How far a drag must go down, and how vertical it must be, before it counts as a swipe. */
const START_DISTANCE = 8;
const VERTICAL_BIAS = 1.5;

type ScrollRegistry = { report: (id: string, offset: number) => void };
const ScrollRegistryContext = createContext<ScrollRegistry | null>(null);

/**
 * The drag behind "swipe a popup down to dismiss": the finger-following
 * transform, the pan responder, and the scroll registry for lists inside.
 * Spread `panHandlers` on an Animated.View styled with `animatedStyle` and wrap
 * its content in `<ScrollRegistryContext.Provider value={registry}>`; or use
 * `SwipeDismiss`, which does all of that around its children.
 */
export function useSwipeDismiss(onDismiss: (() => void) | undefined) {
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const dismissing = useSharedValue(false);
  const pastThreshold = useSharedValue(false);
  // False while any list inside is scrolled away from its top.
  const listsAtTop = useSharedValue(true);

  const dismiss = useCallback(() => {
    if (!onDismiss || dismissing.get()) return;
    dismissing.set(true);
    hapticSoft();
    translateY.set(
      withTiming(height, TimingExit, (finished) => {
        if (finished) runOnJS(onDismiss)();
      })
    );
  }, [dismissing, height, onDismiss, translateY]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Capture, so the drag is ours before a child sees it, but only for a downward, mostly vertical drag with nothing scrolled.
        onMoveShouldSetPanResponderCapture: (_, g) =>
          !!onDismiss && !dismissing.get() && listsAtTop.get() && g.dy > START_DISTANCE && g.dy > Math.abs(g.dx) * VERTICAL_BIAS,
        onPanResponderMove: (_, g) => {
          translateY.set(Math.max(0, g.dy));
          // A tick the moment the drag has gone far enough to dismiss, and another if it comes back.
          const past = g.dy > DISMISS_DISTANCE;
          if (past !== pastThreshold.get()) {
            pastThreshold.set(past);
            hapticSelection();
          }
        },
        onPanResponderRelease: (_, g) => {
          pastThreshold.set(false);
          if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) dismiss();
          else translateY.set(withSpring(0, SpringSheet));
        },
        onPanResponderTerminate: () => {
          pastThreshold.set(false);
          translateY.set(withSpring(0, SpringSheet));
        },
      }),
    [dismiss, dismissing, listsAtTop, onDismiss, pastThreshold, translateY]
  );

  const registry = useMemo<ScrollRegistry>(() => {
    const scrolledAway = new Set<string>();
    return {
      report: (id, offset) => {
        if (offset > 0) scrolledAway.add(id);
        else scrolledAway.delete(id);
        listsAtTop.set(scrolledAway.size === 0);
      },
    };
  }, [listsAtTop]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  return { panHandlers: pan.panHandlers, animatedStyle, registry };
}

export { ScrollRegistryContext };

export type SwipeDismissProps = {
  /** Called once the popup has slid away: close it (set `visible` to false, go back…). Leave it out to show the grabber without the swipe, where the platform already provides it. */
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
  /** The iPhone grabber at the top edge. On by default. */
  grabber?: boolean;
  /** Distance of the grabber from the top edge. */
  grabberTop?: number;
  children: React.ReactNode;
};

/**
 * Makes a popup surface swipe-to-dismiss, like an iPhone sheet: drag it down
 * (from anywhere on it) and it follows the finger, then slides off if the drag
 * went far or fast enough, or springs back. It also draws the grabber.
 *
 * A scrolling list inside it (use `PopupScrollView`) only lets the drag
 * through while it is scrolled to its very top, so scrolling the list and
 * dismissing the popup never fight. Dragging up, or sideways, is left to the
 * content. `GlassSurface` has the same behaviour built in (`swipeToDismiss`).
 */
export function SwipeDismiss({ onDismiss, style, grabber = true, grabberTop, children }: SwipeDismissProps) {
  const { panHandlers, animatedStyle, registry } = useSwipeDismiss(onDismiss);
  return (
    <ScrollRegistryContext.Provider value={registry}>
      <Animated.View style={[style, animatedStyle]} {...panHandlers}>
        {children}
        {grabber ? <SheetGrabber top={grabberTop} /> : null}
      </Animated.View>
    </ScrollRegistryContext.Provider>
  );
}

/**
 * A vertical ScrollView that tells the enclosing `SwipeDismiss` how far it is
 * scrolled, so a downward drag closes the popup only from the top of the list.
 * Horizontal strips are left alone. Outside a `SwipeDismiss` it is a plain ScrollView.
 */
export function PopupScrollView({ onScroll, scrollEventThrottle, ...props }: ScrollViewProps) {
  const registry = useContext(ScrollRegistryContext);
  const id = useId();
  if (props.horizontal || !registry) return <ScrollView onScroll={onScroll} scrollEventThrottle={scrollEventThrottle} {...props} />;
  return (
    <ScrollView
      {...props}
      scrollEventThrottle={scrollEventThrottle ?? 16}
      onScroll={(e) => {
        registry.report(id, e.nativeEvent.contentOffset.y);
        onScroll?.(e);
      }}
    />
  );
}
