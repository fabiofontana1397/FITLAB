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
  // foto dedicate PL001–PL032 (PL002 non è nel catalogo ricette)
  PL001: 'pl001',
  PL003: 'pl003',
  PL004: 'pl004',
  PL005: 'pl005',
  PL006: 'pl006',
  PL007: 'pl007',
  PL008: 'pl008',
  PL009: 'pl009',
  PL010: 'pl010',
  PL011: 'pl011',
  PL012: 'pl012',
  PL013: 'pl013',
  PL014: 'pl014',
  PL015: 'pl015',
  PL016: 'pl016',
  PL017: 'pl017',
  PL018: 'pl018',
  PL019: 'pl019',
  PL020: 'pl020',
  PL021: 'pl021',
  PL022: 'pl022',
  PL023: 'pl023',
  PL024: 'pl024',
  PL025: 'pl025',
  PL026: 'pl026',
  PL027: 'pl027',
  PL028: 'pl028',
  PL029: 'pl029',
  PL030: 'pl030',
  PL031: 'pl031',
  PL032: 'pl032',
  // colazione
  X104: 'porridge-frutti-bosco',
  X106: 'porridge-frutti-bosco',
  // spuntino
  // pranzo e cena
  PL044: 'spaghetti-pomodoro',
  X321: 'penne-zucchine',
  X302: 'risotto-funghi',
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
