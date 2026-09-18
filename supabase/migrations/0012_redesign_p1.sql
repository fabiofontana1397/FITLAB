-- P1 redesign changes (see FITLAB_SPEC.md §7 ter, §14):
--   1. exercise_sets.rir — optional "reps in reserve" per logged set, the
--      input the scoped progression engine (lib/planning/progression.ts)
--      uses to suggest the next load instead of a flat bodyweight formula.
--      Nullable/optional: a user who never logs it sees no behavior change.

alter table public.exercise_sets
  add column if not exists rir smallint check (rir is null or (rir >= 0 and rir <= 10));
