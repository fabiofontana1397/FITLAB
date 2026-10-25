import type { ImageSourcePropType } from 'react-native';

import { foodIconKey, type FoodIconKey } from '@/lib/nutrition/food-icon-keys';

/**
 * The picture a food gets in the meal tracker when there is no photo of it
 * (food-photos.ts): Microsoft Fluent Emoji 3D
 * (github.com/microsoft/fluentui-emoji, MIT licence, see
 * assets/images/food-icons/LICENSE.txt), 256 px WebP. One exists for every
 * key, so every food has an image. Which food gets which key lives in
 * food-icon-keys.ts.
 */
const ICONS = {
  avocado: require('@/assets/images/food-icons/avocado.webp'),
  bacon: require('@/assets/images/food-icons/bacon.webp'),
  banana: require('@/assets/images/food-icons/banana.webp'),
  beans: require('@/assets/images/food-icons/beans.webp'),
  bellPepper: require('@/assets/images/food-icons/bell-pepper.webp'),
  blueberries: require('@/assets/images/food-icons/blueberries.webp'),
  bowl: require('@/assets/images/food-icons/bowl-with-spoon.webp'),
  bread: require('@/assets/images/food-icons/bread.webp'),
  broccoli: require('@/assets/images/food-icons/broccoli.webp'),
  butter: require('@/assets/images/food-icons/butter.webp'),
  canned: require('@/assets/images/food-icons/canned-food.webp'),
  carrot: require('@/assets/images/food-icons/carrot.webp'),
  cheese: require('@/assets/images/food-icons/cheese-wedge.webp'),
  cherries: require('@/assets/images/food-icons/cherries.webp'),
  chestnut: require('@/assets/images/food-icons/chestnut.webp'),
  chocolate: require('@/assets/images/food-icons/chocolate-bar.webp'),
  coconut: require('@/assets/images/food-icons/coconut.webp'),
  corn: require('@/assets/images/food-icons/ear-of-corn.webp'),
  croissant: require('@/assets/images/food-icons/croissant.webp'),
  cucumber: require('@/assets/images/food-icons/cucumber.webp'),
  custard: require('@/assets/images/food-icons/custard.webp'),
  drink: require('@/assets/images/food-icons/cup-with-straw.webp'),
  egg: require('@/assets/images/food-icons/egg.webp'),
  eggplant: require('@/assets/images/food-icons/eggplant.webp'),
  fish: require('@/assets/images/food-icons/fish.webp'),
  garlic: require('@/assets/images/food-icons/garlic.webp'),
  grains: require('@/assets/images/food-icons/sheaf-of-rice.webp'),
  grapes: require('@/assets/images/food-icons/grapes.webp'),
  greenApple: require('@/assets/images/food-icons/green-apple.webp'),
  honey: require('@/assets/images/food-icons/honey-pot.webp'),
  hotPepper: require('@/assets/images/food-icons/hot-pepper.webp'),
  jar: require('@/assets/images/food-icons/jar.webp'),
  kiwi: require('@/assets/images/food-icons/kiwi-fruit.webp'),
  leafy: require('@/assets/images/food-icons/leafy-green.webp'),
  lemon: require('@/assets/images/food-icons/lemon.webp'),
  mango: require('@/assets/images/food-icons/mango.webp'),
  meat: require('@/assets/images/food-icons/cut-of-meat.webp'),
  meatOnBone: require('@/assets/images/food-icons/meat-on-bone.webp'),
  melon: require('@/assets/images/food-icons/melon.webp'),
  milk: require('@/assets/images/food-icons/glass-of-milk.webp'),
  mushroom: require('@/assets/images/food-icons/brown-mushroom.webp'),
  octopus: require('@/assets/images/food-icons/octopus.webp'),
  olive: require('@/assets/images/food-icons/olive.webp'),
  onion: require('@/assets/images/food-icons/onion.webp'),
  orange: require('@/assets/images/food-icons/tangerine.webp'),
  oyster: require('@/assets/images/food-icons/oyster.webp'),
  pasta: require('@/assets/images/food-icons/spaghetti.webp'),
  peaPod: require('@/assets/images/food-icons/pea-pod.webp'),
  peach: require('@/assets/images/food-icons/peach.webp'),
  peanuts: require('@/assets/images/food-icons/peanuts.webp'),
  pear: require('@/assets/images/food-icons/pear.webp'),
  pineapple: require('@/assets/images/food-icons/pineapple.webp'),
  pizza: require('@/assets/images/food-icons/pizza.webp'),
  potato: require('@/assets/images/food-icons/potato.webp'),
  poultry: require('@/assets/images/food-icons/poultry-leg.webp'),
  redApple: require('@/assets/images/food-icons/red-apple.webp'),
  rice: require('@/assets/images/food-icons/cooked-rice.webp'),
  riceCracker: require('@/assets/images/food-icons/rice-cracker.webp'),
  salad: require('@/assets/images/food-icons/green-salad.webp'),
  salt: require('@/assets/images/food-icons/salt.webp'),
  seedling: require('@/assets/images/food-icons/seedling.webp'),
  shrimp: require('@/assets/images/food-icons/shrimp.webp'),
  squid: require('@/assets/images/food-icons/squid.webp'),
  strawberry: require('@/assets/images/food-icons/strawberry.webp'),
  sunflower: require('@/assets/images/food-icons/sunflower.webp'),
  sweetPotato: require('@/assets/images/food-icons/roasted-sweet-potato.webp'),
  tomato: require('@/assets/images/food-icons/tomato.webp'),
  watermelon: require('@/assets/images/food-icons/watermelon.webp'),
} satisfies Record<FoodIconKey, ImageSourcePropType>;

export function foodIcon(foodId: string): ImageSourcePropType {
  return ICONS[foodIconKey(foodId)];
}
