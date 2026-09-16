import { useCallback, useEffect, useState } from 'react';

import { buildClientContext } from '@/lib/assistant/build-client-context';
import type { Insight } from '@/lib/mock/types';
import { supabase } from '@/lib/supabase/client';
import { withAuthRetry } from '@/lib/supabase/retry';
import { useAuthStore } from '@/store/auth-store';

/** Replaces the static, non-data-grounded `insights` import from
 * lib/mock/progress.ts. Reads `coach_insights` (written only by the
 * `generate-insights` Edge Function) and exposes a manual `refresh()` that
 * invokes it — the client never writes insight content directly. */
export function useCoachInsights() {
  const userId = useAuthStore((s) => s.user?.id);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!userId) return;
    try {
      // withAuthRetry only retries on a THROWN error, but supabase-js
      // resolves query errors instead of throwing — re-throw so a
      // transient post-signup clock-skew failure here gets retried too.
      const { data } = await withAuthRetry(async () => {
        const result = await supabase
          .from('coach_insights')
          .select('id, tone, headline, body')
          .eq('dismissed', false)
          .order('generated_at', { ascending: false })
          .limit(4);
        if (result.error) throw result.error;
        return result;
      });
      if (data) setInsights(data as Insight[]);
    } catch {
      // Same as before: a failed fetch just leaves insights as-is.
    } finally {
      setHasLoadedOnce(true);
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const clientContext = buildClientContext();
      await withAuthRetry(async () => {
        const { error } = await supabase.functions.invoke('generate-insights', { body: { clientContext } });
        if (error) throw error;
      });
      await fetchInsights();
    } catch (err) {
      console.warn('generate-insights failed', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, fetchInsights]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/userId change, not a render-triggered cascade
    fetchInsights();
  }, [fetchInsights]);

  // Auto-trigger exactly one refresh for a brand-new user with zero rows,
  // so Home doesn't look broken on first login — `hasLoadedOnce` only
  // flips false->true once per userId, so this can't loop.
  useEffect(() => {
    if (hasLoadedOnce && insights.length === 0 && !isLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot fallback fetch, gated on hasLoadedOnce so it can't loop
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoadedOnce]);

  return { insights, isLoading, refresh };
}
