# Attivare Web Push per FitLab

Le impostazioni, il service worker e il dispatcher sono nel repository. La consegna quando FitLab è chiusa si attiva dopo aver configurato il progetto Supabase e la variabile pubblica di Vercel.

1. Applica la migration e distribuisci il dispatcher:

   ```sh
   npx supabase db push
   npx supabase functions deploy dispatch-notifications
   ```

2. Genera una coppia VAPID (`npx web-push generate-vapid-keys`). Mantieni privata la chiave privata. Imposta i segreti Supabase:

   ```sh
   npx supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:assistenza@fitlab-training.vercel.app" NOTIFICATION_CRON_SECRET="<segreto-casuale-lungo>"
   ```

3. In Vercel aggiungi `EXPO_PUBLIC_VAPID_PUBLIC_KEY` con la chiave pubblica VAPID e ridistribuisci FitLab.

4. Nel SQL Editor del progetto Supabase salva URL e segreto nel Vault e pianifica il dispatcher una volta al minuto. Sostituisci i valori prima di eseguire:

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   select vault.create_secret('https://<project-ref>.supabase.co', 'fitlab_project_url');
   select vault.create_secret('<lo-stesso-NOTIFICATION_CRON_SECRET>', 'fitlab_notification_cron_secret');

   select cron.schedule(
     'fitlab-push-every-minute',
     '* * * * *',
     $$
       select net.http_post(
         url := (select decrypted_secret from vault.decrypted_secrets where name = 'fitlab_project_url') || '/functions/v1/dispatch-notifications',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fitlab_notification_cron_secret')
         ),
         body := '{}'::jsonb
       );
     $$
   );
   ```

5. Pubblica il sito, aprilo con Safari su iPhone, aggiungilo alla schermata Home e abilita le notifiche da FitLab. iOS richiede l’installazione nella schermata Home prima di concedere Web Push.

Il dispatcher invia i pasti agli orari configurati, l’allenamento solo nei giorni di seduta del piano, il riepilogo settimanale la domenica alle 19:00 e il promemoria mensile quando termina un mese del piano. Gli orari seguono il fuso del dispositivo.
