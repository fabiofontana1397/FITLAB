import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnBrand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** True when the page runs as the iPhone Home Screen web app (no Safari bars around it). */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/**
 * Web only. Keeps everything around the page the same color as the app:
 * - the page background and the browser's own bars (the `theme-color` meta that tints Safari's top and
 *   bottom bars) follow the in-app appearance, which can differ from the phone's;
 * - on the Home Screen web app the status bar is "black-translucent", so iOS always draws its text in
 *   white over whatever is under it: a black band over the top safe area keeps the clock and battery
 *   readable in light mode and blends with the Dynamic Island. In a normal Safari tab Safari draws its
 *   own bars, so no band there.
 */
export function WebChrome() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the display mode is only known in the browser
    setStandalone(isStandalone());
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.backgroundColor = theme.background;
    document.body.style.backgroundColor = theme.background;

    // One theme-color for the current appearance (the static page ships two, chosen by the phone's setting).
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    metas.slice(1).forEach((m) => m.remove());
    const meta = metas[0] ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
    meta.removeAttribute('media');
    meta.content = theme.background;
  }, [theme.background]);

  if (Platform.OS !== 'web' || !standalone || insets.top <= 0) return null;
  return <View style={[styles.band, { height: insets.top }]} />;
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: OnBrand.statusBarBand,
    pointerEvents: 'none',
  },
});
