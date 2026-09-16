-- Reference migration: mirrors src/store/body-store.ts exactly.
--
-- body_metrics uses a composite (user_id, date) primary key so that both
-- addWeightEntry (overwrites weight_kg only) and addMeasurement (merges a
-- partial set of fields) collapse into a single client-side
-- `upsert(...).onConflict('user_id,date')` — the same upsert-by-date
-- semantics the store already implements client-side today.
create table public.body_metrics (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight_kg numeric,
  body_fat_pct numeric,
  muscle_mass_kg numeric,
  shoulders_cm numeric,
  chest_cm numeric,
  biceps_cm numeric,
  waist_cm numeric,
  hips_cm numeric,
  thigh_cm numeric,
  resting_heart_rate numeric,
  sleep_hours numeric,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.body_metrics enable row level security;

create policy "body_metrics_select_own" on public.body_metrics for select using (auth.uid() = user_id);
create policy "body_metrics_insert_own" on public.body_metrics for insert with check (auth.uid() = user_id);
create policy "body_metrics_update_own" on public.body_metrics for update using (auth.uid() = user_id);
create policy "body_metrics_delete_own" on public.body_metrics for delete using (auth.uid() = user_id);

-- body_photos: storage_path is bucket-relative (see the `progress-photos`
-- bucket below), not a URL — the bucket is private, so the client always
-- resolves a short-lived signed URL at read time instead of persisting a
-- permanent public link.
create table public.body_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  pose text not null check (pose in (
    'frontRelaxed', 'sideRightRelaxed', 'sideLeftRelaxed', 'backRelaxed', 'frontFlexed', 'backFlexed'
  )),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index body_photos_user_date_idx on public.body_photos (user_id, date);

alter table public.body_photos enable row level security;

create policy "body_photos_select_own" on public.body_photos for select using (auth.uid() = user_id);
create policy "body_photos_insert_own" on public.body_photos for insert with check (auth.uid() = user_id);
create policy "body_photos_update_own" on public.body_photos for update using (auth.uid() = user_id);
create policy "body_photos_delete_own" on public.body_photos for delete using (auth.uid() = user_id);

-- Storage bucket for progress photos: private, path convention
-- `${user_id}/${photo_id}.jpg`. RLS on storage.objects scopes each user to
-- their own folder prefix.
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy "progress_photos_select_own" on storage.objects for select
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress_photos_insert_own" on storage.objects for insert
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress_photos_update_own" on storage.objects for update
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress_photos_delete_own" on storage.objects for delete
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
