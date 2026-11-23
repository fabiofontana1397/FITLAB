import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { SWAP_BUILD_AFTER_MS, SwapLayer } from '@/components/motion/swap-layer';
import { DishPhoto, DishPlaceholder, mealImageUri } from '@/components/nutrition/dish-photo';
import { RecipeDetailSheet } from '@/components/nutrition/recipe-detail-sheet';
import { ThemedText } from '@/components/themed-text';
import { SwipeDeck, useSwipeDeckJustDragged, type DeckCardSize } from '@/components/ui/swipe-deck';
import { HorizontalScrollDefaults } from '@/constants/scroll';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection } from '@/lib/haptics';
import { openPopup } from '@/lib/open-popup';
import type { SlotKind } from '@/lib/planning/fitlab/catalog';
import type { RecipeCard } from '@/lib/planning/fitlab/recipe-book';
import type { ScrollViewInstance } from 'react-native';

type Filter = 'all' | SlotKind;
const CHIP_H = 34;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tutte' },
  { value: 'breakfast', label: 'Colazione' },
  { value: 'lunch', label: 'Pranzo' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Merenda' },
];

/** How far the card behind the top one sits (pt): the edge of the stack peeks out above. */
const PEEK = 9;
/** Fixed parts of a card around its photo: padding, two lines of title, the calorie and macro overview. */
const CARD_PAD = 16;
const TITLE_H = 54;
const OVERVIEW_H = 86;
const CARD_GAPS = 12 * 2;
/** Photos fetched ahead of the top card (and kept behind it, for "back"). */
const PREFETCH_BEHIND = 2;
const PREFETCH_AHEAD = 5;

/** The chips' pill gliding to the chosen meal: quick, settling without a wobble. */
const PILL_SPRING = { damping: 26, stiffness: 320, mass: 0.8 };
/** After Ricette first shows, the other meals' decks are built in the background, one at a time. */
const PREWARM_START_MS = 1600;
const PREWARM_STEP_MS = 450;

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
 * The stack is the shared `SwipeDeck` (drag on the UI thread, cards never rebuilt as they move up); the photos ahead
 * are prefetched and shown without a fade.
 */
