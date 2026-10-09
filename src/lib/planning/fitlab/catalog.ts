/**
 * The Fit Lab food framework: which foods belong to which role in which meal.
 * Every meal of the diet is built from these lists first (the "structural layer");
 * everything else (recipes, quantities, variety) works inside them.
 *
 * Ids are those of lib/mock/food-database.ts.
 */
import type { MealSlot } from '@/store/nutrition-store';

export type SlotKind = 'breakfast' | 'snack' | 'lunch' | 'dinner';
export type Role = 'protein' | 'carb' | 'fat' | 'veg' | 'fruit';

export const SLOT_KIND: Record<MealSlot, SlotKind> = {
  colazione: 'breakfast',
  spuntinoMattina: 'snack',
  pranzo: 'lunch',
  spuntinoPomeriggio: 'snack',
  cena: 'dinner',
  spuntinoSera: 'snack',
};

const MAIN_PROTEIN = ['chicken-breast', 'turkey-breast', 'beef-lean', 'tuna-canned', 'salmon', 'cod', 'sea-bream', 'shrimp', 'eggs', 'chickpeas', 'lentils', 'borlotti-beans', 'cannellini-beans'];
const MAIN_CARB = ['rice-basmati', 'pasta', 'couscous', 'potato', 'sweet-potato', 'farro-cooked', 'quinoa', 'bread-wholegrain', 'gnocchi', 'polenta-cooked'];
const MAIN_FAT = ['olive-oil', 'avocado', 'almonds', 'walnuts', 'hazelnuts', 'pistachios', 'cashews', 'chia-seeds', 'flaxseed', 'tahini'];
const MAIN_VEG = ['zucchini', 'broccoli', 'spinach', 'carrot', 'cherry-tomato', 'bell-pepper-red', 'eggplant', 'mixed-salad', 'cauliflower', 'green-beans'];

export const CATALOG: Record<SlotKind, Partial<Record<Role, string[]>>> = {
  breakfast: {
    protein: ['greek-yogurt-0', 'skyr', 'yogurt-protein', 'milk-lactose-free', 'whey-protein', 'eggs', 'egg-whites', 'cottage-cheese', 'kefir', 'ricotta-magra'],
    carb: ['oats', 'bread-wholegrain', 'bread-rye', 'fette-biscottate', 'muesli', 'cereals-wholegrain', 'rice-cakes', 'cream-of-rice', 'granola'],
    fruit: ['banana', 'apple', 'kiwi', 'blueberries', 'orange', 'strawberries'],
    fat: ['almonds', 'walnuts', 'peanut-butter', 'chia-seeds'],
  },
  snack: {
    protein: ['greek-yogurt-0', 'skyr', 'yogurt-protein', 'whey-protein', 'protein-pudding', 'protein-bar', 'protein-drink', 'cottage-cheese', 'kefir', 'bresaola'],
    carb: ['banana', 'apple', 'pear', 'kiwi', 'orange', 'blueberries', 'rice-cakes', 'corn-cakes', 'bread-wholegrain', 'fette-biscottate'],
    fat: ['almonds', 'walnuts', 'hazelnuts', 'pistachios', 'cashews', 'peanut-butter', 'almond-butter', 'chia-seeds', 'pumpkin-seeds', 'avocado'],
  },
  lunch: { protein: MAIN_PROTEIN, carb: MAIN_CARB, fat: MAIN_FAT, veg: MAIN_VEG },
  dinner: { protein: [...MAIN_PROTEIN, 'veal-cutlet'], carb: MAIN_CARB, fat: MAIN_FAT, veg: MAIN_VEG },
};

/** Extra foods that keep a meal buildable when the person's exclusions empty a role's list (still the same kind of food). */
export const FALLBACK: Record<SlotKind, Partial<Record<Role, string[]>>> = {
  breakfast: { protein: ['plant-protein', 'turkey-breast-smoked', 'bresaola', 'tofu', 'protein-bar'], carb: ['bread-white', 'puffed-rice', 'corn-cakes'] },
  snack: { protein: ['plant-protein', 'turkey-breast-smoked', 'tuna-canned', 'tofu'], carb: ['bread-white', 'puffed-rice'] },
  lunch: { protein: ['tofu', 'ricotta-magra', 'cottage-cheese', 'turkey-ground', 'veal-cutlet', 'black-beans', 'white-beans'], carb: ['rice-brown-cooked', 'pasta-wholewheat', 'barley-cooked'] },
  dinner: { protein: ['tofu', 'ricotta-magra', 'cottage-cheese', 'turkey-ground', 'black-beans', 'white-beans'], carb: ['rice-brown-cooked', 'pasta-wholewheat', 'barley-cooked'] },
};

