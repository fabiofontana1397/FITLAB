/**
 * Sanity checks on what the plan generators produce for a persona. Every
 * check is independent of the generator code (it re-derives what a sensible
 * plan must look like from nutrition/training basics and the persona's own
 * answers) so a bug in the generators can't hide itself.
 */
import { FOOD_DATABASE, findFood } from '@/lib/mock/food-database';
import { ONBOARDING_STEPS, buildActivityQuestions, isQuestionVisible, stepsForMode, TIME_REGEX, type OnboardingMode, type Question } from '@/lib/questionnaire/schema';
import { parseNumericAnswer } from '@/lib/questionnaire/parse-answer';
import { baselineKcal } from '@/domain/energy';
import { buildPlans, initialTargets, type PlanBundle } from '@/domain/plan-engine';
import { weeklyBalanceGoal, type PlanTargets } from '@/domain/targets';
import { buildUserContext, type UserContext } from '@/domain/user-context';
import { GYM_EXERCISES, HOME_EXERCISES, type ExerciseDef } from '@/lib/planning/exercise-library';
import type { DietPlan, TrainingPlan } from '@/lib/planning/types';
import type { Goal } from '@/lib/mock/types';

import type { Answers, Persona } from './personas';

export type Level = 'FAIL' | 'WARN' | 'INFO';
export type Area = 'questionario' | 'target' | 'dieta' | 'allenamento' | 'coerenza';
export type Finding = { level: Level; area: Area; code: string; message: string };

export type PersonaRun = {
  persona: Persona;
  ctx: UserContext;
  bundle: PlanBundle;
  targets: NutritionTargets;
  durationMonths: number;
  diet: DietPlan | null;
  training: TrainingPlan | null;
  findings: Finding[];
};

const num = (v: unknown, fallback = 0) => parseNumericAnswer(v) ?? fallback;
const MIN_SAFE_CALORIE_TARGET = 1200;

/** Harness-side view of the month-1 targets. */
export type NutritionTargets = {
  bmr: number;
  /** Average daily expenditure (resting + everyday + planned exercise). */
  tdee: number;
  dailyCalorieTarget: number;
  macroTargetsG: { protein: number; carbs: number; fats: number };
  hydrationTargetMl: number;
};
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// ---------------------------------------------------------------- helpers --

export function macrosOf(items: { foodId: string; grams: number }[]) {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fats = 0;
  for (const it of items) {
    const f = findFood(it.foodId);
    if (!f) continue;
    const k = it.grams / 100;
    kcal += f.kcal100 * k;
    protein += f.protein100 * k;
    carbs += f.carbs100 * k;
    fats += f.fats100 * k;
  }
  return { kcal, protein, carbs, fats };
}

const MEAT = new Set(['chicken-breast', 'turkey-breast', 'beef-lean', 'prosciutto-crudo', 'bresaola', 'chicken-thigh', 'chicken-thigh-raw']);
const FISH = new Set(['salmon', 'tuna-canned']);
const DAIRY = new Set(['greek-yogurt', 'cottage-cheese', 'ricotta', 'skyr', 'whey-protein', 'milk-semi', 'mozzarella', 'parmesan']);
const EGGS = new Set(['eggs', 'egg-whites']);
const ANIMAL = new Set([...MEAT, ...FISH, ...DAIRY, ...EGGS, 'honey']);
const MAIN_MEAL_ONLY = new Set([...MEAT, ...FISH, 'chickpeas', 'lentils', 'black-beans']);

const ALL_FOOD_NAMES = new Map(FOOD_DATABASE.map((f) => [f.id, f.name]));
const foodName = (id: string) => ALL_FOOD_NAMES.get(id) ?? id;

function allDietItems(diet: DietPlan, monthIndex?: number) {
  const out: { month: number; day: number; slotId: string; foodId: string; grams: number; kcal: number }[] = [];
  for (const m of diet.months) {
    if (monthIndex != null && m.monthIndex !== monthIndex) continue;
    m.weeklySplit.forEach((d, day) =>
      d.meals.forEach((meal) => meal.items.forEach((it) => out.push({ month: m.monthIndex, day, slotId: meal.slotId, foodId: it.foodId, grams: it.grams, kcal: it.kcal })))
    );
  }
  return out;
}

const exerciseCatalog: Map<string, ExerciseDef> = new Map(
  [...Object.values(GYM_EXERCISES).flat(), ...Object.values(HOME_EXERCISES).flat()].map((e) => [e.id, e])
);

function minutesFromBucket(bucket: unknown): { min: number; max: number } {
  switch (bucket) {
    case 'lt30':
      return { min: 15, max: 30 };
    case '30-45':
      return { min: 30, max: 45 };
    case '45-60':
      return { min: 45, max: 60 };
    case '60-90':
      return { min: 60, max: 90 };
    case 'gt90':
      return { min: 90, max: 150 };
    default:
      return { min: 30, max: 60 };
  }
}

// ----------------------------------------------------------- questionnaire --

/** The persona's blob must be a complete, valid questionnaire — same gate the
 * app applies before "Conferma" (every mandatory visible question answered). */
