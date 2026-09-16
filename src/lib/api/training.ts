// Repository module for training-store.ts (the static Push/Pull/Legs
// template logs) — writes to the shared exercise_sets table with
// source='static_template', per the unification decision in
// supabase/migrations/0007_training.sql. training-progress.ts is the
// sibling module for source='generated_plan'.
import { supabase } from '@/lib/supabase/client';
import type { ExerciseSetLog } from '@/store/training-store';

type ExerciseSetRow = { id: string; date: string; template_id: string | null; exercise_id: string; reps: number; weight_kg: number };

function fromRow(row: ExerciseSetRow): ExerciseSetLog {
  return { id: row.id, date: row.date, templateId: row.template_id ?? '', exerciseId: row.exercise_id, reps: row.reps, weightKg: row.weight_kg };
}

export async function fetchStaticTemplateLogs(userId: string): Promise<ExerciseSetLog[]> {
  const { data, error } = await supabase
    .from('exercise_sets')
    .select('id, date, template_id, exercise_id, reps, weight_kg')
    .eq('user_id', userId)
    .eq('source', 'static_template');
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function insertStaticTemplateLog(userId: string, log: ExerciseSetLog): Promise<void> {
  const { error } = await supabase.from('exercise_sets').insert({
    id: log.id,
    user_id: userId,
    source: 'static_template',
    exercise_id: log.exerciseId,
    template_id: log.templateId,
    reps: log.reps,
    weight_kg: log.weightKg,
    date: log.date,
  });
  if (error) throw error;
}
