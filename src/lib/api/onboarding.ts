// Repository module for onboarding-store.ts — the free-form questionnaire
// answers map, stored as one jsonb column (mirrors the client's own
// Record<string, AnswerValue> shape exactly, no per-field mapping needed).
import { supabase } from '@/lib/supabase/client';
import { QUESTIONNAIRE_VERSION } from '@/lib/questionnaire/schema';
import type { AnswerValue } from '@/store/onboarding-store';

export async function fetchOnboardingAnswers(userId: string): Promise<Record<string, AnswerValue> | null> {
  const { data, error } = await supabase.from('onboarding_answers').select('answers').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data?.answers as Record<string, AnswerValue>) ?? null;
}

export async function upsertOnboardingAnswers(userId: string, answers: Record<string, AnswerValue>): Promise<void> {
  const { error } = await supabase
    .from('onboarding_answers')
    .upsert({ user_id: userId, answers, questionnaire_version: QUESTIONNAIRE_VERSION }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function deleteOnboardingAnswers(userId: string): Promise<void> {
  const { error } = await supabase.from('onboarding_answers').delete().eq('user_id', userId);
  if (error) throw error;
}
