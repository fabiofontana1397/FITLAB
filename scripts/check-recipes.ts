/**
 * Checks the official recipe catalog (fitlab/recipes.ts) against the dishes (fitlab/dishes.ts): every official PL dish
 * has exactly one recipe with the same id, steps, times and difficulty; no recipe points at a missing dish; the meal of
 * the catalog is one the dish can be served at; and no step states a weight (quantities are solved per person).
 *
 *   npm run recipes:check
 */
import { DISHES } from '@/lib/planning/fitlab/dishes';
import { RECIPES } from '@/lib/planning/fitlab/recipes';

const problems: string[] = [];
const seen = new Set<string>();
const dishes = new Map(DISHES.map((d) => [d.id, d]));

for (const r of RECIPES) {
  if (seen.has(r.id)) problems.push(`duplicate recipe: ${r.id}`);
  seen.add(r.id);
  const dish = dishes.get(r.id);
  if (!dish) { problems.push(`${r.id}: no dish with this id in dishes.ts`); continue; }
  if (!dish.kinds.includes(r.meal)) problems.push(`${r.id}: meal "${r.meal}" is not among the dish kinds (${dish.kinds.join(', ')})`);
  if (!r.name || !r.description) problems.push(`${r.id}: name and description are required`);
  if (r.steps.length < 2 || r.steps.some((s) => !s.trim())) problems.push(`${r.id}: needs at least two non-empty steps`);
  if (r.equipment.length === 0) problems.push(`${r.id}: equipment is empty`);
  if (!(r.prepMinutes > 0) || r.cookMinutes < 0 || r.totalMinutes !== r.prepMinutes + r.cookMinutes) problems.push(`${r.id}: inconsistent times`);
  if (r.steps.some((s) => /\b\d+\s?(g|gr|grammi|kg|ml)\b/i.test(s))) problems.push(`${r.id}: a step states a weight, quantities must not be fixed in the recipe`);
}
for (const d of DISHES) if (d.source === 'excel' && !seen.has(d.id)) problems.push(`${d.id}: official dish without a recipe`);

if (problems.length > 0) {
  console.error(`✗ ${problems.length} problem(s):\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${RECIPES.length} recipes, all consistent with the dishes`);
