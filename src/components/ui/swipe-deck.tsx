import { createContext, memo, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { DECK_SHADE } from '@/constants/deck-depth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection, hapticTap } from '@/lib/haptics';

/** A drag past this share of the card's width (or a quick flick) changes card. */
const THROW = 0.28;
/** A flick faster than this (pt/s) changes card whatever the distance. */
const FLICK = 700;
/** Cards kept mounted around the top one: the previous one (waiting off to the left), the top one, two behind it. */
const WINDOW = [-1, 0, 1, 2] as const;
/** Stamps the time (ms) into a shared value, from the gesture's own thread. */
function markNow(sv: SharedValue<number>) {
  'worklet';
  sv.value = Date.now();
}
const THROW_TIMING = { duration: 240, easing: Easing.out(Easing.quad) };
const SETTLE_SPRING = { damping: 18, stiffness: 190 };
/** The counter's number settling into place as it rolls: quick, no wobble. */
const COUNTER_SPRING = { damping: 22, stiffness: 340, mass: 0.7 };

/**
 * A horizontal control inside a card (the "Scorri per iniziare" slider) must keep its drag: wrap it in
 * `SwipeDeckKeepDrag` and the deck does not move while a finger (or the mouse) is down on it.
 */
const KeepDragContext = createContext<{ hold: () => void; release: () => void; justDragged: () => boolean } | null>(null);

/**
 * For a button inside a card: true right after a drag of the deck ended (the web fires a click on mouse up), so the
 * press is not taken as a tap. Stable: safe in a memoised card.
 */
export function useSwipeDeckJustDragged(): () => boolean {
  const ctx = useContext(KeepDragContext);
  return ctx?.justDragged ?? notDragged;
}
const notDragged = () => false;

export function SwipeDeckKeepDrag({ children }: { children: ReactNode }) {
  const ctx = useContext(KeepDragContext);
  return (
    <View
      onTouchStart={ctx?.hold}
      onTouchEnd={ctx?.release}
      onTouchCancel={ctx?.release}
      onPointerDown={ctx?.hold}
      onPointerUp={ctx?.release}
      onPointerCancel={ctx?.release}>
      {children}
    </View>
  );
}

export type DeckCardSize = { width: number; height: number };

export type SwipeDeckProps<T> = {
  items: T[];
  keyOf: (item: T) => string;
  /** Changing it (a new filter, a new list) starts the deck again from its first card. */
  resetKey: string;
  /**
   * The face of a card, at the size the deck gives it. Pass a stable function (useCallback): a card is only redrawn
   * when it, the item or the size change, never because it moved up the stack. Only the top card takes touches.
   */
  renderCard: (item: T, size: DeckCardSize) => ReactNode;
  /** Under the counter ("Scorri per cambiare ricetta"). */
  hint: string;
  prevLabel: string;
  nextLabel: string;
  /** How far the card behind the top one sits (pt): the edge of the stack peeks out above the top card. */
  peek?: number;
  /** The cards' corner radius, for the shade over the cards behind. */
  radius?: number;
  /** The position of the top card (0…n-1), e.g. to fetch the photos ahead. */
  onIndexChange?: (position: number) => void;
};

/**
 * A Tinder-like stack of cards that fills the height its parent gives it, with the selector (arrows and counter)
 * under it. Drag the top card left for the next one; drag right to bring the previous one back over it (or use the
 * arrows). The top card tilts with the finger and flies off past a threshold (a tick of haptics when it is crossed),
 * the card behind grows into its place. The stack wraps around. A mostly vertical drag is left alone, and a control
 * inside a card wrapped in `SwipeDeckKeepDrag` keeps its own drag.
 *
 * Smoothness: the drag runs on the UI thread (gesture handler), never waiting on JavaScript; the cards around the top
 * one stay mounted and keyed by their place in the deck, so the card behind becomes the top one without being
 * rebuilt; the swap happens on the UI thread in the same frame the thrown card leaves, React catching up after.
 */
export function SwipeDeck<T>({ items, keyOf, resetKey, renderCard, hint, prevLabel, nextLabel, peek = 12, radius = 30, onIndexChange }: SwipeDeckProps<T>) {
  const theme = useTheme();
  const stackTop = peek * 2;
  const [index, setIndex] = useState(0);
  const [lastReset, setLastReset] = useState(resetKey);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const n = items.length;

  // UI-thread state: the deck's position (moved in the same frame a card is thrown, before React re-renders), the
  // horizontal drag of the top card, and `back`, 0→1 as the previous card slides back in from the left.
  const pos = useSharedValue(0);
  const tx = useSharedValue(0);
  const back = useSharedValue(0);
  const width = useSharedValue(360);
  const busy = useSharedValue(false);
  const crossed = useSharedValue(false);
  const held = useSharedValue(false);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const progress = useDerivedValue(() => Math.min(Math.abs(Math.min(tx.value, 0)) / (width.value * 0.45), 1));
  // When the last drag started or ended (ms), for telling a click that ends a drag from a tap.
  const draggedAt = useSharedValue(0);
  const keepDrag = useMemo(
    () => ({ hold: () => held.set(true), release: () => held.set(false), justDragged: () => Date.now() - draggedAt.value < 350 }),
    [held, draggedAt]
  );

  if (lastReset !== resetKey) {
    setLastReset(resetKey);
    setIndex(0);
    pos.set(0);
    tx.set(0);
    back.set(0);
    busy.set(false);
  }

  const position = n > 0 ? ((index % n) + n) % n : 0;
  useEffect(() => {
    onIndexChange?.(position);
  }, [position, onIndexChange]);

  const next = () => {
    'worklet';
    if (busy.value || n < 2) return;
    busy.value = true;
    tx.value = withTiming(-width.value * 1.4, THROW_TIMING, (done) => {
      if (!done) return;
      // Same frame: the deck moves on and the drag resets, so the card behind is the top one at rest.
      pos.value = pos.value + 1;
      tx.value = 0;
      busy.value = false;
      runOnJS(setIndex)(pos.value);
    });
  };
  const previous = () => {
    'worklet';
    if (busy.value || n < 2) return;
    busy.value = true;
    tx.value = withSpring(0, SETTLE_SPRING);
    back.value = withTiming(1, THROW_TIMING, (done) => {
      if (!done) return;
      pos.value = pos.value - 1;
      back.value = 0;
      busy.value = false;
      runOnJS(setIndex)(pos.value);
    });
  };

  const pan = Gesture.Pan()
    .enabled(n > 1)
    // Taken only once the drag is clearly horizontal: a tap still opens the card, a vertical drag is left alone.
    .manualActivation(true)
    .onTouchesDown((e) => {
      const t = e.allTouches[0];
      if (!t) return;
      startX.value = t.absoluteX;
      startY.value = t.absoluteY;
    })
    .onTouchesMove((e, manager) => {
      const t = e.allTouches[0];
      if (!t) return;
      if (held.value || busy.value) {
        manager.fail();
        return;
      }
      const dx = t.absoluteX - startX.value;
      const dy = t.absoluteY - startY.value;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) manager.activate();
      else if (Math.abs(dy) > 12) manager.fail();
    })
    .onStart(() => {
      crossed.value = false;
      markNow(draggedAt);
    })
    .onUpdate((e) => {
      const dx = e.translationX;
      // Left drags the top card away; right pulls the previous one back over it.
      if (dx <= 0) {
        tx.value = dx;
        back.value = 0;
      } else {
        tx.value = 0;
        back.value = Math.min(dx / width.value, 1);
      }
      const past = Math.abs(dx) > width.value * THROW;
      if (past !== crossed.value) {
        crossed.value = past;
        runOnJS(hapticSelection)();
      }
    })
    .onEnd((e) => {
      markNow(draggedAt);
      const go = Math.abs(e.translationX) > width.value * THROW || Math.abs(e.velocityX) > FLICK;
      if (go && e.translationX < 0) next();
      else if (go && e.translationX > 0) previous();
      else {
        tx.value = withSpring(0, SETTLE_SPRING);
        back.value = withSpring(0, SETTLE_SPRING);
      }
    })
    .onFinalize((_, success) => {
      if (success || busy.value) return;
      tx.value = withSpring(0, SETTLE_SPRING);
      back.value = withSpring(0, SETTLE_SPRING);
    });

  if (n === 0) return null;
  const at = (i: number) => items[((i % n) + n) % n];
  const cardSize = size ? { width: size.w, height: Math.max(size.h - stackTop, 0) } : null;

  return (
    <View style={styles.root}>
      <GestureDetector gesture={pan}>
        <View
          style={styles.deck}
          onLayout={(e: LayoutChangeEvent) => {
            const { width: w, height: h } = e.nativeEvent.layout;
            // A page kept mounted but hidden measures 0: keep the last real size.
            if (w <= 0 || h <= 0) return;
            width.set(w);
            setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
          }}>
          <KeepDragContext.Provider value={keepDrag}>
            {cardSize
              ? WINDOW.filter((k) => (n === 1 ? k === 0 : n === 2 ? k <= 1 : true)).map((k) => {
                  const i = index + k;
                  return (
                    <DeckSlot
                      key={`${resetKey}:${i}`}
                      slot={i}
                      pos={pos}
                      tx={tx}
                      back={back}
                      progress={progress}
                      width={width}
                      height={cardSize.height}
                      peek={peek}
                      radius={radius}
                      interactive={k === 0}>
                      <CardFace item={at(i)} itemKey={keyOf(at(i))} size={cardSize} render={renderCard} />
                    </DeckSlot>
                  );
                })
              : null}
          </KeepDragContext.Provider>
        </View>
      </GestureDetector>

      {/* The selector: one quiet capsule, centred under the deck, with the position rolling as the cards move. */}
      <View style={styles.selectorRow}>
        <View
          style={[styles.capsule, { backgroundColor: theme.backgroundElevated, borderColor: theme.boxEdge }]}
          accessibilityHint={hint}>
          <StepButton
            icon="arrowBack"
            label={prevLabel}
            disabled={n < 2}
            onPress={() => {
              hapticTap();
              previous();
            }}
          />
          <RollingCounter index={index} position={position} total={n} />
          <StepButton
            icon="chevronRight"
            label={nextLabel}
            disabled={n < 2}
            onPress={() => {
              hapticTap();
              next();
            }}
          />
        </View>
      </View>
    </View>
  );
}

