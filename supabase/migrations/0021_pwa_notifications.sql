create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  meal_enabled boolean not null default true,
  breakfast_time text not null default '08:00',
  lunch_time text not null default '13:00',
  dinner_time text not null default '20:00',
  training_enabled boolean not null default true,
  training_time text not null default '18:00',
  weekly_enabled boolean not null default true,
  monthly_enabled boolean not null default true,
  timezone text not null default 'Europe/Rome',
  updated_at timestamptz not null default now(),
  constraint notification_times_valid check (
    breakfast_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and
    lunch_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and
    dinner_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and
    training_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  )
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "Users manage their notification preferences"
  on public.notification_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.notification_dispatches (
  user_id uuid not null references auth.users(id) on delete cascade,
  dispatch_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, dispatch_key)
);
alter table public.notification_dispatches enable row level security;
