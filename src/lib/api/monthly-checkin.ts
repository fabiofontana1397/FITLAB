// Repository module for monthly_checkins (spec §0.4, punto 2) — one row per
// user per plan month, gating that month's unlock and feeding the next
// month's regeneration (see lib/planning/monthly-adjustment.ts).
import { supabase } from '@/lib/supabase/client';

export type MonthlyCheckin = {
  monthIndex: number;
  answers: Record<string, unknown>;
  weightTrendKg: number | null;
  createdAt: string;
};

export async function fetchMonthlyCheckins(userId: string): Promise<MonthlyCheckin[]> {
  const { data, error } = await supabase
    .from('monthly_checkins')
    .select('month_index, answers, weight_trend_kg, created_at')
    .eq('user_id', userId)
    .order('month_index', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    monthIndex: row.month_index,
    answers: (row.answers as Record<string, unknown>) ?? {},
    weightTrendKg: row.weight_trend_kg,
    createdAt: row.created_at,
  }));
}

export async function upsertMonthlyCheckin(
  userId: string,
  monthIndex: number,
  answers: Record<string, unknown>,
  weightTrendKg: number | null
): Promise<void> {
  const { error } = await supabase
    .from('monthly_checkins')
    .upsert({ user_id: userId, month_index: monthIndex, answers, weight_trend_kg: weightTrendKg }, { onConflict: 'user_id,month_index' });
  if (error) throw error;
}
