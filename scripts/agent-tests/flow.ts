/**
 * Second phase: "does the app get populated correctly?". After onboarding the
 * app holds a profile (finalizeOnboarding), the raw answers, a diet plan and
 * a training plan, and each screen reads a different slice of them. These
 * checks rebuild what the screens read — with the same pure helpers the screens
 * call — and look for missing, contradictory or misleading values.
 *
 * The data-flow map these rules come from is in docs/DATA-FLOW.md.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getExerciseMedia } from '@/lib/exercise-media/exercise-media';
import { estimateDailyEnergyExpenditure, deriveWeeklyTrainingDays, type NutritionTargets } from '@/lib/nutrition/targets';
import { currentMonthIndex } from '@/lib/planning/plan-progress';
import { resolveTrainingSchedule } from '@/lib/planning/training-days';
import { WEEKDAY_LABELS } from '@/lib/planning/exercise-library';
import { parseNumericAnswer } from '@/lib/questionnaire/parse-answer';
import type { DietPlan, TrainingPlan } from '@/lib/planning/types';
import type { Goal } from '@/lib/mock/types';

import type { Finding } from './checks';
import type { Persona } from './personas';

const num = (v: unknown, fallback = 0) => parseNumericAnswer(v) ?? fallback;

/** The Nutrition tab always renders these six cards (nutrition-store.ts MEAL_SLOTS). */
const NUTRITION_TAB_SLOTS = ['colazione', 'spuntinoMattina', 'pranzo', 'spuntinoPomeriggio', 'cena', 'spuntinoSera'];

/** Questionnaire answers nothing reads (verified by tracing every consumer). */
export const UNUSED_ANSWERS = ['generalActivityLevel', 'bedTime', 'wakeTime', 'sleepQuality', 'dietaryPatternOther', 'preferredProteinsOther', 'preferredCarbsOther', 'preferredFatsOther'];

/** What onboarding.tsx's confirmProfile writes to the profile. */
function profileFromAnswers(a: Persona['answers'], targets: NutritionTargets) {
  const activities = Array.isArray(a.activitiesPracticed) ? (a.activitiesPracticed as string[]) : [];
  return {
    goal: ((a.goal as Goal) ?? 'generalHealth') as Goal,
    sports: activities.length > 0 ? activities : ['gym'], // fallback in onboarding.tsx
    sex: (a.sex as string) ?? 'unspecified',
    age: num(a.age, 30),
    heightCm: num(a.heightCm, 180),
    targetWeightKg: parseNumericAnswer(a.targetWeightKg) ?? 75, // default in onboarding.tsx
    dailyCalorieTarget: targets.dailyCalorieTarget,
    macroTargetsG: targets.macroTargetsG,
  };
}

