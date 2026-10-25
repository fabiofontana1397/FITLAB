import { router } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { AuthShell } from '@/components/auth/auth-shell';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';

/** Reached only via the password-reset email link (see
 * use-handle-auth-redirect.ts) — by the time this renders, a temporary
 * "recovery" session is already active, which is exactly what
 * supabase.auth.updateUser needs to actually change the password. No
 * back button: there's nothing to go back to mid-recovery. */
export default function ResetPasswordScreen() {
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const canSubmit = password.length >= 6 && password === confirmPassword && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setIsSubmitting(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    router.replace(hasOnboarded ? '/' : '/onboarding');
  };

  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <AuthShell
      title="Nuova password"
      subtitle="Scegli una nuova password per il tuo account."
      footer={<PrimaryButton label={isSubmitting ? 'Salvataggio…' : 'Salva nuova password'} onPress={handleSubmit} disabled={!canSubmit} />}>
      <AuthField
        label="Nuova password"
        secure
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError(null);
        }}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        placeholder="••••••••"
        error={tooShort ? 'Almeno 6 caratteri.' : null}
      />
      <AuthField
        ref={confirmRef}
        label="Conferma password"
        secure
        value={confirmPassword}
        onChangeText={(t) => {
          setConfirmPassword(t);
          setError(null);
        }}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        placeholder="••••••••"
        error={mismatch ? 'Le password non coincidono.' : error}
      />
    </AuthShell>
  );
}
