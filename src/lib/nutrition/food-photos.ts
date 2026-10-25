import type { ImageSourcePropType } from 'react-native';

import { findFood } from '@/lib/mock/food-database';

/**
 * Photos of individual foods for the meal tracker (assets/images/foods, see
 * the README there for where they come from). A food without a fitting
 * photo shows its 3D picture instead (food-icons.ts), so this map only has
 * to be right, never complete.
 */
const PHOTOS = {
  arancia: require('@/assets/images/foods/arancia.webp'),
  avocado: require('@/assets/images/foods/avocado.webp'),
  banana: require('@/assets/images/foods/banana.webp'),
  broccoli: require('@/assets/images/foods/broccoli.webp'),
  carote: require('@/assets/images/foods/carote.webp'),
  ceci: require('@/assets/images/foods/ceci.webp'),
  couscous: require('@/assets/images/foods/couscous.webp'),
  'fagioli-borlotti': require('@/assets/images/foods/fagioli-borlotti.webp'),
  'fagioli-cannellini': require('@/assets/images/foods/fagioli-cannellini.webp'),
  farro: require('@/assets/images/foods/farro.webp'),
  fave: require('@/assets/images/foods/fave.webp'),
  'fiocchi-avena': require('@/assets/images/foods/fiocchi-avena.webp'),
  fragole: require('@/assets/images/foods/fragole.webp'),
  fusilli: require('@/assets/images/foods/fusilli.webp'),
  gnocchi: require('@/assets/images/foods/gnocchi.webp'),
  lasagne: require('@/assets/images/foods/lasagne.webp'),
  lattuga: require('@/assets/images/foods/lattuga.webp'),
  lenticchie: require('@/assets/images/foods/lenticchie.webp'),
  maiale: require('@/assets/images/foods/maiale.webp'),
  mandorle: require('@/assets/images/foods/mandorle.webp'),
  manzo: require('@/assets/images/foods/manzo.webp'),
  mela: require('@/assets/images/foods/mela.webp'),
  melanzana: require('@/assets/images/foods/melanzana.webp'),
  merluzzo: require('@/assets/images/foods/merluzzo.webp'),
  mirtilli: require('@/assets/images/foods/mirtilli.webp'),
  mozzarella: require('@/assets/images/foods/mozzarella.webp'),
  noci: require('@/assets/images/foods/noci.webp'),
  orzo: require('@/assets/images/foods/orzo.webp'),
  parmigiano: require('@/assets/images/foods/parmigiano.webp'),
  'pasta-integrale': require('@/assets/images/foods/pasta-integrale.webp'),
  penne: require('@/assets/images/foods/penne.webp'),
  peperone: require('@/assets/images/foods/peperone.webp'),
  'petto-pollo': require('@/assets/images/foods/petto-pollo.webp'),
  piselli: require('@/assets/images/foods/piselli.webp'),
  polenta: require('@/assets/images/foods/polenta.webp'),
  pomodorini: require('@/assets/images/foods/pomodorini.webp'),
  quinoa: require('@/assets/images/foods/quinoa.webp'),
  ricotta: require('@/assets/images/foods/ricotta.webp'),
  riso: require('@/assets/images/foods/riso.webp'),
  salmone: require('@/assets/images/foods/salmone.webp'),
  soia: require('@/assets/images/foods/soia.webp'),
  spaghetti: require('@/assets/images/foods/spaghetti.webp'),
  tacchino: require('@/assets/images/foods/tacchino.webp'),
  tagliatelle: require('@/assets/images/foods/tagliatelle.webp'),
  tonno: require('@/assets/images/foods/tonno.webp'),
  uova: require('@/assets/images/foods/uova.webp'),
  uva: require('@/assets/images/foods/uva.webp'),
  'yogurt-greco': require('@/assets/images/foods/yogurt-greco.webp'),
  zucchine: require('@/assets/images/foods/zucchine.webp'),
} satisfies Record<string, ImageSourcePropType>;

export type FoodPhotoKey = keyof typeof PHOTOS;

/**
 * Matched against "<id> <name>" in lower case; the first rule that matches
 * wins. `null` means "has no fitting photo": those rules come first so a
 * product is never shown as the raw food it is named after (soy sauce is not
 * soy beans, almond butter is not almonds, a rice cake is not rice).
 */