/** The face of one card: redrawn only when its item, its size or the render function change. */
const CardFace = memo(
  function CardFace<T>({ item, size, render }: { item: T; itemKey: string; size: DeckCardSize; render: (item: T, size: DeckCardSize) => ReactNode }) {
    return <>{render(item, size)}</>;
  },
  (a, b) => a.itemKey === b.itemKey && a.item === b.item && a.render === b.render && a.size.width === b.size.width && a.size.height === b.size.height
) as <T>(props: { item: T; itemKey: string; size: DeckCardSize; render: (item: T, size: DeckCardSize) => ReactNode }) => ReactNode;

/**
 * One place in the deck. Its role (top card, first or second behind, the previous one waiting off to the left) is
 * worked out on the UI thread from the deck's position, so a card changes role without React re-rendering it.
 */
function DeckSlot({
  slot,
  pos,
  tx,
  back,
  progress,
  width,
  height,
  peek,
  radius,
  interactive,
  children,
}: {
  slot: number;
  pos: SharedValue<number>;
  tx: SharedValue<number>;
  back: SharedValue<number>;
  progress: SharedValue<number>;
  width: SharedValue<number>;
  height: number;
  peek: number;
  radius: number;
  interactive: boolean;
  children: ReactNode;
}) {
  const shade = DECK_SHADE[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const stackTop = peek * 2;
  // The veil over the card: none on top, darker one and two places back; it follows the same drag as the stack.
  const veil = useAnimatedStyle(() => {
    const r = slot - pos.value;
    const p = progress.value;
    const b = back.value;
    let o = 0;
    if (r === 0) o = b * shade.first;
    else if (r === 1) o = interpolate(p, [0, 1], [shade.first, 0]) + b * (shade.second - shade.first);
    else if (r === 2) o = interpolate(p, [0, 1], [shade.second, shade.first]);
    return { opacity: o };
  });
  const style = useAnimatedStyle(() => {
    const r = slot - pos.value;
    const w = width.value;
    const b = back.value;
    if (r === 0) {
      // The top card: follows a left drag; pushed down into the stack while the previous one comes back over it.
      return {
        opacity: 1,
        zIndex: 3,
        transform: [
          { translateX: tx.value },
          { translateY: stackTop + Math.abs(tx.value) * 0.04 - b * (stackTop - peek) },
          { rotate: `${interpolate(tx.value, [-w, w], [-9, 9])}deg` },
          { scale: 1 - b * 0.05 },
        ],
      };
    }
    if (r === -1) {
      // The previous card, off to the left until a right drag brings it back.
      return {
        opacity: b > 0 ? 1 : 0,
        zIndex: 4,
        transform: [
          { translateX: (b - 1) * w * 1.4 },
          { translateY: stackTop + (1 - b) * w * 0.05 },
          { rotate: `${(b - 1) * 9}deg` },
          { scale: 1 },
        ],
      };
    }
    const p = progress.value;
    if (r === 1) {
      return {
        opacity: 1,
        zIndex: 2,
        transform: [
          { translateX: 0 },
          { translateY: interpolate(p, [0, 1], [peek, stackTop]) - b * peek },
          { rotate: '0deg' },
          { scale: interpolate(p, [0, 1], [0.95, 1]) - b * 0.05 },
        ],
      };
    }
    if (r === 2) {
      return {
        opacity: interpolate(p, [0, 1], [0.55, 1]) * (1 - b),
        zIndex: 1,
        transform: [
          { translateX: 0 },
          { translateY: interpolate(p, [0, 1], [0, peek]) },
          { rotate: '0deg' },
          { scale: interpolate(p, [0, 1], [0.9, 0.95]) },
        ],
      };
    }
    return { opacity: 0, zIndex: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 0.9 }] };
  });

  return (
    <Animated.View
      aria-hidden={!interactive}
      importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
      style={[styles.slot, { height, pointerEvents: interactive ? 'auto' : 'none' }, style]}>
      {children}
      <Animated.View style={[styles.veil, { backgroundColor: shade.color, borderRadius: radius }, veil]} />
    </Animated.View>
  );
}

