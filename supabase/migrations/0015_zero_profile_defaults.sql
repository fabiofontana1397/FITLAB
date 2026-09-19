-- Spec §0.1 (Ingresso in app): "valori di default deve essere 0 se
-- l'utente non ha compilato il questionario". src/store/user-store.ts's
-- client-side DEFAULT_PROFILE was already all-zero, but the DB column
-- defaults handle_new_user() relies on for the auto-created row (0002_
-- profiles.sql) were plausible-looking placeholder numbers (180cm, 78kg,
-- 2650kcal, 175g protein...) instead of zero — never actually visible in
-- the UI today (AuthGate redirects every route to /onboarding until
-- hasOnboarded), but a real inconsistency at the data layer: a
-- not-yet-onboarded account's row shouldn't look like real answered data.
-- Only affects NEW rows going forward (ALTER COLUMN ... SET DEFAULT never
-- rewrites existing rows) — consistent with every other migration in this
-- series being purely additive/forward-looking.
alter table public.profiles
  alter column height_cm set default 0,
  alter column target_weight_kg set default 0,
  alter column daily_calorie_target set default 0,
  alter column protein_g set default 0,
  alter column carbs_g set default 0,
  alter column fats_g set default 0,
  alter column hydration_target_ml set default 0,
  alter column sports set default array[]::text[];
