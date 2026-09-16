import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in the values printed by `npm run supabase:start`.'
  );
}

// AsyncStorage's web implementation shims to `window.localStorage`
// unconditionally — but Expo Router's web dev server (and static export)
// pre-renders modules in a Node/SSR pass with no `window` at all, and
// supabase-js eagerly calls `storage.getItem` the moment the client is
// created (to try to recover a session), which crashed the whole server
// with "ReferenceError: window is not defined" before this guard existed.
// This wrapper no-ops during that SSR pass and defers to the real
// AsyncStorage once actually running in a browser (or on native, where
// AsyncStorage never touches `window` in the first place).
const webSafeStorage = {
  getItem: (key: string) => (typeof window === 'undefined' ? Promise.resolve(null) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) => (typeof window === 'undefined' ? Promise.resolve() : AsyncStorage.setItem(key, value)),
  removeItem: (key: string) => (typeof window === 'undefined' ? Promise.resolve() : AsyncStorage.removeItem(key)),
};

// Untyped for now (no <Database> generic) — database.types.ts is a
// hand-authored placeholder covering only a few tables; wire the generic
// back in once `npm run supabase:types` has regenerated it for real
// against the live local schema.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: webSafeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// supabase-js's auto token refresh keeps a timer running; without this it
// can misbehave (pile up or silently stop) while the RN app is
// backgrounded, so pause/resume it with app foreground state.
export function initSupabaseAuthLifecycle() {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
  return () => subscription.remove();
}
