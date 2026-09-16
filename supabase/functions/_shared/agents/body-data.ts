import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type BodyContext = {
  profile: {
    goal: string;
    targetWeightKg: number;
    sex: string;
  } | null;
  latest: Record<string, number | null> | null;
  entryCount: number;
  weightDelta30d: number | null;
  waistDelta30d: number | null;
  bodyFatDelta30d: number | null;
};

/** The only domain fully migrated to Postgres this pass — queried for
 * real via the user-scoped client (RLS-enforced), unlike the
 * nutrition/training specialists which still work off client-supplied
 * context since those stores stay local-first for now. */
export async function getBodyContext(supabase: SupabaseClient): Promise<BodyContext> {
  const [{ data: profile }, { data: entries }] = await Promise.all([
    supabase.from('profiles').select('goal, target_weight_kg, sex').maybeSingle(),
    supabase.from('body_metrics').select('*').order('date', { ascending: true }),
  ]);

  const rows = entries ?? [];
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const thirtyDaysAgo = rows.length > 0 ? rows[Math.max(0, rows.length - 30)] : null;

  const delta = (key: 'weight_kg' | 'waist_cm' | 'body_fat_pct'): number | null => {
    if (!latest || !thirtyDaysAgo || latest[key] == null || thirtyDaysAgo[key] == null) return null;
    return Number((latest[key] - thirtyDaysAgo[key]).toFixed(2));
  };

  return {
    profile: profile ? { goal: profile.goal, targetWeightKg: Number(profile.target_weight_kg), sex: profile.sex } : null,
    latest,
    entryCount: rows.length,
    weightDelta30d: delta('weight_kg'),
    waistDelta30d: delta('waist_cm'),
    bodyFatDelta30d: delta('body_fat_pct'),
  };
}
