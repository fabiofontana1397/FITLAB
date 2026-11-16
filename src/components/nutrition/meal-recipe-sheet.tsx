import { Modal, StyleSheet, View } from 'react-native';

import { DishPhoto, DishPlaceholder } from '@/components/nutrition/dish-photo';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ListGroup } from '@/components/ui/list-group';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dishImage } from '@/lib/planning/fitlab/dish-images';
import { recipeForDish, WEIGHT_BASIS_NOTE } from '@/lib/planning/fitlab/recipes';
import type { PlanMeal } from '@/lib/planning/types';

const MEAL_PHOTO = 232;

export type MealRecipeSheetProps = {
  /** The meal to present; null keeps the sheet closed. */
  meal: PlanMeal | null;
  onClose: () => void;
};

/**
 * The meal as a bottom sheet, like Profilo and Promemoria: its photo, time and
 * difficulty, the numbers of the portion assigned to this person in one strip,
 * then two grouped lists — the ingredients with their own quantities and (for
 * the official recipes) the numbered preparation. Dishes outside the recipe catalog still show
 * the meal and its ingredients, just without a procedure.
 */
export function MealRecipeSheet({ meal, onClose }: MealRecipeSheetProps) {
  return (
    // The sheet animates itself, so the Modal only has to be transparent.
    <Modal visible={meal != null} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {meal ? <MealRecipeContent key={`${meal.slotId}-${meal.recipe?.name ?? ''}`} meal={meal} onClose={onClose} /> : null}
    </Modal>
  );
}

function MealRecipeContent({ meal, onClose }: { meal: PlanMeal; onClose: () => void }) {
  const theme = useTheme();
  const photo = dishImage(meal.recipe?.dishId, meal.items.map((i) => i.name));
  const recipe = recipeForDish(meal.recipe?.dishId);
  const title = meal.recipe?.name ?? meal.label;

  const numbers: { label: string; value: string }[] = [
    ...(meal.totalKcal > 0 ? [{ label: 'kcal', value: meal.totalKcal.toLocaleString('it-IT') }] : []),
    ...(meal.macros
      ? [
          { label: 'proteine', value: `${Math.round(meal.macros.protein)} g` },
          { label: 'carboidrati', value: `${Math.round(meal.macros.carbs)} g` },
          { label: 'grassi', value: `${Math.round(meal.macros.fats)} g` },
        ]
      : []),
  ];

  return (
    <SheetScreen title={title} eyebrow={`${meal.label} · ${meal.time}`} onClose={onClose} contentContainerStyle={styles.content}>
      <View style={styles.hero}>{photo ? <DishPhoto image={photo} size={MEAL_PHOTO} radius={28} /> : <DishPlaceholder size={MEAL_PHOTO} radius={28} />}</View>

      {recipe ? (
        <View style={styles.intro}>
          <View style={styles.facts}>
            <View style={styles.factItem}>
              <Icon name="clock" size={16} color={theme.textSecondary} />
              <ThemedText style={styles.factText}>{recipe.totalMinutes} min</ThemedText>
            </View>
            <View style={styles.factItem}>
              <Icon name="gauge" size={16} color={theme.textSecondary} />
              <ThemedText style={styles.factText}>{recipe.difficulty}</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.description} themeColor="textSecondary">
            {recipe.description}
          </ThemedText>
        </View>
      ) : null}

      {/* The portion's numbers, as one strip. */}
      {numbers.length > 0 ? (
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
      ) : null}

      <ListGroup header="Ingredienti" footer={meal.recipe && meal.recipe.flavorings.length > 0 ? `Per insaporire: ${meal.recipe.flavorings.join(', ')}` : undefined}>
        {meal.items.map((item, i) => (
          <View key={i} style={styles.row}>
            <ThemedText style={styles.rowTitle}>{item.name}</ThemedText>
            <ThemedText style={styles.rowValue} themeColor="textSecondary">
              {item.quantityLabel}
            </ThemedText>
          </View>
        ))}
      </ListGroup>

      {recipe ? (
        <>
          <ListGroup header="Preparazione" footer={`Ti serve: ${recipe.equipment.join(', ').toLowerCase()}.`}>
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
        </>
      ) : null}
    </SheetScreen>
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
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: 12 },
  rowTitle: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 21 },
  rowValue: { fontSize: 16, lineHeight: 21, fontVariant: ['tabular-nums'] },
  stepRow: { alignItems: 'flex-start' },
  stepNumber: { width: 20, fontSize: 16, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stepText: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22 },
  note: { paddingHorizontal: Spacing.four },
});
