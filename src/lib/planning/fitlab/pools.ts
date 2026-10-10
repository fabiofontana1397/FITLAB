/**
 * Which Fit Lab foods this person can and likes to eat. The hard filters come straight from the catalog columns:
 * the dietary regime ("Regimi_alimentari") and the allergens ("Allergeni"), plus foods the person excluded by name.
 * The weights only steer the choice (what they said they prefer, usually eat or explicitly want); a food they did not
 * pick can still appear, rarely.
 */
import { FITLAB_FOODS, type FitLabFood } from './foods';
import type { SlotKind } from './catalog';

const NO_ANSWER = new Set(['', 'no', 'nessuna', 'nessuno', 'niente', 'no.', 'n/a', 'na']);
const STOPWORDS = new Set(['di', 'del', 'della', 'al', 'alla', 'con', 'magro', 'magra', 'light', 'intere', 'intero', 'naturale', 'proteico', 'proteica', 'zuccherata', 'fresca', 'fresco', 'non', 'senza', 'istantanea']);

const norm = (text: string): string => text.toLowerCase().replace(/[’‘]/g, "'").normalize('NFD').replace(/[̀-ͯ]/g, '');

function textOf(answers: Record<string, unknown>, fields: string[]): string {
  return norm(
    fields
      .map((f) => answers[f])
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => !NO_ANSWER.has(norm(v)))
      .join(' . ')
  );
}

const wordsOf = (food: FitLabFood): string[] =>
  [food.name, ...food.synonyms]
    .flatMap((n) => norm(n).split(/[^a-z0-9]+/))
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

// Free-text (Italian) allergen/intolerance terms → the allergen they name in the catalog's "Allergeni" column.
const ALLERGEN_KEYWORDS: { keywords: string[]; allergen: string }[] = [
  { keywords: ['lattosio', 'latte', 'latticini', 'formaggio', 'formaggi'], allergen: 'latte' },
  { keywords: ['uova', 'uovo'], allergen: 'uova' },
  { keywords: ['glutine', 'celiach'], allergen: 'glutine' },
  { keywords: ['frutta secca', 'frutta a guscio', 'noci', 'mandorle', 'nocciole', 'pistacchi', 'anacardi'], allergen: 'guscio' },
  { keywords: ['arachidi'], allergen: 'arachidi' },
  { keywords: ['soia'], allergen: 'soia' },
  { keywords: ['pesce'], allergen: 'pesce' },
  { keywords: ['crostacei', 'gamberi', 'molluschi'], allergen: 'crostacei' },
  { keywords: ['sesamo'], allergen: 'sesamo' },
  { keywords: ['senape'], allergen: 'senape' },
  { keywords: ['solfiti'], allergen: 'solfiti' },
];

// Generic words the person may type → the catalog subcategories they mean.
const GENERIC_SUBS: Record<string, string[]> = {
  carne: ['Carni bianche', 'Carni rosse', 'Carni suine', 'Preparazioni di carne', 'Salumi'],
  pesce: ['Pesce', 'Crostacei', 'Preparazioni di pesce'],
  legumi: ['Legumi'],
  formaggi: ['Formaggi freschi', 'Formaggi stagionati'],
  formaggio: ['Formaggi freschi', 'Formaggi stagionati'],
  yogurt: ['Latticini', 'Latticini fermentati'],
  pane: ['Pane e prodotti da forno'],
};

/** Foods named in a free text: by whole name, by a word of the name or a synonym (plural tolerated), or by a generic word. */
function foodsNamedIn(blob: string): Set<string> {
  const found = new Set<string>();
  if (blob.length === 0) return found;
  const tokens = blob.split(/[^a-z0-9]+/).filter(Boolean);
  for (const food of FITLAB_FOODS) {
    if (blob.includes(norm(food.name))) {
      found.add(food.id);
      continue;
    }
    const words = wordsOf(food);
    if (tokens.some((t) => words.some((w) => t === w || (t.length >= 5 && w.length >= 5 && t.slice(0, -1) === w.slice(0, -1))))) found.add(food.id);
  }
  for (const [word, subs] of Object.entries(GENERIC_SUBS)) {
    if (!tokens.includes(word)) continue;
    for (const food of FITLAB_FOODS) if (subs.includes(food.sub)) found.add(food.id);
  }
  return found;
}

