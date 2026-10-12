import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Root HTML of the static web export — the page iPhones open from Safari or
// the Home Screen icon. These colors mirror Colors.light/dark.background in
// src/constants/theme.ts (this file renders on the server and can't import it).
const PAGE_BACKGROUND_CSS = `
html,body{background-color:#F7F7F8}
@media (prefers-color-scheme:dark){html,body{background-color:#000000}}
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
        <meta name="theme-color" content="#F7F7F8" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <ScrollViewStyleReset />
        <style id="page-background" dangerouslySetInnerHTML={{ __html: PAGE_BACKGROUND_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
