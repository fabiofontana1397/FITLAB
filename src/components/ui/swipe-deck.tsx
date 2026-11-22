import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection, hapticTap } from '@/lib/haptics';

/** How far the card behind the top one sits (pt): the edge of the stack peeks out above the top card. */
const PEEK = 9;
const STACK_TOP = PEEK * 2;
/** A drag past this share of the card's width (or a quick flick) sends the card away. */
const THROW = 0.28;

/**
 * A horizontal control inside a card (the "Scorri per iniziare" slider) must keep its drag: wrap it in
 * `SwipeDeckKeepDrag` and the deck does not move while a finger (or the mouse) is down on it.
 */
const KeepDragContext = createContext<{ hold: () => void; release: () => void } | null>(null);

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

export type SwipeDeckProps<T> = {
  items: T[];
  keyOf: (item: T) => string;
  /** Changing it (a new filter, a new list) starts the deck again from its first card. */
  resetKey: string;
  /** `top` is false for the two cards behind, drawn only for their edge: no actions there. */
  renderCard: (item: T, top: boolean) => ReactNode;
  /** Under the counter ("Scorri per cambiare ricetta"). */
  hint: string;
  prevLabel: string;
  nextLabel: string;
};

/**
 * A Tinder-like stack of cards: drag the top card left for the next one, right for the previous one (or use the
 * arrows); it tilts with the finger, flies off past a threshold (with a tick of haptics when crossed) and the card
 * behind grows into its place. The stack wraps around. A mostly vertical drag is left to the page's scroll, and a
 * control inside a card that takes the touch first (a slider) keeps it.
 */
