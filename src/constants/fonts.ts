import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

/** Every Plus Jakarta Sans face the app uses, keyed by the family name
 * registered with expo-font (see useFonts in the root layout). Custom fonts
 * have no automatic weight synthesis on native, so each weight is its own
 * family. */
export const APP_FONTS = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

type AppFamily = keyof typeof APP_FONTS;

/** The app family closest to a CSS-style fontWeight ('600', 'bold', 700…). */
export function appFamilyForWeight(weight: unknown): AppFamily {
  const n = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight);
  if (!Number.isFinite(n) || n <= 400) return 'PlusJakartaSans_400Regular';
  if (n <= 500) return 'PlusJakartaSans_500Medium';
  if (n <= 600) return 'PlusJakartaSans_600SemiBold';
  if (n <= 700) return 'PlusJakartaSans_700Bold';
  return 'PlusJakartaSans_800ExtraBold';
}
