import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { FoodGlyph } from '@/components/nutrition/food-glyph';
import { useTheme } from '@/hooks/use-theme';
import { foodPhoto } from '@/lib/nutrition/food-photos';

/**
 * Where the thumbnail sits:
 * - `row`: the leading image of a list row (meal log, food search results).
 * - `hero`: the food being added, in the selected card with the grams field.
 */
export type FoodThumbVariant = 'row' | 'hero';

/**
 * Point sizes per width class, after the iOS HIG: 44 pt is both the standard
 * leading image of a list row and the minimum touch target, so a row
 * thumbnail never drops far below it. Narrow phones (iPhone SE, mini) give a
 * little of it back to the text; Plus / Pro Max widths take a little more.
 * The hero is the same ladder one step up, so the food being added reads as
 * the subject of its card rather than as one more row.
 */
const SIZES: Record<FoodThumbVariant, { compact: number; regular: number; large: number }> = {
  row: { compact: 40, regular: 44, large: 48 },
  hero: { compact: 56, regular: 64, large: 72 },
};

/** Width classes in points: below 360 is an SE / mini, from 428 a Plus / Pro Max. */
const COMPACT_BELOW = 360;
const LARGE_FROM = 428;

/**
 * Dynamic Type: the thumbnail grows with the user's text size, so it stays in
 * proportion with the name and numbers beside it — but only up to this
 * factor, past which the row would have no width left for that text.
 */
const MAX_TEXT_SCALE = 1.3;

/** The thumbnail's size in points for the space available on this screen. */
export function useFoodThumbSize(variant: FoodThumbVariant): number {
  const { width, fontScale } = useWindowDimensions();
  const ladder = SIZES[variant];
  const base = width < COMPACT_BELOW ? ladder.compact : width >= LARGE_FROM ? ladder.large : ladder.regular;
  return Math.round(base * Math.min(Math.max(fontScale, 1), MAX_TEXT_SCALE));
}

/**
 * What a food looks like in the meal tracker: its photo when there is one
 * (lib/nutrition/food-photos.ts), otherwise its lucide glyph tinted by its
 * main macro, on a tile sized for the space available. Decorative — the
 * food's name always sits beside it — so it is hidden from screen readers.
 */
export function FoodThumb({ foodId, variant = 'row' }: { foodId: string; variant?: FoodThumbVariant }) {
  const theme = useTheme();
  const size = useFoodThumbSize(variant);
  const photo = foodPhoto(foodId);

  return (
    <View
      aria-hidden
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          // A quarter of the side, on iOS's continuous curve: the same rounding
          // the system gives app icons and list thumbnails, at any size.
          borderRadius: Math.round(size * 0.24),
          backgroundColor: theme.backgroundElement,
        },
      ]}>
      {photo ? (
        // Square packshots on white: cover-fit fills the tile edge to edge.
        <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} accessibilityIgnoresInvertColors />
      ) : (
        <FoodGlyph foodId={foodId} size={Math.round(size * 0.5)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
