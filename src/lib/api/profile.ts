import { supabase } from '@/lib/supabase/client';
import type { Goal, Sex, Sport, UserProfile } from '@/lib/mock/types';

type ProfileRow = {
  name: string;
  sex: string;
  age: number | null;
  goal: string;
  sports: string[];
  height_cm: number;
  target_weight_kg: number;
  daily_calorie_target: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  hydration_target_ml: number;
};

function fromRow(row: ProfileRow): UserProfile {
  return {
    name: row.name,
    sex: row.sex as Sex,
    age: row.age ?? 0,
    goal: row.goal as Goal,
    sports: row.sports as Sport[],
    heightCm: row.height_cm,
    targetWeightKg: row.target_weight_kg,
    dailyCalorieTarget: row.daily_calorie_target,
    macroTargetsG: { protein: row.protein_g, carbs: row.carbs_g, fats: row.fats_g },
    hydrationTargetMl: row.hydration_target_ml,
  };
}

/** `handle_new_user` creates a placeholder row at signup, so this should
 * always resolve to a real row for an authenticated user — null only on an
 * actual fetch failure, never "profile doesn't exist yet". */
export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, sex, age, goal, sports, height_cm, target_weight_kg, daily_calorie_target, protein_g, carbs_g, fats_g, hydration_target_ml')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as ProfileRow) : null;
}

export async function upsertProfile(userId: string, profile: UserProfile): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({
    user_id: userId,
    name: profile.name,
    sex: profile.sex,
    age: profile.age,
    goal: profile.goal,
    sports: profile.sports,
    height_cm: profile.heightCm,
    target_weight_kg: profile.targetWeightKg,
    daily_calorie_target: profile.dailyCalorieTarget,
    protein_g: profile.macroTargetsG.protein,
    carbs_g: profile.macroTargetsG.carbs,
    fats_g: profile.macroTargetsG.fats,
    hydration_target_ml: profile.hydrationTargetMl,
  });
  if (error) throw error;
}
