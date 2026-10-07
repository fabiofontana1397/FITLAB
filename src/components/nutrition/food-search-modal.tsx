import { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppTextInput } from '@/components/ui/app-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { FOOD_DATABASE, findFood, searchFood, type FoodItem } from '@/lib/mock/food-database';
import { useNutritionStore, type MealSlot } from '@/store/nutrition-store';

const PAGE_PADDING = 20;
const CARD_RADIUS = 18;

/** Shown (in this order) until the user's own history says otherwise. */
const DEFAULT_FAVORITE_IDS = ['chicken-breast', 'cottage-cheese', 'greek-yogurt', 'apple', 'mixed-salad', 'eggs'];

type ListTab = 'preferiti' | 'recenti';

export type FoodSearchModalProps = {
  visible: boolean;
  slot: MealSlot | null;
  date: string;
  /** When set, the screen opens pre-filled with this logged entry (food +
   * grams) so the user edits it in place instead of adding a new one. */
  editEntry?: { id: string; foodId: string; grams: number } | null;
  onClose: () => void;
};

function fmt(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function macroText(food: FoodItem, ratio: number): string {
  return `P ${fmt(food.protein100 * ratio)}g - C ${fmt(food.carbs100 * ratio)}g - G${fmt(food.fats100 * ratio)}g`;
}

/** Wraps the actual form so it can be given a `key` that changes every time
 * the screen opens (see below) — remounting it is what resets query /
 * selection / grams back to defaults (or to the entry being edited) on each
 * open, without syncing that reset through an effect. */
export function FoodSearchModal({ visible, slot, date, editEntry, onClose }: FoodSearchModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <FoodSearchForm key={visible ? (editEntry?.id ?? 'add') : 'closed'} slot={slot} date={date} editEntry={editEntry} onClose={onClose} />
    </Modal>
  );
}

