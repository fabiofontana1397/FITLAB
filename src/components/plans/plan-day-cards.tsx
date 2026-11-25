import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { DishPhoto, DishPlaceholder } from '@/components/nutrition/dish-photo';
import { MealRecipeSheet } from '@/components/nutrition/meal-recipe-sheet';
import { ThemedText } from '@/components/themed-text';
import { ExerciseInfoModal, type ExerciseProgramming } from '@/components/training/exercise-info-modal';
import { Collapsible } from '@/components/ui/collapsible';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
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

/**
 * One exercise of the day as a quiet card: the moving demo (or a thin dumbbell), the name, and the prescription on
 * one line — sets × reps in full weight, the rest softer. The whole card is the button: tapped, it opens how the
 * exercise is done and why it is there.
 */
export function ExerciseSummaryCard({ item }: { item: ExerciseCardItem }) {
  const theme = useTheme();
  const [infoOpen, setInfoOpen] = useState(false);
  const media = item.exerciseId ? getExerciseMedia(item.exerciseId, item.name) : undefined;
  const opensInfo = item.exerciseId != null || item.sets != null;

  // "4 × 8-10" leads; RIR, rest and technique follow in the secondary tone.
  const dose = item.sets != null && item.reps ? `${item.sets} × ${item.reps}` : null;
  const rest = dose ? item.subtitle.split(' · ').slice(1).join(' · ') : item.subtitle;

  const body = (
    <>
      {media ? (
        <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
          <Image source={{ uri: media.gifUrl }} style={StyleSheet.absoluteFill} />
        </View>
      ) : (
        // No animation for this exercise (warm-up, a card's own wording…): a thin dumbbell keeps the row tidy.
        <View style={[styles.thumb, styles.thumbIcon, { backgroundColor: theme.backgroundElement }]}>
          <Icon name="dumbbellLine" size={24} strokeWidth={1.3} color={theme.text} />
        </View>
      )}
      <View style={styles.exerciseTexts}>
        <ThemedText style={styles.exerciseName} numberOfLines={2}>
          {item.name}
        </ThemedText>
        {dose || rest ? (
          <ThemedText style={styles.exerciseMeta} themeColor="textSecondary" numberOfLines={dose ? 1 : 4}>
            {dose ? <ThemedText style={[styles.exerciseMeta, styles.exerciseDose]}>{dose}</ThemedText> : null}
            {dose && rest ? '  ·  ' : ''}
            {rest}
          </ThemedText>
        ) : null}
      </View>
      {opensInfo ? <Icon name="chevronRight" size={16} color={theme.textTertiary} /> : null}
    </>
  );

  return (
    // The same flat surface as the macro-plan box and the meal cards, so the page reads as one set of cards.
    <FlatCard radius={Radius.large}>
      {opensInfo ? (
        <Pressable
          onPress={() => {
            hapticTap();
            setInfoOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}. ${item.subtitle}. Come si esegue`}
          style={({ pressed }) => [styles.exerciseCard, { opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={styles.exerciseCard}>{body}</View>
      )}

      {opensInfo ? (
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
      ) : null}
    </FlatCard>
  );
}

const round = (n: number) => Math.round(n).toLocaleString('it-IT');

const MEAL_MACROS = [
  { key: 'protein', letter: 'P', icon: 'protein', name: 'Proteine' },
  { key: 'carbs', letter: 'C', icon: 'carbs', name: 'Carboidrati' },
  { key: 'fats', letter: 'G', icon: 'fats', name: 'Grassi' },
] as const;

/**
 * One meal of the day, folded to its summary: the dish photo, the meal and its time, the dish name, and under it the
 * calories and P/C/G a touch stronger. Tapped, it unfolds in place to the foods and their quantities and the button
 * for the recipe. Substitutions open under the food they belong to.
 */
export function MealCard({ meal, onSubstitute }: { meal: PlanMeal; /** Applies a suggested alternative (absent: alternatives are only shown). */ onSubstitute?: (itemIndex: number, foodId: string) => void }) {
  const theme = useTheme();
  const photo = dishImage(meal.recipe?.dishId, meal.items.map((i) => i.name));
  const preparation = recipeForDish(meal.recipe?.dishId);
  const [detailOpen, setDetailOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const title = meal.eatOut ? 'Pasto fuori casa' : meal.isFreeMeal ? 'Pasto libero' : (meal.recipe?.name ?? meal.label);
  const when = meal.timeWindow ?? meal.time;
  const overline = title === meal.label ? when : `${meal.label} · ${when}`;
  const log = meal.freeMealLog;
  const kcal = meal.isFreeMeal ? (log ? log.kcal : meal.totalKcal) : meal.totalKcal;
  const macros = meal.isFreeMeal ? log?.macros : meal.macros;
  const hasRecipe = !meal.isFreeMeal && meal.recipe != null;
  const showPhoto = hasRecipe || meal.isFreeMeal || meal.eatOut != null;

  // The chevron turns as the card unfolds.
  const turn = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  const toggle = () => {
    hapticTap();
    const next = !expanded;
    setExpanded(next);
    turn.set(withTiming(next ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) }));
  };

  return (
    <FlatCard radius={Radius.large}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${meal.label}, ${when}, ${title}, ${Math.round(kcal)} kcal`}
        style={({ pressed }) => [styles.mealHeader, { opacity: pressed ? 0.7 : 1 }]}
      >
        {showPhoto ? photo && hasRecipe ? <DishPhoto image={photo} size={68} radius={18} /> : <DishPlaceholder size={68} radius={18} /> : null}
        <View style={styles.mealTexts}>
          <ThemedText style={styles.overline} themeColor="textSecondary" numberOfLines={1}>
            {overline}
          </ThemedText>
          <ThemedText style={styles.mealTitle} numberOfLines={2}>
            {title}
          </ThemedText>
          <View style={styles.mealNumbers}>
            {kcal > 0 ? (
              <ThemedText style={[styles.mealKcal, { color: theme.brandGreen }]} numberOfLines={1}>
                {`${meal.isFreeMeal && !log ? '~' : ''}${round(kcal)} kcal`}
              </ThemedText>
            ) : null}
            {macros
              ? MEAL_MACROS.map((m) => (
                  <View key={m.key} style={styles.mealMacro} accessible accessibilityLabel={`${m.name} ${Math.round(macros[m.key])} grammi`}>
                    <Icon name={m.icon} size={13} color={theme.textSecondary} strokeWidth={1.5} />
                    <ThemedText style={styles.mealMacroLetter} themeColor="textSecondary">
                      {m.letter}
                    </ThemedText>
                    <ThemedText style={styles.mealMacroValue} numberOfLines={1}>
                      {round(macros[m.key])}
                    </ThemedText>
                  </View>
                ))
              : null}
          </View>
        </View>
        <Animated.View style={chevronStyle}>
          <Icon name="chevronDown" size={16} color={theme.textTertiary} />
        </Animated.View>
      </Pressable>

      <Collapsible open={expanded}>
        <View style={[styles.hairline, { backgroundColor: theme.border }]} />
        {meal.eatOut ? (
          <View style={styles.mealItems}>
            {meal.eatOut.guidance.map((line, index) => (
              <ThemedText key={index} style={styles.freeMeal} themeColor="textSecondary">
                {line}
              </ThemedText>
            ))}
          </View>
        ) : meal.isFreeMeal ? (
          <ThemedText style={[styles.freeMeal, styles.freeMealOpen]} themeColor="textSecondary">
            {log
              ? `${log.description ? `${log.description}. ` : ''}${log.method}`
              : 'Scegli tu cosa mangiare, senza eccessi e restando vicino alle calorie indicate.'}
          </ThemedText>
        ) : (
          <>
            <View style={styles.mealItems}>
              {meal.items.map((item, index) => (
                <MealItemRow key={index} item={item} onApply={onSubstitute ? (foodId) => onSubstitute(index, foodId) : undefined} />
              ))}
            </View>
            {hasRecipe ? (
              <Pressable
                onPress={() => {
                  hapticTap();
                  setDetailOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Vedi ricetta: ${title}`}
                style={({ pressed }) => [styles.recipeButton, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 }]}
              >
                <Icon name="utensils" size={16} color={theme.text} />
                <ThemedText style={styles.recipeButtonLabel}>Vedi ricetta</ThemedText>
                {preparation ? (
                  <ThemedText style={styles.recipeButtonMeta} themeColor="textSecondary">
                    · {preparation.totalMinutes} min
                  </ThemedText>
                ) : null}
              </Pressable>
            ) : (
              <View style={styles.mealItemsEnd} />
            )}
          </>
        )}
      </Collapsible>
      {hasRecipe ? <MealRecipeSheet meal={detailOpen ? meal : null} onClose={() => setDetailOpen(false)} /> : null}
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
  exerciseCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 12, paddingRight: 16 },
  thumb: { width: 56, height: 56, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  exerciseTexts: { flex: 1, minWidth: 0, gap: 3 },
  exerciseName: { fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.3 },
  exerciseMeta: { fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  exerciseDose: { fontWeight: '600' },
  mealHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, paddingRight: 16 },
  mealTexts: { flex: 1, minWidth: 0, gap: 2 },
  overline: { fontSize: 11, lineHeight: 15, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  mealTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.3 },
  mealNumbers: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 10, rowGap: 2, marginTop: 4 },
  mealKcal: { fontSize: 14, lineHeight: 19, fontWeight: '700', letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  mealMacro: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  mealMacroLetter: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  mealMacroValue: { fontSize: 13, lineHeight: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  mealItemsEnd: { height: 8 },
  freeMealOpen: { paddingTop: 12 },
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
  recipeButtonLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.2 },
  recipeButtonMeta: { fontSize: 15, lineHeight: 20 },
});