/** A chevron in the capsule: just the glyph, with a full-size target and a soft press. */
function StepButton({ icon, label, disabled, onPress }: { icon: 'arrowBack' | 'chevronRight'; label: string; disabled?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic={false}
      scaleTo={0.82}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.step, { opacity: disabled ? 0.3 : 1 }]}>
      <Icon name={icon} size={17} color={theme.textSecondary} />
    </PressableScale>
  );
}

/**
 * "12 di 106". The number rolls in from the side the deck moved (up for the next card, down for the previous one)
 * and settles with a soft spring; the total stays still. Wrapping from the last card to the first still rolls forward.
 */
function RollingCounter({ index, position, total }: { index: number; position: number; total: number }) {
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(0);
  const fade = useSharedValue(1);
  const last = useRef(index);

  useEffect(() => {
    const dir = Math.sign(index - last.current);
    last.current = index;
    if (dir === 0 || reduceMotion) return;
    y.set(dir * 9);
    fade.set(0);
    y.set(withSpring(0, COUNTER_SPRING));
    fade.set(withTiming(1, { duration: 180 }));
  }, [index, reduceMotion, y, fade]);

  const numberStyle = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateY: y.value }] }));

  return (
    <View style={styles.counter} accessible accessibilityRole="text" accessibilityLabel={`${position + 1} di ${total}`}>
      <View style={styles.counterClip}>
        <Animated.View style={numberStyle}>
          <ThemedText style={styles.counterNumber}>{position + 1}</ThemedText>
        </Animated.View>
      </View>
      <ThemedText style={styles.counterTotal} themeColor="textTertiary">
        di {total}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  deck: { flex: 1, minHeight: 0 },
  slot: { position: 'absolute', top: 0, left: 0, right: 0, transformOrigin: 'top' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderCurve: 'continuous', pointerEvents: 'none' },
  selectorRow: { alignItems: 'center', marginTop: 12 },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 2,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  step: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  counter: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4, minWidth: 92 },
  counterClip: { height: 20, overflow: 'hidden', justifyContent: 'flex-end' },
  counterNumber: { fontSize: 15, lineHeight: 20, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -0.2 },
  counterTotal: { fontSize: 15, lineHeight: 20, fontWeight: '400', fontVariant: ['tabular-nums'] },
});
