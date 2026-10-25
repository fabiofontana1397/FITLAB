import { findFood, type FoodItem } from '@/lib/mock/food-database';

/** The food pictures the meal tracker can draw (each one's image is in food-icons.ts). */
export const FOOD_ICON_KEYS = ['avocado', 'bacon', 'banana', 'beans', 'bellPepper', 'blueberries', 'bowl', 'bread', 'broccoli', 'butter', 'canned', 'carrot', 'cheese', 'cherries', 'chestnut', 'chocolate', 'coconut', 'corn', 'croissant', 'cucumber', 'custard', 'drink', 'egg', 'eggplant', 'fish', 'garlic', 'grains', 'grapes', 'greenApple', 'honey', 'hotPepper', 'jar', 'kiwi', 'leafy', 'lemon', 'mango', 'meat', 'meatOnBone', 'melon', 'milk', 'mushroom', 'octopus', 'olive', 'onion', 'orange', 'oyster', 'pasta', 'peaPod', 'peach', 'peanuts', 'pear', 'pineapple', 'pizza', 'potato', 'poultry', 'redApple', 'rice', 'riceCracker', 'salad', 'salt', 'seedling', 'shrimp', 'squid', 'strawberry', 'sunflower', 'sweetPotato', 'tomato', 'watermelon'] as const;
export type FoodIconKey = (typeof FOOD_ICON_KEYS)[number];

