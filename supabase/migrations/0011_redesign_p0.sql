-- P0 redesign changes from "Guida ai Miglioramenti delle Specifiche Tecniche
-- FITLAB" (see FITLAB_SPEC.md §6/§12 bis for the corresponding documentation):
--   1. body_metrics baseline support (source, is_baseline) — resetStartingWeight
--      no longer wipes history, it inserts a marked baseline row instead.
--   2. plan_versions — a lightweight audit trail for every plan generation/
--      regeneration/adaptation event. diet_plans/training_plans remain the
--      actual plan storage (still one row per user, still jsonb) — this adds
--      versioned history on top rather than replacing that storage model.
--   3. nutrition_target_history — every nutrition target computed, whether
--      the initial onboarding estimate or a later adaptive correction.

-- 1. body_metrics baseline columns
alter table public.body_metrics
  add column if not exists source text not null default 'manual' check (source in ('onboarding', 'manual', 'import')),
  add column if not exists is_baseline boolean not null default false;

-- 2. plan_versions
create table if not exists public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_type text not null check (plan_type in ('diet', 'training')),
  version int not null,
  status text not null default 'active' check (status in ('draft', 'active', 'superseded')),
  trigger text not null default 'onboarding' check (trigger in ('onboarding', 'regenerate', 'adaptation')),
  algorithm_version text,
  created_at timestamptz not null default now()
);

alter table public.plan_versions enable row level security;

create policy plan_versions_select_own on public.plan_versions
  for select using (auth.uid() = user_id);
create policy plan_versions_insert_own on public.plan_versions
  for insert with check (auth.uid() = user_id);

create index if not exists plan_versions_user_type_idx on public.plan_versions (user_id, plan_type, version desc);

-- 3. nutrition_target_history — the Adaptive Nutrition Engine's audit trail
create table if not exists public.nutrition_target_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_date date not null default current_date,
  calories int not null,
  protein_g int not null,
  carbs_g int not null,
  fats_g int not null,
  source text not null default 'initial_estimate' check (source in ('initial_estimate', 'adaptation')),
  reason text,
  created_at timestamptz not null default now()
);

alter table public.nutrition_target_history enable row level security;

create policy nutrition_target_history_select_own on public.nutrition_target_history
  for select using (auth.uid() = user_id);
create policy nutrition_target_history_insert_own on public.nutrition_target_history
  for insert with check (auth.uid() = user_id);

create index if not exists nutrition_target_history_user_date_idx on public.nutrition_target_history (user_id, effective_date desc);
