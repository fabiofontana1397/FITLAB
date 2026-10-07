/**
 * The recipe layer of the Fit Lab framework. A dish says which foods may play which role
 * ("porridge": oats or cream of rice + whey/yogurt + fruit + nuts), so only pairings that
 * make culinary sense can ever be built — a yogurt never lands next to pasta and bread.
 * The quantities are not here: they are solved afterwards from the person's targets
 * (fitlab/solver.ts), so the same dish weighs differently for each person.
 *
 * Every food id must belong to the catalog of the dish's slots (checked by the test harness).
 */
import type { SlotKind } from './catalog';

export type Dish = {
  id: string;
  kinds: SlotKind[];
  /** Name template: {p} protein, {pc} protein as cooked, {c} carb, {v} vegetable, {f} fat, {fr} fruit. */
  name: string;
  protein: string[];
  carb: string[];
  fat?: string[];
  veg?: string[];
  fruit?: string[];
  /** A cooking fat is part of the recipe (at least a spoon of it). */
  cookingFat?: boolean;
  /** Zero-calorie flavourings that make it a real dish. */
  flavor: string[];
  /** Fine for a packed lunch / eating out. */
  portable?: boolean;
  /** Extra proteins only for people who eat no meat or fish (outside the omnivore catalog). */
  meatlessProtein?: string[];
  /** Only for people who eat no meat or fish (these dishes rely on foods outside the omnivore catalog). */
  meatless?: boolean;
};

const BF_FRUIT = ['banana', 'apple', 'kiwi', 'blueberries', 'orange', 'strawberries'];
const BF_FAT = ['almonds', 'walnuts', 'peanut-butter', 'chia-seeds'];
const SNACK_FRUIT = ['banana', 'apple', 'pear', 'kiwi', 'orange', 'blueberries'];
const MAIN: SlotKind[] = ['lunch', 'dinner'];

