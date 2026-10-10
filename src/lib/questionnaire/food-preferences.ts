/**
 * Food preferences of the questionnaire: one selector per meal component (proteins, carbohydrates, fats, fruit,
 * vegetables), each listing the Fit Lab catalog foods of that component. What the person picks becomes the set of
 * foods the diet engine favours (fitlab/pools.ts, fitlab/meal-builder.ts).
 *
 * Answers hold catalog food ids. Older answers hold broad codes ("chicken", "rice"…): normalizePreferred() turns
 * them into the catalog foods they meant, so nobody has to answer again.
 */
import { FITLAB_FOODS, type FitLabFood } from '@/lib/planning/fitlab/foods';

export type FoodComponent = 'protein' | 'carb' | 'fat' | 'fruit' | 'veg';

export const FOOD_COMPONENTS: FoodComponent[] = ['protein', 'carb', 'fat', 'fruit', 'veg'];

export const PREFERENCE_QUESTION_ID: Record<FoodComponent, string> = {
  protein: 'preferredProteins',
  carb: 'preferredCarbs',
  fat: 'preferredFats',
  fruit: 'preferredFruit',
  veg: 'preferredVegetables',
};

export const COMPONENT_LABEL: Record<FoodComponent, string> = {
  protein: 'Proteine',
  carb: 'Carboidrati',
  fat: 'Grassi',
  fruit: 'Frutta',
  veg: 'Verdura',
};

/** Title of each selector's list, with the right gender and number. */
export const PICKER_TITLE: Record<FoodComponent, string> = {
  protein: 'Proteine preferite',
  carb: 'Carboidrati preferiti',
  fat: 'Grassi preferiti',
  fruit: 'Frutta preferita',
  veg: 'Verdura preferita',
};

/** "Scegli …" prompt of each selector, with the right article. */
export const PICKER_PROMPT: Record<FoodComponent, string> = {
  protein: 'Scegli le proteine che preferisci',
  carb: 'Scegli i carboidrati che preferisci',
  fat: 'Scegli i grassi che preferisci',
  fruit: 'Scegli la frutta che preferisci',
  veg: 'Scegli la verdura che preferisci',
};

const CATEGORY: Record<FoodComponent, string> = {
  protein: 'Proteine',
  carb: 'Carboidrati',
  fat: 'Grassi',
  fruit: 'Frutta',
  veg: 'Verdure',
};

export const componentOf = (food: FitLabFood): FoodComponent | null => FOOD_COMPONENTS.find((c) => CATEGORY[c] === food.category) ?? null;

export type FoodOption = { value: string; label: string; group: string };

/** The selectable foods of a component, grouped by catalog subcategory (alphabetical inside each group). */
export function foodOptions(component: FoodComponent): FoodOption[] {
  return FITLAB_FOODS.filter((f) => f.category === CATEGORY[component])
    .map((f) => ({ value: f.id, label: f.name, group: f.sub }))
    .sort((a, b) => a.group.localeCompare(b.group, 'it') || a.label.localeCompare(b.label, 'it'));
}

// ------------------------------------------------------------ legacy codes --
type Spec = string; // an exact food name, "sub:<Sottocategoria>", "cat:<Categoria>" or "name:<prefix>"

export function matchesSpec(food: FitLabFood, spec: Spec): boolean {
  if (spec.startsWith('sub:')) return food.sub === spec.slice(4);
  if (spec.startsWith('cat:')) return food.category === spec.slice(4);
  if (spec.startsWith('name:')) return food.name.startsWith(spec.slice(5));
  return food.name === spec;
}

/** What the broad codes of the first questionnaire versions meant, in catalog terms. */
export const LEGACY_CODES: Record<'protein' | 'carb' | 'fat', Record<string, Spec[]>> = {
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

const IDS = new Set(FITLAB_FOODS.map((f) => f.id));

/**
 * The catalog food ids a stored answer stands for. Food ids pass through; legacy codes are expanded into the
 * foods they meant (within the component the question belongs to); anything unknown is dropped.
 */
export function normalizePreferred(component: FoodComponent, values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out = new Set<string>();
  for (const value of values as string[]) {
    if (IDS.has(value)) {
      out.add(value);
      continue;
    }
    const specs = component === 'protein' || component === 'carb' || component === 'fat' ? LEGACY_CODES[component][value] : undefined;
    if (!specs) continue;
    for (const food of FITLAB_FOODS) if (specs.some((s) => matchesSpec(food, s)) && food.category === CATEGORY[component]) out.add(food.id);
  }
  return [...out];
}

/** All preferred catalog food ids of a set of answers, per component. */
export function preferredByComponent(answers: Record<string, unknown>): Record<FoodComponent, string[]> {
  const out = {} as Record<FoodComponent, string[]>;
  for (const c of FOOD_COMPONENTS) out[c] = normalizePreferred(c, answers[PREFERENCE_QUESTION_ID[c]]);
  return out;
}
