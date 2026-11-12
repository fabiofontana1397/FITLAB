import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

export type MeasurementZone = 'shouldersCm' | 'chestCm' | 'bicepsCm' | 'waistCm' | 'hipsCm' | 'thighCm';

const IMAGES: Record<MeasurementZone, number> = {
  shouldersCm: require('@/assets/images/body-measures/shoulders.webp'),
  chestCm: require('@/assets/images/body-measures/chest.webp'),
  bicepsCm: require('@/assets/images/body-measures/biceps.webp'),
  waistCm: require('@/assets/images/body-measures/waist.webp'),
  hipsCm: require('@/assets/images/body-measures/hips.webp'),
  thighCm: require('@/assets/images/body-measures/thigh.webp'),
};

export type BodySilhouetteProps = {
  zone: MeasurementZone;
  /** Rendered width; the images have a 5:6 aspect ratio. */
  width?: number;
  height?: number;
  radius?: number;
};

/** Illustration of the body with the highlighted spot where a measurement is taken. */
export function BodySilhouette({ zone, width = 180, height = (width * 6) / 5, radius = 12 }: BodySilhouetteProps) {
  return (
    <View style={[styles.tile, { width, height, borderRadius: radius }]}>
      <Image source={IMAGES[zone]} style={{ width, height }} contentFit="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

const styles = StyleSheet.create({
  // The artwork is drawn on a white background, so keep it on a white tile in dark mode too.
  tile: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
});
