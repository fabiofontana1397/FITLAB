/**
 * Second phase: "does the app get populated correctly?". After onboarding the
 * app holds a profile, the raw answers, a diet plan and a training plan, and
 * each screen reads a different slice of them. These checks rebuild what the
 * screens read — with the same domain functions the screens call — and look
 * for missing, contradictory or misleading values. `checkGlobal` adds
 * structural checks on the code itself (regressions of bugs found earlier).
 *
 * The data-flow map these rules come from is in docs/DATA-FLOW.md.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { profileFromContext } from '@/domain/profile';
import type { PlanBundle } from '@/domain/plan-engine';
import { weeklyBalanceGoal } from '@/domain/targets';
import type { UserContext } from '@/domain/user-context';
import { getExerciseMedia } from '@/lib/exercise-media/exercise-media';
import { ONBOARDING_STEPS } from '@/lib/questionnaire/schema';

import type { Finding } from './checks';
import type { Persona } from './personas';

export function checkFlow(persona: Persona, ctx: UserContext, bundle: PlanBundle): Finding[] {
  const a = persona.answers;
  const f: Finding[] = [];
  const { diet, training } = bundle;
  const targets = bundle.monthTargets[0];
  const profile = profileFromContext(ctx, targets);

  // --- profile ---------------------------------------------------------
  if (ctx.mode === 'diet' && profile.sports.length > 0) f.push({ level: 'FAIL', area: 'coerenza', code: 'P1', message: `Utente solo dieta: il profilo salva sport "${profile.sports.join(', ')}"` });
  if (ctx.mode !== 'diet' && ctx.training?.gym && !profile.sports.includes('gym')) f.push({ level: 'FAIL', area: 'coerenza', code: 'P1', message: 'Il profilo non riporta la palestra praticata' });
  if (ctx.targetWeightKg == null && profile.targetWeightKg !== 0) f.push({ level: 'FAIL', area: 'coerenza', code: 'P2', message: `Peso obiettivo non indicato ma il profilo salva ${profile.targetWeightKg} kg` });
  if (ctx.targetWeightKg != null && profile.targetWeightKg !== ctx.targetWeightKg) f.push({ level: 'FAIL', area: 'coerenza', code: 'P2', message: 'Il peso obiettivo del profilo non è quello indicato' });
  if (ctx.mode === 'diet' && ctx.training != null) f.push({ level: 'FAIL', area: 'coerenza', code: 'P3', message: 'Utente solo dieta: le vecchie risposte di allenamento non vanno usate' });
  if (profile.dailyCalorieTarget !== (diet?.months[0].calorieTarget ?? profile.dailyCalorieTarget)) f.push({ level: 'FAIL', area: 'coerenza', code: 'P5', message: 'Calorie del profilo ≠ calorie del mese 1 del piano' });

  // --- Home: weekly goal -------------------------------------------------
  const homeGoal = weeklyBalanceGoal(targets);
  const wantsDeficit = ctx.goal === 'loseFat' && !ctx.isMinor;
  const wantsSurplus = ctx.goal === 'gainMuscle' || ctx.goal === 'gainStrength';
  if (wantsDeficit && homeGoal >= 0) f.push({ level: 'FAIL', area: 'coerenza', code: 'H1', message: `Home mostra un obiettivo settimanale di ${homeGoal} kcal ma l’obiettivo è dimagrire` });
  if (wantsSurplus && homeGoal <= 0) f.push({ level: 'FAIL', area: 'coerenza', code: 'H1', message: `Home mostra un obiettivo settimanale di ${homeGoal} kcal ma l’obiettivo è aumentare` });

  // --- Training screens ----------------------------------------------------
  if (training) {
    const used = new Set<string>();
    for (const m of training.months) for (const d of m.weeklySplit) for (const ex of d.exercises ?? []) used.add(ex.id);
    const noMedia = [...used].filter((id) => !getExerciseMedia(id));
    if (noMedia.length) f.push({ level: 'WARN', area: 'coerenza', code: 'S1', message: `Esercizi senza GIF/istruzioni nel dettaglio: ${noMedia.join(', ')}` });
    const cardio = training.months[0].weeklySplit.filter((d) => d.type === 'cardio');
    if (cardio.length) f.push({ level: 'INFO', area: 'coerenza', code: 'S2', message: `${cardio.length} sedute di corsa a settimana (es. "${cardio[0].note}")` });
  } else if (ctx.mode === 'diet') {
    f.push({ level: 'INFO', area: 'coerenza', code: 'S3', message: 'Utente solo dieta: la tab Allenamento deve mostrare che il piano non è stato richiesto' });
  }
  if (!diet && ctx.mode === 'training') f.push({ level: 'INFO', area: 'coerenza', code: 'S4', message: 'Utente solo allenamento: la tab Nutrizione deve mostrare che il piano non è stato richiesto' });
  void a;
  return f;
}

// ----------------------------------------------------------------- global --

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** App-wide structural checks on the code, independent of the persona. */
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

  // G1: plan-seeded meal ids must be unique per user (meal_entries.id is a global primary key).
  const store = read('src/store/nutrition-store.ts');
  if (/id:\s*`plan-\$\{date\}-\$\{meal\.slotId\}-\$\{i\}`/.test(store)) {
    f.push({ level: 'FAIL', area: 'coerenza', code: 'G1', message: 'Gli id dei pasti "Segui il piano" non contengono l’utente ma meal_entries.id è chiave primaria globale: due utenti nello stesso giorno si scontrano' });
  }

  // G2: weekday lookups on ISO dates must go through isoMondayIndex (new Date(iso).getDay() is off by a day west of Greenwich).
  const offenders = walk(join(root, 'src')).filter((file) => !file.endsWith('dates.ts') && /new Date\([^)]*\)\.getDay\(\)/.test(readFileSync(file, 'utf8')));
  if (offenders.length > 0) {
    f.push({ level: 'FAIL', area: 'coerenza', code: 'G2', message: `Giorno della settimana da date ISO con getDay() locale (slitta di un giorno a ovest di Greenwich) in ${offenders.length} file` });
  }

  // G3: no invented goal weight.
  if (/parseNumericAnswer\(answers\.targetWeightKg\)\s*\?\?\s*75/.test(read('src/app/onboarding.tsx'))) {
    f.push({ level: 'FAIL', area: 'coerenza', code: 'G3', message: 'Il peso obiettivo vuoto diventa 75 kg nel profilo' });
  }

  // G4: plan generation must not leave the UI spinning forever.
  const plans = read('src/store/plan-store.ts');
  const gen = plans.slice(plans.indexOf('generatePlans: async'), plans.indexOf('regenerateFromMonth:'));
  if (!/try\s*\{/.test(gen) || !/finally|catch/.test(gen)) f.push({ level: 'FAIL', area: 'coerenza', code: 'G4', message: 'generatePlans senza try/catch: un errore lascia isGenerating a true per sempre' });

  // G5: partial answers must not count as a completed onboarding.
  const onb = read('src/store/onboarding-store.ts');
  if (/setHasOnboarded\(true\)/.test(onb)) f.push({ level: 'FAIL', area: 'coerenza', code: 'G5', message: 'Risposte parziali sul server bastano per considerare l’onboarding completato' });

  // G6: one energy model.
  const energyHook = read('src/hooks/use-weekly-energy.ts');
  if (!/@\/domain\/energy/.test(energyHook)) f.push({ level: 'FAIL', area: 'coerenza', code: 'G6', message: 'Il hook dell’energia settimanale non usa il modello energetico unico (src/domain/energy.ts)' });
  const home = read('src/app/(tabs)/index.tsx');
  if (/@\/lib\/nutrition\/targets/.test(home)) f.push({ level: 'FAIL', area: 'coerenza', code: 'G6', message: 'Home usa ancora il vecchio modello energetico' });

  // G7: every question must be used somewhere.
  const files = [...walk(join(root, 'src')), ...walk(join(root, 'supabase', 'functions'))].filter((p) => !p.endsWith(join('questionnaire', 'schema.ts')));
  const blob = files.map((p) => readFileSync(p, 'utf8')).join('\n');
  const dead = ONBOARDING_STEPS.flatMap((s) => s.questions.map((q) => q.id)).filter((id) => !new RegExp(`\\b${id}\\b`).test(blob));
  if (dead.length) f.push({ level: 'WARN', area: 'questionario', code: 'G7', message: `Domande raccolte ma non usate da nessuna parte: ${dead.join(', ')}` });

  // G8: Nutrition tab must follow the plan's meals.
  if (/MEAL_SLOTS\.map\(\(meta\)/.test(read('src/app/(tabs)/nutrition.tsx'))) f.push({ level: 'WARN', area: 'coerenza', code: 'G8', message: 'La tab Nutrizione mostra sempre i 6 pasti fissi invece di quelli scelti dall’utente' });

  // G9: monthly recalibration exists and is wired.
  if (!read('src/domain/recalibration.ts')) f.push({ level: 'FAIL', area: 'coerenza', code: 'G9', message: 'Manca il motore di ricalibrazione mensile' });
  return f;
}
