import { Fragment } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { DishPhoto } from '@/components/nutrition/dish-photo';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { FOOD_IMAGES_ENABLED } from '@/constants/food-images';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dishImage } from '@/lib/planning/fitlab/dish-images';
import { recipeForDish, WEIGHT_BASIS_NOTE } from '@/lib/planning/fitlab/recipes';
import type { PlanMeal } from '@/lib/planning/types';

const MEAL_PHOTO = 232;
const GROUP_RADIUS = 22;
const ROW_INSET = Spacing.three;
const STEP_BADGE = 26;

export type MealRecipeSheetProps = {
  /** The meal to present; null keeps the sheet closed. */
  meal: PlanMeal | null;
  onClose: () => void;
};

/**
 * The meal as a bottom sheet, like Profilo and Promemoria, laid out as an iOS
 * grouped page: the photo of the plate on its own white card, time and
 * difficulty as two quiet chips, the numbers of the portion assigned to this
 * person in one row, then the ingredients, the equipment and the numbered
 * preparation as grouped lists with hairline separators. Dishes outside the
 * recipe catalog still show the meal and its ingredients, just without a
 * procedure.
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

  const nutrition: { label: string; value: string; unit?: string }[] = [
    { label: 'Calorie', value: String(meal.totalKcal), unit: 'kcal' },
    ...(meal.macros
      ? [
          { label: 'Proteine', value: String(Math.round(meal.macros.protein)), unit: 'g' },
          { label: 'Carboidrati', value: String(Math.round(meal.macros.carbs)), unit: 'g' },
          { label: 'Grassi', value: String(Math.round(meal.macros.fats)), unit: 'g' },
        ]
      : []),
  ];

  return (
    <SheetScreen title={title} eyebrow={`${meal.label} · ${meal.time}`} onClose={onClose} contentContainerStyle={styles.content}>
      {/* The plate, whole and centred, on a white card of its own. A dish with no photo yet simply starts with its facts. */}
      {photo && FOOD_IMAGES_ENABLED ? (
        <View style={[styles.hero, { borderColor: theme.boxEdge }]}>
          <DishPhoto image={photo} size={MEAL_PHOTO} radius={0} />
        </View>
      ) : null}

      {recipe ? (
        <View style={styles.intro}>
          <View style={styles.chips}>
            <Chip icon="clockOutline" label={`${recipe.totalMinutes} min`} />
            <Chip icon="gauge" label={recipe.difficulty} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {recipe.description}
          </ThemedText>
        </View>
      ) : null}

      <Group>
        <View style={styles.nutrition}>
          {nutrition.map((n, i) => (
            <Fragment key={n.label}>
              {i > 0 ? <View style={[styles.nutritionDivider, { backgroundColor: theme.border }]} /> : null}
              <View style={styles.nutritionCell}>
                <ThemedText style={styles.nutritionValue}>
                  {n.value}
                  {n.unit ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      {` ${n.unit}`}
                    </ThemedText>
                  ) : null}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                  {n.label}
                </ThemedText>
              </View>
            </Fragment>
          ))}
        </View>
      </Group>

      <Section
        title="Ingredienti"
        footer={meal.recipe && meal.recipe.flavorings.length > 0 ? `Per insaporire: ${meal.recipe.flavorings.join(', ')}.` : undefined}>
        <Group>
          {meal.items.map((item, i) => (
            <Fragment key={i}>
              {i > 0 ? <Separator /> : null}
              <View style={styles.row}>
                <ThemedText type="default" style={styles.rowTitle}>
                  {item.name}
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary" style={styles.tabular}>
                  {item.quantityLabel}
                </ThemedText>
              </View>
            </Fragment>
          ))}
        </Group>
      </Section>

      {recipe ? (
        <>
          <Section title="Attrezzatura">
            <View style={styles.chips}>
              {recipe.equipment.map((tool) => (
                <Chip key={tool} label={tool} />
              ))}
            </View>
          </Section>

          <Section title="Preparazione" footer={WEIGHT_BASIS_NOTE}>
            <Group>
              {recipe.steps.map((step, i) => (
                <Fragment key={i}>
                  {i > 0 ? <Separator inset={ROW_INSET + STEP_BADGE + Spacing.three} /> : null}
                  <View style={styles.step}>
                    <View style={[styles.stepBadge, { backgroundColor: theme.accentSoft }]}>
                      <ThemedText type="caption" style={[styles.stepNumber, { color: theme.accent }]}>
                        {i + 1}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" style={styles.stepText}>
                      {step}
                    </ThemedText>
                  </View>
                </Fragment>
              ))}
            </Group>
          </Section>
        </>
      ) : null}
    </SheetScreen>
  );
}

/** One white card holding the rows of a section. */
function Group({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.group, { backgroundColor: theme.backgroundElevated, borderColor: theme.boxEdge }]}>{children}</View>;
}

function Separator({ inset = ROW_INSET }: { inset?: number }) {
  const theme = useTheme();
  return <View style={[styles.separator, { backgroundColor: theme.border, marginLeft: inset }]} />;
}

/** A section of the page: a small uppercase heading, its content, and an optional note under it (as in iOS Settings). */
function Section({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textSecondary" style={styles.sectionEdge} accessibilityRole="header">
        {title}
      </ThemedText>
      {children}
      {footer ? (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.sectionEdge}>
          {footer}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Chip({ icon, label }: { icon?: IconName; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: theme.backgroundElevated, borderColor: theme.boxEdge }]}>
      {icon ? <Icon name={icon} size={14} color={theme.textSecondary} /> : null}
      <ThemedText type="caption" style={styles.chipLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.four },
  // White in both schemes, like the photo's own background: the plate sits on one continuous surface.
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xlarge,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  intro: { gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: { fontWeight: '600' },
  group: {
    borderRadius: GROUP_RADIUS,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  separator: { height: StyleSheet.hairlineWidth },
  nutrition: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: 14 },
  nutritionCell: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  nutritionDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  nutritionValue: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  section: { gap: Spacing.two },
  sectionEdge: { paddingHorizontal: ROW_INSET },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: ROW_INSET,
    paddingVertical: 12,
  },
  rowTitle: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingHorizontal: ROW_INSET,
    paddingVertical: 14,
  },
  stepBadge: { width: STEP_BADGE, height: STEP_BADGE, borderRadius: STEP_BADGE / 2, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { fontWeight: '700' },
  stepText: { flex: 1, paddingTop: 3 },
});
