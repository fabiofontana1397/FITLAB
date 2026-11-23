-- Consent log (GDPR art. 7.1: the controller must be able to demonstrate consent).
-- Append-only: one row per consent given or withdrawn, with the version of the
-- legal texts it refers to (src/lib/legal/content.ts LEGAL_VERSION). The app
-- reads the latest row per kind; nothing is ever updated in place.
create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('age', 'terms', 'health')),
  version text not null,
  granted boolean not null,
  platform text,
  created_at timestamptz not null default now()
);

create index user_consents_user_kind_idx on public.user_consents (user_id, kind, created_at desc);

alter table public.user_consents enable row level security;

-- Users read and add their own rows only. No update/delete policy: the log is
-- append-only for clients (rows go away with the account, via the cascade).
create policy "user_consents_select_own" on public.user_consents for select using (auth.uid() = user_id);
create policy "user_consents_insert_own" on public.user_consents for insert with check (auth.uid() = user_id);
