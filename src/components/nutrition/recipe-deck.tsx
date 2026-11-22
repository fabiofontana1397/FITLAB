import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { DishPhoto, DishPlaceholder } from '@/components/nutrition/dish-photo';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { SwipeDeck } from '@/components/ui/swipe-deck';
import { HorizontalScrollDefaults } from '@/constants/scroll';
import { OnBrand } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSuccess } from '@/lib/haptics';
import type { SlotKind } from '@/lib/planning/fitlab/catalog';
import { RECIPE_KIND_LABEL, type RecipeCard } from '@/lib/planning/fitlab/recipe-book';
import { WEIGHT_BASIS_NOTE } from '@/lib/planning/fitlab/recipes';

type Filter = 'all' | SlotKind;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tutte' },
  { value: 'breakfast', label: 'Colazione' },
  { value: 'lunch', label: 'Pranzo' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Merenda' },
];

export type RecipeDeckProps = {
  cards: RecipeCard[];
  /** Under the portion's kcal: sized on the person ("Porzione per te") or a standard one. */
  portionLabel: string;
  /** The meal of today a recipe of this kind is logged to ("Pranzo"), and the action that logs it. */
  slotLabelFor: (kind: SlotKind) => string;
  onAdd: (card: RecipeCard) => void;
};

/**
 * Ricette: every recipe of the FitLab pool as a stack of cards. Swipe the top card left for the next recipe, right
 * to go back (or use the arrows); the stack wraps around. Each card is the whole recipe — photo, time and
 * difficulty, the portion's calories and macros sized on the person's targets, the ingredients with their grams,
 * the numbered steps — and logs itself to today's meal in one tap.
 */
export function RecipeDeck({ cards, portionLabel, slotLabelFor, onAdd }: RecipeDeckProps) {
  const theme = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const shown = useMemo(() => (filter === 'all' ? cards : cards.filter((c) => c.kind === filter)), [cards, filter]);

  return (
    <View>
      <ScrollView {...HorizontalScrollDefaults} contentContainerStyle={styles.filters} style={styles.filtersScroll}>
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <PressableScale
              key={f.value}
              onPress={() => {
                if (!active) setFilter(f.value);
              }}
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

      {shown.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText type="smallBold">Nessuna ricetta</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Con le tue preferenze non ci sono ricette per questo pasto.
          </ThemedText>
        </View>
      ) : (
        <View style={styles.deckWrap}>
          <SwipeDeck
            items={shown}
            keyOf={(c) => c.recipe.id}
            resetKey={filter}
            hint="Scorri per cambiare ricetta"
            prevLabel="Ricetta precedente"
            nextLabel="Ricetta successiva"
            renderCard={(card, top) => (
              <RecipeCardView
                card={card}
                portionLabel={portionLabel}
                slotLabel={slotLabelFor(card.kind)}
                added={top && !!added[card.recipe.id]}
                onAdd={() => {
                  if (!top) return;
                  hapticSuccess();
                  onAdd(card);
                  setAdded((a) => ({ ...a, [card.recipe.id]: true }));
                }}
              />
            )}
          />
        </View>
      )}
    </View>
  );
}

