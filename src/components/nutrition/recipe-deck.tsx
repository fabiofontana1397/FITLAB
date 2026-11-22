import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useState } from 'react';
import { PanResponder, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { DishPhoto, DishPlaceholder, mealImageUri } from '@/components/nutrition/dish-photo';
import { RecipeDetailSheet } from '@/components/nutrition/recipe-detail-sheet';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { HorizontalScrollDefaults } from '@/constants/scroll';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection, hapticTap } from '@/lib/haptics';
import { openPopup } from '@/lib/open-popup';
import type { SlotKind } from '@/lib/planning/fitlab/catalog';
import type { RecipeCard } from '@/lib/planning/fitlab/recipe-book';

type Filter = 'all' | SlotKind;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tutte' },
  { value: 'breakfast', label: 'Colazione' },
  { value: 'lunch', label: 'Pranzo' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Merenda' },
];

/** How far the card behind the top one sits (pt) and how much smaller it is: the edge of the stack peeks out above. */
const PEEK = 9;
const STACK_TOP = PEEK * 2;
/** A drag past this share of the card's width (or a quick flick) changes recipe. */
const THROW = 0.28;
/** Fixed parts of a card around its photo: padding, two lines of title, the calorie and macro overview. */
const CARD_PAD = 16;
const TITLE_H = 54;
const OVERVIEW_H = 86;
const CARD_GAPS = 12 * 2;
/** Cards kept mounted around the top one (one behind it for "back", two in the stack) and photos fetched ahead. */
const WINDOW = [-1, 0, 1, 2] as const;
const PREFETCH_BEHIND = 2;
const PREFETCH_AHEAD = 5;

/** Wall-clock ms, for telling a click that ends a drag from a tap. */
const clock = () => Date.now();

const THROW_TIMING = { duration: 240, easing: Easing.out(Easing.quad) };
const SETTLE_SPRING = { damping: 18, stiffness: 190 };

export type RecipeDeckProps = {
  cards: RecipeCard[];
  /** Under the portion's kcal: sized on the person ("Porzione per te") or a standard one. */
  portionLabel: string;
  /** The meal of today a recipe of this kind is logged to ("Pranzo"), and the action that logs it. */
  slotLabelFor: (kind: SlotKind) => string;
  onAdd: (card: RecipeCard) => void;
};

/**
 * Ricette, on one screen with no scrolling: the meal filters, a stack of recipe cards (title, photo, calories and
 * macros) and, under it, the selector to move through them. Swipe left for the next recipe, right to bring the
 * previous one back (or use the arrows); tap the card for the whole recipe in a full-page sheet that logs it.
 *
 * Smoothness: the cards around the top one stay mounted and keyed by their place in the deck, so the card behind
 * becomes the top one without being rebuilt (its photo is already on screen); the swap itself happens on the UI
 * thread in the same frame the thrown card leaves; the photos ahead are prefetched and shown without a fade.
 */
