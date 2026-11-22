import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { DishPhoto, DishPlaceholder } from '@/components/nutrition/dish-photo';
import { MealRecipeSheet } from '@/components/nutrition/meal-recipe-sheet';
import { ThemedText } from '@/components/themed-text';
import { ExerciseInfoModal, type ExerciseProgramming } from '@/components/training/exercise-info-modal';
import { Collapsible } from '@/components/ui/collapsible';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticTap } from '@/lib/haptics';
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
  programming?: ExerciseProgramming;
};

export function ExerciseSummaryCard({ item }: { item: ExerciseCardItem }) {
  const theme = useTheme();
  const [infoOpen, setInfoOpen] = useState(false);
  const media = item.exerciseId ? getExerciseMedia(item.exerciseId, item.name) : undefined;

  return (
    // The same flat surface as the macro-plan box and the meal cards, so the page reads as one set of cards.
    <FlatCard radius={Radius.medium} style={styles.exerciseCard}>
      {media ? (
        <Image source={{ uri: media.gifUrl }} style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} />
      ) : (
        // No animation for this exercise (warm-up, a card's own wording…): a thin dumbbell keeps the row tidy.
        <View style={[styles.thumb, styles.thumbIcon, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="dumbbellLine" size={22} strokeWidth={1.4} color={theme.textSecondary} />
        </View>
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
        <Pressable onPress={() => setInfoOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Come si esegue: ${item.name}`} style={styles.infoButton}>
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
        programming={item.programming}
        onClose={() => setInfoOpen(false)}
      />
    </FlatCard>
  );
}

const round = (n: number) => Math.round(n).toLocaleString('it-IT');

/**
 * One meal of the day, as a quiet white card: the dish with its photo and numbers on top, the foods and their
 * quantities as plain rows, and a single button for the recipe. Substitutions open under the food they belong to.
 */
export function MealCard({ meal, onSubstitute }: { meal: PlanMeal; /** Applies a suggested alternative (absent: alternatives are only shown). */ onSubstitute?: (itemIndex: number, foodId: string) => void }) {
  const theme = useTheme();
  const photo = dishImage(meal.recipe?.dishId, meal.items.map((i) => i.name));
  const preparation = recipeForDish(meal.recipe?.dishId);
  const [detailOpen, setDetailOpen] = useState(false);

  const title = meal.eatOut ? 'Pasto fuori casa' : meal.isFreeMeal ? 'Pasto libero' : (meal.recipe?.name ?? meal.label);
  const when = meal.timeWindow ?? meal.time;
  const overline = meal.isFreeMeal || meal.recipe ? `${meal.label} · ${when}` : when;
  const log = meal.freeMealLog;
  const numbers = meal.isFreeMeal
    ? log
      ? [`${round(log.kcal)} kcal ${log.status === 'measured' ? 'registrate' : log.status === 'estimated' ? 'stimate' : 'dichiarate'}`, log.macros ? `P ${round(log.macros.protein)} · C ${round(log.macros.carbs)} · G ${round(log.macros.fats)}${log.status === 'estimated' ? ' (stima)' : ''}` : 'macro non disponibili'].join('  ·  ')
      : `Circa ${round(meal.totalKcal)} kcal`
    : [meal.totalKcal > 0 ? `${round(meal.totalKcal)} kcal` : null, meal.macros ? `P ${round(meal.macros.protein)} · C ${round(meal.macros.carbs)} · G ${round(meal.macros.fats)}` : null].filter(Boolean).join('  ·  ');
  const hasRecipe = !meal.isFreeMeal && meal.recipe != null;

  const header = (
    <>
      {hasRecipe ? photo ? <DishPhoto image={photo} size={64} radius={16} /> : <DishPlaceholder size={64} radius={16} /> : null}
      <View style={styles.mealTexts}>
        <ThemedText style={styles.overline} themeColor="textSecondary" numberOfLines={1}>
          {overline}
        </ThemedText>
        <ThemedText style={styles.mealTitle} numberOfLines={2}>
          {title}
        </ThemedText>
        {numbers ? (
          <ThemedText style={styles.mealNumbers} themeColor="textSecondary" numberOfLines={1}>
            {numbers}
          </ThemedText>
        ) : null}
      </View>
    </>
  );

  return (
    <FlatCard radius={Radius.medium}>
      {hasRecipe ? (
        <Pressable
          onPress={() => setDetailOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${meal.label}, ${title}. Apri la ricetta`}
          style={({ pressed }) => [styles.mealHeader, { opacity: pressed ? 0.6 : 1 }]}
        >
          {header}
        </Pressable>
      ) : (
        <View style={styles.mealHeader}>{header}</View>
      )}

      {meal.eatOut ? (
        <View style={styles.mealItems}>
          {meal.eatOut.guidance.map((line, index) => (
            <ThemedText key={index} style={styles.freeMeal} themeColor="textSecondary">
              {line}
            </ThemedText>
          ))}
        </View>
      ) : meal.isFreeMeal ? (
        <ThemedText style={styles.freeMeal} themeColor="textSecondary">
          {log
            ? `${log.description ? `${log.description}. ` : ''}${log.method}`
            : 'Scegli tu cosa mangiare, senza eccessi e restando vicino alle calorie indicate. Finché non lo registri, i suoi macro non sono disponibili e la giornata risulta osservata solo in parte.'}
        </ThemedText>
      ) : (
        <>
          <View style={[styles.hairline, { backgroundColor: theme.border }]} />
          <View style={styles.mealItems}>
            {meal.items.map((item, index) => (
              <MealItemRow key={index} item={item} onApply={onSubstitute ? (foodId) => onSubstitute(index, foodId) : undefined} />
            ))}
          </View>
          {meal.recipe && meal.recipe.flavorings.length > 0 ? (
            <ThemedText style={styles.flavorings} themeColor="textSecondary">
              Per insaporire: {meal.recipe.flavorings.join(', ')}
            </ThemedText>
          ) : null}

          {hasRecipe ? (
            <Pressable
              onPress={() => {
                hapticTap();
                setDetailOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Vedi ricetta: ${title}`}
              style={({ pressed }) => [styles.recipeButton, { backgroundColor: theme.accentSoft, opacity: pressed ? 0.6 : 1 }]}
            >
              <Icon name="utensils" size={16} color={theme.accent} />
              <ThemedText style={[styles.recipeButtonLabel, { color: theme.accent }]}>Vedi ricetta</ThemedText>
              {preparation ? <ThemedText style={[styles.recipeButtonMeta, { color: theme.accent }]}>· {preparation.totalMinutes} min</ThemedText> : null}
            </Pressable>
          ) : null}
          <MealRecipeSheet meal={detailOpen ? meal : null} onClose={() => setDetailOpen(false)} />
        </>
      )}
    </FlatCard>
  );
}

/**
 * A food and its quantity on one row. When it has alternatives the row is a button that opens them right under it:
 * each alternative shows its portion, its calories and protein, and whether it is an equivalent or a compromise.
 * They are only suggestions: the menu changes when the person picks one ("Usa"), and then everything is recalculated.
 */
function MealItemRow({ item, onApply }: { item: PlanMeal['items'][number]; onApply?: (foodId: string) => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const substitutes = item.substitutes ?? [];
  const hasSubstitutes = substitutes.length > 0;

  const row = (
    <>
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.itemName} numberOfLines={2}>
          {item.name}
        </ThemedText>
        {item.substitutedFrom ? (
          <ThemedText style={styles.substituteNote} themeColor="textSecondary" numberOfLines={1}>
            al posto di {item.substitutedFrom.name.toLowerCase()} · {item.kcal - item.substitutedFrom.kcal >= 0 ? '+' : ''}
            {item.kcal - item.substitutedFrom.kcal} kcal
          </ThemedText>
        ) : null}
      </View>
      <ThemedText style={styles.itemQuantity} themeColor="textSecondary" numberOfLines={1}>
        {item.quantityLabel}
      </ThemedText>
      {hasSubstitutes ? <Icon name={open ? 'chevronUp' : 'swap'} size={14} color={theme.textTertiary} /> : null}
    </>
  );

  if (!hasSubstitutes) return <View style={styles.itemRow}>{row}</View>;
  return (
    <View>
      <Pressable
        onPress={() => {
          hapticTap();
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${item.name}, ${item.quantityLabel}. Alternative`}
        style={({ pressed }) => [styles.itemRow, { opacity: pressed ? 0.6 : 1 }]}
      >
        {row}
      </Pressable>
      <Collapsible open={open} contentStyle={styles.substitutes}>
        <ThemedText style={styles.substitutesTitle} themeColor="textSecondary">
          Alternative proposte ({item.kcal} kcal, P {Math.round(item.protein ?? 0)} g)
        </ThemedText>
        {substitutes.map((s, i) => (
          <View key={i} style={styles.substituteRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.substituteText} numberOfLines={1}>
                {s.name}
              </ThemedText>
              {s.kcal != null ? (
                <ThemedText style={styles.substituteNote} themeColor="textSecondary" numberOfLines={2}>
                  {s.kcal} kcal · P {Math.round(s.protein ?? 0)} g{s.equivalence === 'tradeoff' ? ` · compromesso${s.note ? `: ${s.note}` : ''}` : s.note ? ` · ${s.note}` : ''}
                </ThemedText>
              ) : null}
            </View>
            <ThemedText style={styles.substituteQuantity} themeColor="textSecondary">
              {s.quantityLabel}
            </ThemedText>
            {onApply ? (
              <Pressable
                onPress={() => {
                  hapticTap();
                  onApply(s.foodId);
                  setOpen(false);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Usa ${s.name} al posto di ${item.name}`}
              >
                <ThemedText style={[styles.substituteApply, { color: theme.accent }]}>Usa</ThemedText>
              </Pressable>
            ) : null}
          </View>
        ))}
      </Collapsible>
    </View>
  );
}

const CARD_INSET = 14;

const styles = StyleSheet.create({
  exerciseCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  thumb: { width: 48, height: 48, borderRadius: Radius.medium },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  infoButton: { padding: 4 },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: CARD_INSET },
  mealTexts: { flex: 1, minWidth: 0, gap: 2 },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  mealTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.2 },
  mealNumbers: { fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: CARD_INSET },
  mealItems: { paddingHorizontal: CARD_INSET, paddingVertical: 4 },
  itemRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20 },
  itemQuantity: { fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] },
  substitutes: { paddingBottom: 8, paddingLeft: 12, gap: 4 },
  substitutesTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  substituteNote: { fontSize: 11, lineHeight: 14 },
  substituteApply: { fontSize: 13, lineHeight: 18, fontWeight: '600', paddingLeft: 8 },
  substituteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  substituteText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 19 },
  substituteQuantity: { fontSize: 14, lineHeight: 19, fontVariant: ['tabular-nums'] },
  flavorings: { fontSize: 13, lineHeight: 18, paddingHorizontal: CARD_INSET, paddingBottom: 4 },
  freeMeal: { fontSize: 14, lineHeight: 20, paddingHorizontal: CARD_INSET, paddingBottom: CARD_INSET },
  recipeButton: {
    minHeight: 44,
    marginHorizontal: CARD_INSET,
    marginTop: 6,
    marginBottom: CARD_INSET,
    borderRadius: 14,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  recipeButtonLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  recipeButtonMeta: { fontSize: 15, lineHeight: 20 },
});
