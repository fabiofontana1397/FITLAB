import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

/** Every Inter face the app uses, keyed by the family name registered with
 * expo-font (see useFonts in the root layout). Custom fonts have no
 * automatic weight synthesis on native, so each weight is its own family. */
export const INTER_FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};

type InterFamily = keyof typeof INTER_FONTS;

/** The Inter family closest to a CSS-style fontWeight ('600', 'bold', 700…). */
export function interFamilyForWeight(weight: unknown): InterFamily {
  const n = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight);
  if (!Number.isFinite(n) || n <= 400) return 'Inter_400Regular';
  if (n <= 500) return 'Inter_500Medium';
  if (n <= 600) return 'Inter_600SemiBold';
  if (n <= 700) return 'Inter_700Bold';
  return 'Inter_800ExtraBold';
}
