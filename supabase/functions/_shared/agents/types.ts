import type Anthropic from 'npm:@anthropic-ai/sdk@^0.68';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

// nutrition-store.ts and training-store.ts/training-progress-store.ts stay
// local-first zustand this pass (see the plan's repository-module
// fast-follow convention) — their data isn't in Postgres yet. Rather than
// have those two specialists answer blind, the client computes a small
// real-data snapshot from its own local stores and sends it alongside the
// chat message; the body-progress specialist, by contrast, queries
// Postgres for real since body-store IS fully migrated (see body-data.ts).
// Once nutrition/training migrate, those specialists swap this for a
// Postgres query too — no prompt/architecture change needed.
export type ClientContext = {
  nutritionToday?: {
    kcalEaten: number;
    kcalTarget: number;
    proteinEatenG: number;
    proteinTargetG: number;
    carbsEatenG: number;
    fatsEatenG: number;
    loggingStreakDays: number;
  };
  trainingToday?: {
    planType: 'workout' | 'cardio' | 'rest';
    title: string;
    exercises?: { name: string; targetSets: number; targetReps: string }[];
    alreadyLoggedToday: boolean;
  };
  trainingAdherence14d?: { planned: number; done: number };
  /** Where the person is in their plan and what the monthly recalibration last decided. */
  plan?: {
    goal: string;
    monthIndex: number;
    durationMonths: number;
    phase: string;
    dailyBalanceKcal: number;
    expectedWeeklyKg: number;
    lastRecalibration?: { monthIndex: number; verdict: string; weeklyRateKg: number | null; changes: string[] };
  };
};

/** One line describing the plan state, shared by every agent's prompt. */
export function describePlan(plan: ClientContext['plan']): string {
  if (!plan) return 'Piano: non disponibile.';
  const balance = plan.dailyBalanceKcal === 0 ? 'calorie di mantenimento' : `${plan.dailyBalanceKcal > 0 ? '+' : ''}${plan.dailyBalanceKcal} kcal/giorno rispetto al dispendio`;
  const last = plan.lastRecalibration
    ? ` Ultima ricalibrazione (mese ${plan.lastRecalibration.monthIndex}): ${plan.lastRecalibration.verdict}${plan.lastRecalibration.weeklyRateKg != null ? `, variazione misurata ${plan.lastRecalibration.weeklyRateKg} kg/sett.` : ''} Modifiche: ${plan.lastRecalibration.changes.join(' ')}`
    : ' Nessuna ricalibrazione ancora (la prima è a fine del primo mese).';
  return `Piano: obiettivo ${plan.goal}, mese ${plan.monthIndex} di ${plan.durationMonths} (fase ${plan.phase}), ${balance}, variazione di peso prevista ${plan.expectedWeeklyKg} kg/sett.${last}`;
}

export type AgentRunContext = {
  supabase: SupabaseClient;
  anthropic: Anthropic;
  clientContext: ClientContext;
};
