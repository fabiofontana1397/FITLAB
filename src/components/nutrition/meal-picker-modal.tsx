import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Icon } from '@/components/ui/icon';
import { SheetScreen } from '@/components/ui/sheet-screen';
import { Layout, OnBrand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection } from '@/lib/haptics';
import { formatKcal } from '@/lib/format-kcal';
import { isoMondayIndex } from '@/lib/mock/dates';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { entriesForSlot, MEAL_SLOTS, sumMacros, useNutritionStore, type MealSlot } from '@/store/nutrition-store';
import { usePlanStore } from '@/store/plan-store';
import { useUserStore } from '@/store/user-store';

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

/** "Registra pasto" as a bottom sheet, like "Registra allenamento": the day's
 * intake against its target on top, then one card per meal the diet plan
 * prescribes for that day (all six slots when there is no plan yet), each
 * with what is planned and what is already logged. Picking one hands the slot
 * to the caller, which opens "Aggiungi alimento" for it. */
export function MealPickerModal({ visible, date, onClose, onPick }: MealPickerModalProps) {
  return (
    // The sheet animates itself, so the Modal only has to be transparent.
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <MealPickerForm key={visible ? 'open' : 'closed'} date={date} onClose={onClose} onPick={onPick} />
    </Modal>
  );
}

