import { use, useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { ColorSchemeOverride } from '@/hooks/color-scheme-override';
import { useAppStore } from '@/store/app-store';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const appearance = useAppStore((s) => s.appearance);
  const system = useRNColorScheme();
  const forced = use(ColorSchemeOverride);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- required to re-sync after static-render hydration
    setHasHydrated(true);
  }, []);

  if (forced) return forced;
  if (!hasHydrated) {
    return 'light';
  }
  if (appearance === 'system') {
    return system ?? 'light';
  }
  return appearance;
}
