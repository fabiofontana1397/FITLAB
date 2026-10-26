import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { FoodThumb } from '@/components/nutrition/food-thumb';
import { ThemedText } from '@/components/themed-text';
import { AppTextInput } from '@/components/ui/app-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { HorizontalScrollDefaults, ListDefaults, ScrollDefaults } from '@/constants/scroll';
import { Layout } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';
import { FOOD_DATABASE, findFood, searchFood, type FoodItem } from '@/lib/mock/food-database';
import { useFavoriteFoodsStore } from '@/store/favorite-foods-store';
import { useNutritionStore, type MealSlot } from '@/store/nutrition-store';

const PAGE_PADDING = Layout.screenGutter;
/** The browser's black focus ring around a text field: the field's own box is the affordance. */
const webNoOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as object;
/** How far the − and + buttons move the quantity. */
const GRAMS_STEP = 10;
/** Height of the fade under the chips. */
const FADE_HEIGHT = 22;

/** Shown (in this order) until the user's own history says otherwise. */
const DEFAULT_FAVORITE_IDS = ['chicken-breast', 'cottage-cheese', 'greek-yogurt', 'apple', 'mixed-salad', 'eggs'];

type CategoryId = FoodItem['category'];
type ListTab = 'preferiti' | 'recenti';
/** What the list shows: one of the two personal lists, or one category of the catalogue. */
type View_ = { kind: 'tab'; id: ListTab } | { kind: 'category'; id: CategoryId };

/** The chips under the search field: the three macros first, then the other categories ("altro" has no chip: it is only found by search). */
const CATEGORY_CHIPS: { id: CategoryId; label: string; icon: IconName }[] = [
  { id: 'carboidrati', label: 'Carboidrati', icon: 'carbs' },
  { id: 'proteine', label: 'Proteine', icon: 'protein' },
  { id: 'grassi', label: 'Grassi', icon: 'fats' },
  { id: 'latticini', label: 'Latticini', icon: 'categoryDairy' },
  { id: 'frutta', label: 'Frutta', icon: 'nutrition' },
  { id: 'verdura', label: 'Verdura', icon: 'foodVeg' },
  { id: 'legumi', label: 'Legumi', icon: 'categoryLegumes' },
];

const LIST_TABS: { id: ListTab; label: string; icon: IconName }[] = [
  { id: 'preferiti', label: 'Preferiti', icon: 'star' },
  { id: 'recenti', label: 'Recenti', icon: 'clock' },
];

export type FoodSearchModalProps = {
  visible: boolean;
  slot: MealSlot | null;
  date: string;
  /** When set, the screen opens on that logged entry's detail (food +
   * grams) so the user edits it in place instead of adding a new one. */
  editEntry?: { id: string; foodId: string; grams: number } | null;
  onClose: () => void;
  /** Called after a food is saved (not on cancel), e.g. to move to Nutrizione once logged from Home. */
  onSaved?: () => void;
};

