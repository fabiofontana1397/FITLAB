import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

/** Height of the floating tab bar: 52 pt of button in 3 pt of padding (app-tabs.tsx). */
export const FLOATING_TAB_BAR_HEIGHT = 58;

/**
 * Space a page that does not scroll must leave at the bottom so nothing ends up under the floating tab bar: the
 * bar, the gap the bar keeps under itself (the home-indicator area on iPhone, as in app-tabs.tsx) and a small
 * breathing gap above it. A scrolling page does not need it: its content scrolls out from under the bar.
 */
export function useTabBarClearance(gap: number = Spacing.three): number {
  const insets = useSafeAreaInsets();
  const under = Platform.select({ web: Math.max(insets.bottom, Spacing.three), default: insets.bottom || Spacing.three });
  return FLOATING_TAB_BAR_HEIGHT + under + gap;
}
