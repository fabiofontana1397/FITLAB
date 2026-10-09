import { buildPlans } from '@/domain/plan-engine';
import { buildUserContext } from '@/domain/user-context';
import { PERSONAS } from './personas';
for (const id of process.argv.slice(2)) {
  const p = PERSONAS.find((x) => x.id === id)!;
  const diet = buildPlans(buildUserContext(p.answers)).diet!;
  const d = diet.months[0].weeklySplit;
  console.log('==', id, p.answers.mealsSelected);
  const slots = [...new Set(d.flatMap((day) => day.meals.map((m) => m.slotId)))];
  for (const s of slots) console.log(s.padEnd(20), d.map((day) => day.meals.find((m) => m.slotId === s)?.recipe?.name ?? '(libero)').join(' | '));
}
