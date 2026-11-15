import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { DishPhoto, DishPlaceholder } from '@/components/nutrition/dish-photo';
import { PressableScale } from '@/components/motion/pressable-scale';
import { MealRecipeSheet } from '@/components/nutrition/meal-recipe-sheet';
import { ThemedText } from '@/components/themed-text';
import { ExerciseInfoModal } from '@/components/training/exercise-info-modal';
import { Icon, type IconName } from '@/components/ui/icon';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getExerciseMedia } from '@/lib/exercise-media/exercise-media';
import { dishImage } from '@/lib/planning/fitlab/dish-images';
import { recipeForDish } from '@/lib/planning/fitlab/recipes';
import type { PlanMeal } from '@/lib/planning/types';

export type ExerciseCardItem = {
  key: string;
  exerciseId?: string;
  name: string;
  subtitle: string;
  sets?: number;
  reps?: string;
  tempo?: string;
  restLabel?: string;
};

export function ExerciseSummaryCard({ item }: { item: ExerciseCardItem }) {
  const theme = useTheme();
  const [infoOpen, setInfoOpen] = useState(false);
  const media = item.exerciseId ? getExerciseMedia(item.exerciseId) : undefined;

  return (
    <GlassSurface level="card" radius={Radius.large} style={styles.exerciseCard}>
      {media ? (
        <Image source={{ uri: media.gifUrl }} style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="smallBold">{item.name}</ThemedText>
        {item.subtitle ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {item.subtitle}
          </ThemedText>
        ) : null}
      </View>
      {item.exerciseId ? (
        <Pressable onPress={() => setInfoOpen(true)} hitSlop={8} style={styles.infoButton}>
          <Icon name="info" size={20} color={theme.textSecondary} />
        </Pressable>
      ) : null}

      <ExerciseInfoModal
        visible={infoOpen}
        exerciseName={item.name}
        media={media}
        sets={item.sets ?? 0}
        reps={item.reps ?? ''}
        tempo={item.tempo ?? ''}
        restLabel={item.restLabel ?? ''}
        onClose={() => setInfoOpen(false)}
      />
    </GlassSurface>
  );
}

const SLOT_ICON: Record<string, IconName> = { colazione: 'mealSun', pranzo: 'mealMidday', cena: 'mealMoon' };
const DISH_PHOTO = 88;

/**
 * A meal of the Piano alimentare, in the iOS grouped-card language: a quiet
 * header (which meal, when, how much), the dish with its photo, the foods
 * with their quantities as hairline-divided rows, and one tinted button that
 * opens the recipe sheet.
 */
export function MealCard({ meal }: { meal: PlanMeal }) {
  const theme = useTheme();
  const photo = dishImage(meal.recipe?.dishId, meal.items.map((i) => i.name));
  const preparation = recipeForDish(meal.recipe?.dishId);
  const [detailOpen, setDetailOpen] = useState(false);
  const icon = SLOT_ICON[meal.label.trim().toLowerCase()] ?? 'mealSnack';
  const openRecipe = () => setDetailOpen(true);

  const facts = [
    meal.macros ? `P ${Math.round(meal.macros.protein)} g` : null,
    meal.macros ? `C ${Math.round(meal.macros.carbs)} g` : null,
    meal.macros ? `G ${Math.round(meal.macros.fats)} g` : null,
  ].filter(Boolean);

  return (
    <GlassSurface level="card" radius={Radius.large} style={styles.mealCard}>
      <View style={styles.mealHeader}>
        <Icon name={icon} size={16} color={theme.textSecondary} />
        <ThemedText type="label" themeColor="textSecondary" style={styles.mealLabel} numberOfLines={1}>
          {meal.label}
          <ThemedText type="label" themeColor="textTertiary">{`  ${meal.time}`}</ThemedText>
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.mealKcal}>
          {meal.isFreeMeal ? '~' : ''}
          {meal.totalKcal} kcal
        </ThemedText>
      </View>

      {meal.isFreeMeal ? (
        <View style={{ gap: 2 }}>
          <ThemedText type="subtitle">Pasto libero</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Scegli tu cosa mangiare, restando indicativamente entro ~{meal.totalKcal} kcal e senza eccessi — vedi le
            note del piano per qualche indicazione.
          </ThemedText>
        </View>
      ) : (
        <>
          {meal.recipe ? (
            <Pressable onPress={openRecipe} style={styles.recipeRow} accessibilityRole="button" accessibilityLabel={`Apri la ricetta: ${meal.recipe.name}`}>
              {photo ? <DishPhoto image={photo} size={DISH_PHOTO} radius={Radius.medium} /> : <DishPlaceholder size={DISH_PHOTO} radius={Radius.medium} />}
              <View style={styles.recipeText}>
                <ThemedText type="subtitle" numberOfLines={3}>
                  {meal.recipe.name}
                </ThemedText>
                {facts.length > 0 ? (
                  <ThemedText type="caption" themeColor="textSecondary" style={styles.tabular}>
                    {facts.join('  ·  ')}
                  </ThemedText>
                ) : null}
                {preparation ? (
                  <View style={styles.prepRow}>
                    <Icon name="clockOutline" size={13} color={theme.textTertiary} />
                    <ThemedText type="caption" themeColor="textTertiary">
                      {preparation.totalMinutes} min · {preparation.difficulty}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </Pressable>
          ) : null}

          <View style={[styles.mealItems, { borderTopColor: theme.border }]}>
            {meal.items.map((item, index) => (
              <MealItemRow key={index} item={item} divider={index > 0} />
            ))}
          </View>

          {meal.recipe ? (
            <PressableScale
              onPress={openRecipe}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={`Visualizza ricetta: ${meal.recipe.name}`}
              style={[styles.recipeButton, { backgroundColor: theme.accentSoft }]}>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                Visualizza ricetta
              </ThemedText>
            </PressableScale>
          ) : null}
          <MealRecipeSheet meal={detailOpen ? meal : null} onClose={() => setDetailOpen(false)} />
        </>
      )}
    </GlassSurface>
  );
}

/** One food of the meal: name on the left, quantity on the right. A food with
 * alternatives has a small swap control that unfolds them under the row (spec
 * request: "un tasto per le sostituzioni"), so the list stays clean until asked. */
function MealItemRow({ item, divider }: { item: PlanMeal['items'][number]; divider: boolean }) {
  const theme = useTheme();
  const [showSubstitutes, setShowSubstitutes] = useState(false);
  const hasSubstitutes = (item.substitutes?.length ?? 0) > 0;

  const row = (
    <>
      <ThemedText type="small" style={{ flex: 1 }}>
        {item.name}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.tabular}>
        {item.quantityLabel}
      </ThemedText>
      <View style={styles.swapSlot}>
        {hasSubstitutes ? <Icon name={showSubstitutes ? 'chevronUp' : 'swap'} size={15} color={showSubstitutes ? theme.accent : theme.textTertiary} /> : null}
      </View>
    </>
  );

  return (
    <View style={divider ? [styles.mealItemDivider, { borderTopColor: theme.border }] : undefined}>
      {hasSubstitutes ? (
        <Pressable
          onPress={() => setShowSubstitutes((v) => !v)}
          style={styles.mealItemRow}
          accessibilityRole="button"
          accessibilityState={{ expanded: showSubstitutes }}
          accessibilityLabel={`${item.name}, ${item.quantityLabel}. Sostituzioni`}>
          {row}
        </Pressable>
      ) : (
        <View style={styles.mealItemRow}>{row}</View>
      )}
      {showSubstitutes && item.substitutes ? (
        <View style={[styles.substituteList, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="caption" themeColor="textTertiary">
            In alternativa
          </ThemedText>
          {item.substitutes.map((s, i) => (
            <View key={i} style={styles.substituteRow}>
              <ThemedText type="caption" style={{ flex: 1 }}>
                {s.name}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.tabular}>
                {s.quantityLabel}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  thumb: { width: 48, height: 48, borderRadius: Radius.medium },
  infoButton: { padding: 4 },
  mealCard: {
    gap: Spacing.three,
    padding: Layout.cardPadding,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mealLabel: { flex: 1 },
  mealKcal: { fontWeight: '600' },
  tabular: { fontVariant: ['tabular-nums'] },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  recipeText: {
    flex: 1,
    gap: 4,
  },
  prepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealItems: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mealItemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mealItemRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 9,
  },
  swapSlot: {
    width: 18,
    alignItems: 'flex-end',
  },
  substituteList: {
    gap: 6,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.small,
    borderCurve: 'continuous',
  },
  substituteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  recipeButton: {
    minHeight: Layout.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    borderCurve: 'continuous',
  },
});
