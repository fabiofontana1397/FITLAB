-- Schema only this pass (training-store.ts / training-progress-store.ts
-- stay local-first for now). Deliberately UNIFIES today's two parallel
-- client logging stores into one table:
--   - training-store.ts's ExerciseSetLog {id,date,templateId,exerciseId,reps,weightKg}
--   - training-progress-store.ts's LoggedSet {id,exerciseId,exerciseName,date,reps,weightKg}
-- Both are structurally "a set was logged," differing only in which
-- catalog the exercise came from (the static Push/Pull/Legs templates vs.
-- a generated multi-month plan). Neither catalog is itself a stable DB
-- table today (templates are a hardcoded client constant; generated-plan
-- exercises live inside training_plans.plan's jsonb), so both sides are
-- just a free-text exercise_id — a real FK isn't possible either way, and
-- a single table avoids duplicating RLS/indexes and any future
-- cross-source query ("last time this exercise was done, from either
-- source") needing a UNION. Two client repository modules (or one
-- parameterized by `source`) keep the two zustand stores' external
-- behavior unchanged when this gets wired up later.
create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('static_template', 'generated_plan')),
  exercise_id text not null,
  exercise_name text,
  template_id text,
  reps int not null,
  weight_kg numeric not null,
  date date not null,
  created_at timestamptz not null default now()
);

create index exercise_sets_user_exercise_date_idx on public.exercise_sets (user_id, exercise_id, date);
create index exercise_sets_user_source_date_idx on public.exercise_sets (user_id, source, date);

alter table public.exercise_sets enable row level security;

create policy "exercise_sets_select_own" on public.exercise_sets for select using (auth.uid() = user_id);
create policy "exercise_sets_insert_own" on public.exercise_sets for insert with check (auth.uid() = user_id);
create policy "exercise_sets_update_own" on public.exercise_sets for update using (auth.uid() = user_id);
create policy "exercise_sets_delete_own" on public.exercise_sets for delete using (auth.uid() = user_id);

-- Replaces training-progress-store.ts's CompletedExercise — a distinct
-- concept from a logged set ("marked done" without necessarily logging
-- reps/weight).
create table public.exercise_completions (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  date date not null,
  primary key (user_id, exercise_id, date)
);

alter table public.exercise_completions enable row level security;

create policy "exercise_completions_select_own" on public.exercise_completions for select using (auth.uid() = user_id);
create policy "exercise_completions_insert_own" on public.exercise_completions for insert with check (auth.uid() = user_id);
create policy "exercise_completions_delete_own" on public.exercise_completions for delete using (auth.uid() = user_id);

-- Mirrors training-store.ts's `plan: WeeklyPlan` (the 7-item Mon-Sun
-- array). A jsonb column is enough: small, always read/replaced as a
-- whole array, never queried per-day.
create table public.training_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  weekly_plan jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.training_settings enable row level security;

create policy "training_settings_select_own" on public.training_settings for select using (auth.uid() = user_id);
create policy "training_settings_insert_own" on public.training_settings for insert with check (auth.uid() = user_id);
create policy "training_settings_update_own" on public.training_settings for update using (auth.uid() = user_id);
create policy "training_settings_delete_own" on public.training_settings for delete using (auth.uid() = user_id);
