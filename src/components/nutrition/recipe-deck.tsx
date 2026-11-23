import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Reveal } from '@/components/motion/reveal';
import { DishPhoto, DishPlaceholder, mealImageUri } from '@/components/nutrition/dish-photo';
import { RecipeDetailSheet } from '@/components/nutrition/recipe-detail-sheet';
import { ThemedText } from '@/components/themed-text';
import { SwipeDeck, useSwipeDeckJustDragged, type DeckCardSize } from '@/components/ui/swipe-deck';
import { HorizontalScrollDefaults } from '@/constants/scroll';
import { SELECTOR_SETTLE_MS, useSettledValue } from '@/hooks/use-settled-value';
import { useTheme } from '@/hooks/use-theme';
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
  // Set by the chips once their tap has landed: the deck is rebuilt then, never while the chip is answering.
  const [filter, setFilter] = useState<Filter>('all');
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<RecipeCard | null>(null);
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
      <Reveal index={0}>
        <FilterChips onSettled={setFilter} />
      </Reveal>

      {shown.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText type="smallBold">Nessuna ricetta</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Con le tue preferenze non ci sono ricette per questo pasto.
          </ThemedText>
        </View>
      ) : (
        <Reveal index={1} style={styles.deck}>
        <Animated.View key={filter} entering={FadeIn.duration(SELECTOR_SETTLE_MS)} style={styles.fill}>
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
        </Animated.View>
        </Reveal>
      )}

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

/**
 * Tutte / Colazione / Pranzo / Cena / Merenda. The chips keep their own choice and answer the tap at once; the deck
 * hears of it only once the choice has settled, so rebuilding the cards never stalls the chip's motion.
 */
const FilterChips = memo(function FilterChips({ onSettled }: { onSettled: (f: Filter) => void }) {
  const theme = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const settled = useSettledValue(filter);
  useEffect(() => onSettled(settled), [settled, onSettled]);
  return (
    <ScrollView {...HorizontalScrollDefaults} contentContainerStyle={styles.filters} style={styles.filtersScroll}>
      {FILTERS.map((f) => {
        const active = f.value === filter;
        return (
          <PressableScale
            key={f.value}
            onPress={() => setFilter(f.value)}
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
  chip: { height: 34, paddingHorizontal: 15, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  deck: { flex: 1, marginTop: 6 },
  fill: { flex: 1 },
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
