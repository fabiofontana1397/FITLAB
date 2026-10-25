import { Platform, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { PhotoTile } from '@/components/ui/photo-tile';
import { useTheme } from '@/hooks/use-theme';
import type { MealImage } from '@/lib/planning/fitlab/dish-images';

const BASE_URL = (process.env.EXPO_PUBLIC_MEAL_IMAGE_BASE_URL ?? '').replace(/\/$/, '');

/** Where to load a photo from. The web app serves it itself; a native build
 * has no site to resolve a path against, so it needs the base URL (CDN or
 * the deployed site) — without one there is no photo and the tile falls back. */
export function mealImageUri(image: MealImage): string | undefined {
  if (/^https?:\/\//.test(image.image)) return image.image;
  if (BASE_URL) return `${BASE_URL}${image.image}`;
  return Platform.OS === 'web' ? image.image : undefined;
}

/**
 * A dish's photo in the Piano alimentare: a fixed square PhotoTile (always
 * the whole picture), lazy on the web since the plan lists a whole week of
 * meals. No photo URL, or a file that fails, leaves a plate glyph instead.
 */
export function DishPhoto({ image, size = 64, radius = 14 }: { image: MealImage; size?: number; radius?: number }) {
  const theme = useTheme();
  const uri = mealImageUri(image);
  const fallback = <Icon name="utensils" size={Math.round(size * 0.38)} color={theme.textTertiary} />;

  if (!uri) {
    return (
      <View
        style={[styles.empty, { width: size, height: size, borderRadius: radius, backgroundColor: theme.backgroundElement }]}
        accessibilityRole="image"
        accessibilityLabel={image.alt}>
        {fallback}
      </View>
    );
  }

  return (
    <PhotoTile
      source={{ uri, width: 512, height: 512 }}
      width={size}
      radius={radius}
      background={theme.backgroundElement}
      alt={image.alt}
      fallback={fallback}
      lazy
      recyclingKey={image.id}
      transition={150}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
