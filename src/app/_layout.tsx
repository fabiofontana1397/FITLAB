import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider, usePathname } from 'expo-router';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';

import { WebChrome } from '@/components/web-chrome';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHandleAuthRedirect } from '@/hooks/use-handle-auth-redirect';
import { useStoreHydrated } from '@/hooks/use-store-hydrated';
import { initSupabaseAuthLifecycle } from '@/lib/supabase/client';
import { useActivityLogStore } from '@/store/activity-log-store';
import { useAppStore } from '@/store/app-store';
import { initAuthListener, useAuthStore } from '@/store/auth-store';
import { useBodyStore } from '@/store/body-store';
import { useConsentStore } from '@/store/consent-store';
import { useHealthStore } from '@/store/health-store';
import { useMonthlyCheckinStore } from '@/store/monthly-checkin-store';
import { useNutritionStore } from '@/store/nutrition-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { useTrainingStore } from '@/store/training-store';
import { useTrainingProgressStore } from '@/store/training-progress-store';
import { useWorkoutSessionStore } from '@/store/workout-session-store';
import { useTrainingSwapStore } from '@/store/training-swap-store';
import { useUserStore } from '@/store/user-store';

SplashScreen.preventAutoHideAsync();

// Routes reachable without an account — every other route (including deep
// links like /onboarding or /profile opened directly, bypassing "/") must
// still go through the welcome/onboarding gate below.
const PUBLIC_ROUTES = new Set(['/welcome', '/login', '/register', '/forgot-password', '/reset-password', '/legal']);
// Reachable while the consent is still missing: the consent screen itself and the legal texts it links to.
const CONSENT_ROUTES = new Set(['/consent', '/legal']);