const RULES: [RegExp, FoodPhotoKey | null][] = [
  // Products named after a food they do not look like.
  [/soy-sauce|salsa di soia|bevanda|drink|latte di|milk|tofu|tempeh/, null],
  [/butter|burro di|crema di|spread|pesto|hummus|ketchup|passata|sugo|salsa/, null],
  [/rice-cake|corn-cake|galletta|gallette|cracker|bar\b|barretta|muesli|granola|cereal|biscott|farina|flour/, null],
  [/pineapple|ananas|prosciutto|bresaola|salame|speck|mortadella|wurstel|affettat|bacon|pancetta/, null],
  // Oils are not the fruit or nut they are pressed from.
  [/\bolio\b|\boil\b|-oil/, null],
  // Look-alike names that are a different food from the photo.
  [/sardin|concentrato|pomodori secchi|sun-dried/, null],
  [/fagiolini|green-bean|taccole|snow-pea/, null],
  [/mirtilli rossi|cranberr|uva spina|gooseberr|soffiat|puffed/, null],
  [/macadamia|brasile|brazil|pecan/, null],

  // Pasta (wholewheat is caught before these rules): the specific shapes first, then any other pasta as penne.
  [/gnocchi/, 'gnocchi'],
  [/lasagn/, 'lasagne'],
  [/spaghett|linguin|bucatin|vermicell/, 'spaghetti'],
  [/fusill/, 'fusilli'],
  [/tagliatell|fettuccin|pappardell|noodle/, 'tagliatelle'],
  [/penne|rigaton|maccheron|\bpasta\b/, 'penne'],

  // Grains.
  [/\boats\b|oat-|avena/, 'fiocchi-avena'],
  [/quinoa/, 'quinoa'],
  [/farro|spelt/, 'farro'],
  [/cous/, 'couscous'],
  [/\borzo\b|barley/, 'orzo'],
  [/polenta/, 'polenta'],
  [/\brice\b|rice-|\briso\b/, 'riso'],

  // Pulses.
  [/chickpea|\bceci\b/, 'ceci'],
  [/lentil|lenticch/, 'lenticchie'],
  [/broad-bean|\bfave\b|\bfava\b/, 'fave'],
  [/cannellin|fagioli bianchi|white-bean/, 'fagioli-cannellini'],
  [/borlott|kidney|black-bean|\bbeans?\b|fagioli/, 'fagioli-borlotti'],
  [/\bpeas\b|piselli/, 'piselli'],
  [/soy|soia|edamame/, 'soia'],

  // Meat and fish.
  [/fegato|liver/, null],
  [/chicken|\bpollo\b/, 'petto-pollo'],
  [/turkey|tacchino/, 'tacchino'],
  [/pork|maiale|lonza/, 'maiale'],
  [/beef|manzo|vitell|veal|steak/, 'manzo'],
  [/salmon/, 'salmone'],
  [/tuna|tonno/, 'tonno'],
  [/\bcod\b|cod-|merluzzo|baccal|nasello|hake/, 'merluzzo'],

  // Dairy and eggs.
  [/mozzarella|fior.di.latte/, 'mozzarella'],
  [/ricotta/, 'ricotta'],
  [/yogurt|skyr/, 'yogurt-greco'],
  [/parmigian|parmesan|\bgrana\b/, 'parmigiano'],
  [/\beggs?\b|egg-|uova|uovo|albume/, 'uova'],

  // Nuts.
  [/almond|mandorl/, 'mandorle'],
  [/walnut|\bnoci\b/, 'noci'],

  // Fruit.
  [/grapefruit|pompelmo|orange|arancia|arance|mandarin|clementin/, 'arancia'],
  [/apple|\bmela\b|\bmele\b/, 'mela'],
  [/banana/, 'banana'],
  [/strawberr|fragol/, 'fragole'],
  [/blueberr|mirtill/, 'mirtilli'],
  [/grape|\buva\b/, 'uva'],
  [/avocado/, 'avocado'],

  // Vegetables.
  [/lettuce|lattuga|insalata|mixed-salad|rucola|rocket/, 'lattuga'],
  [/tomato|pomodor/, 'pomodorini'],
  [/zucchin|courgette/, 'zucchine'],
  [/carrot|carot/, 'carote'],
  [/broccol/, 'broccoli'],
  [/bell-pepper|peperon(?!cino)/, 'peperone'],
  [/eggplant|aubergine|melanzan/, 'melanzana'],
];

export function foodPhotoKey(foodId: string): FoodPhotoKey | null {
  const food = findFood(foodId);
  const haystack = `${foodId} ${food?.name ?? ''}`.toLowerCase();
  // Wholewheat pasta has its own photo; any other "integrale" product (bread, rice…) is left to the general rules.
  if (/integral|wholewheat|whole-wheat/.test(haystack) && /pasta|penne|spaghett|fusill/.test(haystack)) return 'pasta-integrale';
  return RULES.find(([re]) => re.test(haystack))?.[1] ?? null;
}

export function foodPhoto(foodId: string): ImageSourcePropType | null {
  const key = foodPhotoKey(foodId);
  return key ? PHOTOS[key] : null;
}
