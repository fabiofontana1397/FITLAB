import { supabase } from '@/lib/supabase/client';
import type { ActivityIntensity, ActivityType } from '@/lib/nutrition/activity-log';

export type LoggedActivity = {
  id: string;
  date: string;
  activityType: ActivityType;
  durationMinutes: number;
  intensity: ActivityIntensity;
  estimatedKcal: number;
};

type ActivityLogRow = {
  id: string;
  date: string;
  activity_type: ActivityType;
  duration_minutes: number;
  intensity: ActivityIntensity;
  estimated_kcal: number;
};

function fromRow(row: ActivityLogRow): LoggedActivity {
  return {
    id: row.id,
    date: row.date,
    activityType: row.activity_type,
    durationMinutes: row.duration_minutes,
    intensity: row.intensity,
    estimatedKcal: row.estimated_kcal,
  };
}

export async function fetchActivityLog(userId: string): Promise<LoggedActivity[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, date, activity_type, duration_minutes, intensity, estimated_kcal')
    .eq('user_id', userId)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function insertActivityLog(userId: string, entry: Omit<LoggedActivity, 'id'>): Promise<LoggedActivity> {
  const { data, error } = await supabase
    .from('activity_log')
    .insert({
      user_id: userId,
      date: entry.date,
      activity_type: entry.activityType,
      duration_minutes: entry.durationMinutes,
      intensity: entry.intensity,
      estimated_kcal: entry.estimatedKcal,
    })
    .select('id, date, activity_type, duration_minutes, intensity, estimated_kcal')
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteActivityLog(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from('activity_log').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}
