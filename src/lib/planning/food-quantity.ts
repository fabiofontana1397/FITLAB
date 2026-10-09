/**
 * Display-quantity formatting (diet restructure request): some foods are
 * unrealistic to weigh out precisely at home (an egg, a banana) and are
 * always bought/eaten as whole pieces — showing "2 uova" instead of "100g"
 * matches how the user will actually portion the meal. `grams` stays the
 * ground truth everywhere else (kcal math, meal_entries logging); this is
 * purely a display label computed from it.
 */
import { UNITS } from './fitlab/catalog';
import { basisOf, fitlabById } from './fitlab/foods';

const COUNT_UNIT: Record<string, { unitGrams: number; singular: string; plural: string }> = {
  eggs: { unitGrams: 50, singular: 'uovo', plural: 'uova' },
  banana: { unitGrams: 120, singular: 'banana', plural: 'banane' },
  apple: { unitGrams: 150, singular: 'mela', plural: 'mele' },
  orange: { unitGrams: 150, singular: 'arancia', plural: 'arance' },
  kiwi: { unitGrams: 75, singular: 'kiwi', plural: 'kiwi' },
  pear: { unitGrams: 150, singular: 'pera', plural: 'pere' },
  'protein-bar': { unitGrams: 45, singular: 'barretta', plural: 'barrette' },
  'protein-pudding': { unitGrams: 200, singular: 'vasetto', plural: 'vasetti' },
  'protein-drink': { unitGrams: 330, singular: 'bottiglietta', plural: 'bottigliette' },
  'rice-cakes': { unitGrams: 9, singular: 'galletta', plural: 'gallette' },
  'corn-cakes': { unitGrams: 10, singular: 'galletta', plural: 'gallette' },
  'fette-biscottate': { unitGrams: 9, singular: 'fetta', plural: 'fette' },
};

export function formatFoodQuantity(foodId: string, grams: number): string {
  // Fit Lab catalog foods: pieces where it makes sense, otherwise grams in the state the weight refers to (dry / raw)
  const fitlab = fitlabById(foodId);
  if (fitlab) {
    const piece = UNITS[fitlab.name];
    if (piece) {
      const count = Math.max(1, Math.round(grams / piece.grams));
      return `${count} ${count === 1 ? piece.one : piece.many}`;
    }
    const basis = basisOf(fitlab);
    return basis ? `${grams}g a ${basis}` : `${grams}g`;
  }
  const unit = COUNT_UNIT[foodId];
  if (!unit) return `${grams}g`;
  const count = Math.max(1, Math.round(grams / unit.unitGrams));
  return `${count} ${count === 1 ? unit.singular : unit.plural}`;
}
