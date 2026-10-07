/**
 * Which Fit Lab foods this person can and likes to eat: the catalog (catalog.ts) filtered by
 * allergies/intolerances/exclusions and dietary pattern, with a weight per food that reflects
 * what they said they prefer, usually eat or explicitly want. The weights only steer the choice
 * (a food they did not pick can still appear, rarely); the filters are hard.
 */
import { FOOD_DATABASE, findFood } from '@/lib/mock/food-database';

import { CATALOG, FALLBACK, SHORT, type Role, type SlotKind } from './catalog';

const MEAT = new Set(['chicken-breast', 'turkey-breast', 'beef-lean', 'veal-cutlet', 'bresaola', 'turkey-breast-smoked', 'turkey-ground']);
const FISH = new Set(['tuna-canned', 'salmon', 'cod', 'sea-bream', 'shrimp']);
const ANIMAL = new Set([
  'eggs', 'egg-whites', 'greek-yogurt-0', 'yogurt-protein', 'skyr', 'kefir', 'cottage-cheese', 'ricotta-magra', 'milk-lactose-free', 'whey-protein',
  'protein-pudding', 'protein-bar', 'protein-drink', 'ricotta', 'greek-yogurt', 'milk-semi', 'gnocchi',
]);

const FRUIT_IDS = ['banana', 'apple', 'pear', 'kiwi', 'orange', 'blueberries', 'strawberries'];
const LEGUME_IDS = ['chickpeas', 'lentils', 'borlotti-beans', 'cannellini-beans', 'black-beans', 'white-beans'];

// Free-text (Italian) allergen/intolerance terms → the food groups they imply.
const ALLERGEN_GROUPS: { keywords: string[]; ids: string[] }[] = [
  { keywords: ['glutine', 'celiach'], ids: ['pasta', 'pasta-wholewheat', 'bread-wholegrain', 'bread-rye', 'bread-white', 'fette-biscottate', 'couscous', 'gnocchi', 'muesli', 'granola', 'cereals-wholegrain', 'oats', 'barley-cooked', 'farro-cooked'] },
  { keywords: ['lattosio', 'latte', 'latticini', 'formaggio'], ids: ['greek-yogurt-0', 'yogurt-protein', 'skyr', 'kefir', 'cottage-cheese', 'ricotta-magra', 'whey-protein', 'protein-pudding', 'protein-bar', 'protein-drink'] },
  { keywords: ['uova', 'uovo'], ids: ['eggs', 'egg-whites'] },
  { keywords: ['frutta secca', 'noci', 'mandorle', 'arachidi'], ids: ['almonds', 'walnuts', 'hazelnuts', 'pistachios', 'cashews', 'peanut-butter', 'almond-butter'] },
  { keywords: ['pesce'], ids: [...FISH] },
  { keywords: ['crostacei', 'gamberi', 'molluschi'], ids: ['shrimp'] },
  { keywords: ['soia'], ids: ['tofu'] },
  { keywords: ['carne'], ids: [...MEAT] },
  { keywords: ['sesamo'], ids: ['tahini'] },
];

// A generic word the person may type → the catalog foods it means.
const GENERIC_WORDS: Record<string, string[]> = {
  riso: ['rice-basmati', 'rice-brown-cooked', 'cream-of-rice', 'rice-cakes'],
  pane: ['bread-wholegrain', 'bread-rye', 'bread-white', 'fette-biscottate'],
  yogurt: ['greek-yogurt-0', 'yogurt-protein'],
  patate: ['potato', 'sweet-potato', 'gnocchi'],
  legumi: LEGUME_IDS,
  avena: ['oats'],
};

const NO_ANSWER = new Set(['', 'no', 'nessuna', 'nessuno', 'niente', 'no.', 'n/a', 'na']);

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function textOf(answers: Record<string, unknown>, fields: string[]): string {
  return normalize(
    fields
      .map((f) => answers[f])
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => !NO_ANSWER.has(normalize(v)))
      .join(' . ')
  );
}

/** Catalog foods named in a free text (full name, short name, plural stem, or a generic word). */
function foodsNamedIn(blob: string): Set<string> {
  const found = new Set<string>();
  if (blob.length === 0) return found;
  const tokens = blob.split(/[^a-z0-9]+/).filter(Boolean);
  for (const food of FOOD_DATABASE) if (blob.includes(normalize(food.name))) found.add(food.id);
  for (const [id, label] of Object.entries(SHORT)) {
    const phrase = normalize(label);
    const stem = phrase.length >= 6 ? phrase.slice(0, -1) : phrase;
    if (blob.includes(phrase) || tokens.some((t) => t === phrase || (phrase.length >= 6 && t.startsWith(stem)))) found.add(id);
  }
  for (const [word, ids] of Object.entries(GENERIC_WORDS)) if (tokens.includes(word)) ids.forEach((id) => found.add(id));
  return found;
}