/** One recipe, whole: the card the stack is made of. */
function RecipeCardView({ card, portionLabel, slotLabel, added, onAdd }: { card: RecipeCard; portionLabel: string; slotLabel: string; added: boolean; onAdd: () => void }) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const [photoSize, setPhotoSize] = useState(0);
  const { recipe, totals } = card;

  const macros = [
    { label: 'Proteine', value: totals.protein, color: theme.accent },
    { label: 'Carboidrati', value: totals.carbs, color: theme.brandGreen },
    { label: 'Grassi', value: totals.fats, color: theme.brandYellow },
  ];
  const macroKcal = totals.protein * 4 + totals.carbs * 4 + totals.fats * 9 || 1;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElevated, borderColor: theme.boxEdge }]}>
      {/* The photos are shot on white: in dark mode the plate sits on its own white panel. */}
      <View
        style={[styles.photoWell, { backgroundColor: '#FFFFFF' }, dark && styles.photoWellDark]}
        onLayout={(e) => setPhotoSize(Math.min(e.nativeEvent.layout.width - 24, 300))}>
        {photoSize > 0 ? (
          card.image ? (
            <DishPhoto image={card.image} size={photoSize} radius={24} />
          ) : (
            <DishPlaceholder size={photoSize} radius={24} />
          )
        ) : (
          <View style={{ height: 240 }} />
        )}
        <View style={[styles.photoPill, styles.photoPillLeft]}>
          <ThemedText style={styles.photoPillText}>{RECIPE_KIND_LABEL[card.kind]}</ThemedText>
        </View>
        <View style={[styles.photoPill, styles.photoPillRight]}>
          <Icon name="clock" size={13} color="#0B0B0D" />
          <ThemedText style={styles.photoPillText}>{recipe.totalMinutes} min</ThemedText>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleBlock}>
          <ThemedText style={styles.title}>{recipe.name}</ThemedText>
          <ThemedText style={styles.description} themeColor="textSecondary">
            {recipe.description}
          </ThemedText>
          <View style={styles.facts}>
            <Fact icon="gauge" text={recipe.difficulty} />
            <Fact icon="clock" text={recipe.cookMinutes > 0 ? `${recipe.prepMinutes} + ${recipe.cookMinutes} min` : `${recipe.prepMinutes} min`} />
            <Fact icon="flame" text={`${totals.kcal} kcal`} />
          </View>
        </View>

        {/* The portion's energy and how it splits, sized on the person's targets. */}
        <View style={[styles.energy, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.energyHead}>
            <ThemedText style={styles.energyKcal}>
              {totals.kcal}
              <ThemedText style={styles.energyUnit} themeColor="textSecondary">
                {' '}kcal
              </ThemedText>
            </ThemedText>
            <ThemedText style={styles.energyNote} themeColor="textSecondary">
              {portionLabel}
            </ThemedText>
          </View>
          <View style={styles.splitBar}>
            {macros.map((m) => (
              <View key={m.label} style={{ flex: Math.max((m.label === 'Grassi' ? m.value * 9 : m.value * 4) / macroKcal, 0.02), backgroundColor: m.color }} />
            ))}
          </View>
          <View style={styles.macroRow}>
            {macros.map((m) => (
              <View key={m.label} style={styles.macroCol}>
                <View style={styles.macroLabelRow}>
                  <View style={[styles.dot, { backgroundColor: m.color }]} />
                  <ThemedText style={styles.macroLabel} themeColor="textSecondary">
                    {m.label}
                  </ThemedText>
                </View>
                <ThemedText style={styles.macroValue}>{m.value} g</ThemedText>
              </View>
            ))}
          </View>
        </View>

        <Section title="Ingredienti" aside={`${card.items.length}`}>
          {card.items.map((item, i) => (
            <View key={`${item.foodId}-${i}`} style={[styles.ingredient, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <ThemedText style={styles.ingredientName}>{item.name}</ThemedText>
              <View style={styles.ingredientRight}>
                <ThemedText style={styles.ingredientQty}>{item.quantityLabel}</ThemedText>
                <ThemedText style={styles.ingredientKcal} themeColor="textTertiary">
                  {Math.round(item.kcal)} kcal
                </ThemedText>
              </View>
            </View>
          ))}
          {card.flavorings.length > 0 ? (
            <ThemedText style={styles.footnote} themeColor="textSecondary">
              Per insaporire: {card.flavorings.join(', ').toLowerCase()}
            </ThemedText>
          ) : null}
        </Section>

        <Section title="Preparazione" aside={`${recipe.steps.length} passaggi`}>
          <View style={styles.steps}>
            {recipe.steps.map((s, i) => (
              <View key={i} style={styles.step}>
                <View style={[styles.stepBadge, { backgroundColor: theme.accentSoft }]}>
                  <ThemedText style={[styles.stepNumber, { color: theme.accent }]}>{i + 1}</ThemedText>
                </View>
                <ThemedText style={styles.stepText}>{s}</ThemedText>
              </View>
            ))}
          </View>
          {recipe.equipment.length > 0 ? (
            <ThemedText style={styles.footnote} themeColor="textSecondary">
              Ti serve: {recipe.equipment.join(', ').toLowerCase()}.
            </ThemedText>
          ) : null}
        </Section>

        <PressableScale
          onPress={added ? undefined : onAdd}
          disabled={added}
          haptic={false}
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={added ? `Aggiunta a ${slotLabel}` : `Aggiungi a ${slotLabel} di oggi`}
          style={[styles.addButton, { backgroundColor: added ? theme.brandGreen : theme.accent }]}>
          <Icon name={added ? 'check' : 'plus'} size={19} color={OnBrand.text} />
          <ThemedText style={styles.addText}>{added ? `Aggiunta a ${slotLabel}` : `Aggiungi a ${slotLabel} di oggi`}</ThemedText>
        </PressableScale>

        <ThemedText style={styles.basis} themeColor="textTertiary">
          {WEIGHT_BASIS_NOTE}
        </ThemedText>
      </View>
    </View>
  );
}

function Fact({ icon, text }: { icon: 'gauge' | 'clock' | 'flame'; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={14} color={theme.textSecondary} />
      <ThemedText style={styles.factText} themeColor="textSecondary">
        {text}
      </ThemedText>
    </View>
  );
}

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        {aside ? (
          <ThemedText style={styles.sectionAside} themeColor="textTertiary">
            {aside}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  filtersScroll: { marginHorizontal: -16 },
  filters: { paddingHorizontal: 16, gap: 8 },
  deckWrap: { marginTop: 14 },
  chip: { height: 34, paddingHorizontal: 15, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  card: { borderRadius: 32, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  photoWell: { alignItems: 'center', justifyContent: 'center', paddingTop: 20, paddingBottom: 8 },
  photoWellDark: { margin: 10, borderRadius: 24, borderCurve: 'continuous', paddingTop: 12 },
  photoPill: {
    position: 'absolute',
    top: 14,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(241,241,243,0.92)',
  },
  photoPillLeft: { left: 14 },
  photoPillRight: { right: 14 },
  photoPillText: { fontSize: 12, lineHeight: 15, fontWeight: '600', color: '#0B0B0D' },
  body: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18, gap: 18 },
  titleBlock: { gap: 6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  description: { fontSize: 15, lineHeight: 21 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 4 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factText: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  energy: { borderRadius: 20, borderCurve: 'continuous', padding: 14, gap: 10 },
  energyHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  energyKcal: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  energyUnit: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  energyNote: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  splitBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 },
  macroRow: { flexDirection: 'row' },
  macroCol: { flex: 1, gap: 2 },
  macroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  macroLabel: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  macroValue: { fontSize: 16, lineHeight: 21, fontWeight: '700', fontVariant: ['tabular-nums'] },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2 },
  sectionAside: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  ingredient: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  ingredientName: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20 },
  ingredientRight: { alignItems: 'flex-end' },
  ingredientQty: { fontSize: 15, lineHeight: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  ingredientKcal: { fontSize: 12, lineHeight: 15, fontVariant: ['tabular-nums'] },
  footnote: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  steps: { gap: 14 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: -2 },
  stepNumber: { fontSize: 13, lineHeight: 16, fontWeight: '700' },
  stepText: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 22 },
  addButton: { height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addText: { color: OnBrand.text, fontSize: 16, lineHeight: 20, fontWeight: '700' },
  basis: { fontSize: 11, lineHeight: 15 },
  empty: { paddingVertical: 40, alignItems: 'center', gap: 6 },
});
