-- Mirrors src/store/user-store.ts's UserProfile, flattened. One row per
-- auth.users row, auto-created on signup by handle_new_user() below so the
-- app always has *some* profile even before onboarding finishes (matching
-- today's DEFAULT_PROFILE behavior).
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  sex text not null default 'unspecified' check (sex in ('male', 'female', 'unspecified')),
  age_range text not null default '25-34',
  goal text not null default 'generalHealth'
    check (goal in ('loseFat', 'gainMuscle', 'maintainImprove', 'gainStrength', 'improveEndurance', 'generalHealth')),
  sports text[] not null default array['gym']::text[],
  height_cm numeric not null default 180,
  target_weight_kg numeric not null default 78,
  daily_calorie_target numeric not null default 2650,
  protein_g numeric not null default 175,
  carbs_g numeric not null default 290,
  fats_g numeric not null default 80,
  hydration_target_ml numeric not null default 2800,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = user_id);

-- Auto-create a profile row (with the same defaults as today's client-side
-- DEFAULT_PROFILE) whenever a new auth user signs up. `name` comes from the
-- signup metadata (`options.data.name`) the client already sends.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
