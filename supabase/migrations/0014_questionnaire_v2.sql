-- Questionnaire v2 (src/lib/questionnaire/schema.ts, QUESTIONNAIRE_VERSION=2):
-- "Età" is now a precise age instead of a bucket ("25-34"). Adds the new
-- `age` column rather than converting `age_range` in place — a bucket
-- can't be turned back into a precise value for existing rows, and this
-- keeps the change purely additive (the established convention all
-- through this migration series). `age_range` is left in place, unused
-- going forward, rather than dropped.
alter table public.profiles
  add column if not exists age integer;
