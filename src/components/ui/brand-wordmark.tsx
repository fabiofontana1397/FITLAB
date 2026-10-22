import { Image, type ImageStyle, type StyleProp } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

const LOGOS = {
  light: require('@/assets/images/logo-wordmark.png'),
  dark: require('@/assets/images/logo-wordmark-light.png'),
  lightTagline: require('@/assets/images/logo-wordmark-tagline.png'),
  darkTagline: require('@/assets/images/logo-wordmark-tagline-light.png'),
};

/** The FitLab wordmark: black "FIT" on light backgrounds, white on dark ones; optionally with the "Build your best" tagline. */
export function BrandWordmark({ tagline = false, style }: { tagline?: boolean; style?: StyleProp<ImageStyle> }) {
  const dark = useColorScheme() === 'dark';
  const source = tagline ? (dark ? LOGOS.darkTagline : LOGOS.lightTagline) : dark ? LOGOS.dark : LOGOS.light;
  return <Image source={source} style={style} resizeMode="contain" accessibilityRole="image" accessibilityLabel="FitLab" />;
}
