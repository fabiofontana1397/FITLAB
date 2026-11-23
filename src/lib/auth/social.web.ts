/**
 * Web build: Sign in with Apple and Google through Supabase's OAuth redirect. The browser leaves for the provider
 * and comes back to the site with the session in the URL hash, picked up by hooks/use-handle-auth-redirect.ts.
 * The site origin must be in Supabase Auth → URL Configuration → Redirect URLs.
 */
import { authRedirectUrl } from '@/lib/supabase/auth-redirect';
import { supabase } from '@/lib/supabase/client';

export type SocialResult = { status: 'ok'; name?: string } | { status: 'cancelled' } | { status: 'error'; message: string };

/** On the web both go through Supabase: shown when the public flag says the providers are enabled there. */
export const googleConfigured = process.env.EXPO_PUBLIC_SOCIAL_LOGIN_WEB === 'true';

export async function appleAvailable(): Promise<boolean> {
  return process.env.EXPO_PUBLIC_SOCIAL_LOGIN_WEB === 'true';
}

async function oauth(provider: 'apple' | 'google'): Promise<SocialResult> {
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: authRedirectUrl() } });
  // On success the page navigates away: this result is only read on failure.
  return error ? { status: 'error', message: 'Accesso non riuscito. Riprova.' } : { status: 'ok' };
}

export const signInWithApple = () => oauth('apple');
export const signInWithGoogle = () => oauth('google');

export async function signOutSocial(): Promise<void> {}

export async function appleAuthorizationCodeForDeletion(): Promise<string | null> {
  return null;
}