function MealPickerForm({ date, onClose, onPick }: Omit<MealPickerModalProps, 'visible'>) {
  const theme = useTheme();
  const entries = useNutritionStore((s) => s.entries);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const profileTarget = useUserStore((s) => s.dailyCalorieTarget);

  const month = dietPlan?.months.find((m) => m.monthIndex === currentMonthIndex(dietPlan));
  const day = month?.weeklySplit[isoMondayIndex(date)];
  const plannedMeals = day?.meals ?? [];
  const known = MEAL_SLOTS.filter((slot) => plannedMeals.some((m) => m.slotId === slot.id));
  const slots = known.length > 0 ? known : MEAL_SLOTS;

  const dayTarget = day?.calorieTarget ?? month?.calorieTarget ?? profileTarget ?? 0;
  const dayEntries = entries.filter((e) => e.date === date);
  const eaten = sumMacros(dayEntries);
  const fraction = dayTarget > 0 ? Math.min(1, eaten.kcal / dayTarget) : 0;
  const over = dayTarget > 0 && eaten.kcal > dayTarget;
  const barColor = over ? theme.danger : theme.accent;

  return (
    <SheetScreen title="Registra pasto" eyebrow="Scegli a quale pasto aggiungere un alimento" onClose={onClose}>
      {() => (
        <View style={styles.page}>
          {/* The day so far: intake against the target, then the three macros. */}
          <FlatCard radius={22} style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={[styles.heroIcon, { backgroundColor: theme.accentSoft }]}>
                <Icon name="flame" size={22} color={theme.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.heroValueRow}>
                  <ThemedText style={styles.heroValue}>{formatKcal(eaten.kcal)}</ThemedText>
                  {dayTarget > 0 ? (
                    <ThemedText style={styles.heroTarget} themeColor="textSecondary">
                      / {formatKcal(dayTarget)} kcal
                    </ThemedText>
                  ) : (
                    <ThemedText style={styles.heroTarget} themeColor="textSecondary">
                      kcal
                    </ThemedText>
                  )}
                </View>
                <ThemedText style={styles.heroSub} themeColor="textSecondary">
                  {dayTarget > 0 ? (over ? 'Oltre l’obiettivo di oggi' : `Ancora ${formatKcal(dayTarget - eaten.kcal)} kcal da assumere`) : 'Assunte finora'}
                </ThemedText>
              </View>
            </View>
            {dayTarget > 0 ? (
              <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
                <View style={[styles.fill, { width: `${Math.max(fraction, eaten.kcal > 0 ? 0.03 : 0) * 100}%`, backgroundColor: barColor }]} />
              </View>
            ) : null}
            <View style={styles.macros}>
              <MacroPill label="Proteine" value={eaten.protein} />
              <MacroPill label="Carboidrati" value={eaten.carbs} />
              <MacroPill label="Grassi" value={eaten.fats} />
            </View>
          </FlatCard>

          <ThemedText style={styles.sectionTitle} accessibilityRole="header">
            I tuoi pasti
          </ThemedText>

          <View style={styles.list}>
            {slots.map((slot) => {
              const color = mealSlotColor(theme, slot.id);
              const logged = sumMacros(entriesForSlot(entries, slot.id, date));
              const planned = plannedMeals.find((m) => m.slotId === slot.id);
              // What the plan prescribes for the meal, else the slot's usual share of the day.
              const mealTarget = planned && !planned.isFreeMeal ? planned.totalKcal : dayTarget > 0 ? (dayTarget * slot.sharePct) / 100 : 0;
              const mealFraction = mealTarget > 0 ? Math.min(1, logged.kcal / mealTarget) : logged.kcal > 0 ? 1 : 0;
              const done = logged.kcal > 0;
              return (
                <Pressable
                  key={slot.id}
                  onPress={() => {
                    hapticSelection();
                    onPick(slot.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${slot.label}, aggiungi un alimento`}
                  style={({ pressed }) => [
                    styles.box,
                    { backgroundColor: theme.backgroundElevated, borderColor: done ? withAlpha(color, 0.45) : theme.boxEdge, opacity: pressed ? 0.8 : 1 },
                  ]}>
                  <View style={[styles.boxIcon, { backgroundColor: withAlpha(color, 0.14) }]}>
                    <Icon name={slot.icon} size={22} color={color} />
                  </View>
                  <View style={styles.boxBody}>
                    <View style={styles.boxTitleRow}>
                      <ThemedText style={styles.boxTitle} numberOfLines={1}>
                        {slot.label}
                      </ThemedText>
                      <ThemedText style={styles.boxTime} themeColor="textTertiary">
                        {planned?.time ?? slot.time}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.boxSub} themeColor="textSecondary" numberOfLines={1}>
                      {done
                        ? `${formatKcal(logged.kcal)}${mealTarget > 0 ? ` / ${formatKcal(mealTarget)}` : ''} kcal`
                        : mealTarget > 0
                          ? `~${formatKcal(mealTarget)} kcal previste`
                          : 'Nessun alimento registrato'}
                    </ThemedText>
                    <View style={[styles.miniTrack, { backgroundColor: withAlpha(color, 0.14) }]}>
                      <View style={[styles.miniFill, { width: `${mealFraction * 100}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                  <View style={[styles.action, { backgroundColor: done ? withAlpha(color, 0.16) : theme.accent }]}>
                    <Icon name="plus" size={18} color={done ? color : OnBrand.text} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </SheetScreen>
  );
}

function MacroPill({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.macro, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={styles.macroValue}>{Math.round(value)} g</ThemedText>
      <ThemedText style={styles.macroLabel} themeColor="textSecondary" numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14, paddingBottom: 12 },
  hero: { padding: Layout.cardPadding, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroValue: { fontSize: 32, lineHeight: 36, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  heroTarget: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  heroSub: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  macros: { flexDirection: 'row', gap: 8 },
  macro: { flex: 1, minWidth: 0, borderRadius: 14, paddingVertical: 8, alignItems: 'center', gap: 1 },
  macroValue: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
  macroLabel: { fontSize: 11, lineHeight: 14, fontWeight: '500' },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.2 },
  list: { gap: 10 },
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12 },
  boxIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  boxBody: { flex: 1, minWidth: 0, gap: 3 },
  boxTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  boxTitle: { flexShrink: 1, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  boxTime: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  boxSub: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  miniTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  miniFill: { height: '100%', borderRadius: 3 },
  action: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
