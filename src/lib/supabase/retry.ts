// Right after sign-up/sign-in, a freshly-issued JWT can occasionally be
// rejected by PostgREST with "JWT issued at future" (PGRST303) or bounce an
// Edge Function call with a 401 — a transient clock-skew race between
// Supabase's own Auth and Postgres/Edge Function nodes, observed in practice
// during onboarding (the very next request a few seconds later succeeds
// with no code change). This retries once, after a short delay, ONLY for
// that narrow class of error — anything else (a real permission issue, a
// network failure, a genuine 500) is rethrown immediately, unretried.
function isTransientAuthError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { code?: unknown; status?: unknown; context?: unknown };
  if (anyErr.code === 'PGRST303') return true;
  if (anyErr.status === 401) return true;
  if (anyErr.context instanceof Response && anyErr.context.status === 401) return true;
  return false;
}

export async function withAuthRetry<T>(fn: () => Promise<T>, delayMs = 2000): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isTransientAuthError(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return fn();
  }
}
