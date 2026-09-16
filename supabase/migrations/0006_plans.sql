-- Schema only this pass (plan-store.ts stays local-first for now). One
-- current plan per user, matching today's wholesale-replace-on-regenerate
-- behavior (not a history table) — `user_id` is the primary key, not `id`.
--
-- The whole generated months/weeklySplit/meals/items tree stays a single
-- jsonb blob deliberately: it's generated wholesale, never edited
-- field-by-field, deeply variable shape (rest days have no exercises,
-- substitutes are optional), and nothing queries across users/rows at
-- that granularity. `schema_version` is the real fix for a pain point
-- plan-store.ts's own comments already flag: old locally-persisted blobs
-- have no version at all, forcing client-side shape-sniffing guards
-- (isValidTrainingPlan/isValidDietPlan) to detect stale shapes. Keep those
-- guards as defense-in-depth, but this column becomes the source of truth.
create table public.diet_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  schema_version int not null default 1,
  generated_at timestamptz not null default now(),
  duration_months int not null,
  goal text not null,
  plan jsonb not null
);

alter table public.diet_plans enable row level security;

create policy "diet_plans_select_own" on public.diet_plans for select using (auth.uid() = user_id);
create policy "diet_plans_insert_own" on public.diet_plans for insert with check (auth.uid() = user_id);
create policy "diet_plans_update_own" on public.diet_plans for update using (auth.uid() = user_id);
create policy "diet_plans_delete_own" on public.diet_plans for delete using (auth.uid() = user_id);

create table public.training_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  schema_version int not null default 1,
  generated_at timestamptz not null default now(),
  duration_months int not null,
  plan jsonb not null
);

alter table public.training_plans enable row level security;

create policy "training_plans_select_own" on public.training_plans for select using (auth.uid() = user_id);
create policy "training_plans_insert_own" on public.training_plans for insert with check (auth.uid() = user_id);
create policy "training_plans_update_own" on public.training_plans for update using (auth.uid() = user_id);
create policy "training_plans_delete_own" on public.training_plans for delete using (auth.uid() = user_id);
