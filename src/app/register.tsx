import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, type TextInput } from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { AuthShell } from '@/components/auth/auth-shell';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useTheme } from '@/hooks/use-theme';
import { goBackOr } from '@/lib/navigation/go-back';
import { useAuthStore } from '@/store/auth-store';
import { useUserStore } from '@/store/user-store';
import { hapticError, hapticSuccess } from '@/lib/haptics';

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
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Supabase's own minimum_password_length default (see supabase/config.toml).
  const canSubmit = name.trim().length > 0 && email.includes('@') && password.length >= 6 && !isSubmitting;

  const handleRegister = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    const { error: registerError, needsEmailConfirmation: pending } = await register(name.trim(), email.trim(), password);
    setIsSubmitting(false);
    if (registerError) {
      hapticError();
      setError(registerError);
      return;
    }
    hapticSuccess();
    if (pending) {
      setNeedsEmailConfirmation(true);
      return;
    }
    updateProfile({ name: name.trim() });
    router.replace('/onboarding');
  };

  if (needsEmailConfirmation) {
    return (
      <AuthShell
        icon="mail"
        title="Conferma la tua email"
        subtitle={`Ti abbiamo mandato un link di conferma a ${email.trim()}. Aprilo per attivare l'account, poi torna qui.`}
        footer={<PrimaryButton label="Torna al login" onPress={() => router.replace('/login')} />}
      />
    );
  }

  return (
    <AuthShell
      title="Crea il tuo account"
      subtitle="Poi ti faremo qualche domanda per costruire il tuo piano su misura."
      onBack={() => goBackOr('/welcome')}
      footer={
        <>
          <PrimaryButton label={isSubmitting ? 'Creazione in corso…' : 'Continua'} onPress={handleRegister} disabled={!canSubmit} />
          <Pressable onPress={() => router.replace('/login')} hitSlop={8} accessibilityRole="button" style={styles.switchRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Hai già un account?{' '}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Accedi
            </ThemedText>
          </Pressable>
        </>
      }>
      <AuthField
        label="Nome"
        value={name}
        onChangeText={setName}
        placeholder="Il tuo nome"
        autoComplete="given-name"
        textContentType="givenName"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <AuthField
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@esempio.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <AuthField
        ref={passwordRef}
        label="Password"
        secure
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleRegister}
        hint="Almeno 6 caratteri."
        error={error}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', paddingVertical: 8 },
});
