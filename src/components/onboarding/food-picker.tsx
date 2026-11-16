import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection } from '@/lib/haptics';
import { normalizePreferred } from '@/lib/questionnaire/food-preferences';
import type { Question } from '@/lib/questionnaire/schema';
import type { AnswerValue } from '@/store/onboarding-store';

export type FoodPickerProps = {
  question: Question;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
};

/**
 * "Quali proteine preferisci?": every catalog food of one meal component laid out on the page as a grid of
 * tappable boxes, grouped by type. One tap selects, a second tap deselects — no menu to open, so a dozen
 * foods take a dozen taps. The diet engine favours the chosen foods every month.
 */
export function FoodPicker({ question, value, onChange }: FoodPickerProps) {
  const theme = useTheme();
  const component = question.component!;
  const options = useMemo(() => question.options ?? [], [question.options]);
  const selected = useMemo(() => new Set(normalizePreferred(component, value)), [component, value]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof options>();
    for (const o of options) map.set(o.group ?? '', [...(map.get(o.group ?? '') ?? []), o]);
    return [...map.entries()];
  }, [options]);

  const toggle = (id: string) => {
    hapticSelection();
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next.size > 0 ? [...next] : undefined);
  };

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={styles.counterRow}>
        <ThemedText type="caption" themeColor={selected.size > 0 ? undefined : 'textSecondary'} style={selected.size > 0 ? { color: theme.accent, fontWeight: '700' } : undefined}>
          {selected.size > 0 ? `${selected.size} ${selected.size === 1 ? 'alimento selezionato' : 'alimenti selezionati'}` : 'Tocca gli alimenti che ti piacciono'}
        </ThemedText>
        {selected.size > 0 ? (
          <Pressable onPress={() => onChange(undefined)} hitSlop={8} accessibilityRole="button">
            <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '700' }}>
              Deseleziona tutto
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {groups.map(([group, items]) => (
        <View key={group} style={{ gap: Spacing.two }}>
          {group ? (
            <ThemedText type="caption" themeColor="textTertiary" style={styles.groupTitle}>
              {group.toUpperCase()}
            </ThemedText>
          ) : null}
          {pairs(items).map((row) => (
          <View key={row[0].value} style={styles.row}>
            {row.map((o) => {
              const isSelected = selected.has(o.value);
              return (
                <Pressable
                  key={o.value}
                  onPress={() => toggle(o.value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={o.label}
                  style={({ pressed }) => [
                    styles.tile,
                    {
                      backgroundColor: isSelected ? theme.accentSoft : theme.backgroundElement,
                      borderColor: isSelected ? theme.accent : theme.boxEdge,
                      borderWidth: isSelected ? 1.5 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}>
                  <ThemedText type="small" numberOfLines={2} style={[styles.tileLabel, isSelected && { color: theme.accent, fontWeight: '700' }]}>
                    {o.label}
                  </ThemedText>
                  <View
                    style={[
                      styles.mark,
                      { borderColor: isSelected ? theme.accent : theme.borderStrong, backgroundColor: isSelected ? theme.accent : 'transparent' },
                    ]}>
                    {isSelected ? <Icon name="check" size={12} color={theme.onAccent} /> : null}
                  </View>
                </Pressable>
              );
            })}
            {/* an odd last box keeps half the width instead of stretching across the row */}
            {row.length === 1 ? <View style={styles.spacer} /> : null}
          </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Two boxes per row on a phone. */
function pairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

const styles = StyleSheet.create({
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  groupTitle: { letterSpacing: 0.6, fontWeight: '700' },
  row: { flexDirection: 'row', gap: Spacing.two },
  spacer: { flex: 1 },
  tile: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderRadius: Radius.medium,
  },
  tileLabel: { flex: 1 },
  mark: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
