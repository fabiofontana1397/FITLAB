import { use } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { ColorSchemeOverride } from '@/hooks/color-scheme-override';
import { useAppStore } from '@/store/app-store';

export function useColorScheme() {
  const appearance = useAppStore((s) => s.appearance);
  const system = useRNColorScheme();
  const forced = use(ColorSchemeOverride);

  if (forced) return forced;

  if (appearance === 'system') {
    return system ?? 'light';
  }
  return appearance;
}
