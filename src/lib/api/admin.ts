// Read-only admin panel API. Everything goes through the SECURITY DEFINER functions of
// supabase/migrations/0020_admin.sql, which refuse anyone who is not in `app_admins`.
import { supabase } from '@/lib/supabase/client';
import type { DietMonthPlan, TrainingMonthPlan } from '@/lib/planning/types';

export type AdminUserRow = {
  user_id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  goal: string | null;
  questionnaire_version: number | null;
  has_answers: boolean;
  diet_months: number | null;
  diet_generated_at: string | null;
  training_months: number | null;
  training_generated_at: string | null;
  latest_weight_kg: number | null;
  weigh_ins: number;
  checkins: number;
};

export type AdminUserDetail = {
  user: { id: string; email: string | null; created_at: string; last_sign_in_at: string | null } | null;
  profile: Record<string, unknown> | null;
  answers: { answers: Record<string, unknown>; questionnaire_version: number; updated_at: string } | null;
  diet_plan: { generated_at: string; duration_months: number; goal: string; plan: DietMonthPlan[] } | null;
  training_plan: { generated_at: string; duration_months: number; plan: TrainingMonthPlan[] } | null;
  plan_versions: { plan_type: string; version: number; status: string; trigger: string; algorithm_version: string | null; created_at: string }[];
  target_history: { effective_date: string; calories: number; protein_g: number; carbs_g: number; fats_g: number; source: string; reason: string | null }[];
  checkins: { month_index: number; answers: Record<string, unknown>; weight_trend_kg: number | null; created_at: string }[];
  body_metrics: { date: string; weight_kg: number | null; body_fat_pct: number | null; waist_cm: number | null }[];
  activity: { date: string; activity_type: string; duration_minutes: number; intensity: string; estimated_kcal: number }[];
};

/** True when the signed-in account is an admin. Any failure (not signed in, function missing) reads as "no". */
export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('admin_list_users');
  if (error) throw error;
  return (data ?? []) as AdminUserRow[];
}

export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const { data, error } = await supabase.rpc('admin_user_detail', { p_user: userId });
  if (error) throw error;
  return data as AdminUserDetail;
}
