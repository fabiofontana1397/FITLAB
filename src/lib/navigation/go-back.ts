import { router, type Href } from 'expo-router';

/**
 * `router.back()`, but falls back to `fallbackHref` when there's nothing to
 * pop. Every screen that calls this is modal-presented and reachable via a
 * direct URL too — a deep link, or (on web) simply refreshing the page
 * while on it — which starts with an empty in-app history stack. A bare
 * `router.back()` in that case is a no-op, leaving the screen's close
 * button dead and the user stuck with no way out.
 */
export function goBackOr(fallbackHref: Href) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}
