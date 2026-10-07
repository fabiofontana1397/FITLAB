-- Shared cache of AI plan strategies, keyed by a coarse profile signature
-- (goal, activities, experience, age band, constraints…). Holds no personal data:
-- only the generic methodology text and set/rep scheme for that kind of profile.
-- Read and written exclusively by the generate-plan-strategy Edge Function
-- (service role); the app can never reach it.
create table if not exists public.plan_strategy_cache (
  key text primary key,
  strategy jsonb not null,
  created_at timestamptz not null default now(),
  hits integer not null default 0
);

alter table public.plan_strategy_cache enable row level security;
revoke all on public.plan_strategy_cache from anon, authenticated;