/** A number with one decimal at most and an Italian comma: 13,4. */
function fmt(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

/** Wraps the actual flow so it can be given a `key` that changes every time
 * the screen opens (see below) — remounting it is what resets the search,
 * the step and the grams back to defaults (or to the entry being edited) on
 * each open, without syncing that reset through an effect. */
export function FoodSearchModal({ visible, slot, date, editEntry, onClose, onSaved }: FoodSearchModalProps) {
  return (
    // The sheet animates itself (as Profilo and Promemoria do), so the Modal only has to be transparent.
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <FoodSearchForm key={visible ? (editEntry?.id ?? 'add') : 'closed'} slot={slot} date={date} editEntry={editEntry} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

/**
 * "Aggiungi alimento", a bottom sheet like Profilo and Promemoria, in two steps:
 * 1. the list — the search field with the barcode button, the Preferiti /
 *    Recenti selector, the category chips (Carboidrati, Proteine, Grassi, then
 *    the others) and the foods, which scroll under the chips with a fade; each
 *    food has a star to put it among the Preferiti. A tap on a food opens
 * 2. its detail — a big picture, the name, "Quantità" with − / +, the calories
 *    and macros for that quantity, the values per 100 g and "Aggiungi al pasto".
 * Editing a logged food opens straight on step 2.
 */
function FoodSearchForm({ slot, date, editEntry, onClose, onSaved }: Omit<FoodSearchModalProps, 'visible'>) {
  const theme = useTheme();
  const entries = useNutritionStore((s) => s.entries);
  const addEntry = useNutritionStore((s) => s.addEntry);
  const updateEntry = useNutritionStore((s) => s.updateEntry);
  const removeEntry = useNutritionStore((s) => s.removeEntry);
  const favoriteIds = useFavoriteFoodsStore((s) => s.ids);
  const toggleFavorite = useFavoriteFoodsStore((s) => s.toggle);

  const [query, setQuery] = useState('');
  const [view, setView] = useState<View_>(() => ({ kind: 'tab', id: favoriteIds.length > 0 ? 'preferiti' : 'recenti' }));
  const [hint, setHint] = useState<string | null>(null);
  const [selected, setSelected] = useState<FoodItem | null>(() => (editEntry ? (findFood(editEntry.foodId) ?? null) : null));
  const [grams, setGrams] = useState(() => (editEntry ? String(editEntry.grams) : String(FOOD_DATABASE[0].defaultPortionG)));

  // What the person logs most (for the order inside a category), and what they logged last (for Recenti).
  const history = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.foodId, (counts.get(e.foodId) ?? 0) + 1);
    const recent: string[] = [];
    for (let i = entries.length - 1; i >= 0; i--) if (!recent.includes(entries[i].foodId)) recent.push(entries[i].foodId);
    return { counts, recent };
  }, [entries]);

  const searching = query.trim().length > 0;
  const toFoods = (ids: string[]) => ids.map((id) => findFood(id)).filter((f): f is FoodItem => !!f);
  /** True when Recenti has nothing to show yet and a starter set stands in for it. */
  const suggesting = !searching && view.kind === 'tab' && view.id === 'recenti' && history.recent.length === 0;
  const list = useMemo(() => {
    if (searching) return searchFood(query).slice(0, 40);
    if (view.kind === 'tab') {
      if (view.id === 'preferiti') return toFoods(favoriteIds);
      return toFoods(history.recent.length > 0 ? history.recent.slice(0, 30) : DEFAULT_FAVORITE_IDS);
    }
    // A category: the foods of it the person logs most first, then the catalogue's own order.
    return FOOD_DATABASE.filter((f) => f.category === view.id)
      .map((food, index) => ({ food, index }))
      .sort((a, b) => (history.counts.get(b.food.id) ?? 0) - (history.counts.get(a.food.id) ?? 0) || a.index - b.index)
      .map(({ food }) => food)
      .slice(0, 60);
  }, [searching, query, view, history, favoriteIds]);

  const gramsNum = parseFloat(grams.replace(',', '.'));
  const validGrams = Number.isFinite(gramsNum) && gramsNum > 0;
  const ratio = validGrams ? gramsNum / 100 : 0;

  const openDetail = (food: FoodItem) => {
    hapticSelection();
    setSelected(food);
    setGrams(String(food.defaultPortionG));
  };

  const bump = (delta: number) => {
    hapticSelection();
    const base = Number.isFinite(gramsNum) ? gramsNum : 0;
    setGrams(String(Math.max(0, Math.round((base + delta) * 10) / 10)));
  };

  const handleSave = () => {
    if (!slot || !selected || !validGrams) return;
    if (editEntry) updateEntry(editEntry.id, selected.id, gramsNum);
    else addEntry(slot, selected.id, gramsNum, date);
    hapticSuccess();
    onClose();
    onSaved?.();
  };

  const handleDelete = () => {
    if (!editEntry) return;
    removeEntry(editEntry.id);
    onClose();
  };

  // The list scrolls under the search and the chips: a fade there instead of a hard edge, in once it has scrolled.
  const scrolled = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: scrolled.value }));

  const sheetProps = { onClose, scroll: false as const, contentContainerStyle: styles.sheetContent };

  // ── Step 2: the food's detail ────────────────────────────────────────────
  if (selected) {
    const rows: { label: string; value: string }[] = [
      { label: 'Calorie', value: `${Math.round(selected.kcal100)} kcal` },
      { label: 'Proteine', value: `${fmt(selected.protein100)} g` },
      { label: 'Carboidrati', value: `${fmt(selected.carbs100)} g` },
      { label: 'Grassi', value: `${fmt(selected.fats100)} g` },
    ];
    const macros: { label: string; value: number; icon: IconName; color: string }[] = [
      { label: 'Proteine', value: selected.protein100 * ratio, icon: 'protein', color: theme.accent },
      { label: 'Carboidrati', value: selected.carbs100 * ratio, icon: 'carbs', color: theme.brandGreen },
      { label: 'Grassi', value: selected.fats100 * ratio, icon: 'fats', color: theme.brandYellow },
    ];
    const favorite = favoriteIds.includes(selected.id);

    return (
      <SheetScreen title={editEntry ? 'Modifica alimento' : 'Aggiungi alimento'} {...sheetProps}>
        <View style={styles.detailHeader}>
          {editEntry ? (
            <View style={styles.iconButton} />
          ) : (
            <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Indietro" style={styles.iconButton}>
              <Icon name="arrowBack" size={26} color={theme.text} />
            </Pressable>
          )}
          <FavoriteStar active={favorite} name={selected.name} onPress={() => toggleFavorite(selected.id)} />
        </View>

        <ScrollView {...ScrollDefaults} style={styles.flex} contentContainerStyle={styles.detailContent}>
          <View style={styles.hero}>
            <FoodThumb foodId={selected.id} variant="display" />
            <ThemedText style={styles.detailName} accessibilityRole="header">
              {selected.name}
            </ThemedText>
            <ThemedText style={styles.detailSub} themeColor="textTertiary">
              {Math.round(selected.kcal100)} kcal / 100 g
            </ThemedText>
          </View>

          <FlatCard radius={20} style={styles.quantityCard}>
            <ThemedText style={styles.cardTitle}>Quantità</ThemedText>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => bump(-GRAMS_STEP)}
                disabled={!validGrams}
                accessibilityRole="button"
                accessibilityLabel={`Meno ${GRAMS_STEP} grammi`}
                style={[styles.stepButton, { backgroundColor: theme.accentSoft }, !validGrams && styles.disabled]}>
                <Icon name="minusSign" size={22} color={theme.accent} />
              </Pressable>
              <View style={styles.gramsWrap}>
                <AppTextInput
                  value={grams}
                  onChangeText={setGrams}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Quantità in grammi"
                  selectTextOnFocus
                  style={[styles.gramsInput, { color: theme.text }]}
                />
                <ThemedText style={styles.gramsUnit}>g</ThemedText>
              </View>
              <Pressable
                onPress={() => bump(GRAMS_STEP)}
                accessibilityRole="button"
                accessibilityLabel={`Più ${GRAMS_STEP} grammi`}
                style={[styles.stepButton, { backgroundColor: theme.accentSoft }]}>
                <Icon name="plus" size={22} color={theme.accent} />
              </Pressable>
            </View>
          </FlatCard>

          <View style={[styles.summary, { backgroundColor: theme.accentSoft }]}>
            <View style={styles.summaryKcal}>
              <View style={styles.summaryLabelRow}>
                <Icon name="flame" size={16} color={theme.accent} />
                <ThemedText style={styles.summaryLabel} themeColor="textSecondary">
                  Calorie
                </ThemedText>
              </View>
              <ThemedText style={[styles.summaryKcalValue, { color: theme.accent }]}>{Math.round(selected.kcal100 * ratio)} kcal</ThemedText>
            </View>
            <View style={[styles.summaryRule, { backgroundColor: theme.borderStrong }]} />
            {macros.map((macro) => (
              <View key={macro.label} style={styles.summaryMacro}>
                <Icon name={macro.icon} size={16} color={macro.color} />
                <ThemedText style={styles.summaryMacroLabel} themeColor="textSecondary" numberOfLines={1}>
                  {macro.label}
                </ThemedText>
                <ThemedText style={styles.summaryMacroValue}>{Math.round(macro.value)} g</ThemedText>
              </View>
            ))}
          </View>

          <FlatCard radius={20} style={styles.valuesCard}>
            <ThemedText style={styles.cardTitle}>Valori per 100 g</ThemedText>
            {rows.map((row, i) => (
              <View key={row.label} style={[styles.valueRow, { borderTopColor: theme.border }, i === 0 && styles.valueRowFirst]}>
                <ThemedText style={styles.valueLabel} themeColor="textSecondary">
                  {row.label}
                </ThemedText>
                <ThemedText style={styles.valueText}>{row.value}</ThemedText>
              </View>
            ))}
          </FlatCard>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleSave}
            disabled={!validGrams}
            accessibilityRole="button"
            style={[styles.cta, { backgroundColor: theme.accent }, !validGrams && styles.disabled]}>
            <ThemedText style={[styles.ctaLabel, { color: theme.onAccent }]}>{editEntry ? 'Salva modifiche' : 'Aggiungi al pasto'}</ThemedText>
          </Pressable>
          {editEntry ? (
            <Pressable onPress={handleDelete} hitSlop={8} accessibilityRole="button" style={styles.deleteLink}>
              <ThemedText style={[styles.deleteText, { color: theme.danger }]}>Elimina alimento</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </SheetScreen>
    );
  }

  // ── Step 1: the list ─────────────────────────────────────────────────────
  const emptyText = searching
    ? 'Nessun alimento trovato'
    : view.kind === 'tab' && view.id === 'preferiti'
      ? 'Nessun preferito: tocca la stella accanto a un alimento per aggiungerlo qui.'
      : 'Nessun alimento in questa categoria';

  return (
    <SheetScreen title="Aggiungi alimento" {...sheetProps}>
      <View style={styles.searchRow}>
        <View style={[styles.searchField, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="search" size={20} color={theme.textTertiary} />
          <AppTextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setHint(null);
            }}
            placeholder="Cerca un alimento..."
            placeholderTextColor={theme.textTertiary}
            accessibilityLabel="Cerca un alimento"
            returnKeyType="search"
            style={[styles.searchInput, { color: theme.text }]}
          />
          {searching ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancella la ricerca" style={[styles.clearButton, { backgroundColor: theme.textTertiary }]}>
              <Icon name="close" size={13} color={theme.background} />
            </Pressable>
          ) : null}
        </View>
        {searching ? null : (
          <Pressable
            onPress={() => setHint('La scansione del codice a barre non è ancora disponibile.')}
            accessibilityRole="button"
            accessibilityLabel="Scansiona il codice a barre"
            style={[styles.barcodeButton, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="barcode" size={26} color={theme.text} />
          </Pressable>
        )}
      </View>
      {hint ? (
        <ThemedText style={styles.hint} themeColor="textTertiary">
          {hint}
        </ThemedText>
      ) : null}

      {searching ? null : (
        <>
          <View style={[styles.tabsTrack, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
            {LIST_TABS.map((t) => {
              const active = view.kind === 'tab' && view.id === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    hapticSelection();
                    setView({ kind: 'tab', id: t.id });
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tab, active && { backgroundColor: theme.accent }]}>
                  <Icon name={t.icon} size={15} color={active ? theme.onAccent : theme.textSecondary} />
                  <ThemedText style={[styles.tabLabel, { color: active ? theme.onAccent : theme.textSecondary }]}>{t.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ScrollView {...HorizontalScrollDefaults} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
            {CATEGORY_CHIPS.map((c) => {
              const active = view.kind === 'category' && view.id === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    hapticSelection();
                    setView({ kind: 'category', id: c.id });
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active ? { backgroundColor: theme.accentSoft } : { backgroundColor: theme.backgroundElevated, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}>
                  <Icon name={c.icon} size={24} color={active ? theme.accent : theme.textSecondary} />
                  <ThemedText style={[styles.chipLabel, { color: active ? theme.accent : theme.text }, active && styles.chipLabelActive]} numberOfLines={1}>
                    {c.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      <View style={styles.listWrap}>
        <FlatList
          {...ListDefaults}
          testID="food-list"
          data={list}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onScroll={(e) => {
            // eslint-disable-next-line react-hooks/immutability
            scrolled.value = Math.min(1, Math.max(0, e.nativeEvent.contentOffset.y / FADE_HEIGHT));
          }}
          ListHeaderComponent={
            suggesting ? (
              <ThemedText style={styles.sectionTitle} accessibilityRole="header">
                Suggeriti
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <FoodRow food={item} favorite={favoriteIds.includes(item.id)} onOpen={() => openDetail(item)} onToggleFavorite={() => toggleFavorite(item.id)} />
          )}
          ListEmptyComponent={
            <ThemedText style={styles.empty} themeColor="textTertiary">
              {emptyText}
            </ThemedText>
          }
        />
        {/* Under the search and the chips the foods dissolve instead of being cut by a hard edge. */}
        <Animated.View testID="food-list-fade" pointerEvents="none" style={[styles.listFade, fadeStyle]}>
          <LinearGradient colors={[theme.background, `${theme.background}00`]} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </SheetScreen>
  );
}

function FoodRow({ food, favorite, onOpen, onToggleFavorite }: { food: FoodItem; favorite: boolean; onOpen: () => void; onToggleFavorite: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${food.name}, ${Math.round(food.kcal100)} kcal ogni 100 g`}>
      <FlatCard radius={20} style={styles.row}>
        <FoodThumb foodId={food.id} variant="hero" />
        <View style={styles.rowText}>
          <ThemedText style={styles.rowName} numberOfLines={2}>
            {food.name}
          </ThemedText>
          <ThemedText style={styles.rowSub} themeColor="textTertiary">
            {Math.round(food.kcal100)} kcal / 100 g
          </ThemedText>
        </View>
        <FavoriteStar active={favorite} name={food.name} onPress={onToggleFavorite} />
        <View style={[styles.plusCircle, { borderColor: theme.accent }]}>
          <Icon name="plus" size={20} color={theme.accent} />
        </View>
      </FlatCard>
    </Pressable>
  );
}

/** The star that puts a food among the Preferiti (and takes it out again). */
function FavoriteStar({ active, name, onPress }: { active: boolean; name: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? `Togli ${name} dai preferiti` : `Aggiungi ${name} ai preferiti`}
      style={styles.star}>
      <Icon name={active ? 'star' : 'starOutline'} size={22} color={active ? theme.brandYellow : theme.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The sheet gives its content no side padding and no gap: the list, the chips and the detail lay themselves out.
  sheetContent: {
    paddingHorizontal: 0,
    gap: 0,
  },
  flex: {
    flex: 1,
  },
  disabled: {
    opacity: 0.45,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: PAGE_PADDING,
  },
  searchField: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    ...webNoOutline,
  },
  clearButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 8,
    paddingHorizontal: PAGE_PADDING,
    fontSize: 13,
  },
  tabsTrack: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginHorizontal: PAGE_PADDING,
    marginTop: 14,
    padding: 3,
    borderRadius: 14,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 11,
  },
  tabLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  chipsScroll: {
    flexGrow: 0,
    marginTop: 14,
  },
  chips: {
    paddingHorizontal: PAGE_PADDING,
    gap: 10,
  },
  chip: {
    width: 76,
    height: 76,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chipLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  chipLabelActive: {
    fontWeight: '700',
  },
  listWrap: {
    flex: 1,
    marginTop: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 10,
  },
  listFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
  star: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // HIG list row: 12 pt between the leading image and the text.
    gap: 12,
    padding: 10,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  plusCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },

  // Detail
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_PADDING - 10,
    marginBottom: 4,
  },
  detailContent: {
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 24,
    gap: 14,
  },
  hero: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  detailName: {
    marginTop: 10,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  detailSub: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '500',
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  quantityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gramsWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    minWidth: 78,
    gap: 3,
  },
  gramsInput: {
    // A fixed width: on the web a bare input is ~265 px wide and pushes the + out of the card.
    width: 52,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'right',
    padding: 0,
    ...webNoOutline,
  },
  gramsUnit: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 6,
  },
  summaryKcal: {
    flex: 1.6,
    paddingLeft: 4,
    gap: 4,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  summaryLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  summaryKcalValue: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  summaryRule: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 2,
  },
  summaryMacro: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  summaryMacroLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
  summaryMacroValue: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  valuesCard: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  valueRowFirst: {
    marginTop: 10,
  },
  valueLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  valueText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 10,
    gap: 4,
  },
  cta: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
