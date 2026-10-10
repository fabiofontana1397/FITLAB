import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { AppTextInput } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { normalizePreferred, PICKER_PROMPT, PICKER_TITLE } from '@/lib/questionnaire/food-preferences';
import type { Question } from '@/lib/questionnaire/schema';
import type { AnswerValue } from '@/store/onboarding-store';

export type FoodPickerProps = {
  question: Question;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
};

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * "Quali proteine preferisci?": a selector that opens the list of catalog foods of one meal component
 * (grouped by type, with search). The chosen foods show as chips under the selector; the diet engine
 * favours them every month.
 */
export function FoodPicker({ question, value, onChange }: FoodPickerProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const component = question.component!;
  const options = useMemo(() => question.options ?? [], [question.options]);
  const selected = useMemo(() => new Set(normalizePreferred(component, value)), [component, value]);
  const labelOf = (id: string) => options.find((o) => o.value === id)?.label ?? id;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next.size > 0 ? [...next] : undefined);
  };

  const groups = useMemo(() => {
    const q = normalize(query.trim());
    const map = new Map<string, typeof options>();
    for (const o of options) {
      if (q && !normalize(o.label).includes(q) && !normalize(o.group ?? '').includes(q)) continue;
      map.set(o.group ?? '', [...(map.get(o.group ?? '') ?? []), o]);
    }
    return [...map.entries()];
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={{ gap: Spacing.two }}>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={question.label}>
        <GlassSurface level="card" radius={Radius.medium} style={[styles.selector, selected.size > 0 && { borderColor: theme.accent, borderWidth: 1.5 }]}>
          <View style={styles.selectorInner}>
            <ThemedText type="small" style={{ flex: 1 }} themeColor={selected.size > 0 ? undefined : 'textSecondary'}>
              {selected.size > 0 ? `${selected.size} ${selected.size === 1 ? 'alimento selezionato' : 'alimenti selezionati'}` : PICKER_PROMPT[component]}
            </ThemedText>
            <Icon name="chevronDown" size={18} color={theme.textTertiary} />
          </View>
        </GlassSurface>
      </Pressable>

      {selected.size > 0 ? (
        <View style={styles.chips}>
          {[...selected].map((id) => (
            <Pressable key={id} onPress={() => toggle(id)} hitSlop={4} style={[styles.chip, { backgroundColor: theme.accentSoft }]} accessibilityLabel={`Rimuovi ${labelOf(id)}`}>
              <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '600' }}>
                {labelOf(id)}
              </ThemedText>
              <Icon name="close" size={12} color={theme.accent} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* a long list needs a solid card: text showing through a translucent one is hard to read */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Chiudi" />
          <View style={[styles.card, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText type="subtitle">{PICKER_TITLE[component]}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {selected.size > 0 ? `${selected.size} selezionati` : 'Seleziona quelli che ti piacciono'}
            </ThemedText>
          </View>
          <Pressable onPress={close} hitSlop={8} accessibilityLabel="Chiudi">
            <Icon name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <AppTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cerca un alimento"
          placeholderTextColor={theme.textTertiary}
          style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        />

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {groups.length === 0 ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Nessun alimento trovato.
            </ThemedText>
          ) : null}
          {groups.map(([group, items]) => (
            <View key={group} style={{ gap: 4, marginBottom: Spacing.three }}>
              {group ? (
                <ThemedText type="caption" themeColor="textTertiary" style={styles.groupTitle}>
                  {group.toUpperCase()}
                </ThemedText>
              ) : null}
              {items.map((o) => {
                const isSelected = selected.has(o.value);
                return (
                  <Pressable key={o.value} onPress={() => toggle(o.value)} style={[styles.row, { borderColor: isSelected ? theme.accent : 'transparent' }]}>
                    <ThemedText type="small" style={{ flex: 1 }}>
                      {o.label}
                    </ThemedText>
                    <Icon name={isSelected ? 'checkCircle' : 'addCircle'} size={20} color={isSelected ? theme.accent : theme.textTertiary} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <View style={{ gap: Spacing.two }}>
          {selected.size > 0 ? (
            <Pressable onPress={() => onChange(undefined)} hitSlop={8}>
              <ThemedText type="caption" style={{ color: theme.accent, textAlign: 'center', fontWeight: '700' }}>
                Deseleziona tutto
              </ThemedText>
            </Pressable>
          ) : null}
          <PrimaryButton label="Fatto" onPress={close} />
        </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, backgroundColor: 'rgba(0,0,0,0.55)' },
  card: { width: '100%', maxWidth: 420, maxHeight: '90%', borderRadius: Radius.xlarge, borderWidth: 1, padding: Spacing.four, gap: Spacing.three },
  selector: { borderWidth: 1.5, borderColor: 'transparent' },
  selectorInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  search: { borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, paddingVertical: 10, fontSize: 15 },
  list: { maxHeight: 360, flexGrow: 0 },
  groupTitle: { letterSpacing: 0.6, fontWeight: '700', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
});
