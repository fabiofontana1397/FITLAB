/**
 * Sign in with Apple and Google on iOS / Android (native sheets), turned into a Supabase session with the
 * provider's ID token (`signInWithIdToken`). The web build uses social.web.ts (OAuth redirect).
 *
 * Configuration (see docs/SOCIAL-LOGIN.md):
 * - Apple: "Sign In with Apple" capability on the App ID + the Apple provider enabled in Supabase Auth, with the
 *   bundle id (com.fitlab.app) among its Client IDs. iOS only: Apple does not offer a native sheet on Android.
 * - Google: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (the Web client, also set in Supabase) and
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (the iOS client). Without them the Google button is not shown.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, isCancelledResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase/client';

export type SocialResult = { status: 'ok'; name?: string } | { status: 'cancelled' } | { status: 'error'; message: string };

// OAuth client ids are public identifiers (they ship inside every app binary), not secrets: the FitLab ones from
// Google Cloud project fitlab-515611 are the defaults, the env variables override them.
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '703333923406-tamup29j9sp31r3ksve70b54lp83d1sa.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '703333923406-thbda8kun5rt1ps35v20j6n047isbt14.apps.googleusercontent.com';

export const googleConfigured = !!GOOGLE_WEB_CLIENT_ID && (Platform.OS !== 'ios' || !!GOOGLE_IOS_CLIENT_ID);

let googleReady = false;
function ensureGoogle() {
  if (googleReady) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
  googleReady = true;
}

/** Apple's native sheet exists on iOS 13+ only. */
export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

export async function signInWithApple(): Promise<SocialResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) return { status: 'error', message: 'Apple non ha restituito le credenziali. Riprova.' };
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
    if (error) return { status: 'error', message: 'Accesso con Apple non riuscito. Riprova.' };
    // Apple gives the name only the very first time: keep it for the profile.
    const name = credential.fullName ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ') : '';
    if (name) await supabase.auth.updateUser({ data: { name } });
    return { status: 'ok', name: name || undefined };
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' };
    return { status: 'error', message: 'Accesso con Apple non riuscito. Riprova.' };
  }
}

export async function signInWithGoogle(): Promise<SocialResult> {
  if (!googleConfigured) return { status: 'error', message: 'Accesso con Google non ancora configurato.' };
  try {
    ensureGoogle();
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return { status: 'cancelled' };
    const idToken = response.data.idToken;
    if (!idToken) return { status: 'error', message: 'Google non ha restituito le credenziali. Riprova.' };
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) return { status: 'error', message: 'Accesso con Google non riuscito. Riprova.' };
    return { status: 'ok', name: response.data.user.name ?? undefined };
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) return { status: 'cancelled' };
    if (isErrorWithCode(e) && e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { status: 'error', message: 'Google Play Services non disponibili su questo dispositivo.' };
    return { status: 'error', message: 'Accesso con Google non riuscito. Riprova.' };
  }
}

/** Signs out of the Google SDK too, so the next sign-in shows the account picker again. */
export async function signOutSocial(): Promise<void> {
  if (!googleReady) return;
  await GoogleSignin.signOut().catch(() => undefined);
}

/**
 * Apple requires revoking the user's Apple tokens when the account is deleted. A fresh authorization code is
 * needed for that: this asks Apple for one (the person confirms with Face ID). Null when not an Apple account,
 * not on iOS or cancelled.
 */
export async function appleAuthorizationCodeForDeletion(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  const { data } = await supabase.auth.getUser();
  const isApple = data.user?.identities?.some((i) => i.provider === 'apple');
  if (!isApple) return null;
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    return credential.authorizationCode ?? null;
  } catch {
    return null;
  }
}
