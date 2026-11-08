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
  // foto dedicate PL001–PL046, PL048 (PL002 non è nel catalogo ricette)
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
  PL034: 'pl034',
  PL035: 'pl035',
  PL036: 'pl036',
  PL037: 'pl037',
  PL038: 'pl038',
  PL039: 'pl039',
  PL040: 'pl040',
  PL041: 'pl041',
  PL042: 'pl042',
  PL043: 'pl043',
  PL044: 'pl044',
  PL045: 'pl045',
  PL046: 'pl046',
  PL048: 'pl048',
  X302: 'risotto-funghi',
  X308: 'pollo-patate-insalata',
  X313: 'salmone-cereali-zucchine',
  X328: 'salmone-cereali-zucchine',
  PL047: 'frittata-spinaci-pomodori',
};


/** Second photos of a dish for the variant of its main ingredient (another fish, another meat): tried in order after the
 * dish's own photo, each shown only when the meal has what it depicts (PHOTO_KEYS). */
export const DISH_IMAGE_VARIANTS: Record<string, string[]> = {
  PL034: ['pl034-sgombro'],
  PL036: ['pl036-tacchino'],
  PL038: ['pl038-trota'],
  PL043: ['pl043-tacchino'],
  PL045: ['pl045-orata'],
  PL048: ['pl048-sgombro'],
};

/** What each photo actually shows: the foods that must be in the meal (each inner list is "any of these") for the photo to
 * be shown. A dish allows several proteins, bases and fruits, but a photo shows one of each (here only the ingredient that gives the dish its identity: the fish, the meat, the fruit): with another one in the
 * meal (salmon where the photo has sea bream, apple where it has banana) the photo would lie, so the plate shows the
 * placeholder instead. Photos with no entry always fit their dish. */
const PHOTO_KEYS: Record<string, string[][]> = {
  pl001: [['Frutti di bosco', 'Mirtilli', 'Fragole']],
  pl003: [["Albume d'uovo"]],
  pl004: [['Kiwi']],
  pl005: [['Ricotta magra']],
  pl006: [['Avocado']],
  pl007: [['Banana']],
  pl008: [['Fiocchi di latte']],
  pl010: [['Kefir'], ['Mela']],
  pl011: [['Fesa di tacchino affettata'], ['Mela']],
  pl012: [['Mandorle']],
  pl013: [['Banana']],
  pl014: [['Ricotta magra']],
  pl015: [['Bresaola']],
  pl017: [['Kiwi']],
  pl018: [['Ceci'], ['Carote']],
  pl020: [['Kefir']],
  pl021: [['Uova intere']],
  pl022: [['Budino proteico']],
  pl023: [['Petto di pollo']],
  pl024: [['Salmone']],
  pl025: [['Petto di tacchino']],
  pl026: [['Merluzzo']],
  pl027: [['Ceci']],
  pl028: [['Orata']],
  pl029: [['Lenticchie']],
  // the photo shows polenta, which is not in the catalog yet (the dish is built on potatoes): no photo until it is
  pl030: [['Polenta'], ['Manzo magro']],
  pl031: [['Gamberi']],
  pl032: [['Manzo magro']],
  pl034: [['Tonno al naturale']],
  'pl034-sgombro': [['Sgombro']],
  pl035: [['Ricotta magra']],
  pl036: [['Hamburger di pollo magro']],
  'pl036-tacchino': [['Hamburger di tacchino magro']],
  pl037: [['Fagioli borlotti']],
  pl038: [['Salmone']],
  'pl038-trota': [['Trota']],
  pl039: [['Mozzarella', 'Mozzarella light']],
  pl040: [['Lenticchie']],
  pl041: [['Petto di tacchino']],
  pl042: [['Ceci']],
  pl043: [['Lonza di maiale magra']],
  'pl043-tacchino': [['Petto di tacchino']],
  pl044: [['Ricotta magra']],
  pl045: [['Merluzzo']],
  'pl045-orata': [['Orata']],
  pl046: [['Fagioli cannellini']],
  pl048: [['Tonno al naturale']],
  'pl048-sgombro': [['Sgombro']],
  'risotto-funghi': [['Funghi']],
  'pollo-patate-insalata': [['Petto di pollo'], ['Patate']],
  'salmone-cereali-zucchine': [['Salmone']],
  'frittata-spinaci-pomodori': [['Uova intere'], ['Spinaci']],
};

/** True when the meal's foods contain what the photo shows. */
const depicts = (photoId: string, foodNames: string[]): boolean => (PHOTO_KEYS[photoId] ?? []).every((anyOf) => anyOf.some((n) => foodNames.includes(n)));

/** The photo for a dish, or undefined when the library has none for it. With the names of the meal's foods, only a photo that
 * really shows them (see PHOTO_KEYS). */
export function dishImage(dishId: string | undefined, foodNames?: string[]): MealImage | undefined {
  if (!dishId) return undefined;
  const main = DISH_IMAGE_IDS[dishId];
  if (!main) return undefined;
  const id = [main, ...(DISH_IMAGE_VARIANTS[dishId] ?? [])].find((candidate) => !foodNames || depicts(candidate, foodNames));
  return id ? BY_ID.get(id) : undefined;
}