export function checkFlow(persona: Persona, targets: NutritionTargets, diet: DietPlan | null, training: TrainingPlan | null): Finding[] {
  const a = persona.answers;
  const f: Finding[] = [];
  const profile = profileFromAnswers(a, targets);
  const mode = (a.mode as string) ?? 'both';
  const weight = num(a.currentWeightKg, 80);

  // --- profile ---------------------------------------------------------
  if (mode === 'diet' && !(a.activitiesPracticed as string[] | undefined)?.length) {
    f.push({ level: 'WARN', area: 'coerenza', code: 'P1', message: `Utente solo dieta: il profilo salva sport "${profile.sports.join(', ')}" per default (compare in Profilo come "Sala pesi")` });
  }
  if (parseNumericAnswer(a.targetWeightKg) == null) {
    const wrongWay = (profile.goal === 'loseFat' && profile.targetWeightKg >= weight) || ((profile.goal === 'gainMuscle' || profile.goal === 'gainStrength') && profile.targetWeightKg <= weight);
    f.push({
      level: wrongWay ? 'FAIL' : 'WARN',
      area: 'coerenza',
      code: 'P2',
      message: `Peso obiettivo non indicato: il profilo (Progressi, grafico del peso, Profilo) usa un valore inventato di ${profile.targetWeightKg} kg${wrongWay ? `, nella direzione sbagliata rispetto all’obiettivo (peso attuale ${weight} kg)` : ''}, mentre il piano usa la durata standard di 4 mesi`,
    });
  }
  const assumedDays = deriveWeeklyTrainingDays(a);
  const schedule = resolveTrainingSchedule(a);
  if (mode === 'diet' && assumedDays > 0) f.push({ level: 'FAIL', area: 'coerenza', code: 'P3', message: `Utente solo dieta con risposte di allenamento rimaste da un questionario precedente: il fabbisogno conta ${assumedDays} allenamenti/sett.` });
  if (mode === 'diet' && schedule.isTrainingDay.some(Boolean)) f.push({ level: 'FAIL', area: 'coerenza', code: 'P3', message: 'Utente solo dieta: la dieta alterna giorni di allenamento/riposo in base a risposte vecchie' });
  for (const key of ['freq_gym', 'freq_running']) {
    const v = a[key];
    if ((v === 'biweekly' || v === 'monthly') && training) {
      const sessions = training.months[0].weeklySplit.filter((d) => d.type !== 'rest').length;
      f.push({ level: 'FAIL', area: 'coerenza', code: 'P4', message: `${key}="${String(v)}" (meno di una volta a settimana): il piano programma ${sessions} sedute settimanali, il fabbisogno calorico ne conta ${assumedDays}` });
    }
  }

  // --- Home: weekly goal as the Home computes it -----------------------
  // Home: weeklyGoal = (monthly calorie target × 7) − Σ expenditure assuming
  // every planned workout is completed (cardio days count as 0 exercise kcal).
  const plan = diet ?? null;
  const monthIdx = plan ? currentMonthIndex(plan) : 1;
  const monthTarget = plan?.months.find((m) => m.monthIndex === monthIdx)?.calorieTarget ?? profile.dailyCalorieTarget;
  const split = training?.months[0].weeklySplit;
  let expenditureWeek = 0;
  for (let i = 0; i < 7; i++) {
    expenditureWeek += estimateDailyEnergyExpenditure({
      sex: profile.sex as 'male' | 'female' | 'unspecified',
      age: profile.age,
      heightCm: profile.heightCm,
      weightKg: weight,
      jobActivity: a.jobActivity as string | undefined,
      sessionDurationBucket: a.sessionDuration as string | undefined,
      completionFraction: split?.[i]?.type === 'workout' ? 1 : 0,
    });
  }
  const homeWeeklyGoal = monthTarget * 7 - expenditureWeek;
  const intendedWeekly = (targets.dailyCalorieTarget - targets.tdee) * 7;
  const goal = profile.goal;
  const wantsDeficit = goal === 'loseFat';
  const wantsSurplus = goal === 'gainMuscle' || goal === 'gainStrength';
  if (wantsDeficit && homeWeeklyGoal >= 0) {
    f.push({ level: 'FAIL', area: 'coerenza', code: 'H1', message: `Home mostra "Surplus settimanale ${homeWeeklyGoal > 0 ? '+' : ''}${Math.round(homeWeeklyGoal)} kcal" ma l’obiettivo è dimagrire (il piano prevede ${Math.round(intendedWeekly)} kcal/sett.)` });
  } else if (wantsSurplus && homeWeeklyGoal <= 0) {
    f.push({ level: 'FAIL', area: 'coerenza', code: 'H1', message: `Home mostra "Deficit settimanale ${Math.round(homeWeeklyGoal)} kcal" ma l’obiettivo è aumentare massa/forza (il piano prevede +${Math.round(intendedWeekly)} kcal/sett.)` });
  } else if (Math.abs(homeWeeklyGoal - intendedWeekly) > 1500) {
    f.push({ level: 'WARN', area: 'coerenza', code: 'H1', message: `Obiettivo settimanale mostrato in Home ${Math.round(homeWeeklyGoal)} kcal contro ${Math.round(intendedWeekly)} kcal/sett. voluti dal piano: due modelli energetici diversi` });
  }

  // --- Nutrition tab ----------------------------------------------------
  if (diet) {
    const planSlots = diet.months[0].weeklySplit[0].meals.map((m) => m.slotId);
    if (planSlots.length < NUTRITION_TAB_SLOTS.length) {
      f.push({ level: 'WARN', area: 'coerenza', code: 'N1', message: `La tab Nutrizione mostra sempre ${NUTRITION_TAB_SLOTS.length} pasti (con orari fissi) ma l’utente ne fa ${planSlots.length} (${planSlots.join(', ')}): compaiono schede di pasti che non fa` });
    }
    for (const s of planSlots) if (!NUTRITION_TAB_SLOTS.includes(s)) f.push({ level: 'FAIL', area: 'coerenza', code: 'N2', message: `Pasto del piano "${s}" inesistente nella tab Nutrizione: non verrebbe mostrato` });

    // "Segui il piano per questo giorno" seeds the day from the plan
    const target = diet.months[0].calorieTarget;
    diet.months[0].weeklySplit.forEach((d, i) => {
      const seededKcal = d.meals.reduce((s, m) => s + m.items.reduce((x, it) => x + it.kcal, 0), 0);
      const freeMeal = d.meals.find((m) => m.isFreeMeal);
      if (freeMeal && seededKcal < target * 0.8) {
        f.push({ level: 'WARN', area: 'coerenza', code: 'N3', message: `${WEEKDAY_LABELS[i]}: con "Segui il piano" il giorno si riempie con ${seededKcal} kcal (${Math.round((seededKcal / target) * 100)}% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto` });
      }
      for (const m of d.meals) for (const it of m.items) if (!(it.grams > 0) || !Number.isFinite(it.kcal)) f.push({ level: 'FAIL', area: 'coerenza', code: 'N4', message: `${WEEKDAY_LABELS[i]} ${m.slotId}: alimento con quantità non valida` });
    });
  }

  // --- Training screens -------------------------------------------------
  if (training) {
    const used = new Set<string>();
    for (const m of training.months) for (const d of m.weeklySplit) for (const ex of d.exercises ?? []) used.add(ex.id);
    const noMedia = [...used].filter((id) => !getExerciseMedia(id));
    if (noMedia.length) f.push({ level: 'WARN', area: 'coerenza', code: 'S1', message: `Esercizi senza GIF/istruzioni nel dettaglio: ${noMedia.join(', ')}` });

    const cardio = training.months[0].weeklySplit.filter((d) => d.type === 'cardio');
    if (cardio.length) {
      f.push({ level: 'INFO', area: 'coerenza', code: 'S2', message: `${cardio.length} sedute di corsa a settimana: nell’app compaiono come testo ("${cardio[0].note}"), senza dettaglio, senza spunta e senza calorie previste; contano come "svolte" solo se registri un’attività quel giorno` });
    }
  } else if (mode === 'diet') {
    f.push({ level: 'INFO', area: 'coerenza', code: 'S3', message: 'Utente solo dieta: la tab Allenamento resta visibile e mostra "Nessun programma generato… scegliendo sala pesi o corsa", frase fuorviante perché la domanda non è mai stata posta' });
  }
  if (!diet && mode === 'training') {
    f.push({ level: 'INFO', area: 'coerenza', code: 'S4', message: 'Utente solo allenamento: Home e Nutrizione mostrano comunque target calorici e macro del profilo (nessun piano alimentare dietro) e la tab Nutrizione mostra tutti e 6 i pasti' });
  }

  // --- dead answers -----------------------------------------------------
  const dead = UNUSED_ANSWERS.filter((k) => a[k] !== undefined && a[k] !== '');
  if (dead.length) f.push({ level: 'INFO', area: 'questionario', code: 'Q4', message: `Risposte raccolte ma non usate da nessuna parte: ${dead.join(', ')}` });
  return f;
}

