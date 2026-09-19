/**
 * Maps the fixed-option questionnaire answers (preferredProteins/Carbs/Fats,
 * dietaryPattern — see lib/questionnaire/schema.ts) onto concrete
 * lib/mock/food-database ids, so the diet planner can build a believable
 * sample day instead of picking foods at random.
 */
import { FOOD_DATABASE } from '@/lib/mock/food-database';

export type MealType = 'breakfast' | 'main' | 'snack' | 'any';

const PROTEIN_SOURCES: Record<string, string[]> = {
  chicken: ['chicken-breast'],
  turkey: ['turkey-breast'],
  beef: ['beef-lean'],
  eggs: ['eggs'],
  fish: ['salmon', 'tuna-canned'],
  legumes: ['chickpeas', 'lentils', 'black-beans'],
  dairy: ['cottage-cheese', 'ricotta'],
  yogurt: ['greek-yogurt'],
  proteinPowder: ['whey-protein'],
  tofu: ['tofu'],
};

// Which meal(s) each protein source is realistic for — this is what stops
// a "colazione" slot from getting served lean beef or canned tuna just
// because that's what's in the user's chosen protein pool.
const PROTEIN_MEAL_TYPE: Record<string, MealType> = {
  chicken: 'main',
  turkey: 'main',
  beef: 'main',
  eggs: 'any',
  fish: 'main',
  legumes: 'main',
  dairy: 'any',
  yogurt: 'any',
  proteinPowder: 'any',
  tofu: 'main',
};

const CARB_SOURCES: Record<string, string[]> = {
  rice: ['rice-basmati'],
  pasta: ['pasta'],
  potatoes: ['potato', 'sweet-potato'],
  bread: ['bread-wholegrain'],
  oats: ['oats'],
  cereals: ['quinoa', 'couscous'],
  legumes: ['chickpeas', 'lentils'],
  fruit: ['banana', 'apple', 'orange'],
};

const CARB_MEAL_TYPE: Record<string, MealType> = {
  rice: 'main',
  pasta: 'main',
  potatoes: 'main',
  bread: 'any',
  oats: 'breakfast',
  cereals: 'main',
  legumes: 'main',
  fruit: 'any',
};

const FAT_SOURCES: Record<string, string[]> = {
  oliveOil: ['olive-oil'],
  nuts: ['almonds', 'walnuts'],
  avocado: ['avocado'],
  eggs: ['eggs'],
  fattyFish: ['salmon'],
  butter: ['olive-oil'],
};

const DEFAULT_PROTEIN_POOL = ['chicken-breast', 'turkey-breast', 'eggs', 'greek-yogurt', 'tuna-canned', 'tofu'];
const DEFAULT_CARB_POOL = ['rice-basmati', 'oats', 'potato', 'pasta', 'sweet-potato'];
const DEFAULT_FAT_POOL = ['olive-oil', 'almonds', 'avocado'];
const VEGETABLE_POOL = ['broccoli', 'spinach', 'zucchini', 'mixed-salad', 'green-beans', 'carrot'];
const FRUIT_POOL = ['banana', 'apple', 'orange', 'blueberries', 'kiwi'];

const MEAT_IDS = new Set(['chicken-breast', 'turkey-breast', 'beef-lean', 'prosciutto-crudo', 'bresaola']);
const FISH_IDS = new Set(['salmon', 'tuna-canned']);
const ANIMAL_DERIVED_IDS = new Set([
  'eggs',
  'egg-whites',
  'greek-yogurt',
  'cottage-cheese',
  'mozzarella',
  'parmesan',
  'ricotta',
  'skyr',
  'milk-semi',
  'honey',
  'whey-protein',
]);

function poolFromAnswer(answer: unknown, sourceMap: Record<string, string[]>, fallback: string[]): string[] {
  const values = Array.isArray(answer) ? (answer as string[]) : [];
  const ids = values.flatMap((v) => sourceMap[v] ?? []);
  return ids.length > 0 ? [...new Set(ids)] : fallback;
}

/** Removes foods incompatible with a vegetarian/vegan/pescetarian pattern. */
function filterByDietaryPattern(ids: string[], pattern: unknown): string[] {
  let excluded: Set<string> | null = null;
  if (pattern === 'vegan') excluded = new Set([...MEAT_IDS, ...FISH_IDS, ...ANIMAL_DERIVED_IDS]);
  else if (pattern === 'vegetarian') excluded = new Set([...MEAT_IDS, ...FISH_IDS]);
  else if (pattern === 'pescetarian') excluded = new Set(MEAT_IDS);
  if (!excluded) return ids;
  const filtered = ids.filter((id) => !excluded!.has(id));
  return filtered.length > 0 ? filtered : ids.filter((id) => !MEAT_IDS.has(id) && !FISH_IDS.has(id));
}