export function checkQuestionnaire(answers: Answers): Finding[] {
  const f: Finding[] = [];
  const mode = (answers.mode as OnboardingMode) ?? 'both';
  const steps = stepsForMode(mode);
  const missing: string[] = [];
  for (const step of steps) {
    const questions: Question[] =
      step.id === 'training' ? [...step.questions, ...buildActivityQuestions((answers.activitiesPracticed as string[]) ?? [])] : step.questions;
    for (const q of questions.filter((qq) => isQuestionVisible(qq, answers))) {
      if (q.optional) continue;
      const v = answers[q.id];
      const ok = Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '' && (q.type !== 'time' || TIME_REGEX.test(String(v).trim()));
      if (!ok) missing.push(q.id);
    }
  }
  if (missing.length > 0) f.push({ level: 'FAIL', area: 'questionario', code: 'Q1', message: `Domande obbligatorie senza risposta: ${missing.join(', ')}` });

  // Answers that are present but not part of the questionnaire for this mode
  const known = new Set([...ONBOARDING_STEPS.flatMap((s) => s.questions.map((q) => q.id)), ...buildActivityQuestions(['gym', 'running']).map((q) => q.id)]);
  const dynamic = Object.keys(answers).filter((k) => answers[k] !== undefined && !known.has(k) && !k.startsWith('freq_') && !k.startsWith('focus_') && k !== 'mode');
  if (dynamic.length > 0) f.push({ level: 'INFO', area: 'questionario', code: 'Q2', message: `Risposte non presenti nello schema: ${dynamic.join(', ')}` });

  const goal = answers.goal as Goal;
  const cur = num(answers.currentWeightKg);
  const tgt = num(answers.targetWeightKg);
  if (goal === 'loseFat' && tgt >= cur) f.push({ level: 'WARN', area: 'questionario', code: 'Q3', message: `Obiettivo "perdere grasso" ma peso obiettivo (${tgt}) ≥ peso attuale (${cur}): l’app non lo blocca` });
  if ((goal === 'gainMuscle' || goal === 'gainStrength') && tgt > 0 && tgt < cur) f.push({ level: 'WARN', area: 'questionario', code: 'Q3', message: `Obiettivo "${goal}" ma peso obiettivo (${tgt}) < peso attuale (${cur}): l’app non lo blocca` });
  return f;
}

// ----------------------------------------------------------------- targets --

export function checkTargets(persona: Persona, targets: NutritionTargets, durationMonths: number): Finding[] {
  const a = persona.answers;
  const f: Finding[] = [];
  const goal = a.goal as Goal;
  const sex = a.sex as string;
  const weight = num(a.currentWeightKg);
  const height = num(a.heightCm);
  const bmi = weight / Math.pow(height / 100, 2);
  const { bmr, tdee, dailyCalorieTarget: cal, macroTargetsG: m } = targets;

  const ratio = cal / tdee;
  const expected = persona.expect?.calories;
  if (expected === 'deficit' && !(ratio < 0.95)) f.push({ level: 'FAIL', area: 'target', code: 'T1', message: `Obiettivo di deficit ma target ${cal} kcal = ${(ratio * 100).toFixed(0)}% del fabbisogno (${tdee})` });
  if (expected === 'surplus' && !(ratio > 1.03)) f.push({ level: 'FAIL', area: 'target', code: 'T1', message: `Obiettivo di surplus ma target ${cal} kcal = ${(ratio * 100).toFixed(0)}% del fabbisogno (${tdee})` });
  if (expected === 'maintenance' && Math.abs(ratio - 1) > 0.06) f.push({ level: 'FAIL', area: 'target', code: 'T1', message: `Obiettivo di mantenimento ma target ${cal} kcal = ${(ratio * 100).toFixed(0)}% del fabbisogno (${tdee})` });

  if (goal === 'loseFat') {
    if (ratio < 0.7) f.push({ level: 'FAIL', area: 'target', code: 'T2', message: `Deficit eccessivo: ${((1 - ratio) * 100).toFixed(0)}% sotto il fabbisogno` });
    else if (ratio < 0.78) f.push({ level: 'WARN', area: 'target', code: 'T2', message: `Deficit aggressivo: ${((1 - ratio) * 100).toFixed(0)}% sotto il fabbisogno` });
    const weeklyKg = ((tdee - cal) * 7) / 7700;
    const pctBw = (weeklyKg / weight) * 100;
    if (pctBw > 1) f.push({ level: 'WARN', area: 'target', code: 'T3', message: `Perdita attesa ${weeklyKg.toFixed(2)} kg/sett. (${pctBw.toFixed(1)}% del peso): oltre il ritmo consigliato (≤1%)` });
  }
  if ((goal === 'gainMuscle' || goal === 'gainStrength') && ratio > 1.2) f.push({ level: 'WARN', area: 'target', code: 'T2', message: `Surplus alto: +${((ratio - 1) * 100).toFixed(0)}% sul fabbisogno (rischio aumento di grasso)` });

  if (tdee < bmr * 1.15 || tdee > bmr * 2.4) f.push({ level: 'FAIL', area: 'target', code: 'T4', message: `Fabbisogno ${tdee} irrealistico rispetto al metabolismo basale ${bmr} (×${(tdee / bmr).toFixed(2)})` });

  const floor = sex === 'female' ? MIN_SAFE_CALORIE_TARGET : 1500;
  if (cal < floor) f.push({ level: sex === 'female' ? 'FAIL' : 'WARN', area: 'target', code: 'T5', message: `Target ${cal} kcal sotto la soglia di sicurezza (${floor})` });
  else if (cal === MIN_SAFE_CALORIE_TARGET) f.push({ level: 'INFO', area: 'target', code: 'T5', message: `Il target è stato forzato al minimo di sicurezza (${MIN_SAFE_CALORIE_TARGET} kcal): il deficit reale è inferiore a quello voluto` });

  const macroKcal = m.protein * 4 + m.carbs * 4 + m.fats * 9;
  if (Math.abs(macroKcal - cal) / cal > 0.03) f.push({ level: 'FAIL', area: 'target', code: 'T6', message: `Le calorie dei macro (${macroKcal}) non tornano con il target (${cal})` });

  const pPerKg = m.protein / weight;
  if (pPerKg < 1.3 || pPerKg > 2.5) f.push({ level: 'WARN', area: 'target', code: 'T7', message: `Proteine ${m.protein} g = ${pPerKg.toFixed(1)} g/kg: fuori dall’intervallo 1,3–2,5` });
  if (bmi >= 30 && pPerKg > 1.9) f.push({ level: 'WARN', area: 'target', code: 'T7', message: `Proteine ${m.protein} g (${pPerKg.toFixed(1)} g/kg) calcolate sul peso reale con BMI ${bmi.toFixed(0)}: eccessive, andrebbero calcolate sul peso obiettivo/massa magra` });
  const fatPct = (m.fats * 9) / cal;
  if (fatPct < 0.2) f.push({ level: 'WARN', area: 'target', code: 'T8', message: `Grassi ${(fatPct * 100).toFixed(0)}% delle calorie: sotto il 20%` });
  const carbPerKg = m.carbs / weight;
  if (goal === 'improveEndurance' && carbPerKg < 4) f.push({ level: 'WARN', area: 'target', code: 'T9', message: `Per un runner di resistenza i carboidrati (${carbPerKg.toFixed(1)} g/kg) sono bassi (consigliati ≥4–5 g/kg)` });
  if (m.carbs < 100) f.push({ level: 'WARN', area: 'target', code: 'T9', message: `Carboidrati molto bassi (${m.carbs} g)` });

  const hydrationPerKg = targets.hydrationTargetMl / weight;
  if (hydrationPerKg < 25 || hydrationPerKg > 50) f.push({ level: 'WARN', area: 'target', code: 'T10', message: `Idratazione ${targets.hydrationTargetMl} ml = ${hydrationPerKg.toFixed(0)} ml/kg fuori range 25–50` });

  // Plan length vs the weight change asked for
  const tgt = num(a.targetWeightKg);
  if (goal === 'loseFat' && tgt > 0 && tgt < weight) {
    const kg = weight - tgt;
    const impliedWeekly = ((tdee - cal) * 7) / 7700;
    const reachable = impliedWeekly * 4.345 * durationMonths;
    if (durationMonths === 12 && reachable < kg * 0.9) f.push({ level: 'WARN', area: 'target', code: 'T11', message: `Obiettivo −${kg.toFixed(0)} kg ma il piano dura al massimo 12 mesi e al deficit attuale se ne perdono ~${reachable.toFixed(0)} kg: l’obiettivo non è raggiungibile nel piano` });
    if (reachable > kg * 1.5) f.push({ level: 'INFO', area: 'target', code: 'T11', message: `Con il deficit attuale (~${impliedWeekly.toFixed(2)} kg/sett.) il piano di ${durationMonths} mesi porterebbe a −${reachable.toFixed(0)} kg, oltre i −${kg.toFixed(0)} richiesti (la durata è calcolata a 0,5 kg/sett. fisso, indipendente dal deficit)` });
  }
  return f;
}