export function RecipeDeck({ cards, portionLabel, slotLabelFor, onAdd }: RecipeDeckProps) {
  const theme = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const [index, setIndex] = useState(0);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<RecipeCard | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const shown = useMemo(() => (filter === 'all' ? cards : cards.filter((c) => c.kind === filter)), [cards, filter]);
  const n = shown.length;
  const at = (i: number) => shown[((i % n) + n) % n];

  // UI-thread state: the deck's position (moved in the same frame a card is thrown, before React re-renders), the
  // horizontal drag of the top card, and `back`, 0→1 as the previous card slides back in from the left.
  const pos = useSharedValue(0);
  const tx = useSharedValue(0);
  const back = useSharedValue(0);
  const width = useSharedValue(360);
  const busy = useSharedValue(false);
  const crossed = useSharedValue(false);
  // When the last drag ended: a click that lands right after one (the web fires it on mouse up) is not a tap.
  const draggedAt = useSharedValue(0);
  const progress = useDerivedValue(() => Math.min(Math.abs(Math.min(tx.value, 0)) / (width.value * 0.45), 1));

  // Photos of the recipes around the current one, fetched before they come on screen.
  useEffect(() => {
    if (n === 0) return;
    const uris: string[] = [];
    for (let k = -PREFETCH_BEHIND; k <= PREFETCH_AHEAD; k++) {
      const image = shown[(((index + k) % n) + n) % n].image;
      const uri = image ? mealImageUri(image) : undefined;
      if (uri && !uris.includes(uri)) uris.push(uri);
    }
    if (uris.length > 0) Image.prefetch(uris, 'memory-disk').catch(() => {});
  }, [index, n, shown]);

  const next = () => {
    if (busy.value || n < 2) return;
    busy.set(true);
    tx.set(
      withTiming(-width.value * 1.4, THROW_TIMING, (done) => {
        if (!done) return;
        // Same frame: the deck moves on and the drag resets, so the card behind is the top one at rest.
        pos.set(pos.value + 1);
        tx.set(0);
        busy.set(false);
        runOnJS(setIndex)(pos.value);
      })
    );
  };
  const previous = () => {
    if (busy.value || n < 2) return;
    busy.set(true);
    back.set(
      withTiming(1, THROW_TIMING, (done) => {
        if (!done) return;
        pos.set(pos.value - 1);
        back.set(0);
        busy.set(false);
        runOnJS(setIndex)(pos.value);
      })
    );
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only a mostly horizontal drag, taken from the card (which is itself a button) as soon as it starts.
        onMoveShouldSetPanResponderCapture: (_, g) => !busy.value && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          crossed.set(false);
          draggedAt.set(clock());
        },
        onPanResponderMove: (_, g) => {
          // Left drags the top card away; right pulls the previous one back over it.
          if (g.dx <= 0) {
            tx.set(g.dx);
            back.set(0);
          } else {
            tx.set(0);
            back.set(Math.min(g.dx / width.value, 1));
          }
          const past = Math.abs(g.dx) > width.value * THROW;
          if (past !== crossed.value) {
            crossed.set(past);
            hapticSelection();
          }
        },
        onPanResponderRelease: (_, g) => {
          draggedAt.set(clock());
          const go = Math.abs(g.dx) > width.value * THROW || Math.abs(g.vx) > 0.7;
          if (go && g.dx < 0) next();
          else if (go && g.dx > 0) previous();
          else {
            tx.set(withSpring(0, SETTLE_SPRING));
            back.set(withSpring(0, SETTLE_SPRING));
          }
        },
        onPanResponderTerminate: () => {
          tx.set(withSpring(0, SETTLE_SPRING));
          back.set(withSpring(0, SETTLE_SPRING));
        },
      }),
    // next/previous only touch shared values and a state setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n]
  );

  const changeFilter = (f: Filter) => {
    if (f === filter) return;
    pos.set(0);
    tx.set(0);
    back.set(0);
    busy.set(false);
    setFilter(f);
    setIndex(0);
  };

  const cardW = size ? size.w : 0;
  const cardH = size ? size.h - STACK_TOP : 0;
  const photoSize = size ? Math.max(Math.min(cardW - CARD_PAD * 2, cardH - CARD_PAD * 2 - TITLE_H - OVERVIEW_H - CARD_GAPS), 96) : 0;
  const position = n > 0 ? ((index % n) + n) % n : 0;

  return (
    <View style={styles.root}>
      <ScrollView {...HorizontalScrollDefaults} contentContainerStyle={styles.filters} style={styles.filtersScroll}>
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <PressableScale
              key={f.value}
              onPress={() => changeFilter(f.value)}
              haptic="tap"
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, { backgroundColor: active ? theme.text : theme.backgroundElevated, borderColor: active ? theme.text : theme.boxEdge }]}>
              <ThemedText style={[styles.chipText, { color: active ? theme.background : theme.text }]}>{f.label}</ThemedText>
            </PressableScale>
          );
        })}
      </ScrollView>

      {n === 0 ? (
        <View style={styles.empty}>
          <ThemedText type="smallBold">Nessuna ricetta</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Con le tue preferenze non ci sono ricette per questo pasto.
          </ThemedText>
        </View>
      ) : (
        <View
          style={styles.deck}
          onLayout={(e: LayoutChangeEvent) => {
            const { width: w, height: h } = e.nativeEvent.layout;
            width.set(w);
            setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
          }}
          {...responder.panHandlers}>
          {size
            ? WINDOW.filter((k) => (n === 1 ? k === 0 : n === 2 ? k <= 1 : true)).map((k) => {
                const i = index + k;
                const card = at(i);
                return (
                  <DeckSlot key={`${filter}:${i}`} slot={i} pos={pos} tx={tx} back={back} progress={progress} width={width} height={cardH} interactive={k === 0}>
                    <RecipeFace
                      card={card}
                      portionLabel={portionLabel}
                      photoSize={photoSize}
                      onOpen={
                        k === 0
                          ? () => {
                              if (clock() - draggedAt.value < 350) return;
                              openPopup(() => setDetail(card));
                            }
                          : undefined
                      }
                    />
                  </DeckSlot>
                );
              })
            : null}
        </View>
      )}

      {/* The selector, under the card. */}
      <View style={styles.counterRow}>
        <RoundButton icon="arrowBack" label="Ricetta precedente" onPress={() => { hapticTap(); previous(); }} />
        <View style={styles.counterText}>
          <ThemedText style={styles.counter}>
            {n > 0 ? position + 1 : 0}
            <ThemedText style={styles.counterTotal} themeColor="textTertiary">
              {' '}/ {n}
            </ThemedText>
          </ThemedText>
          <ThemedText style={styles.hint} themeColor="textSecondary">
            Scorri per cambiare ricetta
          </ThemedText>
        </View>
        <RoundButton icon="chevronRight" label="Ricetta successiva" onPress={() => { hapticTap(); next(); }} />
      </View>

      <RecipeDetailSheet
        card={detail}
        portionLabel={portionLabel}
        slotLabel={detail ? slotLabelFor(detail.kind) : ''}
        added={detail ? !!added[detail.recipe.id] : false}
        onAdd={(card) => {
          onAdd(card);
          setAdded((a) => ({ ...a, [card.recipe.id]: true }));
        }}
        onClose={() => setDetail(null)}
      />
    </View>
  );
}

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
  interactive: boolean;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const r = slot - pos.value;
    const w = width.value;
    if (r === 0) {
      // The top card: follows a left drag; pushed down into the stack while the previous one comes back over it.
      const b = back.value;
      return {
        opacity: 1,
        zIndex: 3,
        transform: [
          { translateX: tx.value },
          { translateY: STACK_TOP + Math.abs(tx.value) * 0.04 - b * (STACK_TOP - PEEK) },
          { rotate: `${interpolate(tx.value, [-w, w], [-9, 9])}deg` },
          { scale: 1 - b * 0.05 },
        ],
      };
    }
    if (r === -1) {
      // The previous recipe, off to the left until a right drag brings it back.
      const b = back.value;
      return {
        opacity: b > 0 ? 1 : 0,
        zIndex: 4,
        transform: [
          { translateX: (b - 1) * w * 1.4 },
          { translateY: STACK_TOP + (1 - b) * w * 0.05 },
          { rotate: `${(b - 1) * 9}deg` },
          { scale: 1 },
        ],
      };
    }
    const p = progress.value;
    const b = back.value;
    if (r === 1) {
      return {
        opacity: 1,
        zIndex: 2,
        transform: [
          { translateX: 0 },
          { translateY: interpolate(p, [0, 1], [PEEK, STACK_TOP]) - b * PEEK },
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
          { translateY: interpolate(p, [0, 1], [0, PEEK]) },
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
    </Animated.View>
  );
}

/** The face of a recipe card: title, photo, the portion's calories and macros. Memoised: dragging never rebuilds it. */
const RecipeFace = memo(function RecipeFace({
  card,
  portionLabel,
  photoSize,
  onOpen,
}: {
  card: RecipeCard;
  portionLabel: string;
  photoSize: number;
  onOpen?: () => void;
}) {
  const theme = useTheme();
  const { recipe, totals } = card;
  const macros = [
    { label: 'Proteine', value: totals.protein, kcal: totals.protein * 4, color: theme.accent },
    { label: 'Carboidrati', value: totals.carbs, kcal: totals.carbs * 4, color: theme.brandGreen },
    { label: 'Grassi', value: totals.fats, kcal: totals.fats * 9, color: theme.brandYellow },
  ];
  const macroKcal = macros.reduce((s, m) => s + m.kcal, 0) || 1;

  return (
    <PressableScale
      onPress={onOpen}
      disabled={!onOpen}
      haptic="tap"
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name}, ${totals.kcal} kcal. Apri la ricetta`}
      style={[styles.card, { backgroundColor: theme.backgroundElevated, borderColor: theme.boxEdge }]}>
      <ThemedText style={styles.title} numberOfLines={2}>
        {recipe.name}
      </ThemedText>

      {/* No touches on the photo itself: on the web an <img> under the mouse starts the browser's own image drag and the swipe never arrives. */}
      <View style={[styles.photoWell, { pointerEvents: 'none' }]}>
        {card.image ? <DishPhoto image={card.image} size={photoSize} radius={26} eager /> : <DishPlaceholder size={photoSize} radius={26} />}
      </View>

      <View style={[styles.overview, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.overviewHead}>
          <ThemedText style={styles.kcal}>
            {totals.kcal}
            <ThemedText style={styles.kcalUnit} themeColor="textSecondary">
              {' '}kcal
            </ThemedText>
          </ThemedText>
          <ThemedText style={styles.portion} themeColor="textSecondary">
            {portionLabel}
          </ThemedText>
        </View>
        <View style={styles.splitBar}>
          {macros.map((m) => (
            <View key={m.label} style={{ flex: Math.max(m.kcal / macroKcal, 0.02), backgroundColor: m.color }} />
          ))}
        </View>
        <View style={styles.macroRow}>
          {macros.map((m) => (
            <View key={m.label} style={styles.macroCol}>
              <View style={styles.macroLabelRow}>
                <View style={[styles.dot, { backgroundColor: m.color }]} />
                <ThemedText style={styles.macroLabel} themeColor="textSecondary" numberOfLines={1}>
                  {m.label}
                </ThemedText>
              </View>
              <ThemedText style={styles.macroValue}>{m.value} g</ThemedText>
            </View>
          ))}
        </View>
      </View>
    </PressableScale>
  );
});

function RoundButton({ icon, label, onPress }: { icon: 'arrowBack' | 'chevronRight'; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptic={false}
      scaleTo={0.9}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.round, { backgroundColor: theme.backgroundElevated, borderColor: theme.boxEdge }]}>
      <Icon name={icon} size={18} color={theme.text} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filtersScroll: { marginHorizontal: -16, flexGrow: 0 },
  filters: { paddingHorizontal: 16, gap: 8 },
  chip: { height: 34, paddingHorizontal: 15, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  deck: { flex: 1, marginTop: 6 },
  slot: { position: 'absolute', top: 0, left: 0, right: 0, transformOrigin: 'top' },
  card: {
    flex: 1,
    borderRadius: 32,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: CARD_PAD,
    gap: 12,
  },
  title: { height: TITLE_H, fontSize: 21, lineHeight: 27, fontWeight: '700', letterSpacing: -0.4 },
  photoWell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overview: { height: OVERVIEW_H, borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'space-between' },
  overviewHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  kcal: { fontSize: 20, lineHeight: 24, fontWeight: '800', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  kcalUnit: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  portion: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  splitBar: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden', gap: 2 },
  macroRow: { flexDirection: 'row' },
  macroCol: { flex: 1, gap: 1 },
  macroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  macroLabel: { fontSize: 12, lineHeight: 15, fontWeight: '500' },
  macroValue: { fontSize: 15, lineHeight: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  counterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  counterText: { flex: 1, alignItems: 'center' },
  counter: { fontSize: 15, lineHeight: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  counterTotal: { fontSize: 15, lineHeight: 19, fontWeight: '500' },
  hint: { fontSize: 12, lineHeight: 15, marginTop: 1 },
  round: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
});
