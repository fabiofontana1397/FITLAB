-- Mirrors src/store/onboarding-store.ts: a single free-form jsonb map of
-- the ~70-question onboarding answers. Only a handful get promoted into
-- `profiles` when onboarding finishes (client-side, unchanged this pass).
create table public.onboarding_answers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.onboarding_answers enable row level security;

create policy "onboarding_answers_select_own" on public.onboarding_answers for select using (auth.uid() = user_id);
create policy "onboarding_answers_insert_own" on public.onboarding_answers for insert with check (auth.uid() = user_id);
create policy "onboarding_answers_update_own" on public.onboarding_answers for update using (auth.uid() = user_id);
create policy "onboarding_answers_delete_own" on public.onboarding_answers for delete using (auth.uid() = user_id);
