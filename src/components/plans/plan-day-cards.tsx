import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { DishPhoto, DishPlaceholder } from '@/components/nutrition/dish-photo';
import { MealRecipeSheet } from '@/components/nutrition/meal-recipe-sheet';
import { ThemedText } from '@/components/themed-text';
import { ExerciseInfoModal } from '@/components/training/exercise-info-modal';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
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

export function MealCard({ meal }: { meal: PlanMeal }) {
  const theme = useTheme();
  const photo = dishImage(meal.recipe?.dishId, meal.items.map((i) => i.name));
  const preparation = recipeForDish(meal.recipe?.dishId);
  const [detailOpen, setDetailOpen] = useState(false);
  return (
    <GlassSurface level="card" radius={Radius.large} style={styles.mealCard}>
      <View style={styles.mealHeader}>
        <ThemedText type="smallBold" style={{ flex: 1 }}>
          {meal.label}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {meal.time}
        </ThemedText>
      </View>

      {meal.isFreeMeal ? (
        <View style={{ gap: 2 }}>
          <ThemedText type="small" style={{ color: theme.accent, fontWeight: '600' }}>
            Pasto libero
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Scegli tu cosa mangiare, restando indicativamente entro ~{meal.totalKcal} kcal e senza eccessi — vedi le
            note del piano per qualche indicazione.
          </ThemedText>
        </View>
      ) : (
        <>
          {meal.recipe ? (
            <Pressable onPress={() => setDetailOpen(true)} style={styles.recipeRow} accessibilityRole="button" accessibilityLabel={`Apri la ricetta: ${meal.recipe.name}`}>
              {photo ? <DishPhoto image={photo} size={72} radius={Radius.medium} /> : <DishPlaceholder size={72} radius={Radius.medium} />}
              <View style={styles.recipeText}>
                <ThemedText type="smallBold">{meal.recipe.name}</ThemedText>
                {meal.recipe.flavorings.length > 0 ? (
                  <ThemedText type="caption" themeColor="textSecondary">
                    Per insaporire: {meal.recipe.flavorings.join(', ')}
                  </ThemedText>
                ) : null}
              </View>
              <Icon name="chevronRight" size={16} color={theme.textTertiary} />
            </Pressable>
          ) : null}
          <View style={{ gap: 6 }}>
            {meal.items.map((item, index) => (
              <MealItemRow key={index} item={item} />
            ))}
          </View>

          {preparation ? (
            <Pressable onPress={() => setDetailOpen(true)} hitSlop={8} style={styles.substituteToggle} accessibilityRole="button">
              <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '600' }}>
                Ricetta e preparazione · {preparation.totalMinutes} min
              </ThemedText>
              <Icon name="chevronRight" size={14} color={theme.accent} />
            </Pressable>
          ) : null}
          <MealRecipeSheet meal={detailOpen ? meal : null} onClose={() => setDetailOpen(false)} />

          <View style={[styles.mealFooterDivider, { borderTopColor: theme.border }]}>
            <ThemedText type="caption" themeColor="textSecondary">
              Totale {meal.totalKcal} kcal
            </ThemedText>
          </View>
        </>
      )}
    </GlassSurface>
  );
}

/** Substitutions are collapsed behind a tap by default (spec request: "un
 * tasto per le sostituzioni") — a long list of alternatives for every item
 * used to always be visible as a caption line, cluttering the meal even
 * when the user never asked to see them. */
function MealItemRow({ item }: { item: PlanMeal['items'][number] }) {
  const theme = useTheme();
  const [showSubstitutes, setShowSubstitutes] = useState(false);
  const hasSubstitutes = (item.substitutes?.length ?? 0) > 0;

  return (
    <View style={{ gap: 4 }}>
      <View style={styles.mealItemRow}>
        <ThemedText type="small" style={{ flex: 1 }}>
          {item.name} <ThemedText type="caption" themeColor="textSecondary">· {item.quantityLabel}</ThemedText>
        </ThemedText>
        {hasSubstitutes ? (
          <Pressable onPress={() => setShowSubstitutes((v) => !v)} hitSlop={8} style={styles.substituteToggle}>
            <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '600' }}>
              Sostituzioni
            </ThemedText>
            <Icon name={showSubstitutes ? 'chevronUp' : 'chevronDown'} size={14} color={theme.accent} />
          </Pressable>
        ) : null}
      </View>
      {showSubstitutes && item.substitutes ? (
        <View style={[styles.substituteList, { borderLeftColor: theme.border }]}>
          {item.substitutes.map((s, i) => (
            <ThemedText key={i} type="caption" themeColor="textSecondary">
              {s.name} · {s.quantityLabel}
            </ThemedText>
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
    gap: Spacing.two,
    padding: Spacing.three,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  recipeText: {
    flex: 1,
    gap: 2,
  },
  mealFooterDivider: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mealItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  substituteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  substituteList: {
    gap: 2,
    marginLeft: Spacing.two,
    paddingLeft: Spacing.two,
    borderLeftWidth: 2,
  },
});
