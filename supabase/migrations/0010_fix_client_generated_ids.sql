-- Bug fix: client code generates its own free-form string ids for optimistic
-- local state (e.g. `${foodId}-${Date.now()}` in nutrition-store.ts,
-- `photo-${Date.now()}` in body.ts, `${exerciseId}-${date}-${Date.now()}` in
-- training.ts/training-progress.ts) and inserts that same id server-side —
-- but these three tables declared `id uuid default gen_random_uuid()`,
-- rejecting every client-supplied id with "invalid input syntax for type
-- uuid". None of these ids are referenced by a foreign key from another
-- table, so widening the column to text is safe.
alter table public.meal_entries alter column id drop default;
alter table public.meal_entries alter column id type text;

alter table public.body_photos alter column id drop default;
alter table public.body_photos alter column id type text;

alter table public.exercise_sets alter column id drop default;
alter table public.exercise_sets alter column id type text;
