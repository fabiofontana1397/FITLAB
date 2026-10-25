import { router } from 'expo-router';
import { useState } from 'react';

import { AuthField } from '@/components/auth/auth-field';
import { AuthShell } from '@/components/auth/auth-shell';
import { PrimaryButton } from '@/components/ui/primary-button';
import { goBackOr } from '@/lib/navigation/go-back';
import { useAuthStore } from '@/store/auth-store';

export default function ForgotPasswordScreen() {
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = email.includes('@') && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
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

  if (sent) {
    return (
      <AuthShell
        icon="mail"
        title="Controlla la tua email"
        subtitle={`Se esiste un account per ${email.trim()}, ti abbiamo inviato un link per reimpostare la password.`}
        onBack={() => goBackOr('/login')}
        footer={<PrimaryButton label="Torna al login" onPress={() => router.replace('/login')} />}
      />
    );
  }

  return (
    <AuthShell
      title="Password dimenticata?"
      subtitle="Inserisci la tua email: ti mandiamo un link per reimpostarla."
      onBack={() => goBackOr('/login')}
      footer={
        <>
          <PrimaryButton label={isSubmitting ? 'Invio in corso…' : 'Invia link'} onPress={handleSubmit} disabled={!canSubmit} />
          <PrimaryButton label="Torna al login" variant="ghost" onPress={() => router.replace('/login')} />
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
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        placeholder="tu@esempio.com"
        error={error}
      />
    </AuthShell>
  );
}
