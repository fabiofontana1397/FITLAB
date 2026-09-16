import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase/client';

type AuthState = {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  // True until the initial getSession() resolves — replaces the old
  // zustand-persist "hydrated" check in _layout.tsx, since the session is
  // now supabase-js's own concern, not a second persisted copy of it.
  isLoading: boolean;
  register: (name: string, email: string, password: string) => Promise<{ error: string | null }>;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
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
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    return { error: error?.message ?? null };
  },
  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },
  logout: async () => {
    await supabase.auth.signOut();
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
