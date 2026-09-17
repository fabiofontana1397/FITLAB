import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHandleAuthRedirect } from '@/hooks/use-handle-auth-redirect';
import { useStoreHydrated } from '@/hooks/use-store-hydrated';
import { initSupabaseAuthLifecycle } from '@/lib/supabase/client';
import { useAppStore } from '@/store/app-store';
import { initAuthListener, useAuthStore } from '@/store/auth-store';
import { useBodyStore } from '@/store/body-store';
import { useNutritionStore } from '@/store/nutrition-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { usePlanStore } from '@/store/plan-store';
import { useTrainingStore } from '@/store/training-store';
import { useTrainingProgressStore } from '@/store/training-progress-store';
import { useUserStore } from '@/store/user-store';

SplashScreen.preventAutoHideAsync();

// Routes reachable without an account — every other route (including deep
// links like /onboarding or /profile opened directly, bypassing "/") must
// still go through the welcome/onboarding gate below.
const PUBLIC_ROUTES = new Set(['/welcome', '/login', '/register', '/forgot-password', '/reset-password']);

function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const appHydrated = useStoreHydrated(useAppStore);
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
      useUserStore.getState().syncFromServer();
      useBodyStore.getState().syncFromServer();
      useNutritionStore.getState().syncFromServer();
      useTrainingStore.getState().syncFromServer();
      useTrainingProgressStore.getState().syncFromServer();
      usePlanStore.getState().syncFromServer();
      useOnboardingStore.getState().syncFromServer();
    } else if (wasAuthenticated.current) {
      useUserStore.getState().clearLocal();
      useBodyStore.getState().clearLocal();
      useNutritionStore.getState().clearLocal();
      useTrainingStore.getState().clearLocal();
      useTrainingProgressStore.getState().clearLocal();
      usePlanStore.getState().clearLocal();
      useOnboardingStore.getState().clearLocal();
      useAppStore.getState().setHasOnboarded(false);
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  if (authLoading || !appHydrated) return null;

  if (!isAuthenticated && !PUBLIC_ROUTES.has(pathname)) {
    return <Redirect href="/welcome" />;
  }
  // The post-questionnaire summary/celebration/roadmap screens are still
  // part of onboarding (hasOnboarded flips true only at the very end).
  if (isAuthenticated && !hasOnboarded && !pathname.startsWith('/onboarding')) {
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

export default function RootLayout() {
  const colorScheme = useColorScheme();
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
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="onboarding-created" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="onboarding-roadmap" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="chat" options={{ presentation: 'transparentModal', animation: 'none' }} />
          <Stack.Screen name="diet-plan" options={{ presentation: 'modal' }} />
          <Stack.Screen name="training-plan" options={{ presentation: 'modal' }} />
          <Stack.Screen name="training-progress" options={{ presentation: 'modal' }} />
        </Stack>
      </AuthGate>
    </ThemeProvider>
  );
}
