// Account deletion started from the app (App Store Review Guideline 5.1.1(v), GDPR art. 17).
//
// Identity comes ONLY from the caller's JWT (never from the body). Then, with the service role:
//   1. every file in the caller's folder of the private `progress-photos` bucket (progress photos, avatar) is removed;
//   2. the auth user is deleted — every table in `public` references auth.users ON DELETE CASCADE, so all rows
//      (profile, questionnaire, plans, meals, workouts, chat, check-ins, consents…) go with it.
import { handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { createServiceRoleClient, createUserScopedClient, getAuthenticatedUser } from '../_shared/supabase-client.ts';

const BUCKETS = ['progress-photos'];

async function removeFolder(admin: ReturnType<typeof createServiceRoleClient>, bucket: string, prefix: string): Promise<void> {
  // list() is paged and not recursive: walk sub-folders, remove files in batches.
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw new Error(`storage list failed: ${error.message}`);
    if (!data || data.length === 0) return;
    const files = data.filter((o) => o.id != null).map((o) => `${prefix}/${o.name}`);
    const folders = data.filter((o) => o.id == null).map((o) => `${prefix}/${o.name}`);
    for (const folder of folders) await removeFolder(admin, bucket, folder);
    if (files.length > 0) {
      const { error: rmError } = await admin.storage.from(bucket).remove(files);
      if (rmError) throw new Error(`storage remove failed: ${rmError.message}`);
    }
    if (files.length === 0) return;
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 });

  let userId: string;
  try {
    const user = await getAuthenticatedUser(createUserScopedClient(req));
    userId = user.id;
  } catch {
    return jsonResponse({ error: 'Sessione non valida: accedi di nuovo e riprova.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body || body.confirm !== true) return jsonResponse({ error: 'Conferma mancante.' }, { status: 400 });

  const admin = createServiceRoleClient();
  try {
    for (const bucket of BUCKETS) await removeFolder(admin, bucket, userId);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`auth delete failed: ${error.message}`);
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('delete-account', userId, err);
    return jsonResponse({ error: 'Eliminazione non completata. Riprova tra qualche minuto o scrivici.' }, { status: 500 });
  }
});
