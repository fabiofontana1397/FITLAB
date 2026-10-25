import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppTextInput } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AuthFieldProps = Omit<TextInputProps, 'style' | 'secureTextEntry'> & {
  label: string;
  /** Password field: shows an eye toggle to reveal what was typed. */
  secure?: boolean;
  /** Message under the field; also flips the border to the danger colour (never colour alone: the text says it too). */
  error?: string | null;
  hint?: string;
};

/**
 * Labelled input for the sign-in / sign-up screens: a focus ring, an inline
 * error, and a show/hide toggle on passwords. It is a plain controlled
 * TextInput underneath, so the screens keep owning value and validation.
 */
export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField({ label, secure, error, hint, onFocus, onBlur, ...rest }, ref) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.root}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View
        style={[
          styles.box,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : focused ? theme.accent : theme.border,
            borderWidth: focused || error ? 1.5 : 1,
          },
        ]}>
        <AppTextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={theme.textTertiary}
          secureTextEntry={secure && !revealed}
          autoCorrect={false}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: theme.text }]}
          {...rest}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Nascondi password' : 'Mostra password'}
            style={styles.eye}>
            <Icon name={revealed ? 'eyeOff' : 'eye'} size={20} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <ThemedText type="caption" style={{ color: theme.danger }} accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: 6 },
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.medium, minHeight: 54, paddingHorizontal: Spacing.three },
  input: { flex: 1, fontSize: 16, paddingVertical: 14, outlineStyle: 'none' } as never,
  eye: { paddingLeft: Spacing.two, height: 44, justifyContent: 'center' },
});
