import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';

/** Reached only via the password-reset email link (see
 * use-handle-auth-redirect.ts) — by the time this renders, a temporary
 * "recovery" session is already active, which is exactly what
 * supabase.auth.updateUser needs to actually change the password. No
 * back button: there's nothing to go back to mid-recovery. */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = password.length >= 6 && password === confirmPassword && !isSubmitting;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setIsSubmitting(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    router.replace(hasOnboarded ? '/' : '/onboarding');
  };

  return (
    <ScreenScroll>
      <View style={{ gap: Spacing.one }}>
        <ThemedText type="display">Nuova password</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Scegli una nuova password per il tuo account.
        </ThemedText>
      </View>

      <View style={{ gap: Spacing.three }}>
        <View style={{ gap: Spacing.one }}>
          <ThemedText type="label" themeColor="textSecondary">
            Nuova password
          </ThemedText>
          <TextInput
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
            }}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          />
        </View>
        <View style={{ gap: Spacing.one }}>
          <ThemedText type="label" themeColor="textSecondary">
            Conferma password
          </ThemedText>
          <TextInput
            value={confirmPassword}
            onChangeText={(t) => {
              setConfirmPassword(t);
              setError(null);
            }}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          />
        </View>
        {password.length > 0 && password.length < 6 ? (
          <ThemedText type="caption" style={{ color: theme.danger }}>
            Almeno 6 caratteri.
          </ThemedText>
        ) : null}
        {confirmPassword.length > 0 && password !== confirmPassword ? (
          <ThemedText type="caption" style={{ color: theme.danger }}>
            Le password non coincidono.
          </ThemedText>
        ) : null}
        {error ? (
          <ThemedText type="caption" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        ) : null}
      </View>

      <PrimaryButton label="Salva nuova password" onPress={handleSubmit} disabled={!canSubmit} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 15,
  },
});
