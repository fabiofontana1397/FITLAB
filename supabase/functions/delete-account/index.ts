// Account deletion started from the app (App Store Review Guideline 5.1.1(v), GDPR art. 17).
//
// Identity comes ONLY from the caller's JWT (never from the body). Then, with the service role:
//   1. every file in the caller's folder of the private `progress-photos` bucket (progress photos, avatar) is removed;
//   2. the auth user is deleted — every table in `public` references auth.users ON DELETE CASCADE, so all rows
//      (profile, questionnaire, plans, meals, workouts, chat, check-ins, consents…) go with it.
//   0. for Sign in with Apple accounts, the Apple tokens are revoked first (required by Apple), from a fresh
//      authorization code the app obtains just before. Secrets: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
//      (contents of the .p8 key with "Sign in with Apple"), APPLE_CLIENT_ID (the bundle id, com.fitlab.app).
import { importPKCS8, SignJWT } from 'npm:jose@5';

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

/** Client secret for Apple's REST API: an ES256 JWT signed with the Sign in with Apple key, valid 5 minutes. */
async function appleClientSecret(): Promise<{ clientId: string; secret: string } | null> {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
  const clientId = Deno.env.get('APPLE_CLIENT_ID');
  if (!teamId || !keyId || !privateKey || !clientId) return null;
  const key = await importPKCS8(privateKey.replace(/\\n/g, '\n'), 'ES256');
  const secret = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .sign(key);
  return { clientId, secret };
}

/** Exchanges the authorization code for a refresh token and revokes it. Best effort: never blocks the deletion. */
async function revokeApple(code: string): Promise<void> {
  const creds = await appleClientSecret();
  if (!creds) {
    console.warn('delete-account: Apple secrets missing, token revocation skipped');
    return;
  }
  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: creds.clientId, client_secret: creds.secret, code, grant_type: 'authorization_code' }),
  });
  const tokens = await tokenRes.json().catch(() => ({}));
  const token = tokens.refresh_token ?? tokens.access_token;
  if (!token) {
    console.warn('delete-account: Apple token exchange failed', tokenRes.status, tokens.error);
    return;
  }
  const revokeRes = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.secret,
      token,
      token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token',
    }),
  });
  if (!revokeRes.ok) console.warn('delete-account: Apple revoke failed', revokeRes.status);
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
  if (typeof body.appleAuthorizationCode === 'string' && body.appleAuthorizationCode) {
    await revokeApple(body.appleAuthorizationCode).catch((err) => console.warn('delete-account: Apple revoke error', err));
  }
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
