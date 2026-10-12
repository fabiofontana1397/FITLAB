import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

/**
 * Web only (the iPhone Home Screen web app). The status bar is
 * "black-translucent", so iOS always draws its text in white over whatever is
 * under it: a black band over the top safe area keeps the clock and battery
 * readable in light mode and blends with the Dynamic Island. The page
 * background also follows the in-app appearance (which can differ from the
 * system one), so the safe areas never flash a different color.
 */
export function WebChrome() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.backgroundColor = theme.background;
    document.body.style.backgroundColor = theme.background;
  }, [theme.background]);

  if (Platform.OS !== 'web' || insets.top <= 0) return null;
  return <View style={[styles.band, { height: insets.top }]} />;
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#000000',
    pointerEvents: 'none',
  },
});