function FoodSearchForm({ slot, date, editEntry, onClose }: Omit<FoodSearchModalProps, 'visible'>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const entries = useNutritionStore((s) => s.entries);
  const addEntry = useNutritionStore((s) => s.addEntry);
  const updateEntry = useNutritionStore((s) => s.updateEntry);
  const removeEntry = useNutritionStore((s) => s.removeEntry);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ListTab>('preferiti');
  const [hint, setHint] = useState<string | null>(null);

  // Favorites = what the user logs most, padded with a sensible default
  // set; recents = most recently logged distinct foods.
  const favorites = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.foodId, (counts.get(e.foodId) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const ids = [...ranked, ...DEFAULT_FAVORITE_IDS.filter((id) => !ranked.includes(id))];
    return ids.map((id) => findFood(id)).filter((f): f is FoodItem => !!f).slice(0, 12);
  }, [entries]);

  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: FoodItem[] = [];
    for (let i = entries.length - 1; i >= 0 && out.length < 12; i--) {
      const id = entries[i].foodId;
      if (seen.has(id)) continue;
      seen.add(id);
      const food = findFood(id);
      if (food) out.push(food);
    }
    return out;
  }, [entries]);

  const searching = query.trim().length > 0;
  const baseList = useMemo(
    () => (searching ? searchFood(query).slice(0, 30) : tab === 'preferiti' ? favorites : recents),
    [searching, query, tab, favorites, recents]
  );

  const [selected, setSelected] = useState<FoodItem | null>(() => (editEntry ? (findFood(editEntry.foodId) ?? null) : (favorites[0] ?? null)));
  const [grams, setGrams] = useState(() => (editEntry ? String(editEntry.grams) : String((favorites[0] ?? FOOD_DATABASE[0]).defaultPortionG)));

  // While editing, make sure the entry's own food is on screen even if it
  // isn't part of the list currently shown.
  const list = selected && !baseList.some((f) => f.id === selected.id) ? [selected, ...baseList] : baseList;

  const gramsNum = parseFloat(grams.replace(',', '.'));
  const ratio = Number.isFinite(gramsNum) && gramsNum > 0 ? gramsNum / 100 : 0;

  const handlePick = (food: FoodItem) => {
    setSelected(food);
    setGrams(String(food.defaultPortionG));
  };

  const handleSave = () => {
    if (!slot || !selected || ratio <= 0) return;
    if (editEntry) updateEntry(editEntry.id, selected.id, gramsNum);
    else addEntry(slot, selected.id, gramsNum, date);
    onClose();
  };

  const handleDelete = () => {
    if (!editEntry) return;
    removeEntry(editEntry.id);
    onClose();
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.background, paddingTop: Platform.select({ web: 32, default: insets.top + 8 }) }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={onClose} hitSlop={10} style={styles.backButton}>
          <Icon name="arrowBack" size={26} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.title}>{editEntry ? 'Modifica alimento' : 'Registra alimento'}</ThemedText>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchField, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
          <Icon name="search" size={20} color={theme.textTertiary} />
          <AppTextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setHint(null);
              setSelected(null);
            }}
            placeholder="Cerca un alimento..."
            placeholderTextColor={theme.textTertiary}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
        <Pressable
          onPress={() => setHint('La scansione del codice a barre non è ancora disponibile.')}
          style={[styles.barcodeButton, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
          <Icon name="barcode" size={26} color={theme.text} />
        </Pressable>
      </View>
      {hint ? (
        <ThemedText style={styles.hint} themeColor="textTertiary">
          {hint}
        </ThemedText>
      ) : null}

      <View style={[styles.tabsTrack, { backgroundColor: theme.backgroundElement }]}>
        {(
          [
            { id: 'preferiti', label: 'Preferiti', icon: 'star' },
            { id: 'recenti', label: 'Recenti', icon: 'clock' },
          ] as const
        ).map((t) => {
          const active = tab === t.id && !searching;
          return (
            <Pressable key={t.id} onPress={() => (setQuery(''), setTab(t.id))} style={[styles.tab, active && { backgroundColor: theme.accent }]}>
              <Icon name={t.icon} size={16} color={active ? theme.onAccent : theme.text} />
              <ThemedText style={[styles.tabLabel, { color: active ? theme.onAccent : theme.text }]}>{t.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isSelected = selected?.id === item.id;
          if (isSelected) {
            return (
              <FlatCard radius={CARD_RADIUS} style={styles.selectedCard}>
                <View style={styles.rowTop}>
                  <View style={styles.rowLeft}>
                    <ThemedText style={styles.foodName}>{item.name}</ThemedText>
                    <ThemedText style={styles.foodMacros} themeColor="textSecondary">
                      {macroText(item, ratio)}
                    </ThemedText>
                  </View>
                  <View style={styles.rowRight}>
                    <ThemedText style={styles.foodGrams}>{Math.round(gramsNum > 0 ? gramsNum : 0)} g</ThemedText>
                    <ThemedText style={styles.foodKcal} themeColor="textSecondary">
                      {Math.round(item.kcal100 * ratio)} kcal
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.gramsRow}>
                  <AppTextInput
                    value={grams}
                    onChangeText={setGrams}
                    keyboardType="decimal-pad"
                    style={[styles.gramsInput, { color: theme.text, borderColor: theme.border }]}
                  />
                  <ThemedText style={styles.gramsUnit} themeColor="textTertiary">
                    g
                  </ThemedText>
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={handleSave} style={[styles.addButton, { backgroundColor: theme.accent }]}>
                    <ThemedText style={[styles.addButtonText, { color: theme.onAccent }]}>{editEntry ? 'Salva' : '+ Aggiungi'}</ThemedText>
                  </Pressable>
                </View>
                {editEntry ? (
                  <Pressable onPress={handleDelete} style={styles.deleteLink} hitSlop={8}>
                    <ThemedText style={[styles.deleteText, { color: theme.danger }]}>Elimina alimento</ThemedText>
                  </Pressable>
                ) : null}
              </FlatCard>
            );
          }
          return (
            <Pressable onPress={() => handlePick(item)}>
              <FlatCard radius={CARD_RADIUS} style={styles.simpleCard}>
                <View style={styles.rowLeft}>
                  <ThemedText style={styles.foodName}>{item.name}</ThemedText>
                  <ThemedText style={styles.foodMacros} themeColor="textSecondary">
                    {macroText(item, 1)}
                  </ThemedText>
                </View>
                <View style={styles.rowRight}>
                  <ThemedText style={styles.foodGrams}>100 g</ThemedText>
                  <ThemedText style={styles.foodKcal} themeColor="textSecondary">
                    {Math.round(item.kcal100)} kcal
                  </ThemedText>
                </View>
                <View style={[styles.plusCircle, { backgroundColor: theme.accent }]}>
                  <Icon name="plus" size={15} color={theme.onAccent} />
                </View>
              </FlatCard>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <ThemedText style={styles.empty} themeColor="textTertiary">
            {searching ? 'Nessun alimento trovato' : 'Nessun alimento recente'}
          </ThemedText>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: PAGE_PADDING - 6,
    marginBottom: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: PAGE_PADDING,
  },
  searchField: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  barcodeButton: {
    width: 57,
    height: 44,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 8,
    paddingHorizontal: PAGE_PADDING,
    fontSize: 11.5,
  },
  tabsTrack: {
    flexDirection: 'row',
    height: 37,
    borderRadius: 19,
    padding: 3,
    marginTop: 17,
    marginHorizontal: PAGE_PADDING,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 16,
  },
  tabLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  list: {
    flex: 1,
    marginTop: 16,
  },
  listContent: {
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 32,
    gap: 15,
  },
  selectedCard: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 9,
  },
  simpleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 51,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  foodName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  foodMacros: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '500',
  },
  foodGrams: {
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
  },
  foodKcal: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
  plusCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gramsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gramsInput: {
    width: 116,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 0,
  },
  gramsUnit: {
    fontSize: 12,
  },
  addButton: {
    height: 30,
    minWidth: 79,
    borderRadius: 15,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deleteLink: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 12,
  },
});