// -------------------------------------------------------------------- diet --

export function checkDiet(persona: Persona, targets: NutritionTargets, diet: DietPlan, durationMonths: number): Finding[] {
  const a = persona.answers;
  const f: Finding[] = [];
  const mealsSelected = (Array.isArray(a.mealsSelected) ? (a.mealsSelected as string[]) : ['colazione', 'pranzo', 'cena']) as string[];
  const month1 = diet.months[0];

  if (diet.months.length !== durationMonths) f.push({ level: 'FAIL', area: 'dieta', code: 'D1', message: `Mesi del piano (${diet.months.length}) ≠ durata calcolata (${durationMonths})` });

  // slots
  for (const [i, day] of month1.weeklySplit.entries()) {
    const ids = day.meals.map((m) => m.slotId);
    const missing = mealsSelected.filter((s) => !ids.includes(s));
    const extra = ids.filter((s) => !mealsSelected.includes(s));
    if (missing.length || extra.length) f.push({ level: 'FAIL', area: 'dieta', code: 'D2', message: `${WEEKDAYS[i]}: pasti del piano ≠ pasti scelti (mancano: ${missing.join(',') || '-'}; in più: ${extra.join(',') || '-'})` });
  }

  const days = month1.weeklySplit;
  const dayStats = days.map((d, i) => {
    const free = d.meals.some((m) => m.isFreeMeal);
    const items = d.meals.flatMap((m) => m.items.map((it) => ({ foodId: it.foodId, grams: it.grams })));
    const mac = macrosOf(items);
    const plannedKcal = d.meals.reduce((s, m) => s + m.totalKcal, 0);
    return { i, free, mac, plannedKcal };
  });

  // calories: each day against ITS OWN target (training days eat more than rest days)
  const dayDeviations = dayStats
    .filter((d) => !d.free)
    .map((d) => ({ i: d.i, kcal: d.mac.kcal, dev: d.mac.kcal / (days[d.i].calorieTarget ?? month1.calorieTarget) - 1 }));
  const avgDev = dayDeviations.reduce((x, d) => x + d.dev, 0) / Math.max(dayDeviations.length, 1);
  if (Math.abs(avgDev) > 0.05) f.push({ level: 'FAIL', area: 'dieta', code: 'D3', message: `Le calorie reali dei pasti si discostano in media del ${(avgDev * 100).toFixed(0)}% dai target giornalieri` });
  for (const d of dayDeviations) {
    if (Math.abs(d.dev) > 0.08) f.push({ level: Math.abs(d.dev) > 0.15 ? 'FAIL' : 'WARN', area: 'dieta', code: 'D3', message: `${WEEKDAYS[d.i]}: ${d.kcal.toFixed(0)} kcal, ${(d.dev * 100).toFixed(0)}% rispetto al target del giorno (${days[d.i].calorieTarget})` });
  }

  // item kcal consistency (what the plan says vs. what the food DB says)
  for (const it of allDietItems(diet, 1)) {
    const food = findFood(it.foodId);
    if (!food) {
      f.push({ level: 'FAIL', area: 'dieta', code: 'D4', message: `Alimento "${it.foodId}" non presente nel database alimenti` });
      continue;
    }
    const real = (food.kcal100 * it.grams) / 100;
    if (Math.abs(real - it.kcal) > 3) {
      f.push({ level: 'FAIL', area: 'dieta', code: 'D4', message: `${food.name} ${it.grams} g: il piano dice ${it.kcal} kcal ma il database dà ${real.toFixed(0)}` });
      break;
    }
  }

  // macros: every non-free day against its own day target
  const nonFree = dayStats.filter((d) => !d.free);
  for (const [k, label] of [['protein', 'Proteine'], ['carbs', 'Carboidrati'], ['fats', 'Grassi']] as const) {
    const rels = nonFree.map((d) => d.mac[k] / (days[d.i].macroTargetsG?.[k] ?? month1.macroTargetsG[k]));
    const avgRel = rels.reduce((x, r) => x + r, 0) / Math.max(rels.length, 1);
    const worst = Math.max(...rels.map((r) => Math.abs(r - 1)));
    // protein: too little is the failure, a bit extra is harmless; carbs/fats: ±20% (foods carry hidden macros)
    const lowLimit = k === 'protein' ? 0.1 : 0.2;
    const highLimit = k === 'protein' ? 0.25 : 0.2;
    const tooLow = avgRel - 1 < -lowLimit || Math.min(...rels) - 1 < -lowLimit * 2;
    const tooHigh = avgRel - 1 > highLimit || Math.max(...rels) - 1 > highLimit * 2;
    const text = `${label}: i pasti danno in media il ${(avgRel * 100).toFixed(0)}% del target (giorno peggiore: ${(worst * 100).toFixed(0)}% di scarto)`;
    if (tooLow || tooHigh) f.push({ level: 'FAIL', area: 'dieta', code: 'D5', message: text });
    else if (avgRel - 1 < -lowLimit / 2 || avgRel - 1 > highLimit / 2 || worst > Math.max(lowLimit, highLimit) * 1.25) f.push({ level: 'WARN', area: 'dieta', code: 'D5', message: text });
  }

  // forbidden foods
  const itemsAll = allDietItems(diet);
  const used = new Set(itemsAll.map((i) => i.foodId));
  const pattern = a.dietaryPattern as string | undefined;
  const violations: string[] = [];
  if (pattern === 'vegan') for (const id of used) if (ANIMAL.has(id)) violations.push(id);
  if (pattern === 'vegetarian') for (const id of used) if (MEAT.has(id) || FISH.has(id)) violations.push(id);
  if (pattern === 'pescetarian') for (const id of used) if (MEAT.has(id)) violations.push(id);
  if (violations.length) f.push({ level: 'FAIL', area: 'dieta', code: 'D6', message: `Dieta ${pattern} ma il piano contiene: ${[...new Set(violations)].map(foodName).join(', ')}` });
  const forbidden = (persona.expect?.forbiddenFoodIds ?? []).filter((id) => used.has(id));
  if (forbidden.length) f.push({ level: 'FAIL', area: 'dieta', code: 'D7', message: `Alimenti vietati presenti nel piano: ${forbidden.map(foodName).join(', ')}` });
  const missingRequired = (persona.expect?.requiredFoodIds ?? []).filter((id) => !used.has(id));
  if (missingRequired.length) f.push({ level: 'WARN', area: 'dieta', code: 'D7', message: `Alimenti richiesti assenti: ${missingRequired.map(foodName).join(', ')}` });

  // meal realism
  const unrealistic = itemsAll.filter((i) => i.slotId === 'colazione' && MAIN_MEAL_ONLY.has(i.foodId));
  if (unrealistic.length) f.push({ level: 'WARN', area: 'dieta', code: 'D8', message: `Colazione con cibi da pasto principale: ${[...new Set(unrealistic.map((i) => foodName(i.foodId)))].join(', ')}` });

  // portion sanity
  for (const it of allDietItems(diet, 1)) {
    const food = findFood(it.foodId);
    if (!food) continue;
    const limit = food.category === 'verdura' ? 400 : food.category === 'frutta' ? 300 : food.category === 'grassi' ? 60 : 400;
    if (it.grams > limit) {
      f.push({ level: 'WARN', area: 'dieta', code: 'D9', message: `Porzione eccessiva: ${food.name} ${it.grams} g (${WEEKDAYS[it.day]}, ${it.slotId})` });
      break;
    }
  }

  // realism of single meals: how much of one food a person can reasonably eat at one sitting
  {
    const byMeal = new Map<string, { eggs: number; day: number; slot: string; heavy: string[] }>();
    for (const m of diet.months.slice(0, 1)) {
      m.weeklySplit.forEach((d, dayIdx) =>
        d.meals.forEach((meal) => {
          const key = `${dayIdx}-${meal.slotId}`;
          const entry = { eggs: 0, day: dayIdx, slot: meal.slotId, heavy: [] as string[] };
          for (const it of meal.items) {
            const food = findFood(it.foodId);
            if (!food) continue;
            if (EGGS.has(it.foodId) && it.foodId === 'eggs') entry.eggs += it.grams / 50; // ≈50 g per egg
            const isLean = food.category === 'proteine' && !EGGS.has(it.foodId);
            if (isLean && food.defaultPortionG && it.grams > 300 && it.foodId !== 'greek-yogurt') entry.heavy.push(`${food.name} ${it.grams} g`);
            if (food.category === 'carboidrati' && food.kcal100 < 200 && it.grams > 350) entry.heavy.push(`${food.name} ${it.grams} g`);
          }
          byMeal.set(key, entry);
        })
      );
    }
    const eggMeals = [...byMeal.values()].filter((e) => e.eggs > 3.5);
    if (eggMeals.length) f.push({ level: 'WARN', area: 'dieta', code: 'D9', message: `Troppe uova in un solo pasto (fino a ${Math.max(...eggMeals.map((e) => e.eggs)).toFixed(0)}) in ${eggMeals.length} pasti della settimana` });
    const eggDays = new Map<number, number>();
    for (const e of byMeal.values()) eggDays.set(e.day, (eggDays.get(e.day) ?? 0) + e.eggs);
    const worstDay = [...eggDays.entries()].sort((x, y) => y[1] - x[1])[0];
    if (worstDay && worstDay[1] > 5) f.push({ level: 'WARN', area: 'dieta', code: 'D9', message: `${WEEKDAYS[worstDay[0]]}: ${worstDay[1].toFixed(0)} uova in un giorno` });
    const heavy = [...byMeal.values()].filter((e) => e.heavy.length);
    if (heavy.length) f.push({ level: 'WARN', area: 'dieta', code: 'D9', message: `Porzioni molto abbondanti in ${heavy.length} pasti (es. ${WEEKDAYS[heavy[0].day]} ${heavy[0].slot}: ${heavy[0].heavy.join(', ')})` });
  }

  // meal share
  const slotShare: Record<string, number[]> = {};
  for (const d of days) {
    const dayKcal = d.meals.reduce((s, m) => s + m.totalKcal, 0);
    for (const m of d.meals) if (!m.isFreeMeal && dayKcal > 0) (slotShare[m.slotId] ??= []).push(m.totalKcal / dayKcal);
  }
  const shares = Object.entries(slotShare).map(([id, v]) => [id, v.reduce((s, x) => s + x, 0) / v.length] as const);
  if (shares.length > 0) {
    const biggest = shares.reduce((x, y) => (y[1] > x[1] ? y : x));
    if (biggest[1] > 0.45) f.push({ level: 'WARN', area: 'dieta', code: 'D10', message: `Un solo pasto (${biggest[0]}) vale il ${(biggest[1] * 100).toFixed(0)}% delle calorie giornaliere` });
  }

  // free meal
  const freeCount = days.filter((d) => d.meals.some((m) => m.isFreeMeal)).length;
  if (mealsSelected.includes('cena') && freeCount !== 1) f.push({ level: 'WARN', area: 'dieta', code: 'D11', message: `Pasto libero: attesi 1 a settimana, trovati ${freeCount}` });
  if (!mealsSelected.includes('cena') && freeCount > 0) f.push({ level: 'FAIL', area: 'dieta', code: 'D11', message: 'Pasto libero assegnato a un pasto che l’utente non fa' });

  // variety
  const distinct = new Set(allDietItems(diet, 1).map((i) => i.foodId));
  if (distinct.size < 8) f.push({ level: 'WARN', area: 'dieta', code: 'D12', message: `Poca varietà: solo ${distinct.size} alimenti diversi in una settimana` });
  const proteins = new Set(allDietItems(diet, 1).map((i) => i.foodId).filter((id) => findFood(id)?.category === 'proteine' || findFood(id)?.category === 'latticini' || findFood(id)?.category === 'legumi'));
  if (proteins.size < 3) f.push({ level: 'WARN', area: 'dieta', code: 'D12', message: `Poche fonti proteiche diverse (${proteins.size}) in una settimana` });

  // phases / months
  diet.months.forEach((m, i) => {
    if (i > 0 && i < diet.months.length && m.calorieTarget < 1200) f.push({ level: 'FAIL', area: 'dieta', code: 'D13', message: `Mese ${m.monthIndex}: ${m.calorieTarget} kcal sotto il minimo di sicurezza` });
  });
  const later = diet.months.slice(1).map((m) => m.calorieTarget);
  if (later.length >= 2 && later.every((v) => v === later[0])) {
    f.push({ level: 'INFO', area: 'dieta', code: 'D14', message: `Dal mese 2 in poi il target è identico (${later[0]} kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica` });
  }
  if (diet.months[0].calorieTarget !== targets.dailyCalorieTarget) f.push({ level: 'FAIL', area: 'dieta', code: 'D15', message: `Il profilo/onboarding mostra ${targets.dailyCalorieTarget} kcal ma il mese 1 del piano ne prescrive ${diet.months[0].calorieTarget}` });
  return f;
}

