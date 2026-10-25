import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RulerPicker } from '@/components/onboarding/ruler-picker';
import { ThemedText } from '@/components/themed-text';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  cmToInches,
  inchesToCm,
  kgToLb,
  lbToKg,
  roundToStep,
  type LengthUnit,
  type MassUnit,
} from '@/lib/questionnaire/units';

/** Shared read-out: the value in display type with its unit beside it. */
function Readout({ text, unit }: { text: string; unit: string }) {
  const theme = useTheme();
  return (
    <View style={styles.readoutRow}>
      <ThemedText style={[styles.readoutValue, { color: theme.text }]}>{text}</ThemedText>
      <ThemedText type="title" themeColor="textSecondary" style={styles.readoutUnit}>
        {unit}
      </ThemedText>
    </View>
  );
}

export type HeightPickerProps = {
  /** Centimetres — the questionnaire's canonical unit, whatever is on screen. */
  value: number | undefined;
  onChange: (cm: number) => void;
  min: number;
  max: number;
};

/** The `heightCm` question: a vertical tape measure, in cm or feet/inches. */
export function HeightPicker({ value, onChange, min, max }: HeightPickerProps) {
  const [unit, setUnit] = useState<LengthUnit>('cm');
  const metric = unit === 'cm';

  return (
    <View style={styles.root}>
      <View style={styles.toggle}>
        <SegmentedControl
          options={[
            { value: 'cm', label: 'cm' },
            { value: 'ftin', label: 'ft/in' },
          ]}
          value={unit}
          onChange={setUnit}
        />
      </View>
      {metric ? (
        <RulerPicker
          axis="vertical"
          min={min}
          max={max}
          step={1}
          majorEvery={10}
          value={value}
          fallback={175}
          onChange={(cm) => onChange(Math.round(cm))}
          formatMajor={(cm) => String(Math.round(cm))}
          renderValue={(cm) => <Readout text={String(Math.round(cm))} unit="cm" />}
          accessibilityLabel="Altezza in centimetri"
        />
      ) : (
        <RulerPicker
          axis="vertical"
          min={Math.ceil(cmToInches(min))}
          max={Math.floor(cmToInches(max))}
          step={1}
          majorEvery={6}
          value={value != null ? cmToInches(value) : undefined}
          fallback={cmToInches(175)}
          onChange={(inches) => onChange(Math.round(inchesToCm(inches)))}
          formatMajor={(inches) => feetInchesLabel(inches)}
          renderValue={(inches) => <Readout text={feetInchesLabel(inches)} unit="" />}
          accessibilityLabel="Altezza in piedi e pollici"
        />
      )}
    </View>
  );
}

function feetInchesLabel(totalInches: number): string {
  const rounded = Math.round(totalInches);
  return `${Math.floor(rounded / 12)}' ${rounded % 12}"`;
}

export type WeightPickerProps = {
  /** Kilograms — the questionnaire's canonical unit, whatever is on screen. */
  value: number | undefined;
  onChange: (kg: number) => void;
  min: number;
  max: number;
  fallbackKg?: number;
};

/** The `currentWeightKg` / `targetWeightKg` questions: a horizontal ruler in kg or lb. */
export function WeightPicker({ value, onChange, min, max, fallbackKg = 75 }: WeightPickerProps) {
  const [unit, setUnit] = useState<MassUnit>('kg');
  const metric = unit === 'kg';

  return (
    <View style={styles.root}>
      <View style={styles.toggle}>
        <SegmentedControl
          options={[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lb' },
          ]}
          value={unit}
          onChange={setUnit}
        />
      </View>
      {metric ? (
        <RulerPicker
          axis="horizontal"
          min={min}
          max={max}
          step={0.1}
          majorEvery={10}
          value={value}
          fallback={fallbackKg}
          onChange={(kg) => onChange(roundToStep(kg, 0.1))}
          formatMajor={(kg) => String(Math.round(kg))}
          renderValue={(kg) => <Readout text={kg.toFixed(1).replace('.', ',')} unit="kg" />}
          accessibilityLabel="Peso in chilogrammi"
        />
      ) : (
        <RulerPicker
          axis="horizontal"
          min={Math.ceil(kgToLb(min))}
          max={Math.floor(kgToLb(max))}
          step={0.2}
          majorEvery={5}
          value={value != null ? kgToLb(value) : undefined}
          fallback={kgToLb(fallbackKg)}
          // Back to kilograms at the stored precision: the ruler is a view on
          // the answer, never a second place the answer lives.
          onChange={(lb) => onChange(roundToStep(lbToKg(lb), 0.1))}
          formatMajor={(lb) => String(Math.round(lb))}
          renderValue={(lb) => <Readout text={lb.toFixed(1).replace('.', ',')} unit="lb" />}
          accessibilityLabel="Peso in libbre"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.four },
  toggle: { alignSelf: 'center', minWidth: 160 },
  readoutRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  readoutValue: { fontSize: 52, lineHeight: 58, fontWeight: '700', letterSpacing: -1.6, fontVariant: ['tabular-nums'] },
  readoutUnit: { fontWeight: '600' },
});
