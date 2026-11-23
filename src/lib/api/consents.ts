import { Platform } from 'react-native';

import { appleAuthorizationCodeForDeletion } from '@/lib/auth/social';
import type { ConsentItemId } from '@/lib/legal/content';
import { supabase } from '@/lib/supabase/client';

type ConsentRow = { kind: ConsentItemId; version: string; granted: boolean; created_at: string };

/** Latest consent per kind for the signed-in user (null when the request fails). */
export async function fetchLatestConsents(): Promise<Partial<Record<ConsentItemId, { version: string; granted: boolean }>> | null> {
  const { data, error } = await supabase.from('user_consents').select('kind, version, granted, created_at').order('created_at', { ascending: false }).limit(50);
  if (error) return null;
  const out: Partial<Record<ConsentItemId, { version: string; granted: boolean }>> = {};
  for (const row of (data ?? []) as ConsentRow[]) {
    if (!out[row.kind]) out[row.kind] = { version: row.version, granted: row.granted };
  }
  return out;
}

/** Records the given consents (append-only log). Returns an error message or null. */
export async function recordConsents(userId: string, kinds: readonly ConsentItemId[], version: string, granted = true): Promise<string | null> {
  const rows = kinds.map((kind) => ({ user_id: userId, kind, version, granted, platform: Platform.OS }));
  const { error } = await supabase.from('user_consents').insert(rows);
  return error ? error.message : null;
}

/**
 * Deletes the account and every piece of data tied to it (database rows by cascade, photos in storage), through the
 * `delete-account` Edge Function. Returns an error message or null.
 */
export async function deleteAccount(): Promise<string | null> {
  // Sign in with Apple accounts: Apple requires revoking its tokens, which needs a fresh authorization code.
  const appleAuthorizationCode = await appleAuthorizationCodeForDeletion();
  const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirm: true, appleAuthorizationCode } });
  if (error) return 'Non è stato possibile eliminare l’account. Controlla la connessione e riprova.';
  if (data && typeof data === 'object' && 'error' in data && data.error) return String(data.error);
  return null;
}
