-- P2 (spec §3.1/§11 Passo 8): tag every stored answers blob with the
-- schema version that collected it, so future questionnaire changes
-- (adding/removing fields) can tell which shape an existing row is in.
alter table public.onboarding_answers
  add column if not exists questionnaire_version int not null default 1;
