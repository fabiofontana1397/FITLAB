import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type MeasurementZone = 'shouldersCm' | 'chestCm' | 'bicepsCm' | 'waistCm' | 'hipsCm' | 'thighCm';

/**
 * Each illustration is two transparent layers: the body outline and the spot where the tape goes. Both are white
 * masks tinted at render time, so the figure reads on dark and light backgrounds alike, with no white box behind it.
 */
const IMAGES: Record<MeasurementZone, { body: number; zone: number }> = {
  shouldersCm: { body: require('@/assets/images/body-measures/shoulders-body.png'), zone: require('@/assets/images/body-measures/shoulders-zone.png') },
  chestCm: { body: require('@/assets/images/body-measures/chest-body.png'), zone: require('@/assets/images/body-measures/chest-zone.png') },
  bicepsCm: { body: require('@/assets/images/body-measures/biceps-body.png'), zone: require('@/assets/images/body-measures/biceps-zone.png') },
  waistCm: { body: require('@/assets/images/body-measures/waist-body.png'), zone: require('@/assets/images/body-measures/waist-zone.png') },
  hipsCm: { body: require('@/assets/images/body-measures/hips-body.png'), zone: require('@/assets/images/body-measures/hips-zone.png') },
  thighCm: { body: require('@/assets/images/body-measures/thigh-body.png'), zone: require('@/assets/images/body-measures/thigh-zone.png') },
};

/** Width / height of the artwork (cropped tight around the figure). */
export const SILHOUETTE_RATIO = 255 / 479;

export type BodySilhouetteProps = {
  zone: MeasurementZone;
  /** Rendered height; the width follows the artwork's ratio. */
  height?: number;
};

/** The body with the highlighted spot where a measurement is taken: outline in the text colour, spot in the accent. */
export function BodySilhouette({ zone, height = 200 }: BodySilhouetteProps) {
  const theme = useTheme();
  const width = Math.round(height * SILHOUETTE_RATIO);
  const size = { width, height };
  return (
    <View style={size} accessibilityIgnoresInvertColors>
      <Image source={IMAGES[zone].body} style={[StyleSheet.absoluteFill, size]} contentFit="contain" tintColor={theme.text} />
      <Image source={IMAGES[zone].zone} style={[StyleSheet.absoluteFill, size]} contentFit="contain" tintColor={theme.accent} />
    </View>
  );
}
