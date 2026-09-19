-- Expand activity_log.activity_type's allowed values — the "Aggiungi
-- allenamento non programmato" picker now offers 15 common sports instead
-- of the original 8.
alter table public.activity_log drop constraint if exists activity_log_activity_type_check;
alter table public.activity_log add constraint activity_log_activity_type_check
  check (activity_type in (
    'gym', 'running', 'cycling', 'swimming', 'walking', 'functional', 'tennis',
    'soccer', 'basketball', 'volleyball', 'boxing', 'yoga', 'skiing', 'hiking', 'other'
  ));