function idsToMealTypeMap(sourceMap: Record<string, string[]>, mealTypeBySourceKey: Record<string, MealType>): Record<string, MealType> {
  const result: Record<string, MealType> = {};
  for (const [key, ids] of Object.entries(sourceMap)) {
    const mealType = mealTypeBySourceKey[key] ?? 'any';
    for (const id of ids) result[id] = mealType;
  }
  return result;
}

const PROTEIN_ID_MEAL_TYPE = idsToMealTypeMap(PROTEIN_SOURCES, PROTEIN_MEAL_TYPE);
const CARB_ID_MEAL_TYPE = idsToMealTypeMap(CARB_SOURCES, CARB_MEAL_TYPE);

/** Narrows a pool to foods realistic for this slot (breakfast/main/snack).
 * Falls back to the curated default pool (also meal-type-filtered), never to
 * the unfiltered user pool — the previous fallback-to-unfiltered behavior
 * was the actual bug behind "colazione con ceci o pesce" (spec §0.4): a
 * user whose *only* selected protein preferences were main-meal-only foods
 * (e.g. legumi + pesce, no uova/yogurt/latticini) got that exact
 * meal-inappropriate pool back for breakfast too, since filtering it to
 * zero used to fall back to the very pool that had just been filtered out. */
function restrictToMealType(ids: string[], mealTypeMap: Record<string, MealType>, slotType: MealType, defaultPool: string[]): string[] {
  if (slotType === 'any') return ids;
  const fitting = ids.filter((id) => {
    const t = mealTypeMap[id] ?? 'any';
    return t === 'any' || t === slotType;
  });
  if (fitting.length > 0) return fitting;
  const defaultFitting = defaultPool.filter((id) => {
    const t = mealTypeMap[id] ?? 'any';
    return t === 'any' || t === slotType;
  });
  return defaultFitting.length > 0 ? defaultFitting : ids;
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Free-text (Italian) allergen/intolerance terms → whole food groups they
// imply, so "sono intollerante al lattosio" excludes every dairy item even
// though the user never typed a single food name from the catalog.
const ALLERGEN_GROUPS: { keywords: string[]; ids: string[] }[] = [
  { keywords: ['glutine', 'celiach'], ids: ['pasta', 'bread-wholegrain', 'bread-white', 'couscous', 'focaccia', 'pizza-margherita'] },
  {
    keywords: ['lattosio', 'latte', 'latticini', 'formaggio'],
    ids: ['greek-yogurt', 'cottage-cheese', 'ricotta', 'skyr', 'whey-protein', 'milk-semi', 'mozzarella', 'parmesan'],
  },
  { keywords: ['uova', 'uovo'], ids: ['eggs', 'egg-whites'] },
  { keywords: ['frutta secca', 'noci', 'mandorle', 'arachidi'], ids: ['almonds', 'walnuts', 'peanut-butter'] },
  { keywords: ['pesce'], ids: ['salmon', 'tuna-canned'] },
  { keywords: ['soia'], ids: ['tofu'] },
];

const NO_ANSWER_TEXT = new Set(['', 'no', 'nessuna', 'nessuno', 'niente', 'no.', 'n/a', 'na']);

function freeTextExclusionBlob(answers: Record<string, unknown>): string {
  // allergiesIntolerances merges the questionnaire's former separate
  // allergies/intolerances fields into one (v2, schema.ts).
  const fields = ['allergiesIntolerances', 'excludedFoods'];
  const parts = fields
    .map((f) => answers[f])
    .filter((v): v is string => typeof v === 'string')
    .map(normalize)
    .filter((v) => !NO_ANSWER_TEXT.has(v.trim()));
  return parts.join(' . ');
}

/** Food ids to exclude from every pool — from explicit allergies/
 * intolerances/excludedFoods text, matched against curated allergen groups
 * and directly against catalog food names (so typing "manzo" excludes
 * beef-lean even without a named allergen group for it). */
function deriveExcludedFoodIds(answers: Record<string, unknown>): Set<string> {
  const blob = freeTextExclusionBlob(answers);
  const excluded = new Set<string>();
  if (blob.length === 0) return excluded;
  for (const group of ALLERGEN_GROUPS) {
    if (group.keywords.some((k) => blob.includes(k))) group.ids.forEach((id) => excluded.add(id));
  }
  for (const food of FOOD_DATABASE) {
    if (blob.includes(normalize(food.name))) excluded.add(food.id);
  }
  return excluded;
}

function applyExclusions(ids: string[], excluded: Set<string>, fallback: string[]): string[] {
  const filtered = ids.filter((id) => !excluded.has(id));
  if (filtered.length > 0) return filtered;
  const fallbackFiltered = fallback.filter((id) => !excluded.has(id));
  return fallbackFiltered.length > 0 ? fallbackFiltered : ids;
}

// Which pool a FOOD_DATABASE category feeds — used to route free-text
// `includedFoods` matches (e.g. "vorrei più quinoa") into the right pool
// instead of only reaching the AI prompt (see generate-plan-strategy),
// which never actually chooses concrete foods.
function poolKeyForCategory(category: string): 'protein' | 'carbs' | 'fats' | 'vegetables' | 'fruit' | null {
  switch (category) {
    case 'proteine':
    case 'latticini':
    case 'legumi':
      return 'protein';
    case 'carboidrati':
      return 'carbs';
    case 'grassi':
      return 'fats';
    case 'verdura':
      return 'vegetables';
    case 'frutta':
      return 'fruit';
    default:
      return null;
  }
}

/** Foods the user explicitly asked to include (`includedFoods` free text),
 * matched against catalog names the same way deriveExcludedFoodIds matches
 * allergen/exclusion text — grouped by which pool each belongs in.
 * Exclusions always win: a food the user also excluded (or that dietary
 * pattern removes) is never added back in here. */
function deriveIncludedFoodIdsByPool(answers: Record<string, unknown>, excluded: Set<string>, pattern: unknown) {
  const result: Record<'protein' | 'carbs' | 'fats' | 'vegetables' | 'fruit', string[]> = {
    protein: [],
    carbs: [],
    fats: [],
    vegetables: [],
    fruit: [],
  };
  const raw = answers.includedFoods;
  if (typeof raw !== 'string') return result;
  const blob = normalize(raw);
  if (blob.trim().length === 0 || NO_ANSWER_TEXT.has(blob.trim())) return result;

  const matchedIds = FOOD_DATABASE.filter((food) => blob.includes(normalize(food.name))).map((food) => food.id);
  const afterPattern = filterByDietaryPattern(matchedIds, pattern);
  for (const food of FOOD_DATABASE) {
    if (!afterPattern.includes(food.id) || excluded.has(food.id)) continue;
    const key = poolKeyForCategory(food.category);
    if (key) result[key].push(food.id);
  }
  return result;
}

// Which of the questionnaire's free-text "what do you usually eat" answers
// (schema.ts) feed which slot kind — the same 3-way granularity the rest of
// this module already uses for meal-type restriction. The 3 snack slots
// share one bucket rather than each getting its own: the planner has no
// finer-grained "snack" pool to steer differently per snack slot anyway.
const USUAL_MEAL_ANSWER_IDS: Record<MealType, string[]> = {
  breakfast: ['usualBreakfast'],
  main: ['usualLunch', 'usualDinner'],
  snack: ['usualMorningSnack', 'usualAfternoonSnack', 'usualPreSleepSnack'],
  any: [],
};

/**
 * Matches the user's free-text "cosa mangi di solito a X" answers (spec
 * §0.4) against FOOD_DATABASE the same way deriveIncludedFoodIdsByPool
 * matches `includedFoods` — a name that appears in the curated catalog is a
 * real, healthy-enough food to weight toward that slot; a name that doesn't
 * match anything (e.g. "cornetti", not in FOOD_DATABASE) simply produces no
 * match, which is exactly the desired "don't accommodate it, but don't
 * crash either" behavior without needing a separate junk-food blocklist.
 * Bucketed by meal type (breakfast/main/snack) rather than one flat list,
 * so "avena e yogurt" mentioned for colazione doesn't also bias what shows
 * up at cena.
 */
function deriveUsualFoodIdsByMealType(answers: Record<string, unknown>, excluded: Set<string>, pattern: unknown): Record<MealType, Set<string>> {
  const result: Record<MealType, Set<string>> = { breakfast: new Set(), main: new Set(), snack: new Set(), any: new Set() };
  for (const mealType of ['breakfast', 'main', 'snack'] as const) {
    const blob = normalize(
      USUAL_MEAL_ANSWER_IDS[mealType]
        .map((id) => answers[id])
        .filter((v): v is string => typeof v === 'string')
        .join(' . ')
    );
    if (blob.trim().length === 0 || NO_ANSWER_TEXT.has(blob.trim())) continue;
    const matched = filterByDietaryPattern(
      FOOD_DATABASE.filter((food) => blob.includes(normalize(food.name))).map((food) => food.id),
      pattern
    );
    for (const id of matched) {
      if (!excluded.has(id)) result[mealType].add(id);
    }
  }
  return result;
}

/** Biases `pick()`'s deterministic rotation toward foods the user says they
 * already eat at this slot, by giving each match extra entries in the pool
 * instead of just one — `pick` cycles through the pool by index, so a food
 * appearing 3x in a 6-item pool comes up roughly 3x as often as one
 * appearing once, without changing the picking algorithm itself. Foods
 * outside the usual-match set stay in the pool (at their normal weight) so
 * the plan keeps variety instead of only ever repeating what the user
 * already eats. */
function withUsualBoost(pool: string[], usualIds: Set<string>): string[] {
  if (usualIds.size === 0) return pool;
  const matched = pool.filter((id) => usualIds.has(id));
  if (matched.length === 0) return pool;
  return [...matched, ...matched, ...pool];
}

export function buildFoodPools(answers: Record<string, unknown>) {
  const pattern = answers.dietaryPattern;
  const excluded = deriveExcludedFoodIds(answers);
  const included = deriveIncludedFoodIdsByPool(answers, excluded, pattern);
  const usualByMealType = deriveUsualFoodIdsByMealType(answers, excluded, pattern);

  const protein = [
    ...new Set([
      ...applyExclusions(
        filterByDietaryPattern(poolFromAnswer(answers.preferredProteins, PROTEIN_SOURCES, DEFAULT_PROTEIN_POOL), pattern),
        excluded,
        filterByDietaryPattern(DEFAULT_PROTEIN_POOL, pattern)
      ),
      ...included.protein,
    ]),
  ];
  const carbs = [
    ...new Set([...applyExclusions(poolFromAnswer(answers.preferredCarbs, CARB_SOURCES, DEFAULT_CARB_POOL), excluded, DEFAULT_CARB_POOL), ...included.carbs]),
  ];
  const fats = [
    ...new Set([
      ...applyExclusions(
        filterByDietaryPattern(poolFromAnswer(answers.preferredFats, FAT_SOURCES, DEFAULT_FAT_POOL), pattern),
        excluded,
        filterByDietaryPattern(DEFAULT_FAT_POOL, pattern)
      ),
      ...included.fats,
    ]),
  ];
  const vegetables = [...new Set([...applyExclusions(VEGETABLE_POOL, excluded, VEGETABLE_POOL), ...included.vegetables])];
  const fruit = [...new Set([...applyExclusions(FRUIT_POOL, excluded, FRUIT_POOL), ...included.fruit])];

  const defaultProteinPool = filterByDietaryPattern(DEFAULT_PROTEIN_POOL, pattern);
  const defaultCarbPool = DEFAULT_CARB_POOL;

  return {
    protein,
    carbs,
    fats,
    vegetables,
    fruit,
    /** Narrows `protein`/`carbs` to what's realistic for a given slot (see
     * restrictToMealType's fallback behavior for why this never returns an
     * empty pool), then biases the result toward foods the user says they
     * usually eat at that slot (spec §0.4, withUsualBoost). */
    proteinFor: (slotType: MealType) => withUsualBoost(restrictToMealType(protein, PROTEIN_ID_MEAL_TYPE, slotType, defaultProteinPool), usualByMealType[slotType]),
    carbsFor: (slotType: MealType) => withUsualBoost(restrictToMealType(carbs, CARB_ID_MEAL_TYPE, slotType, defaultCarbPool), usualByMealType[slotType]),
    /** Fats/vegetables/fruit have no meal-type restriction (olive oil,
     * avocado, mixed salad etc. are all reasonable at any meal) — only the
     * usual-food bias applies here. */
    fatsFor: (slotType: MealType) => withUsualBoost(fats, usualByMealType[slotType]),
    vegetablesFor: (slotType: MealType) => withUsualBoost(vegetables, usualByMealType[slotType]),
    fruitFor: (slotType: MealType) => withUsualBoost(fruit, usualByMealType[slotType]),
  };
}

export function pick<T>(pool: T[], index: number): T {
  return pool[index % pool.length];
}
