import { useMemo } from 'react';

import { buildUserContext, type UserContext } from '@/domain/user-context';
import { latestSnapshot } from '@/lib/mock/body';
import { useBodyStore } from '@/store/body-store';
import { useOnboardingStore } from '@/store/onboarding-store';

/**
 * The person as the planning engines see them: the questionnaire answers
 * normalized once (domain/user-context.ts), with the weight of the latest
 * weigh-in instead of the onboarding one. Every screen that needs energy or
 * calorie numbers goes through this, so they all start from the same person.
 */
export function useUserContext(): UserContext {
  const answers = useOnboardingStore((s) => s.answers);
  const bodyEntries = useBodyStore((s) => s.entries);
  return useMemo(() => {
    const ctx = buildUserContext(answers);
    const latest = latestSnapshot(bodyEntries).weightKg;
    return latest > 0 ? { ...ctx, weightKg: latest } : ctx;
  }, [answers, bodyEntries]);
}
