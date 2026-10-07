/**
 * The local coach (src/lib/assistant/local-coach.ts) answers chat questions and writes the
 * Home insights without any AI call. These checks run it on synthetic facts — a person with
 * a full history, one just started, one with nothing — and verify it never crashes, always
 * answers the suggested questions with real data, and respects its own limits.
 */
import { localInsights, localReply, SUGGESTED_PROMPTS, type CoachFacts } from '@/lib/assistant/local-coach';

import type { Finding } from './checks';

const EMPTY: CoachFacts = {
  weight: { currentKg: null, startKg: null, targetKg: null, trendKgPerWeek: null, weighIns: 0, lastWeighInDate: null },
  checkinDue: null,
};

const FULL: CoachFacts = {
  nutritionToday: { kcalEaten: 1200, kcalTarget: 2100, proteinEatenG: 60, proteinTargetG: 130, carbsEatenG: 120, fatsEatenG: 40, loggingStreakDays: 4 },
  trainingToday: { planType: 'workout', title: 'Upper', exercises: [{ name: 'Panca piana', targetSets: 4, targetReps: '8-10' }], alreadyLoggedToday: false },
  trainingAdherence14d: { planned: 6, done: 5 },
  plan: { goal: 'loseFat', monthIndex: 2, durationMonths: 4, phase: 'progressione', dailyBalanceKcal: -400, expectedWeeklyKg: -0.4, lastRecalibration: { monthIndex: 1, verdict: 'on_track', weeklyRateKg: -0.35, changes: ['Calorie invariate.'] } },
  weight: { currentKg: 82, startKg: 85, targetKg: 76, trendKgPerWeek: -0.35, weighIns: 8, lastWeighInDate: '2026-10-05' },
  checkinDue: 1,
};

const DAY_ONE: CoachFacts = { ...FULL, weight: { ...FULL.weight, weighIns: 1, startKg: 82, trendKgPerWeek: null }, plan: { ...FULL.plan!, monthIndex: 1, lastRecalibration: undefined }, checkinDue: null, trainingAdherence14d: { planned: 0, done: 0 } };

export function checkCoach(): Finding[] {
  const f: Finding[] = [];
  const fail = (code: string, message: string) => f.push({ level: 'FAIL', area: 'coerenza', code, message });

  for (const [name, facts] of [['completa', FULL], ['primo giorno', DAY_ONE], ['senza dati', EMPTY]] as const) {
    for (const q of [...SUGGESTED_PROMPTS, 'ciao', 'ho un dolore al ginocchio', 'qualcosa di strano']) {
      const text = localReply(q, facts);
      if (!text || text.length < 20) fail('C1', `Risposta vuota per "${q}" (${name})`);
      if (/undefined|NaN|null/.test(text)) fail('C1', `Risposta con valori non validi per "${q}" (${name}): ${text}`);
    }
    const insights = localInsights(facts);
    if (insights.length > 4) fail('C2', `Troppi insight (${insights.length}) con dati ${name}`);
    if (new Set(insights.map((i) => i.id)).size !== insights.length) fail('C2', `Id insight duplicati con dati ${name}`);
    for (const i of insights) if (/undefined|NaN|null/.test(i.headline + i.body)) fail('C2', `Insight con valori non validi (${name}): ${i.headline}`);
  }

  // answers must use the person's own numbers
  const weight = localReply('Come va il mio peso?', FULL);
  if (!weight.includes('82,0')) fail('C3', 'La risposta sul peso non usa il peso registrato');
  const today = localReply('Cosa devo allenare oggi?', FULL);
  if (!today.includes('Upper') || !today.includes('Panca piana')) fail('C3', 'La risposta sull’allenamento non usa la scheda di oggi');
  const calories = localReply('Come vanno le mie calorie oggi?', FULL);
  if (!calories.includes('1200') || !calories.includes('2100')) fail('C3', 'La risposta sulle calorie non usa i dati di oggi');
  const goal = localReply('Quanto manca al mio obiettivo?', FULL);
  if (!/settimane/.test(goal)) fail('C3', 'La risposta sull’obiettivo non stima il tempo');

  // never give medical advice, never invent a trend with too little data
  if (!/medico|professionista/.test(localReply('Ho male alla schiena, cosa prendo?', FULL))) fail('C4', 'Su dolori e farmaci il coach non rimanda a un professionista');
  if (/tendenza è/.test(localReply('Come va il mio peso?', DAY_ONE))) fail('C4', 'Il coach dichiara una tendenza del peso con una sola pesata');
  if (!localInsights(FULL).some((i) => i.id.startsWith('checkin-'))) fail('C5', 'Con un check-in dovuto manca l’insight che lo segnala');
  return f;
}
