import { Pressable, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { DEMO_CONFIG, stepValue, type DemoPreset, type DemoValues } from '@/lib/energy-guide/demo-example';
import { formatKcal } from '@/lib/format-kcal';

const PRESETS: { key: DemoPreset; label: string }[] = [
  { key: 'deficit', label: 'Deficit' },
  { key: 'even', label: 'Equilibrio' },
  { key: 'surplus', label: 'Surplus' },
];

export type DemoControlsProps = {
  values: DemoValues;
  onChange: (values: DemoValues) => void;
  onPreset: (preset: DemoPreset) => void;
  onReset: () => void;
};

/** The example's knobs, shared by every page: change a value here and all four charts follow. */
export function DemoControls({ values, onChange, onPreset, onReset }: DemoControlsProps) {
  const theme = useTheme();
  const { eaten, extraActivity } = DEMO_CONFIG;

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.head}>
        <ThemedText style={styles.title}>Prova a cambiare l’esempio</ThemedText>
        <Pressable onPress={onReset} hitSlop={8} accessibilityRole="button" accessibilityLabel="Ripristina l’esempio">
          <ThemedText style={[styles.reset, { color: theme.accent }]}>Ripristina</ThemedText>
        </Pressable>
      </View>

      <Stepper
        icon="utensils"
        color={theme.brandGreen}
        label="Calorie assunte"
        value={values.eatenKcal}
        min={eaten.min}
        max={eaten.max}
        step={eaten.step}
        onChange={(eatenKcal) => onChange({ ...values, eatenKcal })}
      />
      <Stepper
        icon="footsteps"
        color={theme.brandYellow}
        label="Attività extra"
        value={values.extraActivityKcal}
        min={extraActivity.min}
        max={extraActivity.max}
        step={extraActivity.step}
        onChange={(extraActivityKcal) => onChange({ ...values, extraActivityKcal })}
      />

      <View style={styles.presets} accessibilityRole="radiogroup">
        {PRESETS.map((p) => (
          <PressableScale
            key={p.key}
            onPress={() => onPreset(p.key)}
            accessibilityRole="button"
            accessibilityLabel={`Esempio in ${p.label.toLowerCase()}`}
            style={[styles.preset, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <ThemedText style={styles.presetText}>{p.label}</ThemedText>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

function Stepper({
  icon,
  color,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const down = stepValue(value, -1, { min, max, step });
  const up = stepValue(value, 1, { min, max, step });

  return (
    <View style={styles.stepper}>
      <Icon name={icon} size={18} color={color} />
      <ThemedText style={styles.stepLabel}>{label}</ThemedText>
      <StepButton icon="minus" disabled={value <= min} onPress={() => onChange(down)} label={`Diminuisci ${label.toLowerCase()}`} />
      <ThemedText style={styles.stepValue} accessibilityLiveRegion="polite">
        {formatKcal(value)} kcal
      </ThemedText>
      <StepButton icon="addCircleOutline" disabled={value >= max} onPress={() => onChange(up)} label={`Aumenta ${label.toLowerCase()}`} />
    </View>
  );
}

function StepButton({ icon, disabled, onPress, label }: { icon: IconName; disabled: boolean; onPress: () => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}>
      <Icon name={icon} size={26} color={disabled ? theme.textTertiary : theme.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  reset: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepLabel: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  stepValue: {
    minWidth: 82,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  presets: {
    flexDirection: 'row',
    gap: 8,
  },
  preset: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  presetText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
});
