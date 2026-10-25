import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';

/**
 * How far a rounded corner of radius r reaches into the square it rounds:
 * r·(1 − 1/√2) ≈ 0.29·r. Insetting the picture by this much keeps the
 * corners from ever clipping it.
 */
export function cornerSafeInset(radius: number): number {
  return Math.ceil(radius * (1 - Math.SQRT1_2));
}

export type PhotoTileProps = {
  source: ImageSource | ImageSourcePropType | string;
  width: number;
  /** Defaults to `width` (a square tile). */
  height?: number;
  radius: number;
  background: string;
  /** What the photo shows, for screen readers. Omit for decorative photos. */
  alt?: string;
  /** Shown in place of the photo when it can't be loaded (missing file, network). */
  fallback: React.ReactNode;
  /** Defer loading until the tile is near the viewport (web). */
  lazy?: boolean;
  /** Stable key so a recycled row never flashes the previous photo. */
  recyclingKey?: string;
  transition?: number;
};

/**
 * The one way FitLab shows a food or dish photo: the whole picture, always.
 *
 * - `contentFit="contain"`, centred: scaled down until all of it fits, its
 *   proportions kept, never cropped, zoomed or stretched — square, portrait
 *   or landscape alike. Spare room shows the tile's own background.
 * - Inset by `cornerSafeInset`, so the tile's rounded corners can't clip it.
 * - The tile has a fixed size, so nothing moves when the photo arrives.
 * - If the photo fails, the tile keeps its place and shows `fallback`.
 */
export function PhotoTile({ source, width, height = width, radius, background, alt, fallback, lazy, recyclingKey, transition = 0 }: PhotoTileProps) {
  // Remembers which source failed, so a tile handed a new source tries again.
  const sourceKey = typeof source === 'string' ? source : JSON.stringify(source);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const failed = failedKey === sourceKey;
  const tile = { width, height, borderRadius: radius, backgroundColor: background };

  if (failed) {
    return (
      <View style={[styles.tile, tile]} accessibilityRole={alt ? 'image' : undefined} accessibilityLabel={alt} aria-hidden={!alt}>
        {fallback}
      </View>
    );
  }

  return (
    <View style={[styles.tile, tile, { padding: cornerSafeInset(radius) }]} aria-hidden={!alt}>
      <Image
        source={typeof source === 'string' ? { uri: source } : source}
        style={styles.photo}
        contentFit="contain"
        contentPosition="center"
        loading={lazy ? 'lazy' : undefined}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey}
        transition={transition}
        accessible={!!alt}
        accessibilityLabel={alt}
        accessibilityIgnoresInvertColors
        onError={() => setFailedKey(sourceKey)}
      />
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
  photo: {
    width: '100%',
    height: '100%',
  },
});