export function SwipeDeck<T>({ items, keyOf, resetKey, renderCard, hint, prevLabel, nextLabel }: SwipeDeckProps<T>) {
  const [index, setIndex] = useState(0);
  const [lastReset, setLastReset] = useState(resetKey);
  if (lastReset !== resetKey) {
    setLastReset(resetKey);
    setIndex(0);
  }
  const n = items.length;
  const at = (i: number) => items[((i % n) + n) % n];

  // The drag of the top card, its width, and `lock`: held at 1 from the moment a thrown card has left until the
  // next one is on screen, so the card behind (already grown to full size) never shrinks back for a frame.
  const tx = useSharedValue(0);
  const width = useSharedValue(360);
  const lock = useSharedValue(0);
  const topOpacity = useSharedValue(1);
  const progress = useDerivedValue(() => Math.max(Math.min(Math.abs(tx.value) / (width.value * 0.45), 1), lock.value));
  // Shared values rather than refs: the handlers below read and write them while the finger is down.
  const crossed = useSharedValue(false);
  const held = useSharedValue(false);
  const keepDrag = useMemo(() => ({ hold: () => held.set(true), release: () => held.set(false) }), [held]);

  const step = (dir: 1 | -1) => {
    setIndex((i) => i + dir);
  };

  // A new top card: it is already where the one behind had grown to, so it simply takes its place.
  useLayoutEffect(() => {
    tx.set(0);
    topOpacity.set(1);
    lock.set(0);
  }, [index, resetKey, tx, topOpacity, lock]);

  const throwCard = (dir: 1 | -1) => {
    // left (−) = next card, right (+) = previous one
    const to = (dir === 1 ? -1 : 1) * width.value * 1.4;
    tx.set(
      withTiming(to, { duration: 230, easing: Easing.out(Easing.quad) }, (done) => {
        if (!done) return;
        lock.set(1);
        topOpacity.set(0);
        runOnJS(step)(dir);
      })
    );
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only a mostly horizontal drag: a vertical one scrolls the page.
        onMoveShouldSetPanResponder: (_, g) => !held.value && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          crossed.set(false);
        },
        onPanResponderMove: (_, g) => {
          tx.set(g.dx);
          const past = Math.abs(g.dx) > width.value * THROW;
          if (past !== crossed.value) {
            crossed.set(past);
            hapticSelection();
          }
        },
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > width.value * THROW || Math.abs(g.vx) > 0.7) throwCard(g.dx < 0 ? 1 : -1);
          else tx.set(withSpring(0, { damping: 16, stiffness: 180 }));
        },
        onPanResponderTerminate: () => {
          tx.set(withSpring(0, { damping: 16, stiffness: 180 }));
        },
      }),
    // throwCard only touches shared values and a state setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const topStyle = useAnimatedStyle(() => ({
    opacity: topOpacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: Math.abs(tx.value) * 0.04 },
      { rotate: `${interpolate(tx.value, [-width.value, width.value], [-9, 9])}deg` },
    ],
  }));
  const behind1 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [PEEK, STACK_TOP]) }, { scale: interpolate(progress.value, [0, 1], [0.95, 1]) }],
  }));
  const behind2 = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.55, 1]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, PEEK]) }, { scale: interpolate(progress.value, [0, 1], [0.9, 0.95]) }],
  }));

  if (n === 0) return null;
  const current = at(index);
  const position = ((index % n) + n) % n;

  return (
    <View>
      <View style={styles.counterRow}>
        <RoundButton
          icon="arrowBack"
          label={prevLabel}
          disabled={n < 2}
          onPress={() => {
            hapticTap();
            throwCard(-1);
          }}
        />
        <View style={styles.counterText}>
          <ThemedText style={styles.counter}>
            {position + 1}
            <ThemedText style={styles.counterTotal} themeColor="textTertiary">
              {' '}/ {n}
            </ThemedText>
          </ThemedText>
          <ThemedText style={styles.hint} themeColor="textSecondary">
            {hint}
          </ThemedText>
        </View>
        <RoundButton
          icon="chevronRight"
          label={nextLabel}
          disabled={n < 2}
          onPress={() => {
            hapticTap();
            throwCard(1);
          }}
        />
      </View>

      <View
        style={styles.deck}
        onLayout={(e: LayoutChangeEvent) => {
          width.set(e.nativeEvent.layout.width);
        }}>
        {/* The two cards behind, cut to the deck's height: only their top edge shows until the top card moves. */}
        <View aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.behindClip, { pointerEvents: 'none' }]}>
          {n > 2 ? <Animated.View style={[styles.behind, behind2]}>{renderCard(at(index + 2), false)}</Animated.View> : null}
          {n > 1 ? <Animated.View style={[styles.behind, behind1]}>{renderCard(at(index + 1), false)}</Animated.View> : null}
        </View>

        <KeepDragContext.Provider value={keepDrag}>
          {/* every new press starts unheld (a mouse release outside the slider never reaches it); the slider then holds again. On touch screens the end of a touch always reaches the view it started on. */}
          <Animated.View
            key={`${resetKey}-${keyOf(current)}`}
            style={[styles.top, topStyle]}
            onPointerDownCapture={keepDrag.release}
            {...(n > 1 ? responder.panHandlers : {})}>
            {renderCard(current, true)}
          </Animated.View>
        </KeepDragContext.Provider>
      </View>
    </View>
  );
}

function RoundButton({ icon, label, disabled, onPress }: { icon: 'arrowBack' | 'chevronRight'; label: string; disabled?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic={false}
      scaleTo={0.9}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.round, { backgroundColor: theme.backgroundElevated, borderColor: theme.boxEdge, opacity: disabled ? 0.4 : 1 }]}>
      <Icon name={icon} size={18} color={theme.text} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterText: { flex: 1, alignItems: 'center' },
  counter: { fontSize: 15, lineHeight: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  counterTotal: { fontSize: 15, lineHeight: 19, fontWeight: '500' },
  hint: { fontSize: 12, lineHeight: 15, marginTop: 1 },
  round: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  deck: { marginTop: 4, paddingTop: STACK_TOP },
  // stops short of the deck's bottom so a longer card behind never shows under the top card's rounded corners
  behindClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 48, overflow: 'hidden' },
  behind: { position: 'absolute', top: 0, left: 0, right: 0, transformOrigin: 'top' },
  top: { transformOrigin: 'bottom' },
});