export function RecipeDeck({ cards, portionLabel, slotLabelFor, onAdd }: RecipeDeckProps) {
  const [filter, setFilter] = useState<Filter>('all');
  // Every meal's deck, once built, stays mounted: going back to it is only a cross-fade, never a rebuild.
  const [built, setBuilt] = useState<Filter[]>(['all']);
  // Which way the decks move: +1 when the chip tapped is to the right of the previous one.
  const [direction, setDirection] = useState(1);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<RecipeCard | null>(null);

  const current = useRef(filter);
  const choose = useCallback((next: Filter) => {
    const prev = current.current;
    if (prev === next) return;
    current.current = next;
    setDirection(filterIndex(next) >= filterIndex(prev) ? 1 : -1);
    setFilter(next);
  }, []);

  // A deck not built yet: built a beat later, while the leaving one is already fading on the UI thread.
  useEffect(() => {
    if (built.includes(filter)) return;
    const t = setTimeout(() => setBuilt((b) => (b.includes(filter) ? b : [...b, filter])), SWAP_BUILD_AFTER_MS);
    return () => clearTimeout(t);
  }, [filter, built]);

  // The other meals are built quietly in the background, so a later tap finds them ready.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    FILTERS.forEach((f, i) => {
      timers.push(setTimeout(() => setBuilt((b) => (b.includes(f.value) ? b : [...b, f.value])), PREWARM_START_MS + i * PREWARM_STEP_MS));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const open = useCallback((card: RecipeCard) => openPopup(() => setDetail(card)), []);
  const renderCard = useCallback(
    (card: RecipeCard, size: DeckCardSize) => {
      const photoSize = Math.max(Math.min(size.width - CARD_PAD * 2, size.height - CARD_PAD * 2 - TITLE_H - OVERVIEW_H - CARD_GAPS), 96);
      return <RecipeFace card={card} portionLabel={portionLabel} photoSize={photoSize} onOpen={open} />;
    },
    [portionLabel, open]
  );

  return (
    <View style={styles.root}>
      <FilterChips value={filter} onChange={choose} />

      <View style={styles.deck}>
        {FILTERS.filter((f) => built.includes(f.value)).map((f) => (
          <DeckLayer key={f.value} filter={f.value} cards={cards} active={f.value === filter} direction={direction} renderCard={renderCard} />
        ))}
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

const recipeKey = (c: RecipeCard) => c.recipe.id;
const filterIndex = (f: Filter) => FILTERS.findIndex((x) => x.value === f);

/** One meal's deck, kept mounted once built: the change of meal only moves it (see SwapLayer). */
const DeckLayer = memo(function DeckLayer({
  filter,
  cards,
  active,
  direction,
  renderCard,
}: {
  filter: Filter;
  cards: RecipeCard[];
  active: boolean;
  direction: number;
  renderCard: (card: RecipeCard, size: DeckCardSize) => React.ReactNode;
}) {
  return (
    <SwapLayer active={active} direction={direction} instant={filter === 'all'}>
      <MealDeck filter={filter} cards={cards} renderCard={renderCard} />
    </SwapLayer>
  );
});

/** The recipes of one meal as a deck. Memoised: a change of meal never redraws it. */
const MealDeck = memo(function MealDeck({
  filter,
  cards,
  renderCard,
}: {
  filter: Filter;
  cards: RecipeCard[];
  renderCard: (card: RecipeCard, size: DeckCardSize) => React.ReactNode;
}) {
  const shown = useMemo(() => (filter === 'all' ? cards : cards.filter((c) => c.kind === filter)), [cards, filter]);

  // Photos of the recipes around the current one, fetched before they come on screen.
  const prefetch = useCallback(
    (position: number) => {
      const n = shown.length;
      if (n === 0) return;
      const uris: string[] = [];
      for (let k = -PREFETCH_BEHIND; k <= PREFETCH_AHEAD; k++) {
        const image = shown[(((position + k) % n) + n) % n].image;
        const uri = image ? mealImageUri(image) : undefined;
        if (uri && !uris.includes(uri)) uris.push(uri);
      }
      if (uris.length > 0) Image.prefetch(uris, 'memory-disk').catch(() => {});
    },
    [shown]
  );

  if (shown.length === 0) {
    return (
      <View style={styles.empty}>
        <ThemedText type="smallBold">Nessuna ricetta</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Con le tue preferenze non ci sono ricette per questo pasto.
        </ThemedText>
      </View>
    );
  }
  return (
    <SwipeDeck
      items={shown}
      keyOf={recipeKey}
      resetKey={filter}
      peek={PEEK}
      radius={32}
      hint="Scorri per cambiare ricetta"
      prevLabel="Ricetta precedente"
      nextLabel="Ricetta successiva"
      renderCard={renderCard}
      onIndexChange={prefetch}
    />
  );
});

type ChipBox = { x: number; w: number };

/**
 * Tutte / Colazione / Pranzo / Cena / Merenda. A dark pill glides under the chosen meal on the UI thread, and the
 * labels change colour exactly where its edge passes (a light copy of the labels rides inside the pill, clipped to
 * it), so the choice reads as one continuous movement rather than two chips swapping colours.
 */
const FilterChips = memo(function FilterChips({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [boxes, setBoxes] = useState<(ChipBox | null)[]>(() => FILTERS.map(() => null));
  const [viewport, setViewport] = useState(0);
  const index = filterIndex(value);
  const pos = useSharedValue(index);
  const ready = boxes.every((b) => b != null);

  useEffect(() => {
    pos.set(reduceMotion ? index : withSpring(index, PILL_SPRING));
    // Keep the chosen chip in view when the row is wider than the screen.
    const box = boxes[index];
    if (box && viewport > 0) scrollRef.current?.scrollTo({ x: Math.max(0, box.x + box.w / 2 - viewport / 2), animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onChipLayout = (i: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    if (width <= 0) return;
    setBoxes((prev) => (prev[i]?.x === x && prev[i]?.w === width ? prev : prev.map((b, k) => (k === i ? { x, w: width } : b))));
  };

  const inputs = FILTERS.map((_, i) => i);
  const xs = boxes.map((b) => b?.x ?? 0);
  const ws = boxes.map((b) => b?.w ?? 0);
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(pos.value, inputs, xs) }],
    width: interpolate(pos.value, inputs, ws),
  }));
  // The light labels inside the pill stay where the chips are: shifted back by however far the pill has moved.
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -interpolate(pos.value, inputs, xs) }],
  }));

  return (
    <ScrollView
      ref={scrollRef}
      {...HorizontalScrollDefaults}
      onLayout={(e) => setViewport(e.nativeEvent.layout.width)}
      contentContainerStyle={styles.filters}
      style={styles.filtersScroll}>
      {FILTERS.map((f, i) => {
        const active = f.value === value;
        return (
          <PressableScale
            key={f.value}
            onLayout={onChipLayout(i)}
            onPress={() => {
              if (!active) hapticSelection();
              onChange(f.value);
            }}
            haptic={false}
            scaleTo={0.94}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, { backgroundColor: theme.backgroundElevated, borderColor: theme.boxEdge }]}>
            <ThemedText style={styles.chipText}>{f.label}</ThemedText>
          </PressableScale>
        );
      })}
      {ready ? (
        <Animated.View style={[styles.pill, { backgroundColor: theme.text, pointerEvents: 'none' }, pillStyle]}>
          <Animated.View style={[styles.pillInner, innerStyle]}>
            {FILTERS.map((f, i) => (
              <View key={f.value} style={[styles.pillLabel, { left: xs[i], width: ws[i] }]}>
                <ThemedText style={[styles.chipText, { color: theme.background }]}>{f.label}</ThemedText>
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
});

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
  onOpen: (card: RecipeCard) => void;
}) {
  const theme = useTheme();
  const justDragged = useSwipeDeckJustDragged();
  const { recipe, totals } = card;
  const macros = [
    { label: 'Proteine', value: totals.protein, kcal: totals.protein * 4, color: theme.accent },
    { label: 'Carboidrati', value: totals.carbs, kcal: totals.carbs * 4, color: theme.brandGreen },
    { label: 'Grassi', value: totals.fats, kcal: totals.fats * 9, color: theme.brandYellow },
  ];
  const macroKcal = macros.reduce((s, m) => s + m.kcal, 0) || 1;

  return (
    <PressableScale
      onPress={() => {
        if (!justDragged()) onOpen(card);
      }}
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  filtersScroll: { marginHorizontal: -16, flexGrow: 0 },
  filters: { paddingHorizontal: 16, gap: 8 },
  chip: { height: CHIP_H, paddingHorizontal: 15, borderRadius: CHIP_H / 2, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', top: 0, left: 0, height: CHIP_H, borderRadius: CHIP_H / 2, borderCurve: 'continuous', overflow: 'hidden' },
  pillInner: { position: 'absolute', top: 0, left: 0, height: CHIP_H, width: 2000 },
  pillLabel: { position: 'absolute', top: 0, height: CHIP_H, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  deck: { flex: 1, marginTop: 6 },
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
});