// ----------------------------------------------------------------- global --

/** App-wide structural checks, independent of the persona. */
export function checkGlobal(): Finding[] {
  const f: Finding[] = [];
  const root = process.cwd();
  const read = (p: string) => {
    try {
      return readFileSync(join(root, p), 'utf8');
    } catch {
      return '';
    }
  };

  // Plan seeding ids are `plan-<date>-<slot>-<i>` and meal_entries.id is a global primary key.
  const store = read('src/store/nutrition-store.ts');
  const mig = read('supabase/migrations/0010_fix_client_generated_ids.sql');
  if (/id:\s*`plan-\$\{date\}-\$\{meal\.slotId\}-\$\{i\}`/.test(store) && /alter column id type text/.test(mig)) {
    f.push({ level: 'FAIL', area: 'coerenza', code: 'G1', message: 'Gli id dei pasti "Segui il piano" (plan-<data>-<pasto>-<n>) non contengono l’utente ma meal_entries.id è chiave primaria globale: due utenti che seguono il piano nello stesso giorno si scontrano e il salvataggio sul server del secondo fallisce in silenzio' });
  }

  // mondayIndex(new Date('YYYY-MM-DD')): ISO dates parse as UTC, getDay() is local.
  const iso = '2026-10-07'; // a Wednesday
  const utcMidnight = new Date(iso);
  const inNewYork = new Date(utcMidnight.getTime() - 5 * 3600_000); // local clock in UTC-5
  const expected = 2; // Mer
  const got = (inNewYork.getUTCDay() + 6) % 7;
  if (got !== expected) f.push({ level: 'INFO', area: 'coerenza', code: 'G2', message: 'Nei fusi orari a ovest di Greenwich il giorno della settimana del piano slitta di un giorno (mondayIndex su date ISO): corretto in Italia, sbagliato per utenti in America' });

  const onboarding = read('src/app/onboarding.tsx');
  if (/targetWeightKg:\s*parseNumericAnswer\(answers\.targetWeightKg\)\s*\?\?\s*75/.test(onboarding)) {
    f.push({ level: 'INFO', area: 'coerenza', code: 'G3', message: 'Peso obiettivo facoltativo ma, se vuoto, il profilo salva 75 kg (valore inventato)' });
  }
  const plans = read('src/store/plan-store.ts');
  if (/dietPlan = mode === 'training' \? null : generateDietPlan\(\{ answers, \.\.\.targets, strategy: strategy\?\.diet \}\)/.test(plans) && /set\(\{ dietPlan, trainingPlan, isGenerating: false \}\)/.test(plans) && !/try\s*\{/.test(plans.slice(plans.indexOf('generatePlans: async'), plans.indexOf('regenerateFromMonth:')))) {
    f.push({ level: 'WARN', area: 'coerenza', code: 'G4', message: 'generatePlans non ha try/catch: se un generatore lancia un errore isGenerating resta true e la schermata "stiamo creando il tuo piano" non finisce mai' });
  }
  const onbStore = read('src/store/onboarding-store.ts');
  if (onbStore.includes('Object.keys(answers).length > 0') && onbStore.includes('setHasOnboarded(true)') && onbStore.includes('upsertOnboardingAnswers(userId, answers)')) {
    f.push({ level: 'FAIL', area: 'coerenza', code: 'G5', message: 'Le risposte vengono salvate sul server a ogni domanda e, al successivo avvio, bastano risposte parziali per considerare l’onboarding completato: chi abbandona il questionario a metà trova Home con profilo a zero e piani generati con target 0 kcal' });
  }
  return f;
}
