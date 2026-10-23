# FITLAB

App di nutrizione e allenamento: dal questionario di onboarding genera dieta e
piano di allenamento coerenti fra loro, poi li ricalibra mese per mese sui
progressi reali. Expo (SDK 57) su iOS, Android e web, con Supabase come
backend.

## Requisiti

- **Node ≥ 22.13** (requisito di Expo SDK 57; il deploy Vercel gira su Node 24.x)
- [Docker](https://docs.docker.com/get-docker/), per lo stack Supabase locale

## Avvio

```bash
npm ci
cp .env.example .env     # poi riempi i valori (vedi sotto)
npm run supabase:start   # stampa API URL e anon key da incollare in .env
npm start                # oppure: npm run web / npm run ios / npm run android
```

`npm run supabase:start` applica le migration in `supabase/migrations/`
(`0001`→`0021`) ed esegue `supabase/seed.sql`. Per ripartire da zero:
`npm run supabase:reset`.

## Variabili d'ambiente

| Variabile | Obbligatoria | Note |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | **sì** | serve anche **a build time** (vedi avvertenza) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **sì** | serve anche **a build time** |
| `EXPO_PUBLIC_VAPID_PUBLIC_KEY` | no | chiave pubblica VAPID per le web push |
| `EXPO_PUBLIC_AI_COACH` | no | `true` accende chat, insight e analisi foto (consuma crediti Claude) |

> **Attenzione:** `src/lib/supabase/client.ts` lancia un errore se la coppia
> URL/anon key manca, e l'export statico pre-renderizza ogni rotta in Node —
> quindi `npx expo export --platform web` **fallisce** senza quelle due
> variabili. Su Vercel devono esistere su *tutti* i target (Production,
> Preview, Development), non solo in Production.

Le Edge Functions hanno un template separato: `supabase/functions/.env.example`
→ copiare in `supabase/.env.local` (`ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`).
`SUPABASE_URL` e le chiavi sono iniettate automaticamente dal runtime locale.

## Struttura

| Percorso | Contenuto |
|---|---|
| `src/app/` | rotte Expo Router (file-based; **non** `app/` nella root) |
| `src/domain/` | funzioni pure: modello energetico, target, motore dei piani, ricalibrazione |
| `src/lib/planning/` | dieta secondo il framework Fit Lab, planner di allenamento |
| `src/components/`, `src/store/`, `src/hooks/` | UI, stato Zustand, hook |
| `supabase/migrations/`, `supabase/functions/` | schema Postgres, Edge Functions Deno |
| `scripts/agent-tests/` | harness di test dei piani generati |

Alias TypeScript: `@/*` → `src/*`, `@/assets/*` → `assets/*`.

## Controlli

```bash
npm run lint         # eslint-config-expo
npx tsc --noEmit     # typecheck
npm run agents:test  # 22 questionari finti + simulazione della ricalibrazione
npx expo-doctor      # coerenza della configurazione Expo
```

`npm run agents:test` riscrive `scripts/agent-tests/reports/latest.md`, che è
tracciato: il contenuto dipende dalla data odierna, quindi genera un diff anche
quando non è cambiato nulla nel codice.

## Deploy web

Vercel builda con `npx expo export --platform web` (configurato in
`vercel.json`) e pubblica `dist/`. I file in `public/` — manifest PWA, service
worker, icone — finiscono nella root dell'export.

Le web push richiedono una configurazione a parte: vedi
[`supabase/PWA_NOTIFICATIONS_SETUP.md`](supabase/PWA_NOTIFICATIONS_SETUP.md).

## Build nativi

`ios` e `android` non sono in repository: sono generati da Continuous Native
Generation. Identificatori già impostati in `app.json`
(`com.fitlab.app` su entrambe le piattaforme). I plugin HealthKit e Health
Connect richiedono un development build, non Expo Go. Per EAS serve prima un
`eas init` (nessun `extra.eas.projectId` è configurato).

## Documentazione

- [`FITLAB_SPEC.md`](FITLAB_SPEC.md) — specifiche tecniche complete
- [`docs/ARCHITECTURE-AGENTS.md`](docs/ARCHITECTURE-AGENTS.md) — dominio dei piani e ciclo mensile
- [`docs/DATA-FLOW.md`](docs/DATA-FLOW.md) — dal questionario all'app
- [`docs/DIET-ENGINE.md`](docs/DIET-ENGINE.md) — motore della dieta
- [`docs/ADMIN.md`](docs/ADMIN.md) — pannello admin
