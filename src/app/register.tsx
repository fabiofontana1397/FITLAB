import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ScreenScroll } from '@/components/screen-scroll';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { goBackOr } from '@/lib/navigation/go-back';
import { useAuthStore } from '@/store/auth-store';
import { useUserStore } from '@/store/user-store';

export default function RegisterScreen() {
  const theme = useTheme();
  const register = useAuthStore((s) => s.register);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  // Supabase's own minimum_password_length default (see supabase/config.toml).
  const canSubmit = name.trim().length > 0 && email.includes('@') && password.length >= 6 && !isSubmitting;

  const handleRegister = async () => {
    setIsSubmitting(true);
    const { error: registerError, needsEmailConfirmation: pending } = await register(name.trim(), email.trim(), password);
    setIsSubmitting(false);
    if (registerError) {
      setError(registerError);
      return;
    }
    if (pending) {
      setNeedsEmailConfirmation(true);
      return;
    }
    updateProfile({ name: name.trim() });
    router.replace('/onboarding');
  };

  if (needsEmailConfirmation) {
    return (
      <ScreenScroll>
        <View style={{ gap: Spacing.one }}>
          <ThemedText type="display">Conferma la tua email</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Ti abbiamo mandato un link di conferma a {email.trim()}. Aprilo per attivare l&apos;account, poi torna qui.
          </ThemedText>
        </View>
        <Pressable onPress={() => router.replace('/login')} hitSlop={8}>
          <ThemedText type="caption" style={{ textAlign: 'center', color: theme.accent }}>
            Torna al login
          </ThemedText>
        </Pressable>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <Pressable onPress={() => goBackOr('/welcome')} hitSlop={8}>
          <Icon name="arrowBack" size={22} color={theme.text} />
        </Pressable>
      </View>

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="display">Crea il tuo account</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Poi ti faremo qualche domanda per costruire il tuo piano su misura.
        </ThemedText>
      </View>

      <View style={{ gap: Spacing.three }}>
        <Field label="Nome" value={name} onChangeText={setName} placeholder="Il tuo nome" theme={theme} />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="tu@esempio.com"
          keyboardType="email-address"
          autoCapitalize="none"
          theme={theme}
        />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry theme={theme} />
        {error ? (
          <ThemedText type="caption" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        ) : null}
      </View>

      <PrimaryButton label="Continua" onPress={handleRegister} disabled={!canSubmit} />

      <Pressable onPress={() => router.replace('/login')} hitSlop={8}>
        <ThemedText type="caption" style={{ textAlign: 'center', color: theme.accent }}>
          Hai già un account? Accedi
        </ThemedText>
      </Pressable>
    </ScreenScroll>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address';
  autoCapitalize?: 'none';
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
      />
    </View>
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
