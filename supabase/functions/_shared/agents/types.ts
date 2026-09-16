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
};

export type AgentRunContext = {
  supabase: SupabaseClient;
  anthropic: Anthropic;
  clientContext: ClientContext;
};
