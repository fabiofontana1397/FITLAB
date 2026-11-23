import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { appleAvailable, googleConfigured, signInWithApple, signInWithGoogle, type SocialResult } from '@/lib/auth/social';

/** Web: plain buttons that start Supabase's OAuth redirect to Apple or Google (see lib/auth/social.web.ts). */
export function SocialAuthButtons({ mode = 'continue' }: { mode?: 'continue' | 'signIn' }) {
  const theme = useTheme();
  const [apple, setApple] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appleAvailable().then(setApple);
  }, []);

  if (!apple && !googleConfigured) return null;

  const verb = mode === 'signIn' ? 'Accedi' : 'Continua';
  const run = async (fn: () => Promise<SocialResult>) => {
    setError(null);
    const res = await fn();
    if (res.status === 'error') setError(res.message);
  };

  return (
    <View style={styles.wrap}>
      {apple ? (
        <Pressable onPress={() => run(signInWithApple)} accessibilityRole="button" style={[styles.button, { backgroundColor: theme.text }]}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            {verb} con Apple
          </ThemedText>
        </Pressable>
      ) : null}
      {googleConfigured ? (
        <Pressable onPress={() => run(signInWithGoogle)} accessibilityRole="button" style={[styles.button, styles.outline, { borderColor: theme.borderStrong }]}>
          <ThemedText type="smallBold">{verb} con Google</ThemedText>
        </Pressable>
      ) : null}
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger, textAlign: 'center' }}>
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
  button: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  outline: { borderWidth: 1 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