// Order matters: specific matches first ("burro di arachidi" before "burro", "patate dolci" before "patate").
const RULES: [RegExp, FoodIconKey][] = [
  [/vinegar|aceto|soy-sauce|salsa di soia/, 'salt'],
  [/basilico|origano|prezzemolo|rosmarino|salvia|timo|germogli/, 'leafy'],
  [/protein-bar|barretta|cioccolato|chocolate/, 'chocolate'],
  [/protein-drink|whey|plant-protein|proteine .*polvere|bevanda proteica/, 'drink'],
  [/pudding|budino/, 'custard'],
  [/peanut|arachid/, 'peanuts'],
  [/almond-butter|cashew-butter|burro di |tahin|jam|marmellata|mustard|senape|mayonnaise|maionese/, 'jar'],
  [/honey\b|miele/, 'honey'],
  [/tuna-canned|tonno al naturale|tuna-oil|sott.olio|sardine-|sardine al|anchovy-canned|salmon-canned|in scatola/, 'canned'],
  [/coconut|cocco/, 'coconut'],
  [/bevanda di/, 'milk'],
  [/sunflower|girasole/, 'sunflower'],
  [/olive|olio|pesto/, 'olive'],
  [/butter|burro/, 'butter'],
  [/avocado/, 'avocado'],
  [/almond|walnut|hazelnut|pistach|pistacc|cashew|pine-nut|macadamia|brazil|pecan|chestnut|castagn|dates|datteri|mandorl|\bnoci\b|nocciol|anacard|pinoli/, 'chestnut'],
  [/quail-egg|uovo|uova|\beggs?\b|egg-white|albume/, 'egg'],
  [/onion|cipoll|shallot|scalogno|leek|porro/, 'onion'],
  [/chicken|turkey|pollo|tacchino|duck|anatra|quail|quaglia|guinea|faraona/, 'poultry'],
  [/ribs|costine|puntine|shank|stinco|osso-buco|ossobuco|tbone|ribeye|costata|chop|costolett/, 'meatOnBone'],
  [/prosciutto|bresaola|capocollo|affettat/, 'bacon'],
  [/beef|manzo|pork|maiale|lamb|agnello|veal|vitello|rabbit|coniglio/, 'meat'],
  [/shrimp|gamber/, 'shrimp'],
  [/mussel|cozze|clam|vongol/, 'oyster'],
  [/octopus|polpo/, 'octopus'],
  [/squid|calamar/, 'squid'],
  [/salmon|salmone|tuna|tonno|\bcod\b|cod-|merluzzo|baccal|sea-bass|branzino|trout|trota|mackerel|sgombro|swordfish|anchovy|acciugh|sardin|sea-bream|orata|pesce/, 'fish'],
  [/green-beans|fagiolini|snow-peas|taccole|piselli|\bpeas\b/, 'peaPod'],
  [/tofu|\bsoy|soia|edamame|chickpea|ceci|lentil|lenticch|bean|fagiol|lupini|fava|fave/, 'beans'],
  [/seed|semi di/, 'seedling'],
  [/cheese|formagg|mozzarella|parmesan|parmigiano|ricotta|gorgonzola|pecorino|feta|cheddar|brie|provolone|gouda|caprino|camembert|fontina|groviera|roquefort|fior-di-latte|cottage|fiocchi di latte/, 'cheese'],
  [/condensed|milk|latte|kefir|panna/, 'milk'],
  [/yogurt|skyr/, 'bowl'],
  [/sweet-potato|patate dolci/, 'sweetPotato'],
  [/gnocchi|potato|patat|jerusalem|topinambur/, 'potato'],
  [/rice-cake|corn-cake|gallette|cracker|crispbread|fette-biscottate|fette biscottate/, 'riceCracker'],
  [/noodle|pasta/, 'pasta'],
  [/corn|mais|polenta/, 'corn'],
  [/oats|avena|muesli|granola|\bcereal|cream-of-rice|crema di riso|puffed|soffiato/, 'bowl'],
  [/rice|riso/, 'rice'],
  [/pizza|focaccia/, 'pizza'],
  [/bread|pane|pan bauletto/, 'bread'],
  [/quinoa|cous|barley|orzo|farro|bulgur|buckwheat|saraceno|millet|miglio|amaranth|teff/, 'grains'],
  [/hot-chili|peperoncino/, 'hotPepper'],
  [/bell-pepper|peperon/, 'bellPepper'],
  [/tomato|pomodor|ketchup/, 'tomato'],
  [/broccoli|cauliflower|cavolfiore|brussels|cavolett|cavolini/, 'broccoli'],
  [/mixed-salad|insalata/, 'salad'],
  [/zucchini|zucchine|cucumber|cetriol/, 'cucumber'],
  [/carrot|carot|beet|barbabietola|radish|ravanell|turnip |rapa$|pumpkin|zucca/, 'carrot'],
  [/eggplant|melanzan/, 'eggplant'],
  [/garlic|aglio/, 'garlic'],
  [/mushroom|funghi/, 'mushroom'],
  [/banana/, 'banana'],
  [/pineapple|ananas/, 'pineapple'],
  [/watermelon|anguria/, 'watermelon'],
  [/melon/, 'melon'],
  [/kiwi/, 'kiwi'],
  [/lemon|limone/, 'lemon'],
  [/orange|arancia|tangerine|mandarino|grapefruit|pompelmo/, 'orange'],
  [/strawberr|fragol|raspberr|lampon/, 'strawberry'],
  [/blueberr|mirtill|blackberr|more$|mulberr|gelsi|currant|ribes|gooseberr|uva spina|cranberr|frutti di bosco/, 'blueberries'],
  [/sour-cherr|amaren|cherr|ciliegi/, 'cherries'],
  [/grape|\buva\b|raisin|uvetta/, 'grapes'],
  [/mango|papaya/, 'mango'],
  [/pear|\bpera\b|quince|cotogna/, 'pear'],
  [/peach|pesca|nectarine|apricot|albicocc|plum|susina|prune|prugn|persimmon|cachi|loquat|nespola/, 'peach'],
  [/apple|\bmela\b/, 'redApple'],
];

const CATEGORY_ICON: Record<FoodItem['category'], FoodIconKey> = {
  proteine: 'meat',
  carboidrati: 'bread',
  grassi: 'olive',
  verdura: 'leafy',
  frutta: 'greenApple',
  latticini: 'milk',
  legumi: 'beans',
  altro: 'salt',
};

/** Which picture a food gets: the first rule its id or name matches, otherwise its category's. */
export function foodIconKey(foodId: string): FoodIconKey {
  const food = findFood(foodId);
  const haystack = `${foodId} ${food?.name ?? ''}`.toLowerCase();
  return RULES.find(([re]) => re.test(haystack))?.[1] ?? (food ? CATEGORY_ICON[food.category] : 'bowl');
}
