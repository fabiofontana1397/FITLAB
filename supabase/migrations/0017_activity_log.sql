-- Manual activity log ("Aggiungi allenamento" in Training) — a logged
-- session (type/duration/intensity), independent of the generated plan's
-- own completion tracking, feeding the Home estimated-expenditure model.
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  activity_type text not null check (activity_type in ('gym', 'running', 'cycling', 'swimming', 'walking', 'functional', 'tennis', 'other')),
  duration_minutes integer not null check (duration_minutes > 0),
  intensity text not null check (intensity in ('low', 'moderate', 'high')),
  estimated_kcal integer not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_user_date_idx on public.activity_log (user_id, date);

alter table public.activity_log enable row level security;

create policy "activity_log_select_own" on public.activity_log
  for select using (auth.uid() = user_id);
create policy "activity_log_insert_own" on public.activity_log
  for insert with check (auth.uid() = user_id);
create policy "activity_log_delete_own" on public.activity_log
  for delete using (auth.uid() = user_id);
