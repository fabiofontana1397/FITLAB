/**
 * Display-quantity formatting (diet restructure request): some foods are
 * unrealistic to weigh out precisely at home (an egg, a banana) and are
 * always bought/eaten as whole pieces — showing "2 uova" instead of "100g"
 * matches how the user will actually portion the meal. `grams` stays the
 * ground truth everywhere else (kcal math, meal_entries logging); this is
 * purely a display label computed from it.
 */
const COUNT_UNIT: Record<string, { unitGrams: number; singular: string; plural: string }> = {
  eggs: { unitGrams: 50, singular: 'uovo', plural: 'uova' },
  banana: { unitGrams: 120, singular: 'banana', plural: 'banane' },
  apple: { unitGrams: 150, singular: 'mela', plural: 'mele' },
  orange: { unitGrams: 150, singular: 'arancia', plural: 'arance' },
  kiwi: { unitGrams: 75, singular: 'kiwi', plural: 'kiwi' },
};

export function formatFoodQuantity(foodId: string, grams: number): string {
  const unit = COUNT_UNIT[foodId];
  if (!unit) return `${grams}g`;
  const count = Math.max(1, Math.round(grams / unit.unitGrams));
  return `${count} ${count === 1 ? unit.singular : unit.plural}`;
}
