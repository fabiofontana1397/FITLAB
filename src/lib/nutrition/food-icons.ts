import {
  Amphora,
  Apple,
  Avocado,
  Banana,
  Bean,
  Beef,
  Broccoli,
  Candy,
  Carrot,
  Cherry,
  Citrus,
  Cookie,
  CookingPot,
  Croissant,
  CupSoda,
  Cylinder,
  Dessert,
  Droplet,
  Droplets,
  Drumstick,
  Egg,
  Fish,
  FishSymbol,
  Flame,
  Flower,
  Grape,
  Ham,
  IceCreamBowl,
  LeafyGreen,
  Milk,
  Nut,
  Pizza,
  Salad,
  Sandwich,
  Shell,
  Shrimp,
  Soup,
  Sprout,
  Vegan,
  Wheat,
  type LucideIcon,
} from 'lucide-react-native';

import { findFood } from '@/lib/mock/food-database';
import { foodIconKey, type FoodIconKey } from '@/lib/nutrition/food-icon-keys';

/**
 * The glyph each food gets in the meal tracker, from lucide.
 *
 * Which food gets which key lives in food-icon-keys.ts and is unchanged;
 * this file only decides what each key looks like. Lucide has fewer food
 * shapes than there are keys, so some keys share a glyph (every citrus and
 * melon is the citrus slice, most stone fruit is the apple). The colour is
 * what tells those apart — see `foodMacro` below.
 */
const GLYPHS = {
  avocado: Avocado,
  bacon: Ham,
  banana: Banana,
  beans: Bean,
  bellPepper: LeafyGreen,
  blueberries: Grape,
  bowl: IceCreamBowl,
  bread: Sandwich,
  broccoli: Broccoli,
  butter: Droplets,
  // Every food behind this key is tinned fish (tuna, sardines, anchovies, salmon).
  canned: Fish,
  carrot: Carrot,
  cheese: Milk,
  cherries: Cherry,
  chestnut: Nut,
  chocolate: Candy,
  coconut: Nut,
  corn: Wheat,
  croissant: Croissant,
  cucumber: LeafyGreen,
  custard: Dessert,
  drink: CupSoda,
  egg: Egg,
  eggplant: LeafyGreen,
  fish: Fish,
  garlic: Sprout,
  grains: Wheat,
  grapes: Grape,
  greenApple: Apple,
  honey: Droplet,
  hotPepper: Flame,
  jar: Cylinder,
  kiwi: Citrus,
  leafy: LeafyGreen,
  lemon: Citrus,
  mango: Apple,
  meat: Beef,
  meatOnBone: Ham,
  melon: Citrus,
  milk: Milk,
  mushroom: Vegan,
  octopus: FishSymbol,
  olive: Amphora,
  onion: Sprout,
  orange: Citrus,
  oyster: Shell,
  pasta: CookingPot,
  peaPod: Bean,
  peach: Apple,
  peanuts: Nut,
  pear: Apple,
  pineapple: Citrus,
  pizza: Pizza,
  potato: Wheat,
  poultry: Drumstick,
  redApple: Apple,
  rice: Soup,
  riceCracker: Cookie,
  salad: Salad,
  salt: Droplets,
  seedling: Sprout,
  shrimp: Shrimp,
  squid: FishSymbol,
  strawberry: Cherry,
  sunflower: Flower,
  sweetPotato: Carrot,
  tomato: Cherry,
  watermelon: Citrus,
} satisfies Record<FoodIconKey, LucideIcon>;

export function foodGlyph(foodId: string): LucideIcon {
  return GLYPHS[foodIconKey(foodId)];
}

export type FoodMacro = 'protein' | 'carbs' | 'fats';

/**
 * The macro that supplies most of a food's calories (protein and carbs at
 * 4 kcal/g, fat at 9). The meal tracker tints each food's glyph with that
 * macro's colour, the same colours as the macro rings above it on the
 * Nutrition screen — so chicken, pasta and oil read as three different
 * things even where lucide draws them with similar shapes, and the row
 * says something true about the food rather than only decorating it.
 *
 * `null` for a food that is no longer in the database (an old entry).
 */
export function foodMacro(foodId: string): FoodMacro | null {
  const food = findFood(foodId);
  if (!food) return null;
  const kcal = { protein: food.protein100 * 4, carbs: food.carbs100 * 4, fats: food.fats100 * 9 };
  if (kcal.protein + kcal.carbs + kcal.fats === 0) return null;
  return (Object.keys(kcal) as FoodMacro[]).reduce((best, k) => (kcal[k] > kcal[best] ? k : best));
}
