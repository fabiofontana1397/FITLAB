/**
 * Photos for the Fit Lab dishes. The image library (data/meal-images.json) is
 * its own catalog of pictures, keyed by a stable slug; which dish shows which
 * picture is the explicit map below, so the dishes themselves (ids, foods,
 * quantities) stay untouched and one photo can serve every dish it fits.
 *
 * `image` is a path, not a bundled asset: on the web it resolves against the
 * site (files in public/images/meals), and EXPO_PUBLIC_MEAL_IMAGE_BASE_URL can
 * point it at a CDN later without touching the catalog or the screens (see
 * DishPhoto). Plain data with no React Native import, so Node scripts
 * (scripts/check-meal-images.ts) can load it too.
 */
import type { SlotKind } from './catalog';
import library from './data/meal-images.json';

export type MealImage = {
  /** Stable slug, also the file name (`<id>.webp`). */
  id: string;
  name: string;
  category: SlotKind;
  /** Site-relative path, e.g. "/images/meals/risotto-funghi.webp". */
  image: string;
  /** What the photo shows, for screen readers. */
  alt: string;
};

export const MEAL_IMAGES = library as MealImage[];

const BY_ID = new Map(MEAL_IMAGES.map((m) => [m.id, m]));

/** Dish id (dishes.ts) → photo id. Only dishes the photo honestly depicts:
 * the same plate look (base, main ingredients), even when a garnish differs. */
export const DISH_IMAGE_IDS: Record<string, string> = {
  // colazione
  PL001: 'porridge-frutti-bosco',
  PL003: 'porridge-frutti-bosco',
  X104: 'porridge-frutti-bosco',
  X106: 'porridge-frutti-bosco',
  PL004: 'yogurt-frutta-granola',
  PL006: 'toast-avocado-uova',
  PL007: 'pancake-banana-mirtilli',
  // spuntino
  PL012: 'yogurt-frutta-granola',
  PL021: 'toast-avocado-uova',
  // pranzo e cena
  PL023: 'spaghetti-pomodoro',
  PL044: 'spaghetti-pomodoro',
  X321: 'penne-zucchine',
  X302: 'risotto-funghi',
  PL025: 'farro-verdure-feta',
  X306: 'farro-verdure-feta',
  PL036: 'pollo-patate-insalata',
  X308: 'pollo-patate-insalata',
  X313: 'salmone-cereali-zucchine',
  X328: 'salmone-cereali-zucchine',
  PL047: 'frittata-spinaci-pomodori',
};

/** The photo for a dish, or undefined when the library has none for it. */
export function dishImage(dishId: string | undefined): MealImage | undefined {
  if (!dishId) return undefined;
  const id = DISH_IMAGE_IDS[dishId];
  return id ? BY_ID.get(id) : undefined;
}
