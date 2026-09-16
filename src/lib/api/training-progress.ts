// Repository module for training-progress-store.ts (logs against the
// *generated* plan's exercises) — writes to the shared exercise_sets table
// with source='generated_plan'. training.ts is the sibling module for
// source='static_template'.
import { supabase } from '@/lib/supabase/client';
import type { CompletedExercise, LoggedSet } from '@/store/training-progress-store';

type ExerciseSetRow = { id: string; date: string; exercise_id: string; exercise_name: string | null; reps: number; weight_kg: number };

function fromRow(row: ExerciseSetRow): LoggedSet {
  return { id: row.id, date: row.date, exerciseId: row.exercise_id, exerciseName: row.exercise_name ?? '', reps: row.reps, weightKg: row.weight_kg };
}

export async function fetchGeneratedPlanLogs(userId: string): Promise<LoggedSet[]> {
  const { data, error } = await supabase
    .from('exercise_sets')
    .select('id, date, exercise_id, exercise_name, reps, weight_kg')
    .eq('user_id', userId)
    .eq('source', 'generated_plan');
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function insertGeneratedPlanLog(userId: string, log: LoggedSet): Promise<void> {
  const { error } = await supabase.from('exercise_sets').insert({
    id: log.id,
    user_id: userId,
    source: 'generated_plan',
    exercise_id: log.exerciseId,
    exercise_name: log.exerciseName,
    reps: log.reps,
    weight_kg: log.weightKg,
    date: log.date,
  });
  if (error) throw error;
}

export async function deleteGeneratedPlanLog(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from('exercise_sets').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}

export async function fetchCompletedExercises(userId: string): Promise<CompletedExercise[]> {
  const { data, error } = await supabase.from('exercise_completions').select('exercise_id, date').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => ({ exerciseId: r.exercise_id as string, date: r.date as string }));
}

export async function insertCompletedExercise(userId: string, exerciseId: string, date: string): Promise<void> {
  const { error } = await supabase.from('exercise_completions').insert({ user_id: userId, exercise_id: exerciseId, date });
  if (error) throw error;
}

export async function deleteCompletedExercise(userId: string, exerciseId: string, date: string): Promise<void> {
  const { error } = await supabase.from('exercise_completions').delete().eq('user_id', userId).eq('exercise_id', exerciseId).eq('date', date);
  if (error) throw error;
}