type Spec = string; // an exact food name, or "sub:<Sottocategoria>", or "cat:<Categoria>", or "name:<prefix>"
function matches(food: FitLabFood, spec: Spec): boolean {
  if (spec.startsWith('sub:')) return food.sub === spec.slice(4);
  if (spec.startsWith('cat:')) return food.category === spec.slice(4);
  if (spec.startsWith('name:')) return food.name.startsWith(spec.slice(5));
  return food.name === spec;
}

const PREFERRED: Record<'protein' | 'carb' | 'fat', Record<string, Spec[]>> = {
  protein: {
    chicken: ['Petto di pollo', 'Hamburger di pollo magro'],
    turkey: ['Petto di tacchino', 'Hamburger di tacchino magro', 'Fesa di tacchino affettata'],
    beef: ['Manzo magro'],
    eggs: ['Uova intere', "Albume d'uovo"],
    fish: ['sub:Pesce', 'sub:Crostacei', 'sub:Preparazioni di pesce'],
    legumes: ['sub:Legumi'],
    dairy: ['sub:Formaggi freschi', 'sub:Formaggi stagionati', 'sub:Latte'],
    yogurt: ['sub:Latticini', 'sub:Latticini fermentati'],
    proteinPowder: ['Bevanda proteica', 'Barretta proteica', 'Budino proteico'],
    tofu: ['Tofu', 'Seitan'],
  },
  carb: {
    rice: ['name:Riso'],
    pasta: ['name:Pasta', 'Gnocchi di patate'],
    potatoes: ['Patate', 'Patate dolci'],
    bread: ['sub:Pane e prodotti da forno'],
    oats: ["Fiocchi d'avena", 'Avena istantanea', 'Crema di riso', 'sub:Cereali da colazione'],
    cereals: ['sub:Cereali', 'sub:Pseudocereali', 'Cous cous', 'Polenta'],
    legumes: ['sub:Legumi'],
    fruit: ['cat:Frutta'],
  },
  fat: {
    oliveOil: ['Olio extravergine di oliva'],
    nuts: ['sub:Frutta a guscio', 'sub:Creme di frutta a guscio'],
    avocado: ['Avocado'],
    fattyFish: ['Salmone', 'Sgombro', 'Sardine'],
    butter: ['Olio extravergine di oliva'],
  },
};

const USUAL_FIELDS: Record<SlotKind, string[]> = {
  breakfast: ['usualBreakfast'],
  lunch: ['usualLunch'],
  dinner: ['usualDinner'],
  snack: ['usualMorningSnack', 'usualAfternoonSnack', 'usualPreSleepSnack'],
};

/** The "same protein" rule of the day: foods of one family count as one source. */
export function familyOf(food: FitLabFood): string {
  if (food.sub === 'Uova') return 'egg';
  if (food.sub === 'Latticini' || food.sub === 'Latticini fermentati') return 'yogurt';
  if (food.sub === 'Formaggi freschi' || food.sub === 'Formaggi stagionati') return 'cheese';
  if (food.sub === 'Latte' || food.sub === 'Bevande vegetali') return 'milk';
  if (food.sub === 'Legumi') return 'legumes';
  if (food.name === 'Budino proteico' || food.name === 'Barretta proteica' || food.name === 'Bevanda proteica') return 'supplement';
  if (food.sub === 'Salumi') return 'cured';
  return food.id;
}

