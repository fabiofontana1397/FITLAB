import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, type TextInput } from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { AuthShell } from '@/components/auth/auth-shell';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useTheme } from '@/hooks/use-theme';
import { goBackOr } from '@/lib/navigation/go-back';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { hapticError, hapticSuccess } from '@/lib/haptics';

export default function LoginScreen() {
  const theme = useTheme();
  const login = useAuthStore((s) => s.login);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = !!email && !!password && !isSubmitting;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    const { error: loginError } = await login(email, password);
    setIsSubmitting(false);
    if (loginError) {
      hapticError();
      setError(loginError);
      return;
    }
    hapticSuccess();
    router.replace(hasOnboarded ? '/' : '/onboarding');
  };

  return (
    <AuthShell
      title="Bentornato"
      subtitle="Accedi con le credenziali del tuo account."
      onBack={() => goBackOr('/welcome')}
      footer={
        <>
          <PrimaryButton label={isSubmitting ? 'Accesso in corso…' : 'Accedi'} onPress={handleLogin} disabled={!canSubmit} />
          <Pressable onPress={() => router.replace('/register')} hitSlop={8} accessibilityRole="button" style={styles.switchRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Non hai un account?{' '}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Creane uno
            </ThemedText>
          </Pressable>
        </>
      }>
      <AuthField
        label="Email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setError(null);
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="tu@esempio.com"
      />
      <AuthField
        ref={passwordRef}
        label="Password"
        secure
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError(null);
        }}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
        placeholder="••••••••"
        error={error}
      />
      <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8} accessibilityRole="button" style={styles.forgot}>
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          Password dimenticata?
        </ThemedText>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', paddingVertical: 4 },
  switchRow: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', paddingVertical: 8 },
});
