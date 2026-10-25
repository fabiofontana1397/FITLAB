import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type OnboardingFooterProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Only ever offered for questions the schema itself marks optional. */
  secondary?: { label: string; onPress: () => void };
  /** Shown above the button — a validation hint or a derived fact about the answer. */
  note?: string;
};

export function OnboardingFooter({ label, onPress, disabled, secondary, note }: OnboardingFooterProps) {
  const theme = useTheme();
  return (
    <View style={styles.root}>
      {note ? (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.note}>
          {note}
        </ThemedText>
      ) : null}
      <PrimaryButton label={label} onPress={onPress} disabled={disabled} />
      {secondary ? (
        <Pressable onPress={secondary.onPress} hitSlop={8} accessibilityRole="button" style={styles.secondary}>
          <ThemedText type="smallBold" style={{ color: theme.textSecondary }}>
            {secondary.label}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.two },
  note: { textAlign: 'center' },
  secondary: { alignSelf: 'center', paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
});