export type FitLabPools = {
  /** Hard filter: dietary regime, allergens, foods excluded by name. */
  allowed: (food: FitLabFood) => boolean;
  /** Preference weight (≈1 neutral, >1 wanted, <1 not preferred). */
  weight: (food: FitLabFood, kind: SlotKind) => number;
  /** Eats out often: lunches should be easy to carry. */
  eatsOutOften: boolean;
  /** Vegetarian, or asked for tofu / seitan: otherwise plant proteins stay occasional for an omnivore. */
  wantsPlantProtein: boolean;
};

export function buildFitLabPools(answers: Record<string, unknown>): FitLabPools {
  const pattern = answers.dietaryPattern;
  const regime = pattern === 'vegan' ? 'vegan' : pattern === 'vegetarian' ? 'veg' : pattern === 'pescetarian' ? 'pesc' : 'omni';

  const blob = textOf(answers, ['allergiesIntolerances', 'excludedFoods']);
  const excludedByName = foodsNamedIn(blob);
  const bannedAllergens = ALLERGEN_KEYWORDS.filter((g) => g.keywords.some((k) => blob.includes(k))).map((g) => g.allergen);
  // lactose intolerance is not milk allergy: lactose-free milk and aged cheese stay
  const lactoseOnly = /lattosio/.test(blob) && !/allergia al latte|proteine del latte|caseina/.test(blob);

  const allowed = (food: FitLabFood): boolean => {
    if (!food.regimes.includes(regime)) return false;
    if (excludedByName.has(food.id)) return false;
    const allergens = norm(food.allergens);
    for (const a of bannedAllergens) {
      if (!allergens.includes(a)) continue;
      if (a === 'latte' && lactoseOnly && (/senza lattosio/.test(norm(food.name)) || food.sub === 'Formaggi stagionati')) continue;
      return false;
    }
    return true;
  };

  // preferences only count when the person actually picked some
  const picked = (field: string, kind: 'protein' | 'carb' | 'fat') => {
    const values = Array.isArray(answers[field]) ? (answers[field] as string[]) : [];
    if (values.length === 0) return null;
    const wantedSpecs = values.flatMap((v) => PREFERRED[kind][v] ?? []);
    const knownSpecs = Object.values(PREFERRED[kind]).flat();
    return { wanted: (f: FitLabFood) => wantedSpecs.some((s) => matches(f, s)), known: (f: FitLabFood) => knownSpecs.some((s) => matches(f, s)) };
  };
  const prefs = [picked('preferredProteins', 'protein'), picked('preferredCarbs', 'carb'), picked('preferredFats', 'fat')];
  const included = foodsNamedIn(textOf(answers, ['includedFoods']));
  const usual: Record<SlotKind, Set<string>> = {
    breakfast: foodsNamedIn(textOf(answers, USUAL_FIELDS.breakfast)),
    lunch: foodsNamedIn(textOf(answers, USUAL_FIELDS.lunch)),
    dinner: foodsNamedIn(textOf(answers, USUAL_FIELDS.dinner)),
    snack: foodsNamedIn(textOf(answers, USUAL_FIELDS.snack)),
  };

  const weight = (food: FitLabFood, kind: SlotKind): number => {
    let w = 1;
    for (const p of prefs) {
      if (!p || !p.known(food)) continue;
      w = p.wanted(food) ? 1.6 : 0.3;
    }
    if (included.has(food.id)) w = Math.max(w, 3);
    if (usual[kind].has(food.id)) w = Math.max(w, 2.2);
    return w;
  };

  const outTimes = typeof answers.eatingOut === 'string' ? (answers.eatingOut === 'gt6' ? 7 : answers.eatingOut === 'rarely' ? 0 : Number(answers.eatingOut)) : 0;
  const pickedPlant = Array.isArray(answers.preferredProteins) && (answers.preferredProteins as string[]).includes('tofu');
  const namedPlant = [...included].some((id) => FITLAB_FOODS.find((f) => f.id === id)?.sub === 'Proteine vegetali');
  return { allowed, weight, eatsOutOften: Number.isFinite(outTimes) && outTimes >= 3, wantsPlantProtein: regime !== 'omni' || pickedPlant || namedPlant };
}
