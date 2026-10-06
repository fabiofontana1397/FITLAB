import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassPopup } from '@/components/glass/glass-popup';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { mondayIndex } from '@/lib/mock/dates';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { entriesForSlot, MEAL_SLOTS, sumMacros, useNutritionStore, type MealSlot } from '@/store/nutrition-store';
import { usePlanStore } from '@/store/plan-store';

type Theme = ReturnType<typeof useTheme>;

/** Per-meal accent shared by the Nutrizione meal cards and this picker:
 * breakfast/snacks orange, lunch green, dinner blue. */
export function mealSlotColor(theme: Theme, slot: MealSlot): string {
  if (slot === 'pranzo') return theme.brandGreen;
  if (slot === 'cena') return theme.calorieSurplus;
  return theme.accent;
}

function withAlpha(hex: string, alpha: number): string {
  if (!/^#([0-9a-f]{6})$/i.test(hex)) return hex;
  return `${hex}${Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0')}`;
}

export type MealPickerModalProps = {
  visible: boolean;
  /** The day being logged (ISO) — decides which meals the plan prescribes
   * and the kcal already logged shown on each box. */
  date: string;
  onClose: () => void;
  onPick: (slot: MealSlot) => void;
};

/** "Registra pasto": a centered glass popup with one tappable box per meal
 * the diet plan prescribes for that day (colazione, pranzo, merenda, cena…
 * — all six slots when there is no plan yet). Picking one hands the slot to
 * the caller, which opens "Registra alimento" for it. */
export function MealPickerModal({ visible, date, onClose, onPick }: MealPickerModalProps) {
  const theme = useTheme();
  const entries = useNutritionStore((s) => s.entries);
  const dietPlan = usePlanStore((s) => s.dietPlan);

  const month = dietPlan?.months.find((m) => m.monthIndex === currentMonthIndex(dietPlan));
  const plannedIds = month?.weeklySplit[mondayIndex(new Date(date))]?.meals.map((m) => m.slotId) ?? [];
  const known = MEAL_SLOTS.filter((slot) => plannedIds.includes(slot.id));
  const slots = known.length > 0 ? known : MEAL_SLOTS;

  return (
    <GlassPopup visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="subtitle">Registra pasto</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Scegli il pasto a cui aggiungere un alimento
          </ThemedText>
        </View>
        <Pressable onPress={onClose} hitSlop={8}>
          <Icon name="close" size={22} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.list}>
        {slots.map((slot) => {
          const color = mealSlotColor(theme, slot.id);
          const logged = sumMacros(entriesForSlot(entries, slot.id, date));
          return (
            <Pressable
              key={slot.id}
              onPress={() => onPick(slot.id)}
              style={({ pressed }) => [
                styles.box,
                { backgroundColor: theme.backgroundElevated, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
              ]}>
              <View style={[styles.boxIcon, { backgroundColor: withAlpha(color, 0.14) }]}>
                <Icon name={slot.icon} size={18} color={color} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText style={styles.boxTitle}>{slot.label}</ThemedText>
                <ThemedText style={styles.boxSub} themeColor="textTertiary">
                  {slot.time}
                  {logged.kcal > 0 ? ` · ${Math.round(logged.kcal)} kcal registrate` : ''}
                </ThemedText>
              </View>
              <View style={[styles.plus, { backgroundColor: theme.accent }]}>
                <Icon name="plus" size={16} color="#FFFFFF" />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </GlassPopup>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 420,
  },
  list: {
    gap: 10,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  boxIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
  boxSub: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  plus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
