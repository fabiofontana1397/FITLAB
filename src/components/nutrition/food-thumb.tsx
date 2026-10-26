import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { cornerSafeInset, PhotoTile } from '@/components/ui/photo-tile';
import { FOOD_IMAGES_ENABLED } from '@/constants/food-images';
import { useTheme } from '@/hooks/use-theme';
import { foodIcon } from '@/lib/nutrition/food-icons';
import { foodPhoto } from '@/lib/nutrition/food-photos';

/**
 * Where the thumbnail sits:
 * - `row`: the leading image of a list row (meal log, food search results).
 * - `hero`: the food being added, in the selected card with the grams field.
 * - `display`: the big picture at the top of a food's detail screen.
 */
export type FoodThumbVariant = 'row' | 'hero' | 'display';

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
  display: { compact: 112, regular: 132, large: 148 },
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
 * What a food looks like in the meal tracker, on a tile sized for the space
 * available: its photo when there is one (lib/nutrition/food-photos.ts),
 * otherwise its 3D picture (lib/nutrition/food-icons.ts), which exists for
 * every food. Both are cut out on a transparent background and shown whole,
 * through PhotoTile like every other food or dish photo.
 * Decorative — the food's name always sits beside it — so it is hidden from
 * screen readers.
 */
export function FoodThumb({ foodId, variant = 'row' }: { foodId: string; variant?: FoodThumbVariant }) {
  const theme = useTheme();
  const size = useFoodThumbSize(variant);
  // A quarter of the side, on iOS's continuous curve: the same rounding the
  // system gives app icons and list thumbnails, at any size.
  const radius = Math.round(size * 0.24);

  // Pictures are switched off (constants/food-images.ts): every food is the same grey tile with a fork and knife.
  if (!FOOD_IMAGES_ENABLED) {
    return (
      <View aria-hidden style={[styles.placeholder, { width: size, height: size, borderRadius: radius, backgroundColor: theme.backgroundElement }]}>
        <Icon name="utensils" size={Math.round(size * 0.42)} color={theme.textTertiary} />
      </View>
    );
  }
  const icon = foodIcon(foodId);
  const inner = size - 2 * cornerSafeInset(radius);

  // A photo file that fails to load falls back to the food's 3D picture.
  return (
    <PhotoTile
      source={foodPhoto(foodId) ?? icon}
      width={size}
      radius={radius}
      background={theme.backgroundElement}
      fallback={<Image source={icon} style={{ width: inner, height: inner }} contentFit="contain" transition={0} />}
      recyclingKey={foodId}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