export const DISHES: Dish[] = [
  // ------------------------------------------------------------ breakfast --
  {
    id: 'porridge',
    kinds: ['breakfast'],
    name: 'Porridge proteico di {c} con {fr}',
    protein: ['whey-protein', 'greek-yogurt-0', 'skyr', 'yogurt-protein', 'milk-lactose-free'],
    carb: ['oats', 'cream-of-rice'],
    fruit: BF_FRUIT,
    fat: BF_FAT,
    flavor: ['cannella'],
  },
  {
    id: 'yogurt-bowl',
    kinds: ['breakfast'],
    name: 'Bowl di {p} con {c} e {fr}',
    protein: ['greek-yogurt-0', 'skyr', 'yogurt-protein', 'kefir', 'cottage-cheese'],
    carb: ['granola', 'muesli', 'cereals-wholegrain', 'oats'],
    fruit: BF_FRUIT,
    fat: ['almonds', 'walnuts', 'chia-seeds'],
    flavor: ['cannella'],
  },
  {
    id: 'toast-fresh',
    kinds: ['breakfast'],
    name: 'Toast con {p} e {fr}',
    protein: ['ricotta-magra', 'cottage-cheese'],
    carb: ['bread-wholegrain', 'bread-rye'],
    fruit: ['kiwi', 'apple', 'orange', 'strawberries', 'banana'],
    fat: ['peanut-butter', 'almonds', 'walnuts'],
    flavor: ['cannella'],
  },
  {
    id: 'fette-fresh',
    kinds: ['breakfast'],
    name: 'Fette biscottate con {p} e {fr}',
    protein: ['ricotta-magra', 'cottage-cheese', 'greek-yogurt-0', 'skyr'],
    carb: ['fette-biscottate'],
    fruit: BF_FRUIT,
    fat: ['peanut-butter', 'almonds', 'walnuts'],
    flavor: [],
  },
  {
    id: 'scrambled',
    kinds: ['breakfast'],
    name: 'Strapazzata di {p} con {c} e {fr}',
    protein: ['eggs', 'egg-whites'],
    carb: ['bread-wholegrain', 'bread-rye'],
    fruit: ['orange', 'kiwi', 'apple', 'strawberries', 'banana'],
    fat: ['almonds', 'walnuts'],
    flavor: ['erba cipollina', 'pepe nero'],
  },
  {
    id: 'pancake',
    kinds: ['breakfast'],
    name: 'Pancake proteici di avena e {fr}',
    protein: ['eggs', 'egg-whites'],
    carb: ['oats'],
    fruit: ['banana', 'blueberries', 'strawberries', 'apple'],
    fat: ['peanut-butter', 'almonds', 'walnuts', 'chia-seeds'],
    flavor: ['cannella', 'vaniglia'],
  },
  {
    id: 'cakes-fresh',
    kinds: ['breakfast'],
    name: 'Gallette con {p} e {fr}',
    protein: ['cottage-cheese', 'ricotta-magra', 'greek-yogurt-0'],
    carb: ['rice-cakes'],
    fruit: BF_FRUIT,
    fat: ['peanut-butter', 'almonds'],
    flavor: [],
  },

  // --------------------------------------------------------------- snack --
  {
    id: 'snack-yogurt',
    kinds: ['snack'],
    name: '{p} con {c} e {f}',
    protein: ['greek-yogurt-0', 'skyr', 'yogurt-protein', 'kefir'],
    carb: SNACK_FRUIT,
    fat: ['almonds', 'walnuts', 'pistachios', 'hazelnuts', 'chia-seeds', 'pumpkin-seeds'],
    flavor: [],
  },
  {
    id: 'snack-shake',
    kinds: ['snack'],
    name: 'Shake proteico con {c} e {f}',
    protein: ['whey-protein'],
    carb: ['banana', 'blueberries', 'apple'],
    fat: ['peanut-butter', 'almond-butter', 'almonds'],
    flavor: ['ghiaccio'],
  },
  {
    id: 'snack-drink',
    kinds: ['snack'],
    name: 'Bevanda proteica con {c} e {f}',
    protein: ['protein-drink'],
    carb: SNACK_FRUIT,
    fat: ['almonds', 'walnuts', 'hazelnuts', 'pistachios'],
    flavor: [],
  },
  {
    id: 'snack-cakes-cottage',
    kinds: ['snack'],
    name: 'Gallette con fiocchi di latte e {f}',
    protein: ['cottage-cheese'],
    carb: ['rice-cakes', 'corn-cakes'],
    fat: ['peanut-butter', 'almond-butter', 'walnuts'],
    flavor: ['pepe nero'],
  },
  {
    id: 'snack-bresaola',
    kinds: ['snack'],
    name: 'Bresaola e avocado su {c}',
    protein: ['bresaola'],
    carb: ['bread-wholegrain', 'fette-biscottate', 'rice-cakes', 'corn-cakes'],
    fat: ['avocado'],
    flavor: ['limone', 'pepe nero'],
  },
  {
    id: 'snack-pudding',
    kinds: ['snack'],
    name: 'Budino proteico con {c} e {f}',
    protein: ['protein-pudding'],
    carb: ['blueberries', 'banana', 'kiwi', 'orange'],
    fat: ['almonds', 'hazelnuts', 'pistachios', 'chia-seeds', 'almond-butter'],
    flavor: [],
  },
  {
    id: 'snack-bar',
    kinds: ['snack'],
    name: 'Barretta proteica e {c}',
    protein: ['protein-bar'],
    carb: ['apple', 'banana', 'orange', 'pear', 'kiwi'],
    fat: ['almonds', 'walnuts'],
    flavor: [],
  },
  {
    id: 'snack-cottage-fruit',
    kinds: ['snack'],
    name: 'Fiocchi di latte con {c} e {f}',
    protein: ['cottage-cheese'],
    carb: ['pear', 'apple', 'kiwi', 'blueberries', 'orange'],
    fat: ['walnuts', 'almonds', 'pistachios', 'pumpkin-seeds'],
    flavor: ['cannella'],
  },

  // ---------------------------------------------------- lunch and dinner --
  {
    id: 'bowl',
    kinds: MAIN,
    name: 'Bowl di {p} con {c} e {v}',
    protein: ['chicken-breast', 'turkey-breast', 'beef-lean', 'salmon', 'shrimp', 'cod', 'sea-bream'],
    carb: ['rice-basmati', 'couscous', 'quinoa', 'farro-cooked'],
    veg: ['zucchini', 'bell-pepper-red', 'spinach', 'broccoli', 'cherry-tomato', 'carrot', 'green-beans', 'eggplant'],
    fat: ['olive-oil', 'avocado', 'almonds', 'pistachios', 'tahini'],
    cookingFat: true,
    flavor: ['limone', 'erbe aromatiche', 'spezie a piacere'],
    portable: true,
  },
  {
    id: 'pasta-tuna',
    kinds: MAIN,
    name: 'Pasta al tonno mediterranea',
    protein: ['tuna-canned'],
    carb: ['pasta'],
    veg: ['cherry-tomato'],
    fat: ['olive-oil'],
    cookingFat: true,
    flavor: ['olive nere', 'basilico', 'aglio'],
    portable: true,
  },
  {
    id: 'pasta-shrimp',
    kinds: MAIN,
    name: 'Pasta con gamberi e {v}',
    protein: ['shrimp'],
    carb: ['pasta'],
    veg: ['zucchini', 'cherry-tomato'],
    fat: ['olive-oil'],
    cookingFat: true,
    flavor: ['aglio', 'prezzemolo', 'limone'],
  },
  {
    id: 'pasta-ragu',
    kinds: MAIN,
    name: 'Pasta al ragù leggero di manzo',
    protein: ['beef-lean'],
    carb: ['pasta'],
    veg: ['carrot', 'cherry-tomato', 'zucchini'],
    fat: ['olive-oil'],
    cookingFat: true,
    flavor: ['cipolla', 'passata di pomodoro', 'basilico'],
  },
  {
    id: 'pasta-protein',
    kinds: MAIN,
    name: 'Pasta con {p} e {v}',
    protein: ['chicken-breast', 'turkey-breast', 'salmon'],
    carb: ['pasta'],
    veg: ['zucchini', 'cherry-tomato', 'broccoli', 'spinach', 'bell-pepper-red'],
    fat: ['olive-oil'],
    cookingFat: true,
    flavor: ['aglio', 'peperoncino', 'erbe fresche'],
  },
  {
    id: 'secondo',
    kinds: MAIN,
    name: '{pc} con {c} al forno e {v}',
    protein: ['chicken-breast', 'turkey-breast', 'beef-lean', 'veal-cutlet', 'salmon', 'cod', 'sea-bream', 'shrimp'],
    carb: ['potato', 'sweet-potato'],
    veg: ['broccoli', 'green-beans', 'carrot', 'zucchini', 'cauliflower', 'mixed-salad', 'spinach', 'eggplant'],
    fat: ['olive-oil'],
    cookingFat: true,
    flavor: ['rosmarino', 'limone', 'erbe aromatiche'],
  },
  {
    id: 'frittata',
    kinds: MAIN,
    name: 'Frittata di {v} con {c}',
    protein: ['eggs'],
    carb: ['bread-wholegrain'],
    veg: ['zucchini', 'spinach', 'bell-pepper-red', 'eggplant', 'broccoli'],
    fat: ['olive-oil'],
    cookingFat: true,
    flavor: ['erba cipollina', 'pepe nero'],
  },
  {
    id: 'legume-salad',
    kinds: MAIN,
    name: 'Insalata di {c} e {p}',
    protein: ['tuna-canned', 'eggs', 'turkey-breast', 'shrimp'],
    meatlessProtein: ['tofu', 'ricotta-magra'],
    carb: ['chickpeas', 'lentils', 'cannellini-beans', 'borlotti-beans'],
    veg: ['mixed-salad', 'cherry-tomato', 'carrot', 'bell-pepper-red'],
    fat: ['olive-oil', 'tahini'],
    flavor: ['limone', 'prezzemolo', 'cipolla rossa'],
    portable: true,
  },
  {
    id: 'legume-grain',
    kinds: MAIN,
    name: '{c} e {p}',
    protein: ['chickpeas', 'lentils', 'cannellini-beans', 'borlotti-beans'],
    meatlessProtein: ['tofu', 'ricotta-magra'],
    carb: ['pasta', 'farro-cooked', 'rice-basmati', 'quinoa', 'couscous'],
    veg: ['spinach', 'zucchini', 'carrot', 'cherry-tomato', 'broccoli'],
    fat: ['olive-oil'],
    cookingFat: true,
    flavor: ['rosmarino', 'pepe nero', 'aglio'],
  },
  {
    id: 'tofu-bowl',
    kinds: MAIN,
    name: 'Bowl di {p} con {c} e {v}',
    protein: ['tofu'],
    carb: ['rice-basmati', 'quinoa', 'farro-cooked', 'couscous'],
    veg: ['broccoli', 'zucchini', 'bell-pepper-red', 'spinach', 'carrot'],
    fat: ['olive-oil', 'tahini', 'almonds'],
    cookingFat: true,
    flavor: ['salsa di soia leggera', 'zenzero', 'limone'],
    meatless: true,
  },
  {
    id: 'ricotta-pasta',
    kinds: MAIN,
    name: '{c} con {p} e {v}',
    protein: ['ricotta-magra'],
    carb: ['pasta', 'gnocchi'],
    veg: ['spinach', 'zucchini', 'cherry-tomato', 'eggplant'],
    fat: ['olive-oil'],
    cookingFat: true,
    flavor: ['basilico', 'pepe nero', 'limone'],
    meatless: true,
  },
  {
    id: 'gnocchi',
    kinds: MAIN,
    name: 'Gnocchi al pomodoro con {p}',
    protein: ['chicken-breast', 'turkey-breast', 'shrimp', 'tuna-canned'],
    carb: ['gnocchi'],
    veg: ['cherry-tomato', 'zucchini', 'spinach'],
    fat: ['olive-oil'],
    cookingFat: true,
    flavor: ['basilico', 'aglio'],
  },
  {
    id: 'polenta',
    kinds: MAIN,
    name: 'Polenta con {p} e {v}',
    protein: ['beef-lean', 'turkey-breast', 'chicken-breast', 'veal-cutlet'],
    carb: ['polenta-cooked'],
    veg: ['spinach', 'broccoli', 'carrot', 'cauliflower', 'green-beans'],
    fat: ['olive-oil'],
    cookingFat: true,
    flavor: ['rosmarino', 'pepe nero'],
  },
  {
    id: 'panino',
    kinds: MAIN,
    name: 'Panino integrale con {p} e {v}',
    protein: ['tuna-canned', 'chicken-breast', 'turkey-breast', 'eggs'],
    carb: ['bread-wholegrain'],
    veg: ['mixed-salad', 'cherry-tomato'],
    fat: ['avocado', 'olive-oil'],
    flavor: ['senape', 'limone'],
    portable: true,
  },
  {
    id: 'poke',
    kinds: MAIN,
    name: 'Poke bowl di {p}',
    protein: ['salmon', 'tuna-canned', 'shrimp'],
    carb: ['rice-basmati'],
    veg: ['carrot', 'mixed-salad', 'cherry-tomato'],
    fat: ['avocado'],
    flavor: ['salsa di soia leggera', 'zenzero', 'lime'],
    portable: true,
  },
  {
    id: 'cold-salad',
    kinds: MAIN,
    name: 'Insalata di {c} con {p} e {v}',
    protein: ['tuna-canned', 'shrimp', 'eggs'],
    meatlessProtein: ['tofu'],
    carb: ['rice-basmati', 'farro-cooked', 'quinoa', 'couscous'],
    veg: ['cherry-tomato', 'carrot', 'bell-pepper-red', 'zucchini'],
    fat: ['olive-oil', 'avocado'],
    flavor: ['basilico', 'limone', 'origano'],
    portable: true,
  },
  {
    id: 'curry',
    kinds: MAIN,
    name: 'Curry di {p} con {c} e {v}',
    protein: ['chicken-breast', 'turkey-breast', 'shrimp'],
    carb: ['rice-basmati'],
    veg: ['zucchini', 'bell-pepper-red', 'spinach', 'cauliflower'],
    fat: ['olive-oil'],
    cookingFat: true,
    flavor: ['curry', 'curcuma', 'zenzero'],
  },
  {
    id: 'burger',
    kinds: MAIN,
    name: 'Hamburger di manzo con {c} e {v}',
    protein: ['beef-lean'],
    carb: ['potato', 'sweet-potato'],
    veg: ['mixed-salad', 'cherry-tomato', 'green-beans'],
    fat: ['olive-oil', 'avocado'],
    cookingFat: true,
    flavor: ['senape', 'paprika'],
  },
];
