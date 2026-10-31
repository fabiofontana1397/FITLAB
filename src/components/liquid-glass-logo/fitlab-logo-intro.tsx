'use dom';

/**
 * FITLAB's logo intro: the ReactDrops "Liquid Glass Logo" (WebGL2) wrapped as
 * an Expo DOM component, so the same code runs inline on web and inside a
 * webview on iOS/Android. Ends on the original logo alone, at its normal
 * size, on black — `ending="logo"` means no second wordmark reveal.
 *
 * The `light` theme only colors the glass plate during the entrance; the
 * background and ink are pinned so the final frame is the white logo on black
 * (the light theme's own defaults would be a grey page and near-black ink).
 */

import type { DOMProps } from 'expo/dom';

import { LiquidGlassLogo } from './liquid-glass-logo';

// public/ is served from the site root on web; inside the native webview it is
// bundled and addressed through EXPO_BASE_URL.
const LOGO = process.env.EXPO_DOM_HOST_OS ? `${process.env.EXPO_BASE_URL ?? ''}logo.svg` : '/logo.svg';

export default function FitlabLogoIntro({ height = 480 }: { height?: number; dom?: DOMProps }) {
  return (
    <LiquidGlassLogo
      logo={LOGO}
      ending="logo"
      theme="light"
      logoColor="original"
      background="#000000"
      depth={2.9}
      style={{ height }}
    />
  );
}
