/**
 * "Imposta il tuo piano": the person's own calories and macros, month by month, with no menu.
 * Run: npx tsx scripts/nutrition-tests/targets-plan.ts
 */
import { buildPlans } from '../../src/domain/plan-engine';
import { buildUserContext } from '../../src/domain/user-context';
import { currentMonthIndex } from '../../src/lib/planning/plan-progress';
import { buildTargetsPlan, gramsFromPercents, isTargetsPlan, kcalFromGrams, macroPercents, validateMonthTargets } from '../../src/lib/planning/targets-plan';

let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) failed++;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ` — ${detail}`}`);
}

// 1. Percent ↔ grams
const g = gramsFromPercents(2000, { protein: 30, carbs: 45, fats: 25 });
check('2000 kcal 30/45/25 → 150/225/56 g', g.protein === 150 && g.carbs === 225 && g.fats === 56, JSON.stringify(g));
check('grams back to about 2000 kcal', Math.abs(kcalFromGrams(g) - 2000) <= 10, String(kcalFromGrams(g)));
const p = macroPercents({ calories: 2000, ...g });
check('grams back to the same percents', p.protein === 30 && p.carbs === 45 && p.fats === 25, JSON.stringify(p));

// 2. Validation
const pct = { protein: 30, carbs: 45, fats: 25 };
check('valid month has no blocker', !validateMonthTargets({ calories: 2000, ...g }, 'percent', pct, 75).some((x) => x.level === 'blocker'));
check('percents not summing to 100 block', validateMonthTargets({ calories: 2000, ...g }, 'percent', { protein: 30, carbs: 40, fats: 20 }).some((x) => x.level === 'blocker'));
check('grams far from calories block', validateMonthTargets({ calories: 2500, ...g }, 'grams', pct).some((x) => x.level === 'blocker'));
check('calories out of range block', validateMonthTargets({ calories: 600, protein: 50, carbs: 50, fats: 20 }, 'grams', pct).some((x) => x.level === 'blocker'));
check('1100 kcal is a warning, not a blocker', (() => {
  const t = { calories: 1100, ...gramsFromPercents(1100, pct) };
  const issues = validateMonthTargets(t, 'percent', pct, 60);
  return issues.some((x) => x.level === 'warning') && !issues.some((x) => x.level === 'blocker');
})());
check('low protein per kg warns', validateMonthTargets({ calories: 2000, ...gramsFromPercents(2000, { protein: 10, carbs: 60, fats: 30 }) }, 'percent', { protein: 10, carbs: 60, fats: 30 }, 90).some((x) => x.level === 'warning' && /Proteine basse/.test(x.text)));

// 3. The plan
const months = [2200, 2100, 2000, 1900].map((calories) => ({ calories, ...gramsFromPercents(calories, pct) }));
const plan = buildTargetsPlan(months, { goal: 'loseFat', macroMode: 'percent' });
check('one month per target', plan.durationMonths === 4 && plan.months.length === 4);
check('starts today', currentMonthIndex(plan) === 1 && Math.abs(Date.now() - new Date(plan.generatedAt).getTime()) < 60_000);
check('each month carries its calories', plan.months.map((m) => m.calorieTarget).join(',') === '2200,2100,2000,1900');
check('every day of a month has the month target and no meals', plan.months.every((m) => m.weeklySplit.length === 7 && m.weeklySplit.every((d) => d.meals.length === 0 && d.calorieTarget === m.calorieTarget && d.macroTargetsG?.protein === m.macroTargetsG.protein)));
check('recognised as own targets', isTargetsPlan(plan));
// same rule as isValidDietPlan for a 'custom' plan (the store itself needs React Native, so it is not imported here)
check('accepted as a valid diet plan (not rebuilt)', plan.source === 'custom' && plan.months.every((m) => m.weeklySplit.length > 0));

// 4. A rebuild (questionnaire edit, new training card) never touches it
const answers = { mode: 'both', goal: 'loseFat', sex: 'male', age: 30, heightCm: 180, weightKg: 82, activityLevel: 'moderate', trainingDaysPerWeek: 3 };
const ctx = buildUserContext(answers);
const bundle = buildPlans(ctx, { calibration: plan.calibration, existing: { diet: plan, training: null } });
check('rebuild keeps the targets as set', bundle.diet?.months.map((m) => m.calorieTarget).join(',') === '2200,2100,2000,1900', bundle.diet?.months.map((m) => m.calorieTarget).join(','));
check('rebuild keeps the kind', isTargetsPlan(bundle.diet));

// 5. Editing: months already lived stay as they were
const started = { ...plan, generatedAt: new Date(Date.now() - 45 * 86_400_000).toISOString() };
const edited = buildTargetsPlan(
  [1500, 1500, 1500].map((calories) => ({ calories, ...gramsFromPercents(calories, pct) })),
  { goal: 'loseFat', macroMode: 'grams', generatedAt: started.generatedAt, keepMonths: started.months.filter((m) => m.monthIndex < currentMonthIndex(started)) }
);
check('edit keeps the start date', edited.generatedAt === started.generatedAt);
check('edit keeps the month already lived', edited.months.map((m) => m.calorieTarget).join(',') === '2200,1500,1500', edited.months.map((m) => m.calorieTarget).join(','));
check('edit can shorten the plan', edited.durationMonths === 3);
check('edit records the macro unit', edited.ownTargets?.macroMode === 'grams');

console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);
