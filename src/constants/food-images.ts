/**
 * Whether foods and dishes show their pictures (the 3D fallbacks in
 * assets/images/food-icons, the dish photos in public/images/meals). The foods'
 * own photos (assets/images/food-photos) have their own switch below.
 *
 * On: dishes with a photo (public/images/meals) and foods with a picture show it. Set it to `false` to go back to
 * the same grey tile with a stylised fork and knife everywhere. The pictures, their mappings and the components that
 * load them stay in place either way.
 */
export const FOOD_IMAGES_ENABLED = true;

/**
 * Whether the foods of the meal tracker show their photo (assets/images/food-photos).
 * A food without one shows the grey fork-and-knife tile either way. Separate from
 * FOOD_IMAGES_ENABLED above, which is about the 3D pictures and the dish photos.
 */
export const FOOD_PHOTOS_ENABLED = true;
