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

/**
 * Which photo each recipe of the pool shows (dishes.ts). One photo per recipe, made for that recipe: the recipe's foods
 * never change (only the grams do), so the photo always shows what the plan says. A new recipe needs its own photo
 * (docs/MEAL-IMAGES.md); `npm run meals:check` fails when one is missing.
 */
export const DISH_IMAGE_IDS: Record<string, string> = {
  B01: 'pl001',
  B02: 'pl003',
  B03: 'b03',
  B04: 'pl021',
  B05: 'x103',
  B06: 'b06',
  B07: 'pl005',
  B08: 'pl009',
  B09: 'pl004',
  B10: 'b10',
  B11: 'x104',
  B12: 'b12',
  B13: 'pl007',
  B14: 'pl008',
  B15: 'pl013',
  B16: 'pl010',
  B17: 'x102',
  B18: 'b18',
  B19: 'x106',
  B20: 'b20',
  S01: 'pl012',
  S02: 's02',
  S03: 's03',
  S04: 'x202',
  S05: 'pl020',
  S06: 's06',
  S07: 's07',
  S08: 'pl015',
  S09: 'pl014',
  S10: 'x204',
  S11: 'x205',
  S12: 'pl018',
  S13: 'x201',
  S14: 'x206',
  S15: 'x207',
  S16: 'x208',
  S17: 'pl022',
  S18: 'pl019',
  S19: 's19',
  S20: 's20',
  L01: 'pl023',
  L02: 'l02',
  L03: 'x304',
  L04: 'l04',
  L05: 'l05',
  L06: 'l06',
  L07: 'l07',
  L08: 'l08',
  L09: 'l09',
  L10: 'l10',
  L11: 'l11',
  L12: 'l12',
  L13: 'l13',
  L14: 'l14',
  L15: 'l15',
  L16: 'l16',
  L17: 'l17',
  L18: 'l18',
  L19: 'l19',
  L20: 'l20',
  L21: 'l21',
  L22: 'l22',
  L23: 'x320',
  L24: 'pollo-patate-insalata',
  L25: 'l25',
  L26: 'l26',
  L27: 'l27',
  L28: 'x315',
  L29: 'l29',
  L30: 'l30',
  L31: 'l31',
  L32: 'l32',
  L33: 'l33',
  L34: 'l34',
  L35: 'l35',
  L36: 'l36',
  L37: 'l37',
  L38: 'l38',
  L39: 'l39',
  L40: 'l40',
  L41: 'l41',
  L42: 'l42',
  L43: 'l43',
  L44: 'x325',
  L45: 'l45',
  L46: 'l46',
  L47: 'l47',
  L48: 'l48',
  L49: 'l49',
  L50: 'l50',
  D01: 'pl028',
  D02: 'pl030',
  D03: 'pl031',
  D04: 'x309',
  D05: 'salmone-cereali-zucchine',
  D06: 'x319',
  D07: 'x321',
  D08: 'x327',
  D09: 'x317',
  D10: 'x301',
  D11: 'pl024',
  D12: 'd12',
  D13: 'd13',
  D14: 'd14',
  D15: 'd15',
  D16: 'd16',
  D17: 'd17',
  D18: 'd18',
  D19: 'd19',
  D20: 'd20',
  D21: 'd21',
  D22: 'd22',
  D23: 'd23',
  D24: 'd24',
  D25: 'd25',
  D26: 'd26',
  D27: 'd27',
  D28: 'd28',
  D29: 'd29',
  D30: 'd30',
  D31: 'd31',
  D32: 'd32',
  D33: 'd33',
  D34: 'd34',
  D35: 'd35',
  D36: 'd36',
  D37: 'd37',
  D38: 'd38',
  D39: 'd39',
  D40: 'd40',
  D41: 'd41',
  D42: 'd42',
  D43: 'd43',
  D44: 'd44',
  D45: 'd45',
  D46: 'd46',
  D47: 'd47',
  D48: 'd48',
  D49: 'd49',
  D50: 'd50',
  R01: 'r01',
  R02: 'r02',
  R03: 'r03',
  R04: 'r04',
};

/** The photo of a recipe, or undefined for a dish outside the pool (an old saved plan, a custom diet). */
export function dishImage(dishId: string | undefined, _foodNames?: string[]): MealImage | undefined {
  if (!dishId) return undefined;
  const id = DISH_IMAGE_IDS[dishId];
  return id ? BY_ID.get(id) : undefined;
}
