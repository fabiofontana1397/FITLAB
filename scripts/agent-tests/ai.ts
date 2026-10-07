/**
 * Optional "--ai" mode: asks the real generate-plan-strategy Edge Function
 * (the Claude-based planning agent) for a strategy per persona, feeds it to the
 * same plan generators the app uses, and checks the strategy itself.
 *
 * It calls the HOSTED Supabase project and therefore spends Claude tokens
 * (one request per persona). Requires in .env / the environment:
 *   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY   (already in .env)
 *   TEST_EMAIL, TEST_PASSWORD                                  (a test account)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { PlanStrategy } from '@/lib/planning/strategy-types';

import type { Finding } from './checks';
import type { Persona } from './personas';

function loadDotEnv() {
  try {
    const text = readFileSync(join(process.cwd(), '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // no .env — rely on the real environment
  }
}

export type AiSession = { call: (persona: Persona, targets: { dailyCalorieTarget: number; macroTargetsG: { protein: number; carbs: number; fats: number } }, durationMonths: number) => Promise<PlanStrategy | null> };

export async function openAiSession(): Promise<AiSession | { error: string }> {
  loadDotEnv();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!url || !anon) return { error: 'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY mancanti' };
  if (!email || !password) return { error: 'Imposta TEST_EMAIL e TEST_PASSWORD (un account di prova) per usare --ai' };

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return { error: `Login fallito (${res.status})` };
  const { access_token } = (await res.json()) as { access_token: string };

  return {
    call: async (persona, targets, durationMonths) => {
      try {
        const r = await fetch(`${url}/functions/v1/generate-plan-strategy`, {
          method: 'POST',
          headers: { apikey: anon, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: persona.answers, dailyCalorieTarget: targets.dailyCalorieTarget, macroTargetsG: targets.macroTargetsG, durationMonths }),
        });
        if (!r.ok) return null;
        const json = (await r.json()) as { strategy?: PlanStrategy | null };
        return json.strategy ?? null;
      } catch {
        return null;
      }
    },
  };
}

const VALID_SPLITS = new Set(['Full Body', 'Upper', 'Lower', 'Push', 'Pull', 'Legs']);

/** Checks on the strategy the AI returned (before the planners use it). */
export function checkStrategy(persona: Persona, strategy: PlanStrategy | null, targetCalories: number, durationMonths: number): Finding[] {
  const f: Finding[] = [];
  if (!strategy) {
    f.push({ level: 'WARN', area: 'coerenza', code: 'A1', message: 'L’agente AI non ha restituito una strategia: il piano usa solo le tabelle deterministiche' });
    return f;
  }
  const t = strategy.training;
  if (t) {
    const bad = t.splitLabels.filter((l) => !VALID_SPLITS.has(l));
    if (bad.length) f.push({ level: 'WARN', area: 'allenamento', code: 'A2', message: `Etichette di split non valide dall’AI (ignorate dal planner): ${bad.join(', ')}` });
    if (!t.gymScheme?.adattamento || !t.gymScheme?.later) f.push({ level: 'WARN', area: 'allenamento', code: 'A2', message: 'Schema serie/ripetizioni mancante nella strategia AI' });
    if (t.monthlyFocus.length < durationMonths) f.push({ level: 'INFO', area: 'allenamento', code: 'A3', message: `La strategia AI descrive ${t.monthlyFocus.length} mesi su ${durationMonths}` });
  }
  const d = strategy.diet;
  if (d) {
    if (d.monthlyTargets.length < durationMonths) f.push({ level: 'WARN', area: 'dieta', code: 'A4', message: `La strategia AI fissa i target per ${d.monthlyTargets.length} mesi su ${durationMonths}: gli altri mesi tornano al calcolo deterministico` });
    for (const m of d.monthlyTargets) {
      const kcal = m.macroTargetsG.protein * 4 + m.macroTargetsG.carbs * 4 + m.macroTargetsG.fats * 9;
      if (m.calorieTarget < 1200) f.push({ level: 'FAIL', area: 'dieta', code: 'A5', message: `Mese ${m.monthIndex}: l’AI propone ${m.calorieTarget} kcal, sotto il minimo di sicurezza` });
      if (Math.abs(m.calorieTarget / targetCalories - 1) > 0.25) f.push({ level: 'WARN', area: 'dieta', code: 'A5', message: `Mese ${m.monthIndex}: ${m.calorieTarget} kcal si discosta del ${Math.round((m.calorieTarget / targetCalories - 1) * 100)}% dal target calcolato (${targetCalories})` });
      if (Math.abs(kcal - m.calorieTarget) / m.calorieTarget > 0.05) f.push({ level: 'WARN', area: 'dieta', code: 'A6', message: `Mese ${m.monthIndex}: i macro dell’AI (${kcal} kcal) non tornano con le calorie (${m.calorieTarget})` });
    }
  }
  void persona;
  return f;
}
