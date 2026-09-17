import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase/client';

/**
 * Supabase's default email templates send the user back to `redirectTo`
 * with the session in the URL hash (`#access_token=...&refresh_token=...
 * &type=signup|recovery|...`) rather than a session already active in
 * this browser — the client's `detectSessionInUrl` is off (see
 * lib/supabase/client.ts's comment on SSR), so nothing picks this up
 * automatically. Runs once on mount (web only; native deep links carry
 * the same params but through Linking, not a page URL, and aren't wired
 * up yet — this app isn't shipping to app stores in this phase).
 */
export function useHandleAuthRedirect() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');
    if (!accessToken || !refreshToken) return;

    // Strip the tokens from the address bar immediately regardless of
    // outcome — they're single-use, but still sensitive to leave visible
    // (e.g. in browser history) any longer than necessary.
    window.history.replaceState(null, '', window.location.pathname);

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        console.warn('auth redirect setSession failed', error);
        return;
      }
      // Every other type (signup confirmation, invite, magic link) just
      // means "you're now signed in" — AuthGate's normal onboarded/not
      // routing takes over from here. Recovery is the one case that must
      // NOT drop the user straight into the app with a stranger's-length-
      // old password still set.
      if (type === 'recovery') router.replace('/reset-password');
    });
  }, []);
}
