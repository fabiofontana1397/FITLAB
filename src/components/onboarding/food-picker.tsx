import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PhotoTile } from '@/components/ui/photo-tile';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticSelection } from '@/lib/haptics';
import { foodIcon } from '@/lib/nutrition/food-icons';
import { foodPhoto } from '@/lib/nutrition/food-photos';
import { normalizePreferred } from '@/lib/questionnaire/food-preferences';
import type { Question } from '@/lib/questionnaire/schema';
import type { AnswerValue } from '@/store/onboarding-store';

export type FoodPickerProps = {
  question: Question;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
};

const COLUMNS = 3;
const GAP = Spacing.two;

/**
 * "Quali proteine preferisci?": every catalog food of one meal component laid out on the page as a
 * three-column grid of boxes — the food's picture with its name centred underneath — grouped by type.
 * One tap selects, a second tap deselects. The diet engine favours the chosen foods every month.
 */
export function FoodPicker({ question, value, onChange }: FoodPickerProps) {
  const theme = useTheme();
  const [gridWidth, setGridWidth] = useState(0);
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

  // Box width from the measured column, so three always fit whatever the phone.
  const tileWidth = gridWidth > 0 ? Math.floor((gridWidth - GAP * (COLUMNS - 1)) / COLUMNS) : 0;
  const photoSize = Math.max(0, tileWidth - Spacing.two * 2);

  return (
    <View style={{ gap: Spacing.three }} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
      <View style={styles.counterRow}>
        <ThemedText
          type="caption"
          themeColor={selected.size > 0 ? undefined : 'textSecondary'}
          style={selected.size > 0 ? { color: theme.accent, fontWeight: '700' } : undefined}>
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

      {tileWidth > 0
        ? groups.map(([group, items]) => (
            <View key={group} style={{ gap: Spacing.two }}>
              {group ? (
                <ThemedText type="caption" themeColor="textTertiary" style={styles.groupTitle}>
                  {group.toUpperCase()}
                </ThemedText>
              ) : null}
              <View style={styles.grid}>
                {items.map((o) => {
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
                          width: tileWidth,
                          backgroundColor: isSelected ? theme.accentSoft : theme.backgroundElement,
                          borderColor: isSelected ? theme.accent : theme.boxEdge,
                          transform: [{ scale: pressed ? 0.96 : 1 }],
                        },
                      ]}>
                      <PhotoTile
                        source={foodPhoto(o.value) ?? foodIcon(o.value)}
                        width={photoSize}
                        radius={Radius.small}
                        background="#FFFFFF"
                        recyclingKey={o.value}
                        fallback={<Icon name="utensils" size={Math.round(photoSize * 0.4)} color={theme.textTertiary} />}
                      />
                      <ThemedText
                        type="caption"
                        numberOfLines={2}
                        style={[styles.tileLabel, isSelected && { color: theme.accent, fontWeight: '700' }]}>
                        {o.label}
                      </ThemedText>
                      {isSelected ? (
                        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                          <Icon name="check" size={12} color={theme.onAccent} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  groupTitle: { letterSpacing: 0.6, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    alignItems: 'center',
    gap: 6,
    padding: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: 1.5,
  },
  // two lines reserved even for short names, so every box in a row has the same height
  tileLabel: { textAlign: 'center', minHeight: 36, fontWeight: '600' },
  badge: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
