-- Packaged products now come from Open Food Facts (see the `food-search`
-- Edge Function). Its API allows only ~10 searches/min per IP and every call
-- leaves from the function, so each search answer is remembered here and the
-- same query (from any user) is served from Postgres until it expires.
create table if not exists public.food_search_cache (
  query text primary key,
  food_ids text[] not null default '{}',
  fetched_at timestamptz not null default now()
);

-- Written and read only by the Edge Function (service role): RLS on, no policies.
alter table public.food_search_cache enable row level security;

comment on column public.food_items.source is
  'fitlab = bundled catalogue; openfoodfacts = product cached from Open Food Facts (ODbL, attribution required); fatsecret = legacy';