// ---------------------------------------------------------------- training --

const SPLIT_COVERAGE = {
  push: ['Push', 'Upper', 'Full Body'],
  pull: ['Pull', 'Upper', 'Full Body'],
  legs: ['Legs', 'Lower', 'Full Body'],
};

export function checkTraining(persona: Persona, training: TrainingPlan, durationMonths: number): Finding[] {
  const a = persona.answers;
  const f: Finding[] = [];
  const hasGym = (a.activitiesPracticed as string[] | undefined)?.includes('gym');
  const hasRun = (a.activitiesPracticed as string[] | undefined)?.includes('running');
  const available = a.availableDays === '6+' ? 6 : a.availableDays === 'variable' ? 4 : num(a.availableDays, 3);
  const month1 = training.months[0];
  const week = month1.weeklySplit;
  const gymDays = week.filter((d) => d.type === 'workout');
  const runDays = week.filter((d) => d.type === 'cardio');
  const total = gymDays.length + runDays.length;

  if (training.months.length !== durationMonths) f.push({ level: 'FAIL', area: 'allenamento', code: 'R1', message: `Mesi (${training.months.length}) ≠ durata calcolata (${durationMonths})` });

  const e = persona.expect;
  if (e?.gymSessions != null && gymDays.length !== e.gymSessions) f.push({ level: 'FAIL', area: 'allenamento', code: 'R2', message: `Sedute di palestra a settimana: ${gymDays.length}, attese ${e.gymSessions}` });
  if (e?.runSessions != null && runDays.length !== e.runSessions) f.push({ level: 'FAIL', area: 'allenamento', code: 'R2', message: `Uscite di corsa a settimana: ${runDays.length}, attese ${e.runSessions}` });
  if (total > available && a.availableDays !== 'variable') f.push({ level: 'FAIL', area: 'allenamento', code: 'R3', message: `${total} sedute a settimana ma l’utente ha solo ${available} giorni disponibili` });
  if (total > 6) f.push({ level: 'FAIL', area: 'allenamento', code: 'R3', message: `${total} sedute a settimana: nessun giorno di riposo` });
  if (!hasGym && gymDays.length > 0) f.push({ level: 'FAIL', area: 'allenamento', code: 'R4', message: 'Sedute di palestra assegnate a chi non pratica palestra' });
  if (!hasRun && runDays.length > 0) f.push({ level: 'FAIL', area: 'allenamento', code: 'R4', message: 'Sedute di corsa assegnate a chi non corre' });

  // consecutive training days
  let run = 0;
  let maxRun = 0;
  for (const d of week) {
    if (d.type !== 'rest') {
      run++;
      maxRun = Math.max(maxRun, run);
    } else run = 0;
  }
  if (maxRun > 4) f.push({ level: 'WARN', area: 'allenamento', code: 'R5', message: `${maxRun} giorni di allenamento consecutivi senza riposo` });

  // split vs experience / coverage
  const labels = gymDays.map((d) => d.title);
  const pref = a.gymSplitPreference as string | undefined;
  const beginner = a.gymSkillLevel === 'beginner';
  if (beginner && (!pref || pref === 'noPreference') && labels.some((l) => ['Push', 'Pull', 'Legs'].includes(l))) f.push({ level: 'WARN', area: 'allenamento', code: 'R6', message: `Principiante con split ${labels.join('/')}: meglio full body / upper-lower` });
  if (gymDays.length >= 2) {
    for (const [group, covers] of Object.entries(SPLIT_COVERAGE)) {
      if (!labels.some((l) => covers.includes(l))) f.push({ level: 'WARN', area: 'allenamento', code: 'R7', message: `Nessuna seduta allena ${group === 'legs' ? 'le gambe' : group === 'push' ? 'la spinta' : 'la trazione'} (split: ${labels.join(', ')})` });
    }
  }
  if (gymDays.length >= 3 && labels.every((l) => l === labels[0]) && labels[0] !== 'Full Body') f.push({ level: 'WARN', area: 'allenamento', code: 'R7', message: `Tutte le sedute uguali (${labels[0]})` });

  // exercises
  const bucket = a.sessionDuration;
  const expectedCount: Record<string, [number, number]> = { lt30: [3, 4], '30-45': [4, 5], '45-60': [4, 6], '60-90': [5, 7], gt90: [5, 8] };
  const [lo, hi] = expectedCount[String(bucket)] ?? [3, 6];
  for (const d of gymDays) {
    const n = d.exercises?.length ?? 0;
    if (n === 0) f.push({ level: 'FAIL', area: 'allenamento', code: 'R8', message: `${d.weekday}: seduta senza esercizi` });
    else if (n < lo - 1 || n > hi) f.push({ level: 'WARN', area: 'allenamento', code: 'R8', message: `${d.weekday} (${d.title}): ${n} esercizi per una seduta da ${String(bucket)} min (attesi ${lo}-${hi}) — nel piano sono ${n}` });
    const ids = (d.exercises ?? []).map((x) => x.id);
    if (new Set(ids).size !== ids.length) f.push({ level: 'FAIL', area: 'allenamento', code: 'R8', message: `${d.weekday}: esercizi duplicati nella stessa seduta` });
    for (const ex of d.exercises ?? []) if (!exerciseCatalog.has(ex.id)) f.push({ level: 'FAIL', area: 'allenamento', code: 'R9', message: `Esercizio "${ex.id}" non presente nel catalogo (nessun video/progressi)` });
    if ((d.exercises ?? []).some((x) => x.needsManualReview)) f.push({ level: 'WARN', area: 'allenamento', code: 'R10', message: `${d.weekday}: nessun esercizio compatibile con le limitazioni, usato il piano di ripiego (plank): serve revisione manuale` });
  }

  // safety: avoid areas
  const avoid = e?.avoidAreas ?? [];
  if (avoid.length) {
    const offenders = new Set<string>();
    for (const m of training.months) for (const d of m.weeklySplit) for (const ex of d.exercises ?? []) {
      const def = exerciseCatalog.get(ex.id);
      if (def && def.areas.some((ar) => avoid.includes(ar))) offenders.add(`${def.name} [${def.areas.filter((ar) => avoid.includes(ar)).join('/')}]`);
    }
    if (offenders.size) f.push({ level: 'FAIL', area: 'allenamento', code: 'R11', message: `Esercizi che caricano la zona dolorante (${avoid.join(', ')}): ${[...offenders].join(', ')}` });
  }

  // home equipment
  if (a.trainingLocation === 'home') {
    const owned = (a.equipment as string[] | undefined) ?? [];
    const bad = new Set<string>();
    for (const d of week) for (const ex of d.exercises ?? []) {
      const def = exerciseCatalog.get(ex.id);
      const need = def?.equipment ?? [];
      if (need.length > 0 && !need.some((n) => owned.includes(n))) bad.add(`${def?.name} (serve: ${need.join('/')})`);
      if (def && !HOME_EXERCISES['Full Body'].concat(...Object.values(HOME_EXERCISES)).some((h) => h.id === ex.id)) bad.add(`${def.name} (non è un esercizio da casa)`);
    }
    if (bad.size) f.push({ level: 'FAIL', area: 'allenamento', code: 'R12', message: `Esercizi non eseguibili con l’attrezzatura dichiarata: ${[...bad].join(', ')}` });
  } else if (a.trainingLocation === 'outdoor' || a.trainingLocation === 'mixed') {
    if (gymDays.length > 0) f.push({ level: 'WARN', area: 'allenamento', code: 'R12', message: `Luogo di allenamento "${String(a.trainingLocation)}" ma la scheda usa esercizi da sala pesi (bilanciere, macchine): il luogo viene ignorato` });
  }

  // scheme vs focus
  const focus = (a.focus_gym as string | undefined) ?? 'hypertrophy';
  const lastMonth = training.months[training.months.length - 1];
  const sample = lastMonth.weeklySplit.find((d) => d.type === 'workout')?.exercises?.[0];
  if (sample) {
    const repsMax = Math.max(...(sample.reps.match(/\d+/g) ?? ['0']).map(Number));
    if (focus === 'strength' && repsMax > 6) f.push({ level: 'WARN', area: 'allenamento', code: 'R13', message: `Obiettivo forza ma schema finale ${sample.sets}×${sample.reps}` });
    if (focus === 'hypertrophy' && (repsMax < 8 || repsMax > 15)) f.push({ level: 'WARN', area: 'allenamento', code: 'R13', message: `Ipertrofia con schema ${sample.sets}×${sample.reps}` });
    if (focus === 'strength' && sample.restSec < 120) f.push({ level: 'WARN', area: 'allenamento', code: 'R13', message: `Forza con recuperi di soli ${sample.restSec}s` });
  }

  // phases & progression
  const gymMonths = training.months.filter((m) => m.weeklySplit.some((d) => d.type === 'workout'));
  if (gymMonths.length >= 3) {
    const sig = (m: (typeof gymMonths)[number]) =>
      JSON.stringify(m.weeklySplit.map((d) => (d.exercises ?? []).map((x) => [x.id, x.sets, x.reps, x.suggestedKg])));
    const progression = gymMonths.filter((m) => m.phase === 'progressione');
    if (progression.length >= 2 && progression.every((m) => sig(m) === sig(progression[0]))) {
      f.push({ level: 'WARN', area: 'allenamento', code: 'R14', message: `I mesi "${progression[0].title}" (${progression.map((m) => m.monthIndex).join(', ')}) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo` });
    }
  }
  const expectsAdattamento = beginner || a.gymSkillLevel === undefined;
  if (hasGym && expectsAdattamento && training.months[0].phase !== 'adattamento') f.push({ level: 'WARN', area: 'allenamento', code: 'R15', message: 'Principiante senza mese di adattamento' });
  if (hasGym && !expectsAdattamento && training.months[0].phase === 'adattamento') f.push({ level: 'WARN', area: 'allenamento', code: 'R15', message: 'Utente esperto con mese di adattamento' });

  // loads
  const weight = num(a.currentWeightKg, 75);
  for (const d of gymDays) for (const ex of d.exercises ?? []) {
    if (ex.suggestedKg != null && ex.suggestedKg > weight * 1.3) f.push({ level: 'WARN', area: 'allenamento', code: 'R16', message: `${ex.name}: carico suggerito ${ex.suggestedKg} kg (>${(weight * 1.3).toFixed(0)} kg = 130% del peso corporeo) per ${String(a.gymExperience)}` });
    if (ex.suggestedKg != null && ex.suggestedKg <= 0) f.push({ level: 'WARN', area: 'allenamento', code: 'R16', message: `${ex.name}: carico suggerito ${ex.suggestedKg} kg` });
  }

  // running
  if (hasRun) {
    const mins = minutesFromBucket(a.sessionDuration);
    for (const d of runDays) {
      const m = (d.note ?? '').match(/(\d+)(?:-(\d+))?\s*min/);
      if (m) {
        const longest = Number(m[2] ?? m[1]);
        if (longest > mins.max * 1.25) f.push({ level: 'WARN', area: 'allenamento', code: 'R17', message: `${d.weekday}: "${d.note}" supera il tempo disponibile (${String(a.sessionDuration)} min)` });
      }
    }
    if (runDays.length > 0 && new Set(runDays.map((d) => d.note)).size < 2 && runDays.length >= 3) f.push({ level: 'WARN', area: 'allenamento', code: 'R18', message: 'Tutte le uscite di corsa sono uguali: manca varietà (facile / medio / lungo)' });
  }

  // total weekly load
  const weeklyMinutes = gymDays.length * (minutesFromBucket(a.sessionDuration).min + minutesFromBucket(a.sessionDuration).max) / 2 + runDays.length * 40;
  if (weeklyMinutes > 600) f.push({ level: 'WARN', area: 'allenamento', code: 'R19', message: `Volume settimanale stimato ${Math.round(weeklyMinutes / 60)} h: molto alto` });

  // last phase
  if (training.months.length >= 3 && training.months[training.months.length - 1].phase !== 'consolidamento') f.push({ level: 'WARN', area: 'allenamento', code: 'R20', message: 'L’ultimo mese non è di consolidamento' });
  return f;
}

