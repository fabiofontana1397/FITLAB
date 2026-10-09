/**
 * The Fit Lab catalog as the diet engine and the app use it: the generated rows
 * (data/foods.generated.ts, from the workbook) plus lookups by name.
 */
import { FITLAB_FOODS, type FitLabFood } from './data/foods.generated';

export type { FitLabFood } from './data/foods.generated';
export { FITLAB_FOODS } from './data/foods.generated';

const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const BY_NAME = new Map<string, FitLabFood>();
const BY_ID = new Map<string, FitLabFood>();
for (const food of FITLAB_FOODS) {
  BY_ID.set(food.id, food);
  BY_NAME.set(norm(food.name), food);
}

/** A catalog food by its exact name; throws on a typo so a wrong dish definition fails loudly. */
export function foodByName(name: string): FitLabFood {
  const food = BY_NAME.get(norm(name));
  if (!food) throw new Error(`Fit Lab catalog: "${name}" is not in the catalog`);
  return food;
}

export const fitlabById = (id: string): FitLabFood | undefined => BY_ID.get(id);

/** How the grams of a food are weighed: the catalog's state ("Secco", "Crudo"…) for the foods where it matters. */
export function basisOf(food: FitLabFood): 'secco' | 'crudo' | undefined {
  if (food.category === 'Verdure' || food.category === 'Frutta' || food.category === 'Condimenti e aromi') return undefined;
  const state = norm(food.state.split(';')[0]);
  if (/^(secc|dry)/.test(state)) return 'secco';
  if (/^crud/.test(state)) return 'crudo';
  return undefined;
}
