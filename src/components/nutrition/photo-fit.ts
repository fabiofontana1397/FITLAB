/**
 * How food and dish photos sit in their rounded tiles: always whole.
 *
 * The photo is drawn with `contentFit="contain"` — scaled down until all of
 * it fits, centred, never cropped or zoomed, whatever its proportions — and
 * inset from the tile's edge by just enough that the rounded corners can't
 * clip it either: a corner of radius r cuts r·(1 − 1/√2) ≈ 0.29·r into the
 * square it rounds. Whatever room is left shows the tile's own background.
 */
export function cornerSafeInset(radius: number): number {
  return Math.ceil(radius * (1 - Math.SQRT1_2));
}
