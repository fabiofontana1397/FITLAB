import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/auth-store';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const { error: resetError } = await requestPasswordReset(email.trim());
    setIsSubmitting(false);
    // Never reveal whether the address actually has an account — that's
    // exactly the kind of detail a real reset flow shouldn't leak, and
    // GoTrue itself doesn't error for a non-existent email.
    if (resetError) {
      setError(resetError);
      return;
    }
    setSent(true);
  };

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Icon name="arrowBack" size={22} color={theme.text} />
        </Pressable>
      </View>

      {sent ? (
        <View style={{ gap: Spacing.one }}>
          <ThemedText type="display">Controlla la tua email</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Se esiste un account per {email.trim()}, ti abbiamo inviato un link per reimpostare la password.
          </ThemedText>
        </View>
      ) : (
        <>
          <View style={{ gap: Spacing.one }}>
            <ThemedText type="display">Password dimenticata?</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Inserisci la tua email: ti mandiamo un link per reimpostarla.
            </ThemedText>
          </View>

          <View style={{ gap: Spacing.three }}>
            <View style={{ gap: Spacing.one }}>
              <ThemedText type="label" themeColor="textSecondary">
                Email
              </ThemedText>
              <TextInput
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="tu@esempio.com"
                placeholderTextColor={theme.textTertiary}
                style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
              />
            </View>
            {error ? (
              <ThemedText type="caption" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            ) : null}
          </View>

          <PrimaryButton label="Invia link" onPress={handleSubmit} disabled={!email.includes('@') || isSubmitting} />
        </>
      )}

      <Pressable onPress={() => router.replace('/login')} hitSlop={8}>
        <ThemedText type="caption" style={{ textAlign: 'center', color: theme.accent }}>
          Torna al login
        </ThemedText>
      </Pressable>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 15,
  },
});
