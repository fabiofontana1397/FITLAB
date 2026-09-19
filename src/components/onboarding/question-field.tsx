import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { GlassSurface } from '@/components/glass/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AnswerValue } from '@/store/onboarding-store';
import { TIME_REGEX, type Question } from '@/lib/questionnaire/schema';

/** Keeps only digits typed so far and re-inserts the ":" at the right
 * position (e.g. "073" → "07:3", "0730" → "07:30") — lets the user just
 * type digits instead of the punctuation themselves, and makes an
 * unparseable value structurally hard to reach. */
function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export type QuestionFieldProps = {
  question: Question;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
};

export function QuestionField({ question, value, onChange }: QuestionFieldProps) {
  const theme = useTheme();

  if (question.type === 'single' || question.type === 'multi') {
    const isMulti = question.type === 'multi';
    const selected = new Set(isMulti ? ((value as string[]) ?? []) : value ? [value as string] : []);

    const toggle = (optionValue: string) => {
      if (isMulti) {
        const next = new Set(selected);
        if (next.has(optionValue)) next.delete(optionValue);
        else next.add(optionValue);
        onChange([...next]);
      } else {
        onChange(optionValue);
      }
    };

    return (
      <View style={{ gap: Spacing.two }}>
        {question.options?.map((option) => {
          const isSelected = selected.has(option.value);
          return (
            <Pressable key={option.value} onPress={() => toggle(option.value)}>
              <GlassSurface
                level={isSelected ? 'raised' : 'card'}
                radius={Radius.medium}
                style={[styles.optionRow, isSelected && { borderColor: theme.accent, borderWidth: 1.5 }]}>
                <View style={styles.optionInner}>
                  <ThemedText type="small" style={{ flex: 1 }}>
                    {option.label}
                  </ThemedText>
                  <Icon
                    name={isSelected ? 'checkCircle' : isMulti ? 'addCircle' : 'chevronRight'}
                    size={18}
                    color={isSelected ? theme.accent : theme.textTertiary}
                  />
                </View>
              </GlassSurface>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (question.type === 'scale') {
    const min = question.min ?? 1;
    const max = question.max ?? 5;
    const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <View style={styles.scaleRow}>
        {options.map((n) => {
          const isSelected = value === n || value === String(n);
          return (
            <Pressable key={n} onPress={() => onChange(n)} style={styles.scaleCell}>
              <View
                style={[
                  styles.scaleCircle,
                  { backgroundColor: isSelected ? theme.accent : theme.backgroundElement, borderColor: theme.border },
                ]}>
                <ThemedText type="smallBold" style={{ color: isSelected ? theme.onAccent : theme.text }}>
                  {n}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (question.type === 'number') {
    return (
      <View style={styles.numberRow}>
        <TextInput
          value={value != null ? String(value) : ''}
          onChangeText={(text) => onChange(text === '' ? undefined : text)}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={theme.textTertiary}
          style={[styles.numberInput, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        />
        {question.unit ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {question.unit}
          </ThemedText>
        ) : null}
      </View>
    );
  }

  if (question.type === 'time') {
    const text = (value as string) ?? '';
    const isIncomplete = text.length > 0 && text.length < 5;
    const isInvalid = text.length === 5 && !TIME_REGEX.test(text);
    return (
      <View style={{ gap: Spacing.one }}>
        <TextInput
          value={text}
          onChangeText={(raw) => {
            const formatted = formatTimeInput(raw);
            onChange(formatted === '' ? undefined : formatted);
          }}
          keyboardType="number-pad"
          placeholder={question.placeholder}
          placeholderTextColor={theme.textTertiary}
          maxLength={5}
          style={[
            styles.numberInput,
            { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: isInvalid ? theme.danger : theme.border },
          ]}
        />
        {isInvalid || isIncomplete ? (
          <ThemedText type="caption" style={{ color: theme.danger }}>
            Orario non valido — usa il formato HH:MM (es. {question.placeholder ?? '07:30'})
          </ThemedText>
        ) : null}
      </View>
    );
  }

  // text / longtext
  return (
    <TextInput
      value={(value as string) ?? ''}
      onChangeText={(text) => onChange(text === '' ? undefined : text)}
      placeholder={question.placeholder}
      placeholderTextColor={theme.textTertiary}
      multiline={question.type === 'longtext'}
      style={[
        styles.textInput,
        question.type === 'longtext' && styles.longTextInput,
        { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  optionRow: {
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleCell: {
    flex: 1,
    alignItems: 'center',
  },
  scaleCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  numberInput: {
    width: 96,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
  },
  longTextInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
