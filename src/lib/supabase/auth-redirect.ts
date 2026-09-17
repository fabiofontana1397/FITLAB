import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/** Where GoTrue should send the user back to after they click an email
 * confirmation or password-reset link — the web origin on web (so it
 * round-trips to whichever host is actually running, dev or production,
 * without hardcoding one), or the app's own deep-link scheme (app.json's
 * "fitlab") on native. Must be present in the project's Auth redirect
 * allow-list or GoTrue silently drops it and falls back to Site URL. */
export function authRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return Linking.createURL('/');
}
