# Sign in with Apple e Google

Codice: `src/lib/auth/social.ts` (iOS/Android, token nativo → `supabase.auth.signInWithIdToken`),
`src/lib/auth/social.web.ts` (web, redirect OAuth di Supabase), `src/components/auth/social-auth-buttons*.tsx`
(pulsanti in Welcome e Login). Un nuovo account social passa dallo stesso percorso dell'email: consensi, poi questionario.

Senza configurazione i pulsanti restano nascosti: Apple compare solo su iOS (o sul web con
`EXPO_PUBLIC_SOCIAL_LOGIN_WEB=true`), Google solo con i client id impostati.

## Apple

1. developer.apple.com → Identifiers → App ID `com.fitlab.app` → abilita **Sign In with Apple**.
2. Keys → nuova chiave con **Sign In with Apple** → scarica il `.p8` (una sola volta) e annota Key ID e Team ID.
3. Supabase → Authentication → Sign In / Providers → **Apple** → abilita; in *Client IDs* metti `com.fitlab.app`
   (e il Services ID se usi anche il web, punto 5).
4. Segreti per la revoca dei token all'eliminazione dell'account (richiesta da Apple):
   ```
   supabase secrets set APPLE_TEAM_ID=XXXXXXXXXX APPLE_KEY_ID=YYYYYYYYYY APPLE_CLIENT_ID=com.fitlab.app \
     APPLE_PRIVATE_KEY="$(cat AuthKey_YYYYYYYYYY.p8)"
   supabase functions deploy delete-account
   ```
5. Solo per il web: Identifiers → **Services ID** (es. `com.fitlab.web`) con Sign In with Apple, dominio del sito e
   return URL `https://mcsvqsnidtvxmujehspw.supabase.co/auth/v1/callback`; in Supabase inserisci Services ID e
   secret key generata dalla chiave `.p8`.

`app.json` ha già `ios.usesAppleSignIn` e il plugin `expo-apple-authentication`: serve una nuova build EAS.

## Google

1. console.cloud.google.com → progetto → *Google Auth Platform* → schermata di consenso (nome FitLab, email,
   link a privacy e termini).
2. Clients → crea tre client OAuth:
   - **Web**: authorized redirect URI `https://mcsvqsnidtvxmujehspw.supabase.co/auth/v1/callback`.
   - **iOS**: bundle id `com.fitlab.app`.
   - **Android**: package `com.fitlab.app` + SHA-1 del certificato di firma (`eas credentials` lo mostra).
3. Supabase → Providers → **Google** → abilita; Client ID = client Web (più l'iOS id, separati da virgola, in
   *Authorized Client IDs*); Client Secret = quello del client Web. Attiva *Skip nonce checks* (richiesto dal
   flusso nativo iOS).
4. Variabili (in `.env` e nelle env di EAS):
   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<client Web>.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<client iOS>.apps.googleusercontent.com
   ```
   `app.config.js` ricava da qui l'URL scheme iOS del plugin Google: poi nuova build.

## Web

Aggiungi l'origine del sito (es. `https://fitlab.vercel.app`) in Supabase → Authentication → URL Configuration →
Redirect URLs e imposta `EXPO_PUBLIC_SOCIAL_LOGIN_WEB=true` su Vercel.

## Verifica

- iOS: nuovo account con Apple → consensi → questionario; "Nascondi la mia email" deve funzionare.
- Impostazioni → Elimina account con un account Apple: chiede Face ID, poi l'account sparisce anche da
  Impostazioni iPhone → Apple ID → Accedi con Apple.
- Android e iOS: Google con un account nuovo e uno esistente.
