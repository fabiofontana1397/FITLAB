import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { QuestionOption } from '@/lib/questionnaire/schema';

export type SelectFieldProps = {
  options: QuestionOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
};

/** Single choice as a drop-down: one line showing the current answer, the options unfold under it on tap and fold back once one is picked. */
export function SelectField({ options, value, onChange, placeholder = 'Seleziona' }: SelectFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <GlassSurface level="card" radius={Radius.medium} style={[styles.box, (open || current) && { borderColor: open ? theme.accent : theme.border }]}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.header} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <ThemedText type="small" style={{ flex: 1 }} themeColor={current ? undefined : 'textTertiary'}>
          {current?.label ?? placeholder}
        </ThemedText>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} color={theme.textTertiary} />
      </Pressable>
      {open ? (
        <View style={[styles.list, { borderTopColor: theme.border }]}>
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={[styles.option, selected && { backgroundColor: theme.accentSoft }]}>
                <ThemedText type="small" style={[{ flex: 1 }, selected && { color: theme.accent, fontWeight: '700' }]}>
                  {o.label}
                </ThemedText>
                {selected ? <Icon name="check" size={16} color={theme.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: 'transparent', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: 12 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: 10 },
});
