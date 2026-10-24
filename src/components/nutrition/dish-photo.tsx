import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { cornerSafeInset } from '@/components/nutrition/photo-fit';
import { Icon } from '@/components/ui/icon';
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
 * A dish's photo as a fixed square tile, so the card never jumps when it
 * loads. The photo is always shown whole (see photo-fit.ts). Lazy on the web (the plan lists a whole week of meals), cached in
 * memory and on disk so the same plate shown on several days is fetched once.
 * If the file is missing or fails to load, the tile keeps its place and shows
 * a plate glyph instead.
 */
export function DishPhoto({ image, size = 64, radius = 14 }: { image: MealImage; size?: number; radius?: number }) {
  const theme = useTheme();
  const uri = mealImageUri(image);
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: radius, backgroundColor: theme.backgroundElement };

  if (!uri || failed) {
    return (
      <View style={[styles.tile, box]} accessibilityRole="image" accessibilityLabel={image.alt}>
        <Icon name="utensils" size={Math.round(size * 0.38)} color={theme.textTertiary} />
      </View>
    );
  }

  return (
    <View style={[styles.tile, box, { padding: cornerSafeInset(radius) }]}>
      <Image
        source={{ uri, width: 512, height: 512 }}
        style={styles.photo}
        contentFit="contain"
        contentPosition="center"
        loading="lazy"
        cachePolicy="memory-disk"
        recyclingKey={image.id}
        transition={150}
        accessible
        accessibilityLabel={image.alt}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    width: '100%',
    height: '100%',
  },
  tile: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
