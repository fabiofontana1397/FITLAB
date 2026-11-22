/**
 * The three sources of a plan (FitLab, loaded, built by the person) and the "Fai da te" training program.
 * Run: npx tsx scripts/nutrition-tests/plan-sources.ts
 */
import { buildPlans } from '../../src/domain/plan-engine';
import { buildUserContext } from '../../src/domain/user-context';
import { buildCustomTrainingPlan } from '../../src/lib/planning/custom-workout';
import { buildOwnWeek, DEFAULT_OWN_WEEK, exerciseFromCatalog, exerciseFromName, ownWeekFromPlan, searchExercises, validateOwnWeek } from '../../src/lib/planning/own-workout';
import { dietPlanSource, trainingPlanSource } from '../../src/lib/planning/plan-source';
import { buildTargetsPlan } from '../../src/lib/planning/targets-plan';

let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) failed++;
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond || !detail ? '' : ` — ${detail}`}`);
}

// sources
check('no plan → no source', trainingPlanSource(null) === null && dietPlanSource(undefined) === null);
check('generated → fitlab', trainingPlanSource({ source: 'generated' }) === 'fitlab' && dietPlanSource({ source: 'generated' }) === 'fitlab');
check('loaded card → file', trainingPlanSource({ source: 'custom' }) === 'file' && dietPlanSource({ source: 'custom' }) === 'file');
check('own program / own targets → own', trainingPlanSource({ source: 'custom', ownBuilt: true }) === 'own' && dietPlanSource(buildTargetsPlan([{ calories: 2000, protein: 150, carbs: 200, fats: 66 }], { goal: 'maintainImprove' })) === 'own');

// search
check('search puts names starting with the text first', searchExercises('panca', null)[0].name.startsWith('Panca'), searchExercises('panca', null)[0].name);
check('search ignores accents and case', searchExercises('CROCI', 'chest').length >= 2);
check('group filter keeps only that group', searchExercises('', 'legs').every((e) => ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'].includes(e.primary)));

// validation
check('default week needs exercises', validateOwnWeek(DEFAULT_OWN_WEEK()).length === 3);
check('no days is a blocker', validateOwnWeek({})[0]?.day === null);
const bench = exerciseFromCatalog(searchExercises('panca piana con bilanciere', null)[0]);
check('compound starts at 4×8, 120 s', bench.sets === '4' && bench.reps === '8' && bench.rest === '120');
const typed = exerciseFromName('hip thrust alla smith');
check('typed exercise gets a custom id and a capital', typed.id === 'custom-hip-thrust-alla-smith' && typed.name === 'Hip thrust alla smith');
const week = { 0: { title: 'Petto', exercises: [bench, typed] }, 3: { title: '', exercises: [{ ...bench, key: 'k2', sets: '0' }] } };
check('zero sets is flagged on its day', validateOwnWeek(week).some((x) => x.day === 3 && /serie/.test(x.text)));
week[3].exercises[0].sets = '3';
check('fixed week is valid', validateOwnWeek(week).length === 0, JSON.stringify(validateOwnWeek(week)));

// build
const full = buildOwnWeek(week);
check('seven days, rest where nothing is planned', full.length === 7 && full.filter((d) => d.type === 'workout').length === 2 && full[1].type === 'rest');
check('empty title gets a default', full[3].title === 'Allenamento Giovedì');
check('numbers become numbers', full[0].exercises?.[0].sets === 4 && full[0].exercises?.[0].restSec === 120 && full[0].exercises?.[0].loadIncrementKg === 2.5);
const plan = buildCustomTrainingPlan(full, null, { own: true });
check('own plan is custom + ownBuilt', plan.source === 'custom' && plan.ownBuilt === true && trainingPlanSource(plan) === 'own');
check('loaded card is not ownBuilt', buildCustomTrainingPlan(full, null).ownBuilt === undefined);
const back = ownWeekFromPlan(plan, 1);
check('editing reads the same days back', Object.keys(back).join(',') === '0,3' && back[0].exercises.length === 2 && back[0].exercises[0].sets === '4');

// the app keeps it as written
const ctx = buildUserContext({ mode: 'both', goal: 'gainMuscle', sex: 'male', age: 30, heightCm: 180, weightKg: 80, activityLevel: 'moderate', trainingDaysPerWeek: 3 });
const bundle = buildPlans(ctx, { calibration: plan.calibration, existing: { diet: null, training: plan } });
check('rebuild keeps the program and its kind', bundle.training?.ownBuilt === true && bundle.training.months[0].weeklySplit[0].exercises?.[0].id === 'panca-piana');

console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);
