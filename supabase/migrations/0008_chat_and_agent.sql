-- New capability — chat isn't persisted client-side at all today (chat-store.ts
-- is in-memory only). The `chat` Edge Function is the sole writer of both
-- roles (inserts the user's turn itself before orchestrating, then the
-- assistant's reply after) to avoid a duplicate-write race with the
-- client's own optimistic local bubble.
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_user_created_idx on public.chat_messages (user_id, created_at);

alter table public.chat_messages enable row level security;

create policy "chat_messages_select_own" on public.chat_messages for select using (auth.uid() = user_id);
create policy "chat_messages_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);

-- RAG knowledge base over the two PDFs in `Materiale addestramento agente/`
-- (ingested by scripts/ingest-knowledge.ts). NOT user-owned — a shared
-- corpus, so the standard per-user RLS pattern doesn't apply here. The
-- table itself gets ZERO select/insert policies (RLS enabled = default
-- deny), so it can never be queried directly via PostgREST by anon or
-- authenticated — only a SECURITY DEFINER function (below) or the
-- service-role key (used only by the ingestion script) can touch it.
create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_file text not null,
  chunk_index int not null,
  page_number int,
  content text not null,
  embedding vector(1024) not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.knowledge_chunks enable row level security;
revoke all on public.knowledge_chunks from anon, authenticated;

-- The one narrow, intentional gateway into knowledge_chunks: a
-- SECURITY DEFINER function runs with the privileges of its owner
-- (postgres), so it can read the table even though `authenticated` has no
-- direct grant on it. This lets the chat Edge Function's specialists run
-- RAG lookups through the normal JWT-scoped client (no need to reach for
-- the service-role key on a per-request path) while the raw table/content/
-- embeddings stay fully locked down from direct queries.
create function public.match_knowledge_chunks(
  query_embedding vector(1024),
  match_source text default null,
  match_count int default 5
)
returns table (
  id uuid,
  source text,
  source_file text,
  page_number int,
  content text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    knowledge_chunks.id,
    knowledge_chunks.source,
    knowledge_chunks.source_file,
    knowledge_chunks.page_number,
    knowledge_chunks.content,
    1 - (knowledge_chunks.embedding <=> query_embedding) as similarity
  from knowledge_chunks
  where match_source is null or knowledge_chunks.source = match_source
  order by knowledge_chunks.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_knowledge_chunks(vector(1024), text, int) to authenticated;

-- Replaces lib/mock/progress.ts's static, non-data-grounded `insights`
-- array. Column names match the client `Insight` type exactly
-- (tone/headline/body) so generate-insights's writes need no mapping.
-- Writes are Edge-Function-only (service role) — the client only ever
-- needs to toggle `dismissed`, granted at the column level rather than via
-- a blanket update policy that would also let it rewrite headline/body.
create table public.coach_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tone text not null check (tone in ('positive', 'warning', 'neutral')),
  headline text not null,
  body text not null,
  generated_at timestamptz not null default now(),
  dismissed boolean not null default false
);

create index coach_insights_user_generated_idx on public.coach_insights (user_id, generated_at desc);

alter table public.coach_insights enable row level security;

create policy "coach_insights_select_own" on public.coach_insights for select using (auth.uid() = user_id);
create policy "coach_insights_update_dismissed_own" on public.coach_insights for update using (auth.uid() = user_id);
grant update (dismissed) on public.coach_insights to authenticated;