function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const appHydrated = useStoreHydrated(useAppStore);
  const consentHydrated = useStoreHydrated(useConsentStore);
  const consentStatus = useConsentStore((s) => s.status);
  const wasAuthenticated = useRef(isAuthenticated);

  // Server-authoritative refresh for every migrated domain, fired once per
  // sign-in (not on every render) — covers both a fresh login and a cold
  // app start with an already-valid session. On sign-out, clear every local
  // store instead: without this, a different account signing in on the
  // same device would see the previous account's cached data (a real report
  // from testing) until/unless the server happened to overwrite every
  // field — several stores intentionally keep local state when the server
  // has zero rows, which is exactly wrong for "a new account on this device".
  useEffect(() => {
    if (isAuthenticated) {
      useConsentStore.getState().syncFromServer();
      useUserStore.getState().syncFromServer();
      useBodyStore.getState().syncFromServer();
      useNutritionStore.getState().syncFromServer();
      useTrainingStore.getState().syncFromServer();
      useTrainingProgressStore.getState().syncFromServer();
      usePlanStore.getState().syncFromServer();
      useOnboardingStore.getState().syncFromServer();
      useMonthlyCheckinStore.getState().syncFromServer();
      useActivityLogStore.getState().syncFromServer();
    } else if (wasAuthenticated.current) {
      useUserStore.getState().clearLocal();
      useBodyStore.getState().clearLocal();
      useNutritionStore.getState().clearLocal();
      useTrainingStore.getState().clearLocal();
      useTrainingProgressStore.getState().clearLocal();
      useWorkoutSessionStore.getState().clear();
      useTrainingSwapStore.getState().clearLocal();
      usePlanStore.getState().clearLocal();
      useOnboardingStore.getState().clearLocal();
      useMonthlyCheckinStore.getState().clearLocal();
      useActivityLogStore.getState().clearLocal();
      useHealthStore.getState().clearLocal();
      useConsentStore.getState().clearLocal();
      useAppStore.setState({ hasOnboarded: false, redoingQuestionnaire: false });
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  if (authLoading || !appHydrated || !consentHydrated) return null;

  if (!isAuthenticated && !PUBLIC_ROUTES.has(pathname)) {
    return <Redirect href="/welcome" />;
  }
  // Consent gate: age 18+, Terms + health disclaimer and explicit consent to health data come BEFORE the
  // questionnaire (it already collects health data) and again whenever the legal texts change version.
  if (isAuthenticated && !CONSENT_ROUTES.has(pathname)) {
    if (consentStatus === 'unknown') return null;
    if (consentStatus === 'required') return <Redirect href="/consent" />;
  }
  if (isAuthenticated && consentStatus === 'accepted' && pathname === '/consent') {
    return <Redirect href={hasOnboarded ? '/' : '/onboarding'} />;
  }
  // The post-questionnaire summary/celebration/roadmap screens are still
  // part of onboarding (hasOnboarded flips true only at the very end).
  if (isAuthenticated && !hasOnboarded && !pathname.startsWith('/onboarding') && !CONSENT_ROUTES.has(pathname)) {
    return <Redirect href="/onboarding" />;
  }
  // Multi-device case: a second device lands here on the stale local
  // hasOnboarded=false before onboarding-store's syncFromServer corrects
  // it (the server already has answers). Once corrected, bounce back out
  // — but only from the questionnaire entry itself, never from
  // onboarding-created/-roadmap, which a user actually completing the
  // real flow reaches with hasOnboarded still false the whole way through.
  if (isAuthenticated && hasOnboarded && pathname === '/onboarding') {
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}

/**
 * Defaults for every pushed screen. Kept on the expo-router Stack (rather
 * than a custom transition) so pushes use the platform's own native screen
 * animation and iOS's interactive back-swipe, including the full-width
 * variant — these screens have no back button in a header to fall back on,
 * since the stack is headerless.
 *
 * Under Reduce Motion the slide becomes a cross-fade: the screens still
 * change, they just no longer travel across the display.
 */
type StackScreenOptions = ComponentProps<typeof Stack>['screenOptions'];

function useStackScreenOptions(): StackScreenOptions {
  const reduceMotion = useReducedMotion();

  return {
    headerShown: false,
    animation: reduceMotion ? 'fade' : 'default',
    // iOS-only, both of them: swipe anywhere on the screen to go back, and
    // let the transition follow the finger rather than replaying a canned
    // animation when the gesture is released.
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
    animationMatchesGesture: true,
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const stackScreenOptions = useStackScreenOptions();
  useHandleAuthRedirect();

  useEffect(() => {
    SplashScreen.hideAsync();
    const unsubscribeAuth = initAuthListener();
    const unsubscribeLifecycle = initSupabaseAuthLifecycle();
    return () => {
      unsubscribeAuth();
      unsubscribeLifecycle();
    };
  }, []);

  return (
    // Needed by the gestures that run on the UI thread (the card decks in Ricette and Allenamento veloce).
    <GestureHandlerRootView style={{ flex: 1 }}>
    {/* SDK 58: Expo Router no longer provides safe-area insets on web; this provider reads CSS env(safe-area-inset-*)
        so the web app keeps clearing the Dynamic Island and home indicator. Native keeps the router's own provider. */}
    <WebSafeArea>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthGate>
        <Stack screenOptions={stackScreenOptions}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="consent" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="onboarding-created" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="onboarding-roadmap" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          {/* Profilo, Promemoria, the two plans and the calorie-chart guide are bottom sheets drawn by SheetScreen
              itself (it owns the slide-up, the backdrop and the drag-down),
              so the route only has to get out of its way: transparent, with
              no presentation animation of its own. */}
          {/* Pages opened from the header menu: full pages whose sections enter one by one, like the tabs. Transparent
              so that going back can slide the page away over the tab underneath (see PageScreen). */}
          <Stack.Screen name="profile" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="notification-settings" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="legal" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="settings" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="workout-detail" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="logged-activity" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="chat" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="energy-guide" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="weekly-guide" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="custom-workout" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="custom-diet" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="custom-targets" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="own-workout" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="monthly-checkin" options={{ presentation: 'modal' }} />
          <Stack.Screen name="training-progress" options={{ presentation: 'modal' }} />
        </Stack>
      </AuthGate>
      <WebChrome />
    </ThemeProvider>
    </WebSafeArea>
    </GestureHandlerRootView>
  );
}

function WebSafeArea({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return <SafeAreaProvider style={{ flex: 1 }}>{children}</SafeAreaProvider>;
}