// --------------------------------------------------------------- coherence --

export function checkCoherence(persona: Persona, run: { ctx: UserContext; bundle: PlanBundle }): Finding[] {
  const a = persona.answers;
  const { ctx, bundle } = run;
  const { diet, training } = bundle;
  const f: Finding[] = [];
  const e = persona.expect;
  if (e?.noDiet && diet) f.push({ level: 'FAIL', area: 'coerenza', code: 'C1', message: 'Utente "solo allenamento" ma esiste un piano alimentare' });
  if (e?.noTraining && training) f.push({ level: 'FAIL', area: 'coerenza', code: 'C1', message: 'Utente "solo dieta" ma esiste un piano di allenamento' });
  if (!e?.noDiet && a.mode !== 'training' && !diet) f.push({ level: 'FAIL', area: 'coerenza', code: 'C1', message: 'Manca il piano alimentare' });
  if (!e?.noTraining && a.mode !== 'diet' && (a.activitiesPracticed as string[] | undefined)?.length && !training) f.push({ level: 'FAIL', area: 'coerenza', code: 'C1', message: 'Manca il piano di allenamento' });
  if (diet && training && diet.durationMonths !== training.durationMonths) f.push({ level: 'FAIL', area: 'coerenza', code: 'C2', message: `Durata dieta (${diet.durationMonths}) ≠ durata allenamento (${training.durationMonths})` });

  // The diet must follow the training: for every month, the weekly balance (planned intake − planned
  // expenditure) equals the goal's balance, and each day's target moves with that day's exercise.
  bundle.monthTargets.forEach((t, i) => {
    const week = training?.months[i]?.weeklySplit ?? null;
    const exercisePlanned = week?.some((d) => d.type !== 'rest') ?? false;
    const weekly = weeklyBalanceGoal(t);
    const expected = (t.pace.dailyBalanceKcal) * 7;
    const floorHit = t.adjustments.some((x) => x.includes('minima'));
    if (!floorHit && Math.abs(weekly - expected) > 120) {
      f.push({ level: 'FAIL', area: 'coerenza', code: 'C3', message: `Mese ${i + 1}: bilancio settimanale ${weekly} kcal ≠ ${expected} previsto dall'obiettivo: dieta e allenamento non sono allineati` });
    }
    if (exercisePlanned) {
      const train = t.perWeekday.filter((d) => d.isTrainingDay);
      const rest = t.perWeekday.filter((d) => !d.isTrainingDay);
      if (train.length && rest.length) {
        const avg = (xs: typeof train) => xs.reduce((x, d) => x + d.calories, 0) / xs.length;
        if (avg(train) <= avg(rest)) f.push({ level: 'FAIL', area: 'coerenza', code: 'C4', message: `Mese ${i + 1}: i giorni di allenamento hanno meno calorie (${avg(train).toFixed(0)}) dei giorni di riposo (${avg(rest).toFixed(0)})` });
      }
    }
  });
  if (!training && ctx.mode === 'diet') {
    const base = baselineKcal(ctx).total;
    if (Math.abs(bundle.monthTargets[0].averageExpenditure - base) > 2) f.push({ level: 'FAIL', area: 'coerenza', code: 'C5', message: 'Utente solo dieta: il fabbisogno include allenamento che non esiste' });
  }
  if (ctx.isMinor && ctx.goal === 'loseFat' && bundle.monthTargets[0].pace.dailyBalanceKcal < 0) f.push({ level: 'FAIL', area: 'coerenza', code: 'C6', message: 'Minorenne con deficit calorico' });
  return f;
}

export function toNutritionTargets(ctx: UserContext, t: PlanTargets): NutritionTargets {
  return { bmr: baselineKcal(ctx).resting, tdee: t.averageExpenditure, dailyCalorieTarget: t.calories, macroTargetsG: t.macros, hydrationTargetMl: t.hydrationMl };
}

export function runChecks(persona: Persona, ctx: UserContext, bundle: PlanBundle): Finding[] {
  const targets = toNutritionTargets(ctx, bundle.monthTargets[0]);
  return [
    ...checkQuestionnaire(persona.answers),
    ...checkTargets(persona, targets, bundle.durationMonths),
    ...(bundle.diet ? checkDiet(persona, targets, bundle.diet, bundle.durationMonths) : []),
    ...(bundle.training ? checkTraining(persona, bundle.training, bundle.durationMonths) : []),
    ...checkCoherence(persona, { ctx, bundle }),
  ];
}

export { buildPlans, buildUserContext, initialTargets };
