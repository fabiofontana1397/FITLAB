import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { authRedirectUrl } from '@/lib/supabase/auth-redirect';
import { supabase } from '@/lib/supabase/client';

// GoTrue's error messages are English-only — translating the handful a
// user can actually hit keeps error text consistent with the rest of the
// (all-Italian) UI. Falls back to the original message for anything not
// listed rather than hiding a real error behind a generic one.
const ERROR_TRANSLATIONS: Record<string, string> = {
  'Invalid login credentials': 'Email o password non corrette.',
  'Email not confirmed': 'Devi confermare la tua email prima di accedere. Controlla la posta.',
  'User already registered': 'Esiste già un account con questa email.',
  'Password should be at least 6 characters': 'La password deve avere almeno 6 caratteri.',
  'Unable to validate email address: invalid format': "L'indirizzo email non è valido.",
  'For security purposes, you can only request this after 60 seconds':
    'Per sicurezza puoi richiederlo di nuovo solo dopo 60 secondi.',
};

function translateAuthError(message: string | undefined): string | null {
  if (!message) return null;
  return ERROR_TRANSLATIONS[message] ?? message;
}

type AuthState = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  // True until the initial getSession() resolves — replaces the old
  // zustand-persist "hydrated" check in _layout.tsx, since the session is
  // now supabase-js's own concern, not a second persisted copy of it.
  isLoading: boolean;
  // `needsEmailConfirmation: true` means signUp succeeded but GoTrue
  // requires confirming the address before a session exists (no error,
  // but also nothing to log in with yet) — the caller should show a
  // "check your email" state instead of navigating into the app.
  register: (name: string, email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
};

// Real Supabase Auth (GoTrue) replaces the old local mock that just
// compared a plaintext password stored in AsyncStorage. No `persist`
// middleware here — supabase-js already persists the session itself via
// the AsyncStorage-backed storage adapter in lib/supabase/client.ts; a
// second persisted copy here would just be a staleness risk.
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,
  register: async (name, email, password) => {
    // The `handle_new_user` Postgres trigger creates the matching
    // `profiles` row from this same signup metadata.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: authRedirectUrl() },
    });
    return { error: translateAuthError(error?.message), needsEmailConfirmation: !error && !data.session };
  },
  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: translateAuthError(error?.message) };
  },
  logout: async () => {
    await supabase.auth.signOut();
  },
  requestPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
    return { error: translateAuthError(error?.message) };
  },
  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: translateAuthError(error?.message) };
  },
}));

/** Call once at app start (see _layout.tsx). Hydrates the initial session
 * and keeps the store in sync afterward (token refresh, sign-out from
 * another tab/device, etc). Returns an unsubscribe function. */
export function initAuthListener(): () => void {
  supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.setState({ session, user: session?.user ?? null, isAuthenticated: !!session, isLoading: false });
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({ session, user: session?.user ?? null, isAuthenticated: !!session, isLoading: false });
  });

  return () => subscription.unsubscribe();
}
