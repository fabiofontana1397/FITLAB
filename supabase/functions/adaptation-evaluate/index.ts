// POST /adaptation/evaluate (spec §14, "API di dominio") — the concrete,
// scoped piece of "move critical domain logic off the client" this pass
// ships: the Adaptive Nutrition Engine (spec §4.1 bis) now runs here,
// against the user's own RLS-scoped body_metrics/meal_entries, instead of
// being recomputed client-side from whatever's currently cached in
// zustand stores. The client (src/store/user-store.ts's
// reviewNutritionTarget) just invokes this and applies whatever profile
// update comes back.
import { ALGORITHM_VERSION, evaluateAdaptation, type IntakePoint, type WeightPoint } from '../_shared/adaptive-engine.ts';
import { CORS_HEADERS, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { createUserScopedClient, getAuthenticatedUser } from '../_shared/supabase-client.ts';

const MIN_SAFE_CALORIE_TARGET = 1200;

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const supabase = createUserScopedClient(req);
    const user = await getAuthenticatedUser(supabase);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('goal, daily_calorie_target, protein_g, carbs_g, fats_g')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) throw new Error('Profile not found');

    const { data: bodyRows, error: bodyError } = await supabase
      .from('body_metrics')
      .select('date, weight_kg')
      .eq('user_id', user.id)
      .order('date', { ascending: true });
    if (bodyError) throw bodyError;

    const { data: mealRows, error: mealError } = await supabase
      .from('meal_entries')
      .select('date, grams, food_items(kcal100)')
      .eq('user_id', user.id);
    if (mealError) throw mealError;

    const weightSeries: WeightPoint[] = (bodyRows ?? [])
      .filter((r) => typeof r.weight_kg === 'number' && r.weight_kg > 0)
      .map((r) => ({ date: r.date as string, weightKg: r.weight_kg as number }));

    const kcalByDate = new Map<string, number>();
    for (const row of mealRows ?? []) {
      // deno-lint-ignore no-explicit-any
      const kcal100 = (row as any).food_items?.kcal100;
      if (typeof kcal100 !== 'number') continue;
      const kcal = kcal100 * ((row.grams as number) / 100);
      kcalByDate.set(row.date as string, (kcalByDate.get(row.date as string) ?? 0) + kcal);
    }
    const intakeSeries: IntakePoint[] = [...kcalByDate.entries()]
      .map(([date, kcal]) => ({ date, kcal }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const decision = evaluateAdaptation({ goal: profile.goal as string, weightSeries, intakeSeries });

    if (decision.action === 'none') {
      return jsonResponse({ decision, updatedProfile: null });
    }

    const delta = decision.action === 'increase' ? decision.deltaKcal : -decision.deltaKcal;
    const newCalorieTarget = Math.max(profile.daily_calorie_target + delta, MIN_SAFE_CALORIE_TARGET);
    // Protein stays fixed (it's set from bodyweight, not the calorie
    // budget); fats held constant; carbs absorb the whole adjustment —
    // mirrors the macro logic in src/lib/nutrition/targets.ts.
    const newCarbsG = Math.max(Math.round((newCalorieTarget - profile.protein_g * 4 - profile.fats_g * 9) / 4), 0);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ daily_calorie_target: newCalorieTarget, carbs_g: newCarbsG })
      .eq('user_id', user.id);
    if (updateError) throw updateError;

    const today = new Date().toISOString().slice(0, 10);
    const { error: historyError } = await supabase.from('nutrition_target_history').insert({
      user_id: user.id,
      effective_date: today,
      calories: newCalorieTarget,
      protein_g: profile.protein_g,
      carbs_g: newCarbsG,
      fats_g: profile.fats_g,
      source: 'adaptation',
      reason: decision.reason,
    });
    if (historyError) throw historyError;

    const { count, error: countError } = await supabase
      .from('plan_versions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('plan_type', 'diet');
    if (countError) throw countError;
    const { error: versionError } = await supabase.from('plan_versions').insert({
      user_id: user.id,
      plan_type: 'diet',
      version: (count ?? 0) + 1,
      status: 'active',
      trigger: 'adaptation',
      algorithm_version: ALGORITHM_VERSION,
    });
    if (versionError) throw versionError;

    return jsonResponse({
      decision,
      updatedProfile: { dailyCalorieTarget: newCalorieTarget, macroTargetsG: { protein: profile.protein_g, carbs: newCarbsG, fats: profile.fats_g } },
    });
  } catch (err) {
    console.error('adaptation-evaluate function error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message === 'Unauthorized' || message.includes('Authorization') ? 401 : 500;
    return jsonResponse({ error: message }, { status, headers: CORS_HEADERS });
  }
});
