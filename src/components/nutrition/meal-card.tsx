import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { FoodThumb } from '@/components/nutrition/food-thumb';
import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon, type IconName } from '@/components/ui/icon';
import { SwipeToDelete } from '@/components/ui/swipe-to-delete';
import { useTheme } from '@/hooks/use-theme';
import { hapticTap } from '@/lib/haptics';
import { findFood } from '@/lib/mock/food-database';
import { macrosForEntry, type MealFoodEntry } from '@/store/nutrition-store';

type Totals = { kcal: number; protein: number; carbs: number; fats: number };

export type MealCardProps = {
  label: string;
  time: string;
  icon: IconName;
  /** The meal's accent: its icon, and nothing else (the kcal and the bar are the app's orange). */
  color: string;
  entries: MealFoodEntry[];
  totals: Totals;
  expanded: boolean;
  onToggle: () => void;
  onEditEntry: (entry: MealFoodEntry) => void;
  /** A food swiped to the left and deleted. */
  onDeleteEntry: (entry: MealFoodEntry) => void;
  onAddFood: () => void;
  /** The Reanimated layout transition the card (and the ones below) glide with when it folds. */
  layout?: ComponentProps<typeof FlatCard>['layout'];
};

function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

function countLabel(n: number): string {
  return n === 0 ? 'Nessun alimento' : n === 1 ? '1 alimento' : `${n} alimenti`;
}

/**
 * One meal of the day on Nutrizione, laid out as in the reference:
 * - a round icon, the meal's name and "09:30 · 5 alimenti" on the left; its
 *   kcal in orange on the right;
 * - protein / carbs / fat of the meal on one line;
 * - the foods, each with its picture, grams, kcal and P · C · G, separated by
 *   hairlines, then a full-width "+ Aggiungi alimento" outline button.
 * Tapping the header folds the foods away.
 */
export function MealCard({ label, time, icon, color, entries, totals, expanded, onToggle, onEditEntry, onDeleteEntry, onAddFood, layout }: MealCardProps) {
  const theme = useTheme();

  return (
    <FlatCard radius={24} style={styles.card} layout={layout}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${label}, ${Math.round(totals.kcal)} kcal`} style={styles.header}>
        <View style={[styles.icon, { backgroundColor: withAlpha(color, 0.14) }]}>
          <Icon name={icon} size={22} color={color} />
        </View>
        <View style={styles.titleCol}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {label}
          </ThemedText>
          <ThemedText style={styles.sub} themeColor="textTertiary" numberOfLines={1}>
            {time} · {countLabel(entries.length)}
          </ThemedText>
        </View>
        <View style={styles.kcalCol}>
          <ThemedText style={[styles.kcal, { color: theme.accent }]}>{Math.round(totals.kcal)} kcal</ThemedText>
        </View>
      </Pressable>

      <View style={styles.macroRow}>
        {(
          [
            ['Proteine', totals.protein],
            ['Carboidrati', totals.carbs],
            ['Grassi', totals.fats],
          ] as const
        ).map(([name, value]) => (
          <ThemedText key={name} style={styles.macro} themeColor="textSecondary" numberOfLines={1}>
            {name} <ThemedText style={styles.macroValue}>{Math.round(value)} g</ThemedText>
          </ThemedText>
        ))}
      </View>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(220).delay(60)} exiting={FadeOut.duration(110)}>
          <View style={[styles.rule, { backgroundColor: theme.borderStrong }]} />
          {entries.map((entry, i) => {
            const food = findFood(entry.foodId);
            const m = macrosForEntry(entry);
            return (
              <View key={entry.id} style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.borderStrong }}>
                <SwipeToDelete
                  onPress={() => onEditEntry(entry)}
                  onDelete={() => onDeleteEntry(entry)}
                  accessibilityLabel={`${food?.name ?? entry.foodId}, ${entry.grams} g`}>
                  <View style={styles.foodRow}>
                    <FoodThumb foodId={entry.foodId} variant="row" />
                    <View style={styles.foodText}>
                      <ThemedText style={styles.foodName} numberOfLines={2}>
                        {food?.name ?? entry.foodId}
                      </ThemedText>
                      <ThemedText style={styles.foodGrams} themeColor="textTertiary">
                        {entry.grams} g
                      </ThemedText>
                    </View>
                    <View style={styles.foodRight}>
                      <ThemedText style={styles.foodKcal}>{Math.round(m.kcal)} kcal</ThemedText>
                      <ThemedText style={styles.foodMacros} themeColor="textTertiary">
                        P {Math.round(m.protein)} · C {Math.round(m.carbs)} · G {Math.round(m.fats)}
                      </ThemedText>
                    </View>
                  </View>
                </SwipeToDelete>
              </View>
            );
          })}
          <Pressable
            onPress={() => {
              hapticTap();
              onAddFood();
            }}
            accessibilityRole="button"
            style={[styles.addButton, { borderColor: theme.borderStrong }, entries.length > 0 && styles.addButtonAfterRows]}>
            <Icon name="plus" size={18} color={theme.textSecondary} />
            <ThemedText style={styles.addLabel} themeColor="textSecondary">
              Aggiungi alimento
            </ThemedText>
          </Pressable>
        </Animated.View>
      ) : null}
    </FlatCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  sub: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  kcalCol: {
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  kcal: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
  },
  macro: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
  },
  macroValue: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 14,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  foodText: {
    flex: 1,
    minWidth: 0,
  },
  foodName: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '500',
  },
  foodGrams: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  foodRight: {
    alignItems: 'flex-end',
  },
  foodKcal: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  foodMacros: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  addButton: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  addButtonAfterRows: {
    marginTop: 6,
  },
  addLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
});
