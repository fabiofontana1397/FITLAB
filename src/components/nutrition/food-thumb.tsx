import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { FoodGlyph } from '@/components/nutrition/food-glyph';
import { foodPhoto } from '@/lib/nutrition/food-photos';

/**
 * What a food looks like in the meal tracker: its photo when there is one
 * (lib/nutrition/food-photos.ts), otherwise its lucide glyph tinted by its
 * main macro. Fills the container it is given, which owns the size, the
 * corner radius and `overflow: 'hidden'`.
 */
export function FoodThumb({ foodId, glyphSize = 20 }: { foodId: string; glyphSize?: number }) {
  const photo = foodPhoto(foodId);
  if (!photo) return <FoodGlyph foodId={foodId} size={glyphSize} />;
  // The photos are packshots on white: cover-fit fills the rounded tile edge to edge.
  return <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} accessibilityIgnoresInvertColors />;
}
