import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { SheetGrabber } from '@/components/ui/sheet-grabber';
import { SpringSheet, TimingExit } from '@/constants/motion';
import { hapticSelection, hapticSoft } from '@/lib/haptics';

/** Drag past this (or flick faster than this, in pt/s) and the popup goes away. */
export const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 800;
/** How far a drag must go down before it counts as a swipe; going up or sideways first leaves it to the content. */
const START_DISTANCE = 8;
const FAIL_UP = -12;
const FAIL_SIDEWAYS = 24;

/** What a scrolling list inside a dismissable popup tells it: how far it is scrolled, and its own native gesture. */
type ScrollRegistry = {
  report: (id: string, offset: number) => void;
  register: (id: string, gesture: NativeGesture | null) => void;
};
const ScrollRegistryContext = createContext<ScrollRegistry | null>(null);

/**
 * The drag behind "swipe a popup down to dismiss", on the UI thread with react-native-gesture-handler.
 *
 * It used to be a PanResponder. On an iPhone that never worked: a native ScrollView (and the buttons inside the
 * popup) take the touch in UIKit before a JS responder is even asked, so the popup just stayed put. A gesture-
 * handler pan runs alongside the lists' own native scrolling (each `PopupScrollView` registers its gesture here) and
 * only moves the popup while every list is at its top, so scrolling a list and dismissing never fight.
 *
 * `translateY` is the popup's offset below its resting place; `close` is called once the drag decides to dismiss
 * (it animates the popup away itself). Leave `close` out to turn the drag off.
 */
export function useDismissDrag(translateY: SharedValue<number>, close: (() => void) | undefined, closeDistance = DISMISS_DISTANCE) {
  // False while any list inside is scrolled away from its top.
  const listsAtTop = useSharedValue(true);
  const dragging = useSharedValue(false);
  const pastThreshold = useSharedValue(false);
  const [natives, setNatives] = useState<Record<string, NativeGesture>>({});

  const registry = useMemo<ScrollRegistry>(() => {
    const scrolledAway = new Set<string>();
    return {
      report: (id, offset) => {
        if (offset > 0.5) scrolledAway.add(id);
        else scrolledAway.delete(id);
        listsAtTop.set(scrolledAway.size === 0);
      },
      register: (id, gesture) => {
        if (!gesture) scrolledAway.delete(id);
        setNatives((current) => {
          if (gesture ? current[id] === gesture : !(id in current)) return current;
          const next = { ...current };
          if (gesture) next[id] = gesture;
          else delete next[id];
          return next;
        });
      },
    };
  }, [listsAtTop]);

  const enabled = close != null;
  const finish = useCallback(() => close?.(), [close]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(enabled)
      .activeOffsetY([-1000, START_DISTANCE])
      .failOffsetY(FAIL_UP)
      .failOffsetX([-FAIL_SIDEWAYS, FAIL_SIDEWAYS])
      .onStart(() => {
        // A list scrolled away from its top keeps the drag: the popup only follows from the top.
        dragging.set(listsAtTop.get());
      })
      .onUpdate((e) => {
        if (!dragging.get()) return;
        translateY.set(Math.max(0, e.translationY));
        // A tick the moment the drag has gone far enough to dismiss, and another if it comes back.
        const past = e.translationY > closeDistance;
        if (past !== pastThreshold.get()) {
          pastThreshold.set(past);
          runOnJS(hapticSelection)();
        }
      })
      .onEnd((e) => {
        if (!dragging.get()) return;
        if (e.translationY > closeDistance || e.velocityY > DISMISS_VELOCITY) runOnJS(finish)();
        else translateY.set(withSpring(0, SpringSheet));
      })
      .onFinalize((_, success) => {
        if (dragging.get() && !success) translateY.set(withSpring(0, SpringSheet));
        dragging.set(false);
        pastThreshold.set(false);
      });
    const lists = Object.values(natives);
    return lists.length > 0 ? pan.simultaneousWithExternalGesture(...lists) : pan;
  }, [closeDistance, dragging, enabled, finish, listsAtTop, natives, pastThreshold, translateY]);

  return { gesture, registry };
}

/**
 * The same drag for a popup that only has to slide away and then report it: the finger-following transform comes
 * with it. Put `gesture` on a GestureDetector around an Animated.View styled with `animatedStyle`, and its content
 * in `<ScrollRegistryContext.Provider value={registry}>`; or use `SwipeDismiss`, which does all of that.
 */
export function useSwipeDismiss(onDismiss: (() => void) | undefined) {
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(0);
  const dismissing = useSharedValue(false);

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

  const { gesture, registry } = useDismissDrag(translateY, onDismiss ? dismiss : undefined);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  return { gesture, animatedStyle, registry };
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
  const { gesture, animatedStyle, registry } = useSwipeDismiss(onDismiss);
  return (
    <ScrollRegistryContext.Provider value={registry}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[style, animatedStyle]}>
          {children}
          {grabber ? <SheetGrabber top={grabberTop} /> : null}
        </Animated.View>
      </GestureDetector>
    </ScrollRegistryContext.Provider>
  );
}

/**
 * A vertical ScrollView that tells the enclosing dismissable popup how far it is
 * scrolled and lets the popup's drag run alongside its own scrolling, so a
 * downward drag closes the popup only from the top of the list.
 * Horizontal strips are left alone. Outside such a popup it is a plain ScrollView.
 */
export function PopupScrollView({ onScroll, scrollEventThrottle, ...props }: ScrollViewProps) {
  const registry = useContext(ScrollRegistryContext);
  const id = useId();
  const native = useMemo(() => Gesture.Native(), []);
  const inPopup = !props.horizontal && registry != null;

  useEffect(() => {
    if (!inPopup || !registry) return;
    registry.register(id, native);
    return () => registry.register(id, null);
  }, [id, inPopup, native, registry]);

  if (!inPopup || !registry) return <ScrollView onScroll={onScroll} scrollEventThrottle={scrollEventThrottle} {...props} />;
  return (
    <GestureDetector gesture={native}>
      <ScrollView
        // While the popup follows the finger the list must not stretch along with it.
        bounces={false}
        {...props}
        scrollEventThrottle={scrollEventThrottle ?? 16}
        onScroll={(e) => {
          registry.report(id, e.nativeEvent.contentOffset.y);
          onScroll?.(e);
        }}
      />
    </GestureDetector>
  );
}
