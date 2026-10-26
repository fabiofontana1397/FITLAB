/**
 * Whether foods and dishes show their pictures (the 3D fallbacks in
 * assets/images/food-icons, the dish photos in public/images/meals). The foods'
 * own photos (assets/images/food-photos) have their own switch below.
 *
 * Off for now: every food and every dish shows the same grey tile with a
 * stylised fork and knife, so the app looks the same everywhere until a final
 * set of pictures exists. The pictures, their mappings and the components that
 * load them are all still in place — set this to `true` to bring them back.
 */
export const FOOD_IMAGES_ENABLED = false;

/**
 * Whether the foods of the meal tracker show their photo (assets/images/food-photos).
 * A food without one shows the grey fork-and-knife tile either way. Separate from
 * FOOD_IMAGES_ENABLED above, which is about the 3D pictures and the dish photos.
 */
export const FOOD_PHOTOS_ENABLED = true;
