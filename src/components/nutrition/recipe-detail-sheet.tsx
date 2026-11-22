import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { DishPhoto, DishPlaceholder } from '@/components/nutrition/dish-photo';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ListGroup } from '@/components/ui/list-group';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { OnBrand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSuccess } from '@/lib/haptics';
import { RECIPE_KIND_LABEL, type RecipeCard } from '@/lib/planning/fitlab/recipe-book';
import { WEIGHT_BASIS_NOTE } from '@/lib/planning/fitlab/recipes';

const HERO = 232;
/** After "Aggiungi", how long the confirmation stays before the sheet goes away. */
const CLOSE_AFTER_ADD_MS = 750;

export type RecipeDetailSheetProps = {
  /** The recipe to show; null keeps the sheet closed. */
  card: RecipeCard | null;
  portionLabel: string;
  /** Today's meal the recipe is logged to ("Pranzo"). */
  slotLabel: string;
  added: boolean;
  onAdd: (card: RecipeCard) => void;
  onClose: () => void;
};

/**
 * A recipe of the deck, whole, as a full-page sheet: photo, time and difficulty, the portion's numbers, the
 * ingredients with their grams and the numbered preparation. Fixed at the bottom, the button that logs it to today's meal.
 */
export function RecipeDetailSheet({ card, ...rest }: RecipeDetailSheetProps) {
  return (
    // The sheet animates itself, so the Modal only has to be transparent.
    <Modal visible={card != null} transparent animationType="none" statusBarTranslucent onRequestClose={rest.onClose}>
      {card ? <RecipeDetail key={card.recipe.id} card={card} {...rest} /> : null}
    </Modal>
  );
}

function RecipeDetail({ card, portionLabel, slotLabel, added, onAdd, onClose }: RecipeDetailSheetProps & { card: RecipeCard }) {
  const theme = useTheme();
  const { recipe, totals } = card;
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const done = added || justAdded;

  const numbers = [
    { label: 'kcal', value: `${totals.kcal}` },
    { label: 'proteine', value: `${totals.protein} g` },
    { label: 'carboidrati', value: `${totals.carbs} g` },
    { label: 'grassi', value: `${totals.fats} g` },
  ];

  return (
    <SheetScreen
      title={recipe.name}
      eyebrow={`${RECIPE_KIND_LABEL[card.kind]} · ${recipe.totalMinutes} min`}
      onClose={onClose}
      contentContainerStyle={styles.content}
      footer={(close) => (
        <PressableScale
          onPress={
            done
              ? undefined
              : () => {
                  hapticSuccess();
                  onAdd(card);
                  setJustAdded(true);
                  timer.current = setTimeout(close, CLOSE_AFTER_ADD_MS);
                }
          }
          disabled={done}
          haptic={false}
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={done ? `Aggiunta a ${slotLabel}` : `Aggiungi a ${slotLabel} di oggi`}
          style={[styles.addButton, { backgroundColor: done ? theme.brandGreen : theme.accent }]}>
          <Icon name={done ? 'check' : 'plus'} size={19} color={OnBrand.text} />
          <ThemedText style={styles.addText}>{done ? `Aggiunta a ${slotLabel}` : `Aggiungi a ${slotLabel} di oggi`}</ThemedText>
        </PressableScale>
      )}>
      <View style={styles.hero}>{card.image ? <DishPhoto image={card.image} size={HERO} radius={28} eager /> : <DishPlaceholder size={HERO} radius={28} />}</View>

      <View style={styles.intro}>
        <View style={styles.facts}>
          <Fact icon="clock" text={recipe.cookMinutes > 0 ? `${recipe.prepMinutes} + ${recipe.cookMinutes} min` : `${recipe.prepMinutes} min`} />
          <Fact icon="gauge" text={recipe.difficulty} />
        </View>
        <ThemedText style={styles.description} themeColor="textSecondary">
          {recipe.description}
        </ThemedText>
      </View>

      <View>
        <View style={[styles.numbers, { backgroundColor: theme.backgroundElement }]}>
          {numbers.map((n, i) => (
            <View key={n.label} style={[styles.number, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.border }]}>
              <ThemedText style={styles.numberValue} numberOfLines={1}>
                {n.value}
              </ThemedText>
              <ThemedText style={styles.numberLabel} themeColor="textSecondary" numberOfLines={1}>
                {n.label}
              </ThemedText>
            </View>
          ))}
        </View>
        <ThemedText style={styles.portion} themeColor="textTertiary">
          {portionLabel}
        </ThemedText>
      </View>

      <ListGroup header="Ingredienti" footer={card.flavorings.length > 0 ? `Per insaporire: ${card.flavorings.join(', ').toLowerCase()}` : undefined}>
        {card.items.map((item, i) => (
          <View key={`${item.foodId}-${i}`} style={styles.row}>
            <ThemedText style={styles.rowTitle}>{item.name}</ThemedText>
            <View style={styles.rowRight}>
              <ThemedText style={styles.rowValue}>{item.quantityLabel}</ThemedText>
              <ThemedText style={styles.rowKcal} themeColor="textTertiary">
                {Math.round(item.kcal)} kcal
              </ThemedText>
            </View>
          </View>
        ))}
      </ListGroup>

      <ListGroup header="Preparazione" footer={recipe.equipment.length > 0 ? `Ti serve: ${recipe.equipment.join(', ').toLowerCase()}.` : undefined}>
        {recipe.steps.map((step, i) => (
          <View key={i} style={[styles.row, styles.stepRow]}>
            <ThemedText style={[styles.stepNumber, { color: theme.accent }]}>{i + 1}</ThemedText>
            <ThemedText style={styles.stepText}>{step}</ThemedText>
          </View>
        ))}
      </ListGroup>

      <ThemedText type="caption" themeColor="textSecondary" style={styles.note}>
        {WEIGHT_BASIS_NOTE}
      </ThemedText>
    </SheetScreen>
  );
}

function Fact({ icon, text }: { icon: 'gauge' | 'clock'; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.factItem}>
      <Icon name={icon} size={16} color={theme.textSecondary} />
      <ThemedText style={styles.factText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four },
  hero: { alignItems: 'center' },
  intro: { gap: Spacing.two, paddingHorizontal: Spacing.one },
  facts: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  factItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  description: { fontSize: 15, lineHeight: 22 },
  numbers: { flexDirection: 'row', borderRadius: 20, borderCurve: 'continuous', paddingVertical: 14 },
  number: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  numberValue: { fontSize: 17, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  numberLabel: { fontSize: 12, lineHeight: 16 },
  portion: { fontSize: 12, lineHeight: 16, marginTop: 6, paddingHorizontal: Spacing.one },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: 12 },
  rowTitle: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 21 },
  rowRight: { alignItems: 'flex-end' },
  rowValue: { fontSize: 16, lineHeight: 21, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rowKcal: { fontSize: 12, lineHeight: 15, fontVariant: ['tabular-nums'] },
  stepRow: { alignItems: 'flex-start' },
  stepNumber: { width: 20, fontSize: 16, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stepText: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22 },
  note: { paddingHorizontal: Spacing.four },
  addButton: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addText: { color: OnBrand.text, fontSize: 16, lineHeight: 20, fontWeight: '700' },
});
