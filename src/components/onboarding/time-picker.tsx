import { StyleSheet, View } from 'react-native';

import { WheelColumn, WheelSelectionBand } from '@/components/onboarding/wheel-column';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { TIME_REGEX } from '@/lib/questionnaire/schema';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export type TimePickerProps = {
  /** "HH:MM" exactly as meal-slots.ts parses it — the picker can't produce anything else. */
  value: string | undefined;
  onChange: (value: string) => void;
  /** The schema's placeholder ("07:30"): where the wheels park while unanswered. */
  placeholder?: string;
  accessibilityLabel: string;
};

function split(time: string | undefined, fallback: string): [number, number] {
  const source = time && TIME_REGEX.test(time) ? time : fallback;
  const [h, m] = source.split(':');
  return [Number(h), Number(m)];
}

/**
 * The questionnaire's meal-time questions as two snapping wheels. Replaces a
 * free-text field that could be left half-typed: the only thing these wheels
 * can emit is a valid HH:MM, and while the user hasn't touched them they
 * stay dimmed and unanswered rather than donating the placeholder as a reply.
 */
export function TimePicker({ value, onChange, placeholder = '08:00', accessibilityLabel }: TimePickerProps) {
  const theme = useTheme();
  const unanswered = value == null || !TIME_REGEX.test(value);
  const [hour, minute] = split(value, placeholder);

  const emit = (h: number, m: number) => onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

  return (
    <View style={styles.root}>
      <View style={styles.wheels}>
        <WheelSelectionBand />
        <WheelColumn
          labels={HOURS}
          index={hour}
          onIndexChange={(i) => emit(i, minute)}
          dimmed={unanswered}
          width={92}
          accessibilityLabel={`${accessibilityLabel} — ore`}
        />
        <ThemedText type="title" themeColor="textSecondary" style={styles.colon}>
          :
        </ThemedText>
        <WheelColumn
          labels={MINUTES}
          index={minute}
          onIndexChange={(i) => emit(hour, i)}
          dimmed={unanswered}
          width={92}
          accessibilityLabel={`${accessibilityLabel} — minuti`}
        />
      </View>
      {unanswered ? (
        <ThemedText type="caption" themeColor="textTertiary" style={{ textAlign: 'center' }}>
          Scorri le ruote per impostare l’orario
        </ThemedText>
      ) : (
        <ThemedText type="caption" style={{ textAlign: 'center', color: theme.textSecondary }}>
          Puoi cambiarlo in qualsiasi momento dal profilo
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  colon: { marginHorizontal: 2 },
});
