-- Extensions used across the schema: pgcrypto for gen_random_uuid(), vector
-- for the RAG knowledge base embeddings (see 0008_chat_and_agent.sql). Kept
-- in the default `public` schema (not a dedicated `extensions` schema) to
-- avoid search_path friction inside Edge Functions/PostgREST for a local-dev
-- setup like this one.
create extension if not exists pgcrypto;
create extension if not exists vector;
