-- Monthly plan check-in (spec §0.4, punto 2): a short questionnaire the
-- user completes at the end of each plan month to unlock the next one.
-- One row per user per month — a redo overwrites that month's answers
-- rather than accumulating duplicates, since only the latest check-in for
-- a given month is ever meaningful.
create table if not exists public.monthly_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_index integer not null check (month_index >= 1),
  answers jsonb not null,
  weight_trend_kg numeric,
  created_at timestamptz not null default now(),
  primary key (user_id, month_index)
);

alter table public.monthly_checkins enable row level security;

create policy "monthly_checkins_select_own" on public.monthly_checkins
  for select using (auth.uid() = user_id);
create policy "monthly_checkins_insert_own" on public.monthly_checkins
  for insert with check (auth.uid() = user_id);
create policy "monthly_checkins_update_own" on public.monthly_checkins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "monthly_checkins_delete_own" on public.monthly_checkins
  for delete using (auth.uid() = user_id);

-- A monthly check-in regenerates the upcoming month(s) of an existing plan
-- (spec §12 bis's plan_versions registry) — extend the trigger vocabulary
-- rather than overloading 'adaptation' (that trigger is reserved for the
-- Adaptive Nutrition Engine's own calorie-only, questionnaire-free review).
alter table public.plan_versions drop constraint if exists plan_versions_trigger_check;
alter table public.plan_versions add constraint plan_versions_trigger_check
  check (trigger in ('onboarding', 'regenerate', 'adaptation', 'monthly_checkin'));
