import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FlatCard } from '@/components/ui/flat-card';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DietMonthPlan, TrainingMonthPlan } from '@/lib/planning/types';

/** Month selector shared by the diet and training views. */
export function MonthPills({ count, value, onChange }: { count: number; value: number; onChange: (i: number) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.pills}>
      {Array.from({ length: count }, (_, i) => (
        <Pressable key={i} onPress={() => onChange(i)} style={[styles.pill, { backgroundColor: value === i ? theme.accent : theme.backgroundElement }]}>
          <ThemedText type="small" style={{ color: value === i ? theme.onAccent : theme.text, fontWeight: '600' }}>
            Mese {i + 1}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

/** A generated diet, month by month, day by day (admin panel and test lab). */
export function DietMonthsView({ months }: { months: DietMonthPlan[] }) {
  const [month, setMonth] = useState(0);
  const m = months[Math.min(month, months.length - 1)];
  return (
    <View style={{ gap: Spacing.four }}>
      <MonthPills count={months.length} value={month} onChange={setMonth} />
      {m ? (
        <>
          <ThemedText type="smallBold">
            {m.title} · {m.calorieTarget} kcal · P {m.macroTargetsG.protein} · C {m.macroTargetsG.carbs} · G {m.macroTargetsG.fats}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {m.focusNote}
          </ThemedText>
          {m.weeklySplit.map((d) => (
            <FlatCard key={d.weekday} style={styles.card}>
              <ThemedText type="smallBold">
                {d.weekday}
                {d.isTrainingDay ? ' · giorno di allenamento' : ''}
                {d.calorieTarget ? ` · target ${d.calorieTarget} kcal` : ''}
              </ThemedText>
              {d.meals.map((meal) => (
                <View key={meal.slotId} style={{ gap: 2, marginTop: Spacing.two }}>
                  <ThemedText type="small" style={{ fontWeight: '700' }}>
                    {meal.label} {meal.time} · {Math.round(meal.totalKcal)} kcal
                    {meal.macros ? ` (P ${Math.round(meal.macros.protein)} · C ${Math.round(meal.macros.carbs)} · G ${Math.round(meal.macros.fats)})` : ''}
                  </ThemedText>
                  {meal.isFreeMeal ? (
                    <ThemedText type="caption" themeColor="textSecondary">
                      Pasto libero
                    </ThemedText>
                  ) : (
                    <>
                      {meal.recipe ? (
                        <ThemedText type="caption" themeColor="textSecondary">
                          {meal.recipe.name}
                          {meal.recipe.flavorings.length ? ` — ${meal.recipe.flavorings.join(', ')}` : ''}
                        </ThemedText>
                      ) : null}
                      <ThemedText type="caption">{meal.items.map((i) => `${i.name} ${i.quantityLabel}`).join(' · ')}</ThemedText>
                    </>
                  )}
                </View>
              ))}
            </FlatCard>
          ))}
        </>
      ) : null}
    </View>
  );
}

/** A generated training plan, month by month, day by day. */
export function TrainingMonthsView({ months }: { months: TrainingMonthPlan[] }) {
  const [month, setMonth] = useState(0);
  const m = months[Math.min(month, months.length - 1)];
  return (
    <View style={{ gap: Spacing.four }}>
      <MonthPills count={months.length} value={month} onChange={setMonth} />
      {m ? (
        <>
          <ThemedText type="smallBold">{m.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {m.focusNote}
          </ThemedText>
          {m.weeklySplit.map((d) => (
            <FlatCard key={d.weekday} style={styles.card}>
              <ThemedText type="smallBold">
                {d.weekday} · {d.title}
              </ThemedText>
              {d.note ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  {d.note}
                </ThemedText>
              ) : null}
              {(d.exercises ?? []).map((e) => (
                <ThemedText key={e.id} type="caption">
                  {e.name} — {e.sets}×{e.reps} · rec {e.restSec}s{e.suggestedKg != null ? ` · ${e.suggestedKg} kg` : ''}
                  {e.needsManualReview ? ' · da rivedere' : ''}
                </ThemedText>
              ))}
            </FlatCard>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill },
  card: { padding: Spacing.three, gap: 6 },
});
