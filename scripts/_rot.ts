import { buildUserContext } from '@/domain/user-context';
import { buildPlans } from '@/domain/plan-engine';
import { DISHES } from '@/lib/planning/fitlab/dishes';
import { PERSONAS } from './agent-tests/personas';
const all = new Set<string>(); let overlapSum = 0, n = 0;
for (const per of PERSONAS) { try { const b = buildPlans(buildUserContext(per.answers as any)); const months = b.diet!.months.map((m) => new Set(m.weeklySplit.flatMap((d) => d.meals.map((x) => x.recipe?.dishId).filter(Boolean) as string[])));
  months.forEach((s) => s.forEach((x) => all.add(x)));
  for (let i = 1; i < months.length; i++) { const a = months[i-1], c = months[i]; const inter = [...c].filter((x) => a.has(x)).length; overlapSum += inter / c.size; n++; } } catch {} }
console.log('ricette usate', all.size, 'di', DISHES.length, '| sovrapposizione media tra mesi consecutivi', Math.round(100 * overlapSum / n) + '%');
console.log('mai usate:', DISHES.filter((d) => !all.has(d.id)).map((d) => d.id).join(' '));
