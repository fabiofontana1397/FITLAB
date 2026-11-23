import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { appleAvailable, googleConfigured, loadGoogleModule, signInWithApple, signInWithGoogle, type SocialResult } from '@/lib/auth/social';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { useUserStore } from '@/store/user-store';

const BUTTON_HEIGHT = 50;

/**
 * "Accedi con Apple" (iOS, Apple's own button as the HIG require) and "Accedi con Google" (Google's own button).
 * Shown on Welcome and Login. A new account goes through the same gate as an email sign-up: consents first,
 * then the questionnaire.
 */
export function SocialAuthButtons({ mode = 'continue' }: { mode?: 'continue' | 'signIn' }) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const updateProfile = useUserStore((s) => s.updateProfile);
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appleAvailable().then(setApple);
  }, []);

  const GoogleSigninButton = googleConfigured ? loadGoogleModule()?.GoogleSigninButton : undefined;
  if (!apple && !GoogleSigninButton) return null;

  const run = async (fn: () => Promise<SocialResult>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (res.status === 'cancelled') return;
    if (res.status === 'error') {
      hapticError();
      setError(res.message);
      return;
    }
    hapticSuccess();
    if (res.name) updateProfile({ name: res.name });
    router.replace('/');
  };

  return (
    <View style={styles.wrap}>
      {apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={mode === 'signIn' ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={scheme === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={BUTTON_HEIGHT / 2}
          style={styles.button}
          onPress={() => run(signInWithApple)}
        />
      ) : null}
      {GoogleSigninButton ? (
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={scheme === 'dark' ? GoogleSigninButton.Color.Dark : GoogleSigninButton.Color.Light}
          onPress={() => run(signInWithGoogle)}
          disabled={busy}
          style={[styles.button, Platform.OS === 'android' && styles.androidGoogle]}
        />
      ) : null}
      {error ? (
        <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
          {error}
        </ThemedText>
      ) : null}
      <View style={styles.dividerRow}>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
        <ThemedText type="caption" themeColor="textSecondary">
          oppure con email
        </ThemedText>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, alignSelf: 'stretch' },
  button: { width: '100%', height: BUTTON_HEIGHT },
  androidGoogle: { height: 56 },
  error: { textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
