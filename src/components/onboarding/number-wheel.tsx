import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { WheelColumn, WheelSelectionBand, WHEEL_HEIGHT } from '@/components/onboarding/wheel-column';
import { ThemedText } from '@/components/themed-text';
import { AppTextInput } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { hapticSelection } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';

export type NumberWheelProps = {
  min: number;
  max: number;
  step?: number;
  /** undefined = not answered yet: the wheel parks on `fallback`, dimmed, and
   * writes nothing until the user actually moves it. */
  value: number | undefined;
  fallback: number;
  onChange: (value: number) => void;
  suffix?: string;
  accessibilityLabel: string;
};

/**
 * iOS-style vertical wheel for a whole-number answer (the questionnaire's
 * age, and any other `number` question without a purpose-built picker).
 *
 * An untouched wheel is explicitly *not* an answer: it shows the parking
 * value at low contrast, and the screen's Continua button stays disabled
 * until a real value is committed — so a default can never be mistaken for
 * something the user chose. The steppers and "inserisci manualmente" are
 * the keyboard/VoiceOver route to the same values.
 */
export function NumberWheel({ min, max, step = 1, value, fallback, onChange, suffix, accessibilityLabel }: NumberWheelProps) {
  const theme = useTheme();
  const [manual, setManual] = useState(false);
  const [draft, setDraft] = useState('');
  const items = useMemo(() => {
    const next: number[] = [];
    for (let v = min; v <= max; v += step) next.push(Number(v.toFixed(2)));
    return next;
  }, [min, max, step]);

  const indexOf = (n: number) => Math.min(items.length - 1, Math.max(0, Math.round((Math.min(max, Math.max(min, n)) - min) / step)));
  const index = indexOf(value ?? fallback);

  const stepBy = (delta: number) => {
    const next = items[Math.min(items.length - 1, Math.max(0, index + delta))];
    if (next === value) return;
    hapticSelection();
    onChange(next);
  };

  const applyManual = () => {
    const parsed = Number(draft.replace(',', '.'));
    if (Number.isFinite(parsed) && draft.trim() !== '') onChange(items[indexOf(parsed)]);
    setManual(false);
  };

  if (manual) {
    return (
      <View style={styles.manualWrap}>
        <AppTextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          keyboardType="number-pad"
          onSubmitEditing={applyManual}
          onBlur={applyManual}
          accessibilityLabel={accessibilityLabel}
          placeholder={String(value ?? fallback)}
          placeholderTextColor={theme.textTertiary}
          style={[styles.manualInput, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.accent }]}
        />
        <Pressable onPress={applyManual} hitSlop={8} accessibilityRole="button">
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Fatto
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.wheelRow}>
        <StepperButton icon="minus" onPress={() => stepBy(-1)} label={`Diminuisci: ${accessibilityLabel}`} disabled={index === 0} />
        <View style={styles.wheelWrap}>
          <WheelSelectionBand />
          <WheelColumn
            labels={items.map(String)}
            index={index}
            onIndexChange={(i) => onChange(items[i])}
            dimmed={value == null}
            accessibilityLabel={accessibilityLabel}
          />
          {suffix ? (
            <ThemedText type="subtitle" themeColor="textSecondary" style={styles.suffix}>
              {suffix}
            </ThemedText>
          ) : null}
        </View>
        <StepperButton icon="plus" onPress={() => stepBy(1)} label={`Aumenta: ${accessibilityLabel}`} disabled={index === items.length - 1} />
      </View>

      <Pressable
        onPress={() => {
          setDraft(value != null ? String(value) : '');
          setManual(true);
        }}
        hitSlop={8}
        accessibilityRole="button">
        <ThemedText type="caption" style={{ color: theme.accent, textAlign: 'center', fontWeight: '700' }}>
          {value == null ? 'Scorri per selezionare · oppure inserisci manualmente' : 'Inserisci manualmente'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function StepperButton({ icon, onPress, label, disabled }: { icon: 'minus' | 'plus'; onPress: () => void; label: string; disabled: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.stepper, { backgroundColor: theme.backgroundSelected, opacity: disabled ? 0.4 : 1 }]}>
      <Icon name={icon} size={22} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three, alignItems: 'center' },
  wheelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  wheelWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  suffix: { marginLeft: Spacing.two },
  stepper: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  manualWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.three, height: WHEEL_HEIGHT },
  manualInput: {
    width: 150,
    borderWidth: 1.5,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
});
