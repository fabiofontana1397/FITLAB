import { Modal, StyleSheet, View } from 'react-native';

import { DishPhoto, DishPlaceholder } from '@/components/nutrition/dish-photo';
import { ThemedText } from '@/components/themed-text';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dishImage } from '@/lib/planning/fitlab/dish-images';
import { recipeForDish, WEIGHT_BASIS_NOTE } from '@/lib/planning/fitlab/recipes';
import type { PlanMeal } from '@/lib/planning/types';

const MEAL_PHOTO = 220;

export type MealRecipeSheetProps = {
  /** The meal to present; null keeps the sheet closed. */
  meal: PlanMeal | null;
  onClose: () => void;
};

/**
 * The meal as a bottom sheet, like Profilo and Promemoria: its photo, the
 * numbers of the portion assigned to this person, the ingredients with their
 * own quantities, and (for the official recipes) times, difficulty, equipment
 * and the numbered preparation. Dishes outside the recipe catalog still show
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

  // one time only: the whole preparation, from start to plate
  const facts: { label: string; value: string }[] = recipe
    ? [
        { label: 'Tempo totale', value: `${recipe.totalMinutes} min` },
        { label: 'Difficoltà', value: recipe.difficulty },
      ]
    : [];

  return (
    <SheetScreen title={title} eyebrow={`${meal.label} · ${meal.time}`} onClose={onClose}>
      <View style={styles.hero}>{photo ? <DishPhoto image={photo} size={MEAL_PHOTO} radius={Radius.xlarge} /> : <DishPlaceholder size={MEAL_PHOTO} radius={Radius.xlarge} />}</View>

      {recipe ? (
        <ThemedText type="small" themeColor="textSecondary">
          {recipe.description}
        </ThemedText>
      ) : null}

      {facts.length > 0 ? (
        <View style={styles.grid}>
          {facts.map((f) => (
            <View key={f.label} style={[styles.fact, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{f.value}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {f.label}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.grid}>
        <Fact label="kcal" value={String(meal.totalKcal)} />
        {meal.macros ? (
          <>
            <Fact label="proteine" value={`${Math.round(meal.macros.protein)} g`} />
            <Fact label="carboidrati" value={`${Math.round(meal.macros.carbs)} g`} />
            <Fact label="grassi" value={`${Math.round(meal.macros.fats)} g`} />
          </>
        ) : null}
      </View>

      <Section title="Ingredienti">
        {meal.items.map((item, i) => (
          <View key={i} style={styles.ingredient}>
            <ThemedText type="small" style={{ flex: 1 }}>
              {item.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.quantityLabel}
            </ThemedText>
          </View>
        ))}
        {meal.recipe && meal.recipe.flavorings.length > 0 ? (
          <ThemedText type="caption" themeColor="textSecondary">
            Per insaporire: {meal.recipe.flavorings.join(', ')}
          </ThemedText>
        ) : null}
      </Section>

      {recipe ? (
        <>
          <Section title="Attrezzatura">
            <ThemedText type="small">{recipe.equipment.join(', ')}</ThemedText>
          </Section>
          <Section title="Preparazione">
            {recipe.steps.map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '700' }}>
                    {i + 1}
                  </ThemedText>
                </View>
                <ThemedText type="small" style={{ flex: 1 }}>
                  {step}
                </ThemedText>
              </View>
            ))}
          </Section>
          <ThemedText type="caption" themeColor="textSecondary">
            {WEIGHT_BASIS_NOTE}
          </ThemedText>
        </>
      ) : null}
    </SheetScreen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.fact, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{value}</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  fact: { flexGrow: 1, flexBasis: '22%', minWidth: 72, alignItems: 'center', gap: 2, paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, borderRadius: Radius.medium, borderCurve: 'continuous' },
  section: { gap: Spacing.two },
  ingredient: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  stepNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
