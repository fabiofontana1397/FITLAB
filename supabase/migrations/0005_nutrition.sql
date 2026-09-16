-- Schema only this pass (nutrition-store.ts stays local-first zustand for
-- now — see the plan's repository-module fast-follow convention). Mirrors
-- src/lib/mock/food-database.ts (FoodItem) and src/store/nutrition-store.ts
-- (MealFoodEntry, seededDates) exactly, so wiring it up later is mechanical.

-- Shared, read-only reference catalog — not user-owned. IDs reuse the
-- existing mock ids verbatim (e.g. 'chicken-breast') so foodId references
-- never need remapping when this gets wired up.
create table public.food_items (
  id text primary key,
  name text not null,
  category text not null check (category in (
    'proteine', 'carboidrati', 'grassi', 'verdura', 'frutta', 'latticini', 'legumi', 'altro'
  )),
  kcal100 numeric not null,
  protein100 numeric not null,
  carbs100 numeric not null,
  fats100 numeric not null,
  default_portion_g numeric not null
);

alter table public.food_items enable row level security;

-- Read-only shared reference data: any authenticated user can read, nobody
-- writes through the API (seeded via scripts/seed-food-database.ts using
-- the service-role key).
create policy "food_items_select_authenticated" on public.food_items for select
  to authenticated using (true);

create table public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  slot text not null check (slot in (
    'colazione', 'spuntinoMattina', 'pranzo', 'spuntinoPomeriggio', 'cena', 'spuntinoSera'
  )),
  food_id text not null references public.food_items (id),
  grams numeric not null,
  created_at timestamptz not null default now()
);

create index meal_entries_user_date_idx on public.meal_entries (user_id, date);

alter table public.meal_entries enable row level security;

create policy "meal_entries_select_own" on public.meal_entries for select using (auth.uid() = user_id);
create policy "meal_entries_insert_own" on public.meal_entries for insert with check (auth.uid() = user_id);
create policy "meal_entries_update_own" on public.meal_entries for update using (auth.uid() = user_id);
create policy "meal_entries_delete_own" on public.meal_entries for delete using (auth.uid() = user_id);

-- Dedicated existence-check table (mirrors nutrition-store.ts's
-- `seededDates: string[]`) rather than an array column, since it's really
-- an append-only set with simple per-date existence checks.
create table public.nutrition_seeded_dates (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  primary key (user_id, date)
);

alter table public.nutrition_seeded_dates enable row level security;

create policy "nutrition_seeded_dates_select_own" on public.nutrition_seeded_dates for select using (auth.uid() = user_id);
create policy "nutrition_seeded_dates_insert_own" on public.nutrition_seeded_dates for insert with check (auth.uid() = user_id);
create policy "nutrition_seeded_dates_delete_own" on public.nutrition_seeded_dates for delete using (auth.uid() = user_id);
