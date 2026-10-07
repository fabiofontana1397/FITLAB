import { useCallback, useEffect, useMemo, useState } from 'react';

import { AI_COACH_ENABLED } from '@/lib/assistant/ai-config';
import { buildClientContext } from '@/lib/assistant/build-client-context';
import { buildCoachFacts } from '@/lib/assistant/coach-facts';
import { localInsights } from '@/lib/assistant/local-coach';
import type { Insight } from '@/lib/mock/types';
import { supabase } from '@/lib/supabase/client';
import { withAuthRetry } from '@/lib/supabase/retry';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useAuthStore } from '@/store/auth-store';
import { useBodyStore } from '@/store/body-store';
import { useMonthlyCheckinStore } from '@/store/monthly-checkin-store';
import { useNutritionStore } from '@/store/nutrition-store';
import { usePlanStore } from '@/store/plan-store';
import { useTrainingProgressStore } from '@/store/training-progress-store';

/** Home insights. By default they are written locally from the data the app already
 * holds (local-coach.ts): free, instant, and they follow the data as it changes.
 * With EXPO_PUBLIC_AI_COACH=true they come from the `generate-insights` Edge Function
 * (read from `coach_insights`), falling back to the local ones when there are none. */
export function useCoachInsights() {
  const userId = useAuthStore((s) => s.user?.id);
  const [remote, setRemote] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [version, setVersion] = useState(0);

  // re-derive the local insights whenever the data they read changes
  const bodyEntries = useBodyStore((s) => s.entries);
  const nutritionEntries = useNutritionStore((s) => s.entries);
  const dietPlan = usePlanStore((s) => s.dietPlan);
  const trainingPlan = usePlanStore((s) => s.trainingPlan);
  const completedExercises = useTrainingProgressStore((s) => s.completed);
  const activityLog = useActivityLogStore((s) => s.entries);
  const completedMonths = useMonthlyCheckinStore((s) => s.completedMonths);
  const local = useMemo(
    () => localInsights(buildCoachFacts()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the stores above are the inputs of buildCoachFacts()
    [bodyEntries, nutritionEntries, dietPlan, trainingPlan, completedExercises, activityLog, completedMonths, version],
  );

  const fetchInsights = useCallback(async () => {
    if (!AI_COACH_ENABLED || !userId) return;
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
      if (data) setRemote(data as Insight[]);
    } catch {
      // a failed fetch just leaves the insights as they are
    } finally {
      setHasLoadedOnce(true);
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!AI_COACH_ENABLED) {
      setVersion((v) => v + 1);
      return;
    }
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

  // AI mode only: one refresh for a brand-new user with zero rows (hasLoadedOnce flips once, so no loop).
  useEffect(() => {
    if (AI_COACH_ENABLED && hasLoadedOnce && remote.length === 0 && !isLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot fallback fetch, gated on hasLoadedOnce so it can't loop
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoadedOnce]);

  const insights = AI_COACH_ENABLED && remote.length > 0 ? remote : local;
  return { insights, isLoading, refresh };
}
