# Pannello admin (fase 1, sola lettura)

Rotte web `/admin` (elenco utenti) e `/admin/user?id=…` (scheda utente: profilo e questionario, dieta e allenamento mese per mese, peso e check-in, storico piani). Nessuna azione di scrittura.

## Sicurezza

- Nessuna policy RLS è stata allentata. Il pannello legge solo tramite due funzioni `SECURITY DEFINER` (`admin_list_users`, `admin_user_detail`) che controllano `is_admin()`: chi non è nella tabella `app_admins` riceve un errore.
- La chiave `service_role` non è mai usata dall'app. `app_admins` non è leggibile né scrivibile dai client.
- La scheda mostra dati di salute: usare solo account e dati di prova.

## Attivazione

1. Applica la migrazione: `npx supabase db push` (file `supabase/migrations/0020_admin.sql`).
2. Rendi admin il tuo account, una volta, dal SQL editor di Supabase:

```sql
insert into public.app_admins (user_id) select id from auth.users where email = 'tua-email@esempio.it';
```

3. Accedi all'app con quell'account e apri `/admin`.

## Prossime fasi

- Laboratorio di test: generare i piani di una persona di prova con il motore corrente e confrontarli con la versione precedente.
- Azioni (rigenera piano, azzera onboarding) solo dopo, sempre tracciate.
