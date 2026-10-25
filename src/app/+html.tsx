import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { PageBackground } from '@/constants/page-background';

// Root HTML of the static web export — the page iPhones open from Safari or
// the Home Screen icon. This file renders in a bare Node pass and cannot
// import constants/theme.ts, so the page colour comes from the dependency-free
// module that theme.ts builds `background` from.
/** Bump when the logo files in public/ change. */
const ICON_VERSION = '3';

const PAGE_BACKGROUND_CSS = `
html,body{background-color:${PageBackground.light}}
@media (prefers-color-scheme:dark){html,body{background-color:${PageBackground.dark}}}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="it">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover lets the page draw under the Dynamic Island and
            home indicator; env(safe-area-inset-*) then reports their size. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Label under the Home Screen icon (the page <title> is empty) and the icon itself. */}
        <meta name="apple-mobile-web-app-title" content="FitLab" />
        <link rel="manifest" href="/manifest.json" />
        {/* ?v= changes the URL when the logo changes: Safari and iOS keep icons cached by URL for a long time. */}
        <link rel="icon" type="image/png" sizes="32x32" href={`/favicon-32.png?v=${ICON_VERSION}`} />
        <link rel="icon" type="image/png" sizes="48x48" href={`/favicon-48.png?v=${ICON_VERSION}`} />
        <link rel="apple-touch-icon" sizes="180x180" href={`/apple-touch-icon.png?v=${ICON_VERSION}`} />
        <meta name="theme-color" content={PageBackground.light} media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content={PageBackground.dark} media="(prefers-color-scheme: dark)" />
        <ScrollViewStyleReset />
        <style id="page-background" dangerouslySetInnerHTML={{ __html: PAGE_BACKGROUND_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