/** How a food is called inside a dish name. */
export const SHORT: Record<string, string> = {
  'chicken-breast': 'pollo',
  'turkey-breast': 'tacchino',
  'beef-lean': 'manzo magro',
  'beef-ground-lean': 'manzo magro',
  'veal-cutlet': 'vitello',
  'tuna-canned': 'tonno',
  salmon: 'salmone',
  cod: 'merluzzo',
  'sea-bream': 'orata',
  shrimp: 'gamberi',
  eggs: 'uova',
  'egg-whites': 'albumi',
  chickpeas: 'ceci',
  lentils: 'lenticchie',
  'borlotti-beans': 'fagioli borlotti',
  'cannellini-beans': 'fagioli cannellini',
  tofu: 'tofu',
  'rice-basmati': 'riso basmati',
  'rice-brown-cooked': 'riso integrale',
  pasta: 'pasta',
  'pasta-wholewheat': 'pasta integrale',
  couscous: 'cous cous',
  potato: 'patate',
  'sweet-potato': 'patate dolci',
  'farro-cooked': 'farro',
  quinoa: 'quinoa',
  'barley-cooked': 'orzo',
  'bread-wholegrain': 'pane integrale',
  gnocchi: 'gnocchi',
  'polenta-cooked': 'polenta',
  zucchini: 'zucchine',
  broccoli: 'broccoli',
  spinach: 'spinaci',
  carrot: 'carote',
  'cherry-tomato': 'pomodorini',
  'bell-pepper-red': 'peperoni',
  eggplant: 'melanzane',
  'mixed-salad': 'insalata',
  cauliflower: 'cavolfiore',
  'green-beans': 'fagiolini',
  'greek-yogurt-0': 'yogurt greco',
  skyr: 'skyr',
  'yogurt-protein': 'yogurt proteico',
  kefir: 'kefir',
  'cottage-cheese': 'fiocchi di latte',
  'ricotta-magra': 'ricotta',
  'whey-protein': 'proteine whey',
  'milk-lactose-free': 'latte senza lattosio',
  oats: 'avena',
  'cream-of-rice': 'crema di riso',
  muesli: 'muesli',
  granola: 'granola',
  'cereals-wholegrain': 'cereali integrali',
  'bread-rye': 'pane di segale',
  'fette-biscottate': 'fette biscottate',
  'rice-cakes': 'gallette di riso',
  'corn-cakes': 'gallette di mais',
  banana: 'banana',
  apple: 'mela',
  pear: 'pera',
  kiwi: 'kiwi',
  orange: 'arancia',
  blueberries: 'mirtilli',
  strawberries: 'fragole',
  almonds: 'mandorle',
  walnuts: 'noci',
  pistachios: 'pistacchi',
  hazelnuts: 'nocciole',
  cashews: 'anacardi',
  'peanut-butter': 'burro di arachidi',
  'almond-butter': 'burro di mandorle',
  avocado: 'avocado',
  'olive-oil': 'olio EVO',
  bresaola: 'bresaola',
  'protein-pudding': 'budino proteico',
  'protein-bar': 'barretta proteica',
  'plant-protein': 'proteine vegetali',
  'turkey-breast-smoked': 'tacchino affumicato',
  'protein-drink': 'bevanda proteica',
};

export const short = (id: string, fallback: string): string => SHORT[id] ?? fallback.toLowerCase();

/** Dish names say how a protein is cooked ("Pollo alla piastra"). */
export const COOKED: Record<string, string> = {
  'chicken-breast': 'Pollo alla piastra',
  'turkey-breast': 'Tacchino alla piastra',
  'beef-lean': 'Straccetti di manzo',
  'beef-ground-lean': 'Manzo magro',
  'veal-cutlet': 'Vitello alla piastra',
  salmon: 'Salmone al forno',
  cod: 'Merluzzo al forno',
  'sea-bream': 'Orata al forno',
  shrimp: 'Gamberi saltati',
  'tuna-canned': 'Tonno',
  eggs: 'Uova',
  tofu: 'Tofu alla piastra',
  'ricotta-magra': 'Ricotta',
  'cottage-cheese': 'Fiocchi di latte',
};