const PREFERRED: Record<'protein' | 'carb' | 'fat', Record<string, string[]>> = {
  protein: {
    chicken: ['chicken-breast'],
    turkey: ['turkey-breast'],
    beef: ['beef-lean', 'veal-cutlet'],
    eggs: ['eggs', 'egg-whites'],
    fish: ['tuna-canned', 'salmon', 'cod', 'sea-bream', 'shrimp'],
    legumes: LEGUME_IDS,
    dairy: ['cottage-cheese', 'ricotta-magra'],
    yogurt: ['greek-yogurt-0', 'skyr', 'yogurt-protein', 'kefir'],
    proteinPowder: ['whey-protein', 'protein-drink', 'protein-pudding', 'protein-bar'],
    tofu: ['tofu'],
  },
  carb: {
    rice: ['rice-basmati', 'rice-brown-cooked'],
    pasta: ['pasta', 'pasta-wholewheat', 'gnocchi'],
    potatoes: ['potato', 'sweet-potato'],
    bread: ['bread-wholegrain', 'bread-rye', 'fette-biscottate'],
    oats: ['oats', 'cream-of-rice', 'muesli', 'granola', 'cereals-wholegrain'],
    cereals: ['quinoa', 'couscous', 'farro-cooked', 'polenta-cooked', 'barley-cooked'],
    legumes: LEGUME_IDS,
    fruit: FRUIT_IDS,
  },
  fat: {
    oliveOil: ['olive-oil'],
    nuts: ['almonds', 'walnuts', 'hazelnuts', 'pistachios', 'cashews'],
    avocado: ['avocado'],
    fattyFish: ['salmon'],
    butter: ['olive-oil'],
  },
};

const USUAL_FIELDS: Record<SlotKind, string[]> = {
  breakfast: ['usualBreakfast'],
  lunch: ['usualLunch'],
  dinner: ['usualDinner'],
  snack: ['usualMorningSnack', 'usualAfternoonSnack', 'usualPreSleepSnack'],
};

/** Foods that count as "the same protein" for the one-source-per-day rule. */
const FAMILY: Record<string, string> = {
  eggs: 'egg',
  'egg-whites': 'egg',
  'greek-yogurt-0': 'yogurt',
  skyr: 'yogurt',
  'yogurt-protein': 'yogurt',
  kefir: 'yogurt',
  'whey-protein': 'supplement',
  'protein-drink': 'supplement',
  'protein-pudding': 'supplement',
  'protein-bar': 'supplement',
  'cottage-cheese': 'cheese',
  'ricotta-magra': 'cheese',
};
export const familyOf = (id: string): string => FAMILY[id] ?? id;

export type FitLabPools = {
  /** Hard filter: allergies, exclusions, dietary pattern. */
  allowed: (id: string) => boolean;
  /** Preference weight (≈1 neutral, >1 wanted, <1 not preferred). */
  weight: (id: string, kind: SlotKind) => number;
  /** The slot's catalog list for a role, filtered (with the fallback foods only when too few remain). */
  pool: (kind: SlotKind, role: Role) => string[];
  /** Eats out often: lunches should be easy to carry. */
  eatsOutOften: boolean;
  /** Vegetarian or vegan: dishes built on tofu/ricotta become available. */
  meatless: boolean;
};

export function buildFitLabPools(answers: Record<string, unknown>): FitLabPools {
  const pattern = answers.dietaryPattern;
  const excluded = foodsNamedIn(textOf(answers, ['allergiesIntolerances', 'excludedFoods']));
  const blob = textOf(answers, ['allergiesIntolerances', 'excludedFoods']);
  for (const group of ALLERGEN_GROUPS) if (group.keywords.some((k) => blob.includes(k))) group.ids.forEach((id) => excluded.add(id));

  const allowed = (id: string): boolean => {
    if (excluded.has(id)) return false;
    if (pattern === 'vegan' && (MEAT.has(id) || FISH.has(id) || ANIMAL.has(id))) return false;
    if (pattern === 'vegetarian' && (MEAT.has(id) || FISH.has(id))) return false;
    if (pattern === 'pescetarian' && MEAT.has(id)) return false;
    return true;
  };

  // preferences: only meaningful when the person actually picked some
  const picked = (field: string, kind: 'protein' | 'carb' | 'fat') => {
    const values = Array.isArray(answers[field]) ? (answers[field] as string[]) : [];
    if (values.length === 0) return null;
    const wanted = new Set(values.flatMap((v) => PREFERRED[kind][v] ?? []));
    const known = new Set(Object.values(PREFERRED[kind]).flat());
    return { wanted, known };
  };
  const prefs = [picked('preferredProteins', 'protein'), picked('preferredCarbs', 'carb'), picked('preferredFats', 'fat')];
  const included = foodsNamedIn(textOf(answers, ['includedFoods']));
  const usual: Record<SlotKind, Set<string>> = {
    breakfast: foodsNamedIn(textOf(answers, USUAL_FIELDS.breakfast)),
    lunch: foodsNamedIn(textOf(answers, USUAL_FIELDS.lunch)),
    dinner: foodsNamedIn(textOf(answers, USUAL_FIELDS.dinner)),
    snack: foodsNamedIn(textOf(answers, USUAL_FIELDS.snack)),
  };

  const weight = (id: string, kind: SlotKind): number => {
    let w = 1;
    for (const p of prefs) {
      if (!p || !p.known.has(id)) continue;
      w = p.wanted.has(id) ? 1.6 : 0.3;
    }
    if (included.has(id)) w = Math.max(w, 3);
    if (usual[kind].has(id)) w = Math.max(w, 2.2);
    return w;
  };

  const pool = (kind: SlotKind, role: Role): string[] => {
    const base = (CATALOG[kind][role] ?? []).filter(allowed);
    if (base.length >= 2 || role === 'fruit' || role === 'veg') return base;
    return [...new Set([...base, ...(FALLBACK[kind][role] ?? []).filter((id) => allowed(id) && findFood(id))])];
  };

  const outTimes = typeof answers.eatingOut === 'string' ? (answers.eatingOut === 'gt6' ? 7 : answers.eatingOut === 'rarely' ? 0 : Number(answers.eatingOut)) : 0;
  return { allowed, weight, pool, meatless: pattern === 'vegetarian' || pattern === 'vegan', eatsOutOften: Number.isFinite(outTimes) && outTimes >= 3 };
}
