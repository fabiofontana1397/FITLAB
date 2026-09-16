// The core security boundary for this whole agent system: every specialist
// queries Postgres using a client built from the CALLER's forwarded JWT
// (never the service-role key), so RLS scopes every read/write to that
// user automatically. Tool schemas the model can influence never carry a
// user_id — there is no channel for a prompt-injected message to make the
// model "ask about another user," because identity is bound here, outside
// the model's control entirely.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function createUserScopedClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing Authorization header');
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

/** Reserved for the one-off ingestion script and admin/local tasks only —
 * never use this inside a per-user request path (it bypasses RLS entirely). */
export function createServiceRoleClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

export async function getAuthenticatedUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Unauthorized');
  return data.user;
}
