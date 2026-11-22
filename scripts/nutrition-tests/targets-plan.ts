/**
 * "Crea il tuo piano" (nutrition): the person's own calories and macros, month by month, training and rest days, with no menu.
 * Run: npx tsx scripts/nutrition-tests/targets-plan.ts
 */
import { buildPlans } from '../../src/domain/plan-engine';
import { buildUserContext } from '../../src/domain/user-context';
import { currentMonthIndex } from '../../src/lib/planning/plan-progress';
import { buildTargetsPlan, carbsForCalories, dayTargets, gramsFromPercents, isTargetsPlan, kcalFromGrams, macroPercents, monthDayTargets, planMonthName, validateDayTargets } from '../../src/lib/planning/targets-plan';

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

// 2. Carbs fill the calories left; validation
const pct = { protein: 30, carbs: 45, fats: 25 };
check('3000 kcal, 160 g protein, 90 g fats → 387 g carbs', carbsForCalories(3000, 160, 90) === 388 || carbsForCalories(3000, 160, 90) === 387, String(carbsForCalories(3000, 160, 90)));
check('the day adds up to its calories', Math.abs(kcalFromGrams(dayTargets(3000, 160, 90)) - 3000) <= 4, String(kcalFromGrams(dayTargets(3000, 160, 90))));
check('carbs never negative', carbsForCalories(1200, 200, 80) === 0);
check('valid day has no blocker', !validateDayTargets({ calories: 2000, protein: 150, fats: 56 }, 75).some((x) => x.level === 'blocker'));
check('protein + fats over the calories block', validateDayTargets({ calories: 1500, protein: 250, fats: 80 }).some((x) => x.level === 'blocker'));
check('calories out of range block', validateDayTargets({ calories: 600, protein: 50, fats: 20 }).some((x) => x.level === 'blocker'));
check('1100 kcal is a warning, not a blocker', (() => {
  const issues = validateDayTargets({ calories: 1100, protein: 80, fats: 35 }, 60);
  return issues.some((x) => x.level === 'warning') && !issues.some((x) => x.level === 'blocker');
})());
check('low protein per kg warns', validateDayTargets({ calories: 2000, protein: 50, fats: 66 }, 90).some((x) => x.level === 'warning' && /Proteine basse/.test(x.text)));

// 3. The plan
const months = [2200, 2100, 2000, 1900].map((calories) => ({ calories, ...gramsFromPercents(calories, pct) }));
const plan = buildTargetsPlan(months, { goal: 'loseFat' });
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
  { goal: 'loseFat', generatedAt: started.generatedAt, keepMonths: started.months.filter((m) => m.monthIndex < currentMonthIndex(started)) }
);
check('edit keeps the start date', edited.generatedAt === started.generatedAt);
check('edit keeps the month already lived', edited.months.map((m) => m.calorieTarget).join(',') === '2200,1500,1500', edited.months.map((m) => m.calorieTarget).join(','));
check('edit can shorten the plan', edited.durationMonths === 3);

// 6. Training and rest days
const split = buildTargetsPlan([{ training: dayTargets(3000, 160, 90), rest: dayTargets(2500, 160, 80) }], { goal: 'gainMuscle', trainingDays: [0, 2, 4] });
const sm = split.months[0];
check('training weekdays carry the training target', [0, 2, 4].every((d) => sm.weeklySplit[d].calorieTarget === 3000 && sm.weeklySplit[d].isTrainingDay === true));
check('rest weekdays carry the rest target', [1, 3, 5, 6].every((d) => sm.weeklySplit[d].calorieTarget === 2500 && sm.weeklySplit[d].isTrainingDay === false));
check('month target is the week average', sm.calorieTarget === Math.round((3 * 3000 + 4 * 2500) / 7), String(sm.calorieTarget));
check('training days recorded', split.ownTargets?.trainingDays?.join(',') === '0,2,4');
const back = monthDayTargets(sm);
check('targets read back per kind of day', back.training.calories === 3000 && back.rest.calories === 2500 && back.training.fats === 90 && back.rest.fats === 80);
check('a single target reads back for both kinds', (() => { const b2 = monthDayTargets(plan.months[0]); return b2.training.calories === 2200 && b2.rest.calories === 2200; })());

// 7. Months named after the calendar
check('months named from the start month', [1, 2, 3].map((i) => planMonthName('2026-11-22T12:00:00Z', i)).join(',') === 'Novembre,Dicembre,Gennaio', [1, 2, 3].map((i) => planMonthName('2026-11-22T12:00:00Z', i)).join(','));
check('short month names', planMonthName('2026-11-22T12:00:00Z', 2, 'short') === 'Dic', planMonthName('2026-11-22T12:00:00Z', 2, 'short'));

console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);
