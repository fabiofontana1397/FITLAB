# FITLAB — Specifiche tecniche complete

> Documento vivo. Modifica direttamente le sezioni "Box" (Input/Output/Collegamenti) per ridisegnare un flusso: questo file descrive **esattamente** come l'app è costruita oggi (path file, nomi campi, tabelle Postgres reali), non un'interpretazione. Ogni riferimento allo stato attuale è verificato sul codice al 2026-09-18.
>
> **Convenzione**: i blocchi marcati con ⚠️ e le sotto-sezioni "bis"/"ter" (§4.1 bis, §5 bis, §7 bis, §7 ter, §12 bis) e il capitolo §14 documentano le **proposte di redesign** emerse da una revisione critica del documento (simulando i ruoli Backend/Software Architect, Frontend, Personal Trainer, Nutrizionista). Il cambio di paradigma centrale: da un flusso lineare a stima singola (TDEE stimato al giorno 0 → target → piano → tracking, mai più ricalcolato) a un **ciclo adattivo** (stima iniziale → comportamento reale osservato → trend → eventuale nuovo target → nuova versione del piano), con relativo versioning dei piani invece di un blob JSON singolo per utente.
>
> **Stato implementazione (2026-09-19)** — tutti i P0 e la maggior parte dei P1/P2 della guida sono stati applicati al codice reale (non solo documentati): equipment filtering, fallback esercizi allargato, `includedFoods` come vincolo reale, `MealDistributionPolicy` unificata, baseline peso non distruttiva, dispendio energetico Home basato su durata sessione, `dailySteps`/`sleepHoursRange`/`hasDeadline`/`hungerLevel`/`cravings` collegati al calcolo, `plan_versions`/`nutrition_target_history`, **Adaptive Nutrition Engine** (ora come Edge Function `adaptation-evaluate`, non più lato client — vedi §14), validazione rule/constraint dell'output AI in `generate-plan-strategy`, progressione carichi basata su RIR (`lib/planning/progression.ts`), `questionnaire_version`. Restano **proposte non implementate**: normalizzazione completa dello schema piani (`training_plan_days`/`training_exercises`/`training_sets` — oggi solo `plan_versions` come registro sopra al blob jsonb esistente), livello API di dominio completo per il resto della business logic, gerarchia Mesocycle/Microcycle (§7 bis) e progression engine esteso oltre al solo carico, rimozione di campi dal questionario (decisione di prodotto, non presa unilateralmente).

## Indice

0. [Flusso narrativo end-to-end: dal login alla dashboard](#0-flusso-narrativo-end-to-end-dal-login-alla-dashboard)
1. [Architettura generale](#1-architettura-generale)
2. [Autenticazione](#2-autenticazione)
3. [Onboarding / Questionario](#3-onboarding--questionario)
4. [Generazione Piani (AI + planner deterministici)](#4-generazione-piani-ai--planner-deterministici)
5. [Home](#5-home)
6. [Body (progressi corporei)](#6-body-progressi-corporei)
7. [Training](#7-training)
8. [Nutrizione](#8-nutrizione)
9. [Chat AI multi-agente](#9-chat-ai-multi-agente)
10. [Profilo](#10-profilo)
11. [Mappa questionario → utilizzo (tabella master)](#11-mappa-questionario--utilizzo-tabella-master)
12. [Schema Postgres — riepilogo tabelle](#12-schema-postgres--riepilogo-tabelle)
13. [Problemi noti / punti deboli identificati](#13-problemi-noti--punti-deboli-identificati)
14. [API di dominio (proposta)](#14-api-di-dominio-proposta)

---

## 0. Flusso narrativo end-to-end: dal login alla dashboard

> Questo capitolo racconta in prosa lo stesso flusso descritto a tabelle nei capitoli 1-13, seguendo il percorso reale di un utente: dal login fino al momento in cui riapre l'app il giorno dopo e ritrova i suoi dati nei box della Home. Ogni numero calcolato viene tracciato fino alla sua destinazione finale in UI — è la parte più utile per capire "dove va a finire" un dato prima di decidere di cambiarne la logica.

### 0.1 Ingresso in app

Tutto comincia da **Welcome** (`src/app/welcome.tsx`), un semplice bivio: "Accedi" porta a `/login`, "Crea un account" porta a `/register`. Chi si registra fornisce solo `name`, `email`, `password` — Supabase Auth crea l'utente e, tramite un trigger Postgres (`handle_new_user`), crea automaticamente una riga vuota in `profiles` (valori di default: obiettivo "salute generale", 180cm, 78kg target, 2650 kcal — placeholder in attesa del questionario). Se manca ancora una sessione attiva (email da confermare), l'utente vede la schermata "Conferma la tua email" e resta bloccato lì finché non clicca il link ricevuto via Resend. Una volta autenticato, se `hasOnboarded` è ancora `false`, l'app forza il passaggio al questionario — non esiste una Home "vuota" per un utente che non ha ancora risposto.

### 0.2 Il questionario: dalle risposte ai numeri grezzi

Il questionario (`src/app/onboarding.tsx`) comincia sempre con una domanda-bivio: **modalità** = solo dieta, solo allenamento, o entrambe (`mode`). Questa scelta filtra dinamicamente quali step successivi vengono mostrati (`stepsForMode`): chi scegli solo dieta salta interamente gli step Allenamento/Disponibilità/Limitazioni fisiche, chi scegli solo allenamento salta Alimentazione/Preferenze alimentari. Gli step "Profilo fisico", "Obiettivo" e "Attività quotidiana" sono invece sempre presenti, perché alimentano il calcolo del metabolismo che serve **sia** alla dieta **sia** all'allenamento.

Ogni singola risposta viene scritta immediatamente (non solo alla fine) in una tabella Postgres, `onboarding_answers`, come un unico blob JSON — quindi anche se l'utente abbandona il questionario a metà, nulla si perde.

Arrivati all'ultimo step (la schermata di riepilogo), succede la parte più importante: **il questionario da solo non produce ancora un piano**, produce solo un mazzo di risposte grezze. È qui che entra in gioco il motore di calcolo.

### 0.3 Dalle risposte al piano nutrizionale: il calcolo passo per passo

Login → Questionario (modalità + step) → **calcolo del target nutrizionale** sulla base di 7 input precisi: `sex`, `ageRange` (fascia età), `heightCm`, `currentWeightKg`, `goal`, `jobActivity`, e un settimo valore *derivato* — `weeklyTrainingDays`, ottenuto sommando tutte le risposte `freq_<attività>` raccolte nello step Allenamento (vale 0 per chi ha scelto solo dieta). Questo calcolo avviene in un'unica funzione, `computeNutritionTargets()` (`src/lib/nutrition/targets.ts`), eseguita **una sola volta**, nell'istante in cui l'utente preme "Conferma" sulla schermata di riepilogo.

**Passo 1 — Metabolismo basale (BMR).** Si usa la formula di Mifflin-St Jeor:

```
BMR = 10 × peso(kg) + 6.25 × altezza(cm) − 5 × età + s
      s = +5 se sex=male, −161 se sex=female, −78 se non specificato
```

L'età non è quella esatta dichiarata dall'utente (il questionario non la chiede in anni, ma per fascia — es. "25-34"): si usa il punto medio della fascia (`AGE_RANGE_MIDPOINT`, "25-34"→29 anni). Il BMR è quindi già un'approssimazione a partire da questo primo passaggio.

**Passo 2 — Dispendio energetico totale (TDEE).** Il BMR viene moltiplicato per un fattore di attività composto da due parti: il moltiplicatore del lavoro quotidiano (`jobActivity` → da 1.2 per lavoro sedentario a 1.8 per lavoro molto pesante) più un "bump" legato allo sport pari a `min(weeklyTrainingDays, 6) × 0.03`:

```
TDEE = BMR × (jobActivityMultiplier + min(weeklyTrainingDays,6) × 0.03)
```

**Passo 3 — Target calorico giornaliero.** Il TDEE viene scalato in base all'obiettivo dichiarato (`goal`): 0.8× per dimagrimento, 1.12× per aumento massa, 1.05× per forza, 1.0× per gli altri obiettivi (mantenimento, endurance, salute generale):

```
dailyCalorieTarget = round(TDEE × goalCalorieFactor[goal])
```

**Passo 4 — Macronutrienti.** Le proteine **non** derivano dalle calorie ma direttamente dal peso corporeo, con un coefficiente g/kg diverso per obiettivo (da 1.6 g/kg per endurance/salute generale a 2.2 g/kg per dimagrimento — l'idea è preservare massa magra proprio quando le calorie sono più basse). I grassi sono fissati al 25% delle calorie totali del target (÷9 kcal per grammo). I carboidrati assorbono tutto quello che resta:

```
proteinG = round(goalProteinPerKg[goal] × pesoKg)
fatsG    = round(dailyCalorieTarget × 0.25 / 9)
carbsG   = round((dailyCalorieTarget − proteinG×4 − fatsG×9) / 4)
```

**Passo 5 — Idratazione.** `hydrationTargetMl = round(pesoKg × 35 + (giorniAllenamento≥4 ? 350 : 0))`.

**Dove finiscono questi 5 numeri?** `dailyCalorieTarget`, `proteinG`/`carbsG`/`fatsG` e `hydrationTargetMl` vengono passati a `finalizeOnboarding()` dello store `useUserStore`, che li scrive nel profilo strutturato e li sincronizza sulla tabella Postgres **`profiles`** (colonne `daily_calorie_target`, `protein_g`, `carbs_g`, `fats_g`, `hydration_target_ml`). Da questo momento sono il "budget" ufficiale dell'utente — e restano **fissi**, senza ricalcolo automatico, finché non si rifà il questionario da capo (Profilo → "Rifai il questionario").

> **Proposta di redesign — `initial_estimate` vs `current_target`.** Il valore appena calcolato va trattato come una **stima iniziale** (`initial_estimate`), non come un dato "vero": ogni formula predittiva del metabolismo (Mifflin-St Jeor incluso) ha un margine d'errore individuale intrinseco. Il valore realmente operativo giorno per giorno (`current_target`) dovrebbe poter discostarsi da questa stima iniziale una volta che il sistema osserva il comportamento reale dell'utente (peso e intake registrati) — è il ciclo documentato in **§4.1 bis, "Adaptive Nutrition Engine"**. Finché quel motore non è implementato, `current_target === initial_estimate` sempre.

### 0.4 Dal budget al piano vero: cosa genera i pasti e gli allenamenti concreti

Il target calorico appena calcolato è solo un numero — non è ancora "lunedì colazione: 60g di avena e 2 uova". Subito dopo aver salvato il profilo (stesso bottone "Conferma", senza che l'utente se ne accorga: parte in background e non blocca la navigazione), si attiva `generatePlans(answers, {dailyCalorieTarget, macroTargetsG})` nello store `usePlanStore`. Qui la catena si divide in due binari paralleli, uno per la dieta e uno per l'allenamento, entrambi preceduti da un passaggio opzionale attraverso l'intelligenza artificiale:

1. **Livello "metodologia AI"** (`generate-plan-strategy`, Edge Function): riceve tutte le risposte del questionario più il target calorico/macro appena calcolato, consulta due PDF di riferimento (RAG) e la letteratura scientifica online (web search su domini autorevoli come PubMed, ACSM, NSCA), e restituisce **solo decisioni di metodologia** — quale split di allenamento usare, come far evolvere le calorie mese per mese, mai un esercizio o un alimento specifico. Se questa chiamata fallisce o non è configurata, non succede nulla di grave: tutto il resto procede comunque con valori di default hardcoded.
2. **Piano dieta deterministico** (`generateDietPlan`, `src/lib/planning/diet-planner.ts`): prende il `dailyCalorieTarget` calcolato al passo precedente e lo distribuisce sui pasti. Prima stabilisce **quando e quanti pasti** ci sono (`buildMealSlotsFromAnswers`, basato su `breakfastTime`/`lunchTime`/`dinnerTime`/`mealsPerDay`/`snacks`), poi **quali alimenti** possono comparire in ciascun pasto (`buildFoodPools`, basato su `preferredProteins`/`preferredCarbs`/`preferredFats`, `dietaryPattern`, e le esclusioni per `allergies`/`intolerances`/`excludedFoods`), infine assegna a ciascun pasto una quota della calorie giornaliere (`sharePct`: colazione peso 3, pranzo peso 4, cena peso 3.5, spuntini peso 1) e sceglie un alimento reale dal pool corrispondente. Il risultato è un piano di **6 mesi** (durata fissa, indipendente dalle risposte), con un target calorico che nei primi 30 giorni ("fase di adattamento") viene leggermente scostato (±150 kcal secondo l'obiettivo) rispetto al target finale.
3. **Piano allenamento deterministico** (`generateTrainingPlan`, `src/lib/planning/training-planner.ts`): in parallelo, usa `freq_gym`/`freq_running`/`availableDays` per decidere quanti giorni a settimana allenarsi, `trainingLocation` per scegliere il catalogo esercizi (palestra o casa), ed esclude qualsiasi esercizio che tocchi una zona del corpo segnalata come dolorosa/infortunata nelle domande di "Limitazioni fisiche" — solo se il relativo flag sì/no è "sì".

Entrambi i piani (`dietPlan`, `trainingPlan`) vengono salvati come blocco JSON intero nelle tabelle Postgres `diet_plans`/`training_plans`, e sono ciò che le schermate `/diet-plan` e `/training-plan` mostrano mese per mese, giorno per giorno.

### 0.5 Dove finiscono questi dati nell'app: la Home

La Home (`src/app/(tabs)/index.tsx`) è il punto dove **tutti** i numeri calcolati finora tornano a galla, ricombinati in tempo reale. È importante distinguere due concetti che nell'app sono separati, anche se collegati:

- **Il budget calorico "ufficiale"** (`dailyCalorieTarget`, calcolato una volta in onboarding, §0.3) è il denominatore dell'anello **dieta** nel box "Riepilogo di oggi": `dietProgress = calorie mangiate oggi ÷ calorieTarget` (dove `calorieTarget` è, se disponibile, quello del mese corrente del piano dieta generato, altrimenti il fallback del profilo). Questo anello misura quindi **quanto hai mangiato rispetto al budget**, non le calorie bruciate.
- **Il metabolismo basale "live"** non è lo stesso calcolo salvato in onboarding: la Home lo **ricalcola ogni volta che apri l'app**, usando la stessa formula di Mifflin-St Jeor ma con il **peso più recente** registrato in Body (non quello dichiarato in onboarding, che potrebbe essere ormai vecchio di settimane). Questo secondo calcolo (`estimateDailyBurnedKcal`, in `src/lib/nutrition/targets.ts`) alimenta un box diverso — la card "Calorie bruciate e assunte" — non l'anello dieta:

```
dispendioEnergeticoStimatoOggi = BMR_live(sesso, età, altezza, peso_più_recente) × jobActivityMultiplier
                 + bonus(+18% del BMR se l'allenamento del giorno è stato completato al 100%)
bilancioStimatoOggi            = dispendioEnergeticoStimatoOggi − caloriemangiateOggi
```

> ⚠️ **Proposta di redesign — è una stima, non una misura.** Il nome storico `burnedKcalOggi` va sostituito concettualmente con **"dispendio energetico stimato"**: non deriva da una misurazione reale del dispendio energetico, ed è importante che né il codice né la UI lo presentino come tale. Il problema più concreto segnalato in revisione non è solo terminologico: il **bonus fisso "+18% del BMR se il workout è completato al 100%"** è un proxy troppo grossolano — una sessione da 35 minuti e una da 90 minuti producono oggi lo stesso identico bonus. La struttura proposta in sostituzione, scomposta in tre componenti invece di un unico bonus binario, è descritta in **§5 bis**.

Riprendendo l'esempio della richiesta originale: l'"anello calorie" che l'utente vede nel riepilogo **non** somma esplicitamente le calorie bruciate dagli allenamenti al metabolismo basale — quel calcolo esiste davvero, ma alimenta la card sottostante del bilancio energetico settimanale, non l'anello di sintesi. Oltre al problema del bonus grossolano, c'è un problema di **fonte di verità**: oggi calorie target, TDEE e bilancio vengono ricalcolati in punti diversi dell'app (Home, chat AI, piano) con logiche leggermente diverse tra loro. Il denominatore dell'anello dieta e il calcolo del dispendio stimato devono condividere la **stessa** funzione di stima — non restare due calcoli paralleli come oggi — vedi §5 bis per il modello proposto.

Gli altri due anelli seguono la stessa logica di "richiamare dati calcolati altrove": l'anello **allenamento** = frazione di esercizi completati oggi rispetto al piano generato (`useTrainingProgressStore`), l'anello **passi** è sempre a zero perché non esiste ancora una vera funzionalità di step-tracking (`stepsHistory` è un array statico vuoto, §13.1) — un terzo del riepilogo "di sintesi" è quindi oggi un placeholder permanentemente vuoto.

La card sottostante, "Calorie bruciate e assunte", replica lo stesso calcolo `burnedKcalOggi` per ciascun giorno della settimana calendariale corrente, con un accorgimento voluto: i giorni **precedenti alla data di creazione dell'account** (`accountStartDate`, fissata al primo peso registrato in onboarding) vengono forzati a zero invece di mostrare una stima di calorie bruciate per giorni in cui l'utente non usava ancora l'app — altrimenti un account appena creato mostrerebbe una settimana di attività fittizia.

### 0.6 Il ciclo quotidiano: come l'utente "rialimenta" i propri dati

Da qui in avanti l'app entra in un ciclo continuo: l'utente **logga** un pasto (Nutrizione → cerca alimento → salva grammi) o **logga** un allenamento (Training → segna esercizio completato / registra un carico). Ogni logging scrive immediatamente su Postgres (`meal_entries` per i pasti, `exercise_sets`/`exercise_completions` per gli allenamenti) e, essendo lo stesso store zustand condiviso da Home/Training/Nutrizione, **aggiorna istantaneamente** tutti gli anelli e i grafici che dipendono da quel dato, senza bisogno di un refresh esplicito: loggare la colazione fa muovere subito l'anello dieta in Home, completare un esercizio fa muovere subito l'anello allenamento e — perché il bonus del +18% dipende dal completamento al 100% del giorno — anche la stima di calorie bruciate nella card sottostante.

### 0.7 La chat AI: come "vede" gli stessi numeri

Quando l'utente apre la chat e fa una domanda, l'orchestratore (Claude Sonnet) decide quali specialisti consultare. Due di questi tre specialisti (allenamento, nutrizione) **non interrogano Postgres direttamente**: ricevono uno snapshot già calcolato lato client (`buildClientContext()`) — le stesse cifre di "oggi" che l'utente vede in Home (calorie mangiate/target, piano del giorno, aderenza 14 giorni). Il terzo specialista, quello sul progresso corporeo, è l'unico che interroga davvero il database in tempo reale (`profiles` + `body_metrics`), calcolando i delta a 30 giorni di peso/girovita/massa grassa. In tutti i casi, il modello ha un'istruzione esplicita a non inventare un dato che non gli è stato fornito: se una domanda riguarda una metrica non tracciata (es. i passi, sempre a zero), l'agente deve dirlo onestamente invece di stimarla.

---

## 1. Architettura generale

```
Expo Router app (iOS + Android + Web, un solo codebase)
  src/app/            → schermate (file-based routing)
  src/store/          → zustand store (stato locale, persist su AsyncStorage)
  src/lib/api/        → repository: store ↔ Postgres (mapping camelCase↔snake_case)
  src/lib/planning/   → planner deterministici (training + dieta)
  src/lib/questionnaire/ → schema domande onboarding
  src/lib/nutrition/  → calcolo target calorici/macro (Mifflin-St Jeor)
  src/lib/assistant/  → contesto client per la chat AI

Supabase Cloud
  Postgres + RLS (ogni tabella utente: user_id → auth.uid())
  Storage (bucket privato progress-photos)
  Auth (GoTrue, email/password, reset/verifica via email SMTP Resend)
  Edge Functions (Deno):
    generate-plan-strategy → AI "metodologa" (Claude Sonnet + web search + RAG)
    generate-insights       → coach insight Home (Claude, dati reali)
    analyze-photo           → Claude Vision on-demand su foto progressi
    chat                    → orchestrator multi-agente (Sonnet + 3 specialisti Haiku)
```

**Principio architetturale cardine, valido ovunque nell'app**: l'AI **non genera mai** dati concreti che finiscono direttamente in UI/DB senza passare da codice deterministico con catalogo chiuso (esercizi, alimenti). L'AI decide solo *metodologia* (split, scheda serie/ripetizioni, target calorici mensili, testi motivazionali) — la selezione di esercizi/alimenti reali resta sempre in `src/lib/planning/*.ts`, pescando da cataloghi statici (`exercise-library.ts`, `food-database.ts`). Se la chiamata AI fallisce o non è configurata, tutto il codice ha un fallback deterministico e non blocca mai l'utente. **Questo principio è già corretto e va mantenuto** in ogni evoluzione futura.

> ⚠️ **Rischio architetturale segnalato in revisione — business logic sul client.** Buona parte della business logic (`src/lib/nutrition`, `src/lib/planning`) risiede oggi nel client (Expo app), non dietro un'API di dominio. Rischio esplicito: piattaforme diverse (iOS, Web, un futuro Android) possono calcolare lo stesso concetto — TDEE, target calorico, split — con logiche leggermente diverse se non condividono esattamente lo stesso codice. Direzione di livellamento target:
>
> ```
> Frontend → API → Domain services → Calculation engine → DB
> ```
>
> Il frontend dovrebbe principalmente raccogliere, mostrare, interagire, mettere in cache — non decidere il TDEE ufficiale. Elenco degli endpoint concettuali proposti in **§14 — API di dominio (proposta)**.

---

## 2. Autenticazione

| Schermata | File | Input utente | Output |
|---|---|---|---|
| Welcome | `src/app/welcome.tsx` | — | naviga a `/login` o `/register` |
| Login | `src/app/login.tsx` | `email`, `password` | `useAuthStore.login()` → Supabase `signInWithPassword`; redirect a `/` (se `hasOnboarded`) o `/onboarding` |
| Registrazione | `src/app/register.tsx` | `name`, `email`, `password` (validazione: email contiene `@`, password ≥6 char) | `useAuthStore.register()` → Supabase `signUp({email,password,options:{data:{name}, emailRedirectTo}})`; se manca sessione → schermata "Conferma la tua email"; altrimenti `updateProfile({name})` + `/onboarding` |
| Password dimenticata | `src/app/forgot-password.tsx` | `email` | `requestPasswordReset()` → `resetPasswordForEmail`; messaggio di successo identico indipendentemente dall'esistenza dell'account (privacy by design) |
| Reset password | `src/app/reset-password.tsx` | `password`, `confirmPassword` (≥6 char, uguali) | `updatePassword()` → `auth.updateUser({password})`; raggiungibile solo da link email di recovery |

**Store**: `src/store/auth-store.ts` — nessun `persist` (la sessione è già persistita da supabase-js). Azioni: `register`, `login`, `logout`, `requestPasswordReset`, `updatePassword`. Errori GoTrue tradotti in italiano via `ERROR_TRANSLATIONS`. `initAuthListener()` (avviato in `_layout.tsx`) mantiene lo store sincronizzato con `onAuthStateChange`.

**Deep link email** (`src/hooks/use-handle-auth-redirect.ts`): legge `window.location.hash` (token GoTrue), chiama `setSession`; se `type==='recovery'` → redirect a `/reset-password`. Solo web per ora — deep link nativi non cablati.

**Trigger server**: alla `signUp`, il trigger Postgres `handle_new_user()` crea automaticamente la riga `profiles` (con `name` da `raw_user_meta_data`).

---

## 3. Onboarding / Questionario

### 3.1 Flusso schermate

| Schermata | File | Scopo |
|---|---|---|
| Questionario | `src/app/onboarding.tsx` | Multi-step in un solo file; step dinamici in base a `mode` |
| Celebrazione | `src/app/onboarding-created.tsx` | Solo animazione, nessun dato |
| Roadmap + generazione | `src/app/onboarding-roadmap.tsx` | Attende fine generazione piani, mostra `GeneratingPlanView`, poi va a `/` |

**Step 0 — scelta modalità**: `mode` = `diet` \| `training` \| `both` → `stepsForMode(mode)` filtra gli step successivi (`src/lib/questionnaire/schema.ts`).

**Persistenza per-risposta**: ogni `setAnswer(id, value)` (in `src/store/onboarding-store.ts`) scrive subito, fire-and-forget, su Postgres `onboarding_answers.answers` (colonna `jsonb`, upsert `onConflict:'user_id'`) — non aspetta la fine del questionario.

> ⚠️ **Proposta — versioning del questionario.** Aggiungere un campo `questionnaire_version`, scritto insieme a `onboarding_answers.answers`, per distinguere con quale versione dello schema domande sono state raccolte le risposte — necessario quando si aggiungono/rimuovono campi come deciso in §3.2/§11.

### 3.2 Elenco completo domande — `src/lib/questionnaire/schema.ts`

> ✏️ **Modifica qui** per cambiare/aggiungere/rimuovere una domanda. Ricorda di aggiornare anche la sezione [11 — Mappa questionario → utilizzo] se cambi cosa consuma il campo.
>
> ⚠️ **Classificazione proposta**: molti campi elencati qui sotto sono oggi "raccolti ma non usati" (marcati `[inutilizzato]` in §11). La revisione propone di classificarli in tre categorie invece di lasciarli genericamente inutilizzati — **Keep+Use** (da collegare a un calcolo reale), **Keep-no-algoritmo** (utili solo a profilo/coach, mai a un calcolo), **Rimuovere candidato** (nessuna funzione prevista, aumentano solo il friction cost del questionario). Classificazione campo per campo in §11.

**Step `physical` — "Profilo fisico"** (sempre mostrato)
| id | tipo | opzioni/vincoli | obbligatoria |
|---|---|---|---|
| `ageRange` | single | `lt18,18-24,25-34,35-44,45-54,55+` | sì |
| `sex` | single | `male,female,unspecified` | sì |
| `heightCm` | number (cm) | — | sì |
| `currentWeightKg` | number (kg) | — | sì |
| `targetWeightKg` | number (kg) | — | sì |
| `neckCm`,`chestCm`,`waistCm`,`hipsCm`,`armCm`,`thighCm` | number (cm) | — | no |

**Step `goal` — "Obiettivo"** (sempre)
| id | tipo | opzioni | obbligatoria |
|---|---|---|---|
| `goal` | single | `loseFat,gainMuscle,maintainImprove,gainStrength,improveEndurance,generalHealth` | sì |
| `hasDeadline` | single | `no,yes` | sì |
| `deadlineDate` | text | `gg/mm/aaaa` | no |
| `successWeightKg` | number (kg) | — | no |

**Step `daily` — "Attività quotidiana"** (sempre)
| id | tipo | opzioni | obbligatoria |
|---|---|---|---|
| `jobActivity` | single | `sedentary,seatedMobile,standing,active,veryHeavy` | sì |
| `dailySteps` | single | `lt3000,3000-5000,5000-8000,8000-12000,gt12000,unknown` | sì |
| `sleepHoursRange` | single | `lt5,5-6,6-7,7-8,gt8` | sì |
| `sleepQuality` | scale 1-5 | — | sì |

**Step `eatingHabits` — "Alimentazione"** (se `mode ≠ training`)
| id | tipo | opzioni | obbligatoria |
|---|---|---|---|
| `dietHistory` | single | `never,occasionally,months,years` | sì |
| `mealsPerDay` | single | `2,3,4,5,6+` | sì |
| `breakfastTime` | text | placeholder `07:30` | sì |
| `lunchTime` | text | placeholder `13:00` | sì |
| `dinnerTime` | text | placeholder `20:00` | sì |
| `snacks` | single | `no,morning,afternoon,evening,multiple` | sì |
| `eatingOut` | single | `rarely,1-2week,3-5week,daily` | sì |

**Step `preferences` — "Preferenze alimentari"** (se `mode ≠ training`)
| id | tipo | opzioni | dipende da | obbligatoria |
|---|---|---|---|---|
| `dietaryPattern` | single | `none,vegetarian,vegan,pescetarian,mediterranean,lowCarb,other` | — | sì |
| `dietaryPatternOther` | text | — | `dietaryPattern=other` | no |
| `allergies` | text | — | — | no |
| `intolerances` | text | — | — | no |
| `excludedFoods` | longtext | — | — | no |
| `includedFoods` | longtext | — | — | no |
| `preferredProteins`(+`Other`) | multi | `chicken,turkey,beef,eggs,fish,legumes,dairy,yogurt,proteinPowder,tofu,other` | — | sì |
| `preferredCarbs`(+`Other`) | multi | `rice,pasta,potatoes,bread,oats,cereals,legumes,fruit,other` | — | sì |
| `preferredFats`(+`Other`) | multi | `oliveOil,nuts,avocado,eggs,fattyFish,butter,other` | — | sì |
| `hungerLevel` | single | `rarely,little,moderate,much,constant` | — | sì |
| `cravings` | scale 1-5 | — | — | sì |
| `coffeeIntake` | single | `0,1,2,3,4+` | — | sì |
| `alcoholIntake` | single | `never,occasionally,1-2week,3+week` | — | sì |
| `supplements`(+`Other`) | multi | `protein,creatine,omega3,vitaminD,multivitamin,magnesium,electrolytes,preworkout,none,other` | — | sì |

**Step `training` — "Allenamento"** (se `mode ≠ diet`)
| id | tipo | opzioni | obbligatoria |
|---|---|---|---|
| `activitiesPracticed` | multi | `gym,running,cycling,swimming,tennis,functional,calcio,artiMarziali,camminata,escursionismo,altro` | sì |

Per **ogni** attività selezionata, generate a runtime (`buildActivityQuestions`, non nello schema statico):
- `freq_<activity>` (single: `1,2,3,4,5,6+`)
- solo per `gym`/`running`: `focus_gym` (`strength,hypertrophy,fatLoss,muscularEndurance,technique`), `focus_running` (`endurance,speed,raceTime,fatLoss,raceReady`)

**Step `availability` — "Disponibilità"** (se `mode ≠ diet`)
| id | tipo | opzioni | dipende da |
|---|---|---|---|
| `availableDays` | single | `1,2,3,4,5,6+,variable` | — |
| `sessionDuration` | single | `lt30,30-45,45-60,60-90,gt90` | — |
| `trainingLocation` | single | `gym,home,outdoor,mixed` | — |
| `equipment` | multi | `none,dumbbells,barbell,rack,bench,machines,cables,kettlebell,bands,cardioMachine,other` | mostrata solo se `trainingLocation=home` |

**Step `limitations` — "Limitazioni fisiche"** (se `mode ≠ diet`, con banner di warning medico)
| id | tipo | opzioni |
|---|---|---|
| `hasPain` | single | `no,yes` |
| `painDetails` | longtext | — (mostrata solo se `hasPain=yes`) |
| `cannotDoExercises` | single | `no,yes` |
| `cannotDoDetails` | longtext | — |
| `recentInjuries` | single | `no,yes` |
| `recentInjuriesDetails` | longtext | — |

### 3.3 Schermata risultati (ultimo step di `onboarding.tsx`)

Calcola `computeNutritionTargets(...)` (§4.1) e mostra: Obiettivo, Peso attuale→target, Altezza, Età·Sesso; se dieta attiva: pattern alimentare, pasti/giorno, allergie/intolleranze; se training attivo: attività+frequenza, giorni disponibili, durata sessione, luogo.

**Bottone "Conferma" (`confirmProfile`)**:
1. `finalizeOnboarding({goal, sports, sex, ageRange, heightCm, targetWeightKg, dailyCalorieTarget, macroTargetsG, hydrationTargetMl})` → `useUserStore` → upsert `profiles`.
2. `resetStartingWeight(currentWeightKg, oggi)` → `useBodyStore` → ⚠️ **comportamento attuale**: sovrascrive tutta la tabella `body_metrics` con un solo entry (fissa `accountStartDate`, vedi §5). **Comportamento proposto**: crea una nuova riga marcata come **baseline** (`is_baseline = true`), senza cancellare le righe precedenti — `accountStartDate` deriverebbe dalla riga baseline più recente, non dalla prima riga in assoluto. Dettagli in §6 e §12.
3. `generatePlans(answers, targets)` **fire-and-forget** su `usePlanStore` → innesca §4. > **Needs Review**: da fire-and-forget + persistenza best-effort, a job di generazione con stato tracciato e versione atomica del piano (§4.5, §12 bis).
4. Naviga a `/onboarding-created`.

**Roadmap (`onboarding-roadmap.tsx`)**: il bottone finale attende (`isGenerating===false`) che la generazione piani sia completata prima di segnare `hasOnboarded=true` e andare alla dashboard — mostra `GeneratingPlanView` (messaggi rotanti) nel frattempo.

### 3.4 Solo alcuni campi vengono "promossi" al profilo strutturato

Dei 45+ campi del questionario, solo questi finiscono nella tabella `profiles`/`user-store` (il resto resta **esclusivamente** nel blob `onboarding_answers.answers`, letto poi direttamente dai planner): `goal, sex, ageRange, heightCm, targetWeightKg, dailyCalorieTarget, macroTargetsG(protein/carbs/fats), hydrationTargetMl, sports`.

---

## 4. Generazione Piani (AI + planner deterministici)

### 4.1 Calcolo target nutrizionali — `src/lib/nutrition/targets.ts` → `computeNutritionTargets()`

Input: `sex, ageRange, heightCm, currentWeightKg, goal, jobActivity, weeklyTrainingDays` (= somma di tutti i `freq_*`).

> ⚠️ **Stima iniziale, non valore definitivo.** L'output di questa funzione (`dailyCalorieTarget`, `macroTargetsG`) va considerato una **stima iniziale** (`initial_estimate`), non un valore "vero": ogni equazione predittiva del metabolismo (Mifflin-St Jeor incluso) ha un errore individuale intrinseco. Il valore operativo effettivo (`current_target`) può discostarsene dopo la fase di adattamento — vedi **§4.1 bis**.

1. `bmr` = Mifflin-St Jeor (`10·peso + 6.25·altezza − 5·età` ±5/−161/−78 in base a `sex`)
   > **Limite noto**: `età` non è quella reale ma il punto medio della fascia scelta nel questionario (`AGE_RANGE_MIDPOINT`, es. "25-34"→29 anni). Due opzioni alternative da valutare: (a) chiedere l'età esatta (`age` o `birthYear`/`birthDate`) invece della fascia; (b) mantenere la fascia ma etichettare esplicitamente il valore come stima (`ageEstimateMethod = "midpoint"`).
2. `tdee = bmr × (JOB_ACTIVITY_MULTIPLIER[jobActivity] + min(weeklyTrainingDays,6)×0.03)`
   > **Limite noto**: il coefficiente euristico `jobActivityMultiplier + trainingDays×0.03` non usa `dailySteps` (raccolto nel questionario ma oggi non collegato a nulla — vedi §11/§13 punto 4) né una vera scomposizione cardio/NEAT. Direzione di miglioramento: scomporre il TDEE in `RMR + NEAT + TEF + exercise expenditure` quando possibile; per l'MVP, `TDEE_initial = RMR × activity_factor` resta il punto di partenza, affiancato da un `TDEE_estimated` calcolato progressivamente (§4.1 bis).
3. `dailyCalorieTarget = round(tdee × GOAL_CALORIE_FACTOR[goal])` — `loseFat 0.8, gainMuscle 1.12, maintainImprove/improveEndurance/generalHealth 1.0, gainStrength 1.05`
   > **Limite noto**: il fattore fisso per obiettivo non considera peso attuale, peso target, scadenza (`hasDeadline`/`deadlineDate`), esperienza o aderenza storica. I campi `hasDeadline`, `deadlineDate`, `successWeightKg` sono già raccolti (§3.2, §11) ma non influenzano il piano — collegarli è oggetto di §11 punto "Passo 8".
4. Macronutrienti — **da valore esatto a range** (vedi tabella sotto)
5. `hydrationTargetMl = round(pesoKg×35 + (giorniAllenamento≥4 ? 350 : 0))`

**Macronutrienti: da formula a range.** Proteine/grassi/carboidrati erano finora calcolati come valori esatti da un'unica formula — troppo rigido: la letteratura raccomanda intervalli, non punti singoli, e un margine di scelta permette al planner di adattare la composizione pasto per pasto senza violare il target.

| Macro | Logica attuale (formula unica) | Logica proposta (range) |
|---|---|---|
| Proteine | `proteinG = round(GOAL_PROTEIN_PER_KG[goal] × pesoKg)` — valore esatto g/kg (`loseFat 2.2, gainMuscle/gainStrength 2.0, maintainImprove 1.8, improveEndurance/generalHealth 1.6`) | range g/kg (es. 1.6–2.2 secondo obiettivo); il planner (`diet-planner.ts`) sceglie un punto nel range in base alla composizione pasto-per-pasto |
| Grassi | `fatsG = round(dailyCalorieTarget × 0.25 / 9)` — 25% fisso delle calorie | soglia minima (es. non sotto il 20% delle calorie totali), non percentuale rigida |
| Carboidrati | `carbsG = max(round((dailyCalorieTarget − proteinG×4 − fatsG×9)/4), 0)` — quota residua esatta | quota residua calcolata **entro** il range risultante da proteine/grassi, non un unico valore fisso |

Calcolato oggi **una sola volta** in onboarding; non si ricalcola mai automaticamente dopo (resta fisso finché non si rifà il questionario) — comportamento che l'Adaptive Nutrition Engine proposto di seguito supera.

### 4.1 bis — Adaptive Nutrition Engine (proposto)

> Sezione proposta, non ancora implementata. Documenta il cambio di paradigma centrale della revisione: da un flusso lineare a stima singola (TDEE stimato al giorno 0 → target calorico → piano → tracking) a un **ciclo adattivo** che corregge il target nel tempo usando il comportamento reale osservato.

**Il ciclo:**

```
Profilo iniziale
  → Stima iniziale RMR/TDEE (§4.1, initial_estimate)
  → Piano nutrizionale (§4.4)
  → Food Tracking (meal_entries) ────┐
                                       ├──→ Data Quality Check
  → Weight Tracking (body_metrics) ──┘
  → Trend Engine (finestre mobili 7 / 14 / 21 giorni su peso e intake)
  → Adaptation Decision Engine
  → Nessuna modifica  ── oppure ──  Nuovo target (current_target)
  → Nuova versione del piano (vedi §4.5/§12 — plan_versions)
```

**Logica decisionale (pseudocodice), con isteresi esplicita** per evitare di correggere il piano per ogni piccola oscillazione del peso:

```
if data_quality < soglia:
    NESSUNA MODIFICA
elif weight_trend nel range target:
    NESSUNA MODIFICA
elif loss_rate < limite_inferiore:
    RIDUCI_TARGET (piccolo passo)
elif loss_rate > limite_superiore:
    AUMENTA_TARGET (piccolo passo)
else:
    NESSUNA MODIFICA
```

Ogni volta che questa logica produce un nuovo target, il risultato **non sovrascrive** `nutrition_targets` in place: crea una nuova riga in `plan_versions` (`trigger = 'adaptation'`) — è ciò che rende interrogabile lo storico delle correzioni nel tempo (§4.5/§12).

### 4.2 Livello "metodologia AI" — Edge Function `generate-plan-strategy`

**Client**: `src/lib/api/plan-strategy.ts::fetchPlanStrategy()` — ritorna sempre `null` su qualsiasi errore, non blocca mai.

**Edge Function** (`supabase/functions/generate-plan-strategy/index.ts`):
1. RAG: query `"${goal} ${activitiesPracticed} ${focus_gym} ${dietaryPattern}"` → `training_guide` + `nutrition_guide` in parallelo.
2. Claude Sonnet con `web_search` (allowlist: examine.com, pubmed.ncbi.nlm.nih.gov, ncbi.nlm.nih.gov, nih.gov, who.int, acsm.org, nsca.com, issn.net, eatright.org, strongerbyscience.com) + `output_config` JSON-schema garantito.
3. **Campi del questionario effettivamente inclusi nel prompt** (`buildProfileSummary`): `goal, activitiesPracticed, focus_gym, focus_running, availableDays, sessionDuration, freq_gym, freq_running, trainingLocation`, **limitazioni fisiche** (`hasPain/painDetails, cannotDoExercises/cannotDoDetails, recentInjuries/recentInjuriesDetails`, solo se il flag è "sì" — sezione "vincolante"), `dietaryPattern, mealsPerDay, breakfastTime, lunchTime, dinnerTime, snacks`, **vincoli alimentari** (`allergies, intolerances, excludedFoods, includedFoods`, sezione "vincolante"), `dailyCalorieTarget, macroTargetsG, durationMonths`.
4. **Campi NON inclusi** nel prompt (raccolti ma ignorati da questo step): `ageRange, sex, heightCm, currentWeightKg`, misure corporee, `hasDeadline/deadlineDate/successWeightKg, jobActivity, dailySteps, sleepHoursRange, sleepQuality, dietHistory, eatingOut, dietaryPatternOther, preferredProteins/Carbs/Fats(+Other), hungerLevel, cravings, coffeeIntake, alcoholIntake, supplements, equipment, freq_<altre attività>, focus_<altre attività>`.

**Output** (`STRATEGY_SCHEMA`): `{ training: {splitLabels[], gymScheme, runSessions, monthlyFocus[], rationale} | null, diet: {monthlyTargets[], monthlyFocus[], rationale} | null }`. **Non contiene mai** esercizi o alimenti concreti — solo decisioni di metodologia.

> ⚠️ **Proposta di redesign — validazione dell'output AI.** Oggi non c'è alcuna validazione esplicita dell'output oltre alla conformità al JSON-schema. Il principio architetturale "mai AI → DB direttamente" è già corretto, ma va esteso con una pipeline di validazione di regole e vincoli, non solo di forma:
>
> ```
> AI → Structured recommendation → Rule validation → Constraint validation → Deterministic planner → Output
> ```
>
> Questo livellamento è anche il prerequisito che rende praticabili in modo sicuro l'Adaptive Engine (§4.1 bis) e il versioning (§12 bis): `algorithm_version` e `input_snapshot_id` in `plan_versions` presuppongono servizi di dominio espliciti, non logica incorporata nei singoli store client.

### 4.3 Planner Training — `src/lib/planning/training-planner.ts::generateTrainingPlan({answers, strategy})`

`durationMonths` sempre **6** (`plan-duration.ts`, valore fisso condiviso con la dieta). Se né `gym` né `running` in `activitiesPracticed` → `null`.

| Box logico | Input | Output/effetto |
|---|---|---|
| Giorni allenamento | `freq_gym`, `freq_running`, `availableDays` | `gymDays`/`runDays` ribilanciati proporzionalmente se la somma eccede il disponibile |
| Pool esercizi | `trainingLocation` (`home`→`HOME_EXERCISES`, altro→`GYM_EXERCISES`) | catalogo sorgente per `selectExercises` |
| Esclusioni | `hasPain`+`painDetails`, `cannotDoExercises`+`cannotDoDetails`, `recentInjuries`+`recentInjuriesDetails` | ⚠️ **comportamento attuale**: `deriveExerciseExclusions()` (`exercise-constraints.ts`) → match keyword aree corpo (`knee,shoulder,lowerBack,wrist,hip`) o testo libero → `selectExercises()` scarta esercizi che matchano, **fallback finale = Plank**. **Proposta**: eliminare il fallback rigido — il matching per keyword è fragile e proporre automaticamente un esercizio generico quando nessun esercizio compatibile viene trovato è un rischio di sicurezza, non solo un limite tecnico. In sostituzione: stato di `manual_review`/`regenerate` esplicito, e a regime un *exercise substitution engine* basato su `movement_pattern`, `muscle_group`, `equipment`, `skill_level`, `joint_constraints` (vedi nota equipment sotto). |
| N. esercizi/sessione | `sessionDuration` | `exerciseCountForDuration()`: `lt30→3, 30-45→4, 45-60→5, 60-90→6, gt90→6` |
| Split | `strategy.training.splitLabels` (se validi) altrimenti `SPLIT_BY_FREQUENCY[gymDays]` | es. 3gg→Push/Pull/Legs — ⚠️ **proposta**: questo fallback frequenza→split non dovrebbe essere una regola universale; la nuova logica proposta è `esperienza + frequenza + obiettivo + giorni disponibili + vincoli esercizi → split` (dettagli in §7 bis/§7 ter) |
| Scheda serie/rip | `strategy.training.gymScheme` altrimenti `FOCUS_SCHEME[focus_gym]` | sets/reps/restSec/tempo per fase (adattamento/progressione/consolidamento) |
| Sessioni corsa | `strategy.training.runSessions` altrimenti `RUNNING_SESSIONS[focus_running]` | testo sessione per fase |
| Carico consigliato | `currentWeightKg` | ⚠️ **comportamento attuale**: `suggestedLoadFor = peso × bwMultiplier × (0.85 se adattamento)` — non è un proxy affidabile per squat/bench/row/curl, che hanno rapporti carico/peso corporeo molto diversi tra loro. **Proposta**: il carico iniziale deve derivare da esperienza dell'utente + esercizio + performance storica + eventuale 1RM stimato + target RIR; il carico nelle sessioni successive deve derivare da performance precedente + reps ottenute + RIR + regola di progressione (§7 ter) |

**Correzione richiesta (non solo nota "non usato"): `equipment`.** Oggi è raccolto nel questionario ma non filtra il pool `HOME_EXERCISES` — questo non è solo un miglioramento architetturale, è la correzione di un **bug funzionale**: un utente che dichiara solo manubri a casa non deve mai ricevere un esercizio con bilanciere. Schema metadati esercizio proposto per risolverlo:

```json
{
  "movementPattern": "horizontal_push",
  "primaryMuscles": ["chest"],
  "secondaryMuscles": ["triceps"],
  "equipment": ["dumbbells", "barbell"],
  "location": ["gym", "home"],
  "skillLevel": ["beginner", "intermediate"],
  "contraindications": [],
  "substitutableGroup": "horizontal_push"
}
```

`freq_<attività non gym/running>` continua a non influenzare il piano (solo il TDEE, per design — non è un problema da correggere).

### 4.4 Planner Dieta

**`src/lib/planning/meal-slots.ts::buildMealSlotsFromAnswers(answers)`**
| Input | Effetto |
|---|---|
| `breakfastTime`/`lunchTime`/`dinnerTime` | regex `^([01]?\d\|2[0-3]):([0-5]\d)$`; se non valido → fallback `07:30`/`13:00`/`20:00` (**qui**, non nel campo UI, avviene la validazione) |
| `mealsPerDay` | `'2'` → esclude colazione (digiuno 16:8); altrimenti n. totale slot desiderati |
| `snacks` | `morning/afternoon/evening/multiple/no` → quali slot spuntino attivare; completati con `fallbackOrder` se `mealsPerDay` richiede più slot |
| — | `sharePct` per slot: colazione 3, pranzo 4, cena 3.5, spuntini 1 ciascuno → quota calorica del pasto |

**`src/lib/planning/food-pools.ts::buildFoodPools(answers)`**
| Input | Effetto |
|---|---|
| `preferredProteins`/`preferredCarbs`/`preferredFats` | mappati su id `FOOD_DATABASE` (fallback pool di default se vuoto) |
| `dietaryPattern` | `vegan` esclude carne+pesce+derivati animali; `vegetarian` esclude carne+pesce; `pescetarian` esclude solo carne |
| `allergies`+`intolerances`+`excludedFoods` | `deriveExcludedFoodIds()` → match contro `ALLERGEN_GROUPS` (glutine, lattosio, uova, frutta secca, pesce, soia) **e** contro i nomi diretti in `FOOD_DATABASE` (es. "manzo" esclude `beef-lean`) |
| — | `proteinFor(mealType)`/`carbsFor(mealType)` restringe il pool per tipo pasto (`breakfast/main/snack`) |

**Correzione richiesta (non solo nota "non usato"): `includedFoods`.** Oggi è incluso nel prompt AI (§4.2) ma **non** nel planner deterministico — non influenza concretamente quali alimenti vengono scelti: un utente che scrive "vorrei più quinoa" non la vedrà mai comparire nel piano. `includedFoods` deve diventare un vincolo di `buildFoodPools()`, non solo testo per il prompt AI. Ordine di priorità proposto nella costruzione del pool alimentare:

```
hard exclusions (allergie/intolleranze) > vincoli dietetici (dietaryPattern)
  > preferenze (preferredProteins/Carbs/Fats) > includedFoods (candidate pool)
  > varietà > ottimizzazione
```

Una volta applicata questa correzione, la destinazione di `includedFoods` nella mappa §11 passa da **[AI soltanto]** a **[Dieta] + [AI]**.

**`src/lib/planning/diet-planner.ts::generateDietPlan({answers, dailyCalorieTarget, macroTargetsG, strategy})`**: per ogni mese, `calorieTarget` = da `strategy.diet.monthlyTargets` se presente, altrimenti nudge deterministico ±150kcal in fase adattamento; `buildWeeklySplit` genera pasti con seed deterministico (riproducibile, non random) pescando dai pool filtrati per slot.

### 4.5 Orchestrazione — `src/store/plan-store.ts::generatePlans(answers, targets)`

```
1. strategy = fetchPlanStrategy(...)               // può essere null
2. dietPlan = mode==='training' ? null : generateDietPlan({...strategy.diet})
3. trainingPlan = mode==='diet' ? null : generateTrainingPlan({...strategy.training})
4. persist best-effort: upsertDietPlan / upsertTrainingPlan (jsonb intero, tabelle diet_plans/training_plans)
```

> ⚠️ **Proposta di redesign — versioning invece di persistenza best-effort.** Il passo 4 va sostituito: la generazione del piano dovrebbe creare una **nuova riga in `plan_versions`** (stato iniziale `draft`, poi `active` al completamento) invece di sovrascrivere in place lo stesso blob JSON. L'operazione diventerebbe un job atomico e tracciato, non più puramente fire-and-forget. Nuovo modello dati proposto in **§12 bis**.

---

## 5. Home

`src/app/(tabs)/index.tsx` — nessuna scrittura propria (solo aggregazione/lettura da altri store); ogni box naviga altrove per l'azione.

| Box | Input | Collegamenti |
|---|---|---|
| **Obiettivo** (peso) | `latestSnapshot(bodyEntries)`, `bodyEntries[0]` (peso iniziale), `currentUser.targetWeightKg`, `useWeightSeries()` | stesso hook/store di Body → sempre sincronizzato; "Vedi corpo" → `/body` |
| **Riepilogo di oggi** (3 anelli: training/dieta/passi) | training: `completedCount/workoutExercises.length` (giorno corrente del `trainingPlan`, via `useTrainingProgressStore`); dieta: `todaysTotals.kcal/calorieTarget`; passi: **sempre 0** (`stepsHistory` in `lib/mock/activity.ts` è un array statico vuoto — nessuna feature reale di step-tracking) | legge `usePlanStore`, `useTrainingProgressStore`, `useNutritionStore` |
| **Calorie bruciate/assunte** (settimana) | `estimateDailyBurnedKcal()` (BMR Mifflin-St Jeor live + bonus 0.18 se workout completato al 100%) per ogni giorno della settimana corrente | **`accountStartDate = bodyEntries[0]?.date ?? oggi`**: ogni giorno precedente viene azzerato (`hasHappened:false`) invece di stimare un burn fittizio pre-registrazione |
| **Allenamento di oggi** | giorno corrente del `trainingPlan` | "Vedi training" → `/training` |
| **Piano alimentare di oggi** | `todaysTotals` vs `calorieTarget`/`macroTargets` del mese attivo | "Dettagli" → `/nutrition` |
| **Ultimi progressi nei carichi** (condizionale, ≥1 esercizio con ≥2 sessioni) | `historyForExercise()` da `useTrainingProgressStore` | "Vedi tutti" → `/training-progress` |
| **Consigli del coach AI** | tabella `coach_insights` (letta da `useCoachInsights()`) | bottone "Aggiorna" → invoca edge function `generate-insights` (§5.1) |

> ⚠️ **Nota di redesign su "Riepilogo di oggi" e "Calorie bruciate e assunte"**: oggi sono due calcoli paralleli (l'anello dieta usa `calorieTarget` statico, la card usa `dispendioEnergeticoStimatoOggi` ricalcolato live) che non condividono la stessa fonte di verità. Vedi §5 bis per il modello di visualizzazione proposto in sostituzione.

### 5.1 `generate-insights` (Edge Function)

Legge **dati reali** da Postgres (`profiles`, `body_metrics` — delta 30gg peso/girovita/% grasso), riceve anche `clientContext` (nutrizione/training, calcolato client-side). Prompt: "basati SOLO sui dati reali, omitti un dominio se non ci sono abbastanza dati invece di inventare". Scrittura: `delete` + `insert` su `coach_insights` per utente — è uno **snapshot corrente**, non storico accumulato.

### 5 bis — Modello di visualizzazione energetica proposto

> Sezione proposta, non ancora implementata. Sostituisce il concetto unico di "calorie bruciate" con 5 metriche distinte, tutte derivate dalla **stessa** funzione di stima (unica fonte di verità, condivisa da Home, piano, API e chat AI):

1. **Calorie assunte** (`logged intake`) — somma di ciò che l'utente ha effettivamente loggato oggi.
2. **Dispendio energetico stimato** (`estimated expenditure`) — dispendio a riposo (*resting expenditure*) + attività di base/NEAT (*baseline activity*) + contributo dell'allenamento (*exercise contribution*, stimato da **durata e intensità** della sessione, non da un flag binario di completamento).
3. **Target calorico** (`nutrition target`) — il `current_target` del §4.1 bis.
4. **Bilancio energetico stimato** (`estimated balance`) — assunte − dispendio stimato.
5. **Trend peso** (media mobile 7 giorni) — il feedback reale che convalida (o smentisce) le prime 4 stime.

Esempio di layout proposto:

```
ENERGY BALANCE
Target expenditure   ───────── 2.750
Food intake           █████████  2.200
Bilancio stimato: -550 kcal
```

Testo esplicativo da includere in UI: *"Il valore del dispendio è una stima. Il trend del peso nel tempo è il principale feedback usato per valutare se il target sta producendo l'effetto atteso."*

> Collegamento: l'anello "passi" sempre a zero (§13 punto 1, `stepsHistory` statico) resta un placeholder finché non esiste una vera integrazione wearable (§10, nota P3) — nessuna azione aggiuntiva richiesta qui oltre a quanto già in §13.

---

## 6. Body (progressi corporei)

`src/app/(tabs)/body.tsx`

| Box | Input | Output | Collegamenti |
|---|---|---|---|
| **Hero peso** | `latestSnapshot(entries)`, `deltaFromPrevious()`, `useWeightSeries()` | "+" → `QuickWeightSheet` → `addWeightEntry(weightKg)` → upsert `body_metrics` | stesso store di Home → aggiorna anche "Peso attuale" e BMR live in Home |
| **Misure** (6 zone: spalle/petto/bicipite/vita/fianchi/coscia) | `seriesOf(entries, zone)` | "+" → `QuickMeasurementSheet` → `addMeasurement({zone: valore})`; tap sparkline → `MeasurementTrendModal`; "i" → `MeasurementInfoModal` (statico, didattico) | girovita usato anche da `generate-insights` |
| **Foto progressi** | `photos` raggruppate per data | "Aggiungi foto" → `PosePickerSheet` (6 pose fisse) → `expo-image-picker` → `addPhoto()` → upload su Storage bucket `progress-photos` + insert `body_photos` | tap foto → `PhotoDetailModal` |
| **Photo Detail** | foto + `previousPhoto` (stessa posa, più recente) | insight **deterministico** sempre visibile (`generatePhotoDetailInsight` — confronta `body_metrics` più vicine, soglie fisse su delta % grasso/girovita); bottone **"Analizza con AI"** on-demand → `analyzePhoto()` → edge function `analyze-photo` (Claude Vision) | risultato AI **non persistito**, solo stato React locale |
| **Confronto AI** (fondo pagina) | ≥2 foto | `generatePhotoInsight()` — stesso motore deterministico, **non chiama mai l'AI** nonostante il nome | — |

> **P3**: sia "Photo Detail" che "Confronto AI" sono candidati a un miglioramento futuro (analisi foto più ricca), non a una correzione urgente — la revisione classifica questo nel backlog Low priority.

**`useBodyStore.resetStartingWeight()`** (chiamato solo in onboarding) **oggi** sovrascrive tutta la tabella `body_metrics` con un unico entry fresco — è il momento che fissa `accountStartDate` letto da Home.

> ⚠️ **Proposta di redesign — baseline invece di reset.** Sovrascrivere tutta la tabella è incompatibile con un'app longitudinale/adattiva: un utente che rifà il questionario perde lo storico peso precedente, e perde anche i dati necessari al Trend Engine dell'Adaptive Nutrition Engine (§4.1 bis, finestre 7/14/21 giorni). Il comportamento precedente cancellava lo storico a ogni nuovo questionario; la logica proposta lo preserva, aggiungendo solo un marcatore di baseline. Struttura dati aggiornata proposta:
>
> ```
> body_metrics
>  - id
>  - user_id
>  - measured_at
>  - weight_kg
>  - ... (colonne di misura già esistenti)
>  - source        (nuovo: 'onboarding' | 'manual' | 'import')
>  - is_baseline   (nuovo: boolean)
> ```
>
> Collegamento con §4.1 bis: la baseline è anche il punto di riferimento per il **Trend Engine** dell'Adaptive Nutrition Engine (finestre mobili 7/14/21 giorni su peso e intake) — senza storico peso continuo, quel motore non avrebbe dati su cui calcolare un trend.

---

## 7. Training

**⚠️ Architettura a due sistemi paralleli** (per ragioni storiche di migrazione):

| | Sistema statico (legacy) | Sistema generato (quello mostrato in UI) |
|---|---|---|
| Store | `training-store.ts` | `training-progress-store.ts` + `plan-store.ts` |
| Piano | 3 template hardcoded (Push/Pull/Legs) | `TrainingPlan` multi-mese da `training-planner.ts` (§4.3) |
| Tabella log | `exercise_sets` (`source='static_template'`) | `exercise_sets` (`source='generated_plan'`) |
| Usato da | **solo** `build-client-context.ts` (contesto chat AI) | tab Training, `/training-plan`, `/training-progress`, Home |

Nessuna schermata UI mostra più il sistema statico — resta vivo solo per alimentare il contesto della chat AI conversazionale.

| Schermata | File | Input | Azione utente → Output |
|---|---|---|---|
| Tab Training | `src/app/(tabs)/training.tsx` | `trainingPlan` (giorno corrente via `mondayIndex`), `progressSets`/`completedExercises` | toggle completamento → `toggleCompleted()` → `exercise_completions`; "+carico" → `NewLoadModal` → `logSet()` → `exercise_sets` |
| Dettaglio piano | `src/app/training-plan.tsx` | `plan.months[selectedMonth].weeklySplit[selectedWeekday]`, `latestWeightForExercise()` | selezione mese/giorno (solo stato locale, mesi futuri bloccati); "Scarica PDF" → `exportTrainingPlanPdf()` (nessuna scrittura DB) — **P3**: export più ricchi (es. grafici di progressione oltre al piano testuale), nessuna azione a breve termine |
| Andamento carichi | `src/app/training-progress.tsx` | tutti gli esercizi unici del piano, `historyForExercise()` | solo lettura |

**Vincoli questionario → piano finale** (agiscono tutti dentro `generateTrainingPlan()`, **prima** che il piano arrivi alla UI): vedi tabella §4.3.

**Componenti**: `day-wheel.tsx` (selettore data), `plan-exercise-row.tsx` (riga esercizio: nome/GIF/sets×reps/carico/checkbox), `new-load-modal.tsx` (form log carico), `exercise-info-modal.tsx` (GIF+istruzioni da `exercise-media.ts`, copertura parziale ~30 esercizi), `plan-timeline.tsx` (barra mesi).

**Comunicazione con Home**: stesso `usePlanStore`/`useTrainingProgressStore` — completare un esercizio in Training aggiorna istantaneamente il ring "Allenamento" in Home, la striscia settimanale, "Ultimi progressi nei carichi", e (indirettamente) la stima kcal bruciate.

> ⚠️ **Integrazione al punto 2 di §13** (due sistemi Training paralleli): la raccomandazione di redesign è la **rimozione definitiva** del sistema statico legacy, incluso dal contesto della chat AI (`build-client-context.ts`), sostituendolo con dati derivati dal sistema generato — per evitare due fonti di verità sull'allenamento.

### 7 bis — Gerarchia del piano (proposta)

> Sezione proposta, non ancora implementata. La gerarchia attuale — `Training Plan → Workout → Exercise → Set` — va estesa, per un piano di 6 mesi, a:

```
Training Plan → Mesocycle → Microcycle → Workout → Exercise → Set
```

Un *mesociclo* corrisponde a una fase (adattamento/progressione/consolidamento, già presente concettualmente in `training-planner.ts` come `phase`); un *microciclo* è la singola settimana. Questa estensione è il prerequisito strutturale per il progression engine di §7 ter (serve un livello "settimana" su cui applicare le decisioni di progressione).

### 7 ter — Progression engine (proposto)

> Sezione proposta, non ancora implementata. Il piano deve osservare `load`, `reps`, `sets`, `RIR`/`RPE`, `completion` e il trend di performance nel tempo, e decidere tra: **aumentare il carico**, **aumentare le ripetizioni**, **mantenere**, **deload**, **sostituire l'esercizio**, **ridurre il volume**.

Pipeline completa proposta:

```
Profile → Goal → Training constraints → Frequency → Split → Movement patterns
  → Exercise selection → Volume allocation → Intensity/RIR → Workout
  → Actual performance → Progression engine → Next workout
```

Questo sostituisce il calcolo statico odierno (`suggestedLoadFor = peso × bwMultiplier`, vedi §4.3) con un carico realmente basato sulla storia di allenamento dell'utente esercizio per esercizio.

---

## 8. Nutrizione

| Schermata | File | Input | Azione utente → Output |
|---|---|---|---|
| Tab Nutrizione | `src/app/(tabs)/nutrition.tsx` | `entries` (log), `dietPlan` (mese/giorno corrente) | apertura nuova data → `seedDayFromPlan()` precompila con gli alimenti pianificati (una sola volta per data, idempotente via `seededDates`); "+" su uno slot → `FoodSearchModal` → `addEntry`/`updateEntry` → `meal_entries`; "X" → `removeEntry` |
| Dettaglio piano dieta | `src/app/diet-plan.tsx` | `dietPlan.months[selectedMonth].weeklySplit[selectedWeekday]` | solo lettura + "Scarica PDF" → `exportDietPlanPdf()` — **P3**: export più ricchi, nessuna azione a breve termine |

**Store** (`src/store/nutrition-store.ts`): `MEAL_SLOTS` con `sharePct` di **default per la UI di logging manuale** (colazione 0.22, pranzo 0.3, cena 0.25, spuntini 0.08-0.1-0.05) — **diversi** dagli `sharePct` calcolati da `meal-slots.ts` per il piano generato (colazione 3, pranzo 4, cena 3.5, spuntini 1 — pesi relativi, non percentuali). I due sistemi di "peso pasto" non sono unificati.

> ⚠️ **Proposta di redesign — `MealDistributionPolicy` unica.** I due `sharePct` rappresentano lo stesso concetto con pesi diversi. Vanno unificati in un'unica funzione — `calculateMealTargets({dailyCalories, meals, preferences})` — usata in modo coerente da planner (`meal-slots.ts`), UI di logging (`nutrition-store.ts`), analytics/API e contesto della chat AI, eliminando entrambe le definizioni parallele oggi esistenti.

**Collegamento questionario → piano dieta**: vedi tabella §4.4 (`meal-slots.ts` per orari/numero pasti, `food-pools.ts` per preferenze/allergie).

**Componenti**: `day-navigator.tsx` (prev/next data), `food-search-modal.tsx` (ricerca in `FOOD_DATABASE`, max 30 risultati), `logging-streak-banner.tsx` (streak giorni consecutivi loggati), `nutrition-week-strip.tsx` (7 pallini settimana, verde se loggato).

**Comunicazione con Home**: loggare un pasto aggiorna istantaneamente (stesso store) gli anelli calorie/macro in Home, la striscia settimanale, e lo streak banner.

---

## 9. Chat AI multi-agente

```
chat.tsx → chat-store.send() → buildClientContext() (locale) →
  edge function "chat" → runOrchestrator (Claude Sonnet) →
    tool_use parallelo → consult_training_specialist (Haiku)
                       → consult_nutrition_specialist (Haiku)
                       → consult_body_progress_specialist (Haiku, unico con query Postgres reali)
  → sintesi finale (Sonnet) → persistenza chat_messages (user+assistant) → risposta al client
```

| Componente | Modello | Dati letti | RAG |
|---|---|---|---|
| **Orchestrator** (`_shared/agents/orchestrator.ts`) | `claude-sonnet-5` | nessuno diretto — decide solo quali specialisti chiamare (`tool_choice:'auto'`), max 2 round di tool-use, poi forza risposta testuale | no |
| **Training agent** | `claude-haiku-4-5` | `clientContext.trainingToday`/`.trainingAdherence14d` (calcolato **client-side**, non da Postgres) | sì — `training_guide` |
| **Nutrition agent** | `claude-haiku-4-5` | `clientContext.nutritionToday` (calcolato **client-side**) | sì — `nutrition_guide` |
| **Body-progress agent** | `claude-haiku-4-5` | **unico** che interroga Postgres realmente (RLS-scoped): `profiles` + `body_metrics`, delta 30gg | no |

**Regola anti-injection esplicita**: ogni tool accetta solo `question` testuale, mai un identificativo utente — l'identità resta vincolata server-side dal JWT.

**RAG** (`_shared/agents/rag.ts`): embedding query via Voyage AI (`voyage-3.5`) → RPC Postgres `match_knowledge_chunks` (SECURITY DEFINER, `knowledge_chunks` inaccessibile via RLS/PostgREST diretto) → filtro `similarity ≥ 0.5` → mai eccezioni verso il chiamante (fallback `[]`). Fonte: 2 PDF ingeriti offline (`Materiale addestramento agente/`) — guida PT e guida dieta.

**Persistenza**: solo l'edge function scrive su `chat_messages` (sia turno utente che assistente) — il bubble utente mostrato subito in UI è puramente optimistic locale.

---

## 10. Profilo

`src/app/profile.tsx` — nessun form di editing diretto inline; l'unica via per modificare i dati raccolti è tornare al questionario (`/onboarding`).

| Sezione | Dati mostrati | Azione |
|---|---|---|
| Identità | `name`, `GOAL_LABEL[goal]` | — |
| Aspetto | `useAppStore.appearance` (`system/light/dark`) | `SegmentedControl` → `setAppearance` |
| Sport praticati | `sports` | "Modifica" → `/onboarding` |
| Dati di partenza | `heightCm`, `targetWeightKg` | solo lettura |
| Obiettivi nutrizionali | `dailyCalorieTarget`, `macroTargetsG`, `hydrationTargetMl` | solo lettura |
| Integrazioni | placeholder Apple Health/Garmin/Whoop | non funzionale ("Presto") — **P3**: un'integrazione reale risolverebbe anche il placeholder "anello passi sempre a zero" (§13 punto 1), oggi vuoto per mancanza di una vera fonte di step-tracking; collegamento anche a §11 (`dailySteps`) |
| Dev tools | — | "Genera dati di test" (seed locale dev-only) |
| Rifai questionario | — | `restartOnboarding()` → `/onboarding` |
| Esci | — | `logout()` → `/welcome` |

**Store** (`src/store/user-store.ts`): `finalizeOnboarding()` (fine questionario) e `updateProfile()` (modifiche parziali) → sempre `upsertProfile()` → tabella `profiles`. `syncFromServer()` chiamato da `_layout.tsx` al login (necessario perché la riga `profiles` è creata server-side dal trigger, non letta automaticamente indietro senza questa chiamata).

> **Backlog P3 (bassa priorità) — gruppo completo**: integrazioni Garmin/Whoop/Apple Health, AI coaching avanzato, miglioramenti dell'analisi foto (§6), PDF export più ricchi (§7, §8), UX di personalizzazione avanzata. Nessuno di questi è urgente rispetto ai P0/P1 documentati nelle altre sezioni.

---

## 11. Mappa questionario → utilizzo (tabella master)

Legenda: **[Profilo]** promosso in `profiles`; **[AI]** incluso nel prompt `generate-plan-strategy`; **[Training]** planner allenamento; **[Dieta]** planner alimentare; **[TDEE]** calcolo calorico onboarding; **[UI]** solo riepilogo onboarding; **[inutilizzato]** raccolto ma non consumato da nessun planner (stato attuale). Tre nuove destinazioni **proposte** per classificare gli `[inutilizzato]` (vedi §3.2, §13 punto 4): **[Keep+Use]** — da collegare a un calcolo reale; **[Keep-no-algoritmo]** — utile solo a profilo/coach, mai a un calcolo; **[Rimuovere candidato]** — nessuna funzione prevista.

| Campo | Destinazione oggi | Destinazione proposta |
|---|---|---|
| `mode` | instradamento step onboarding + quale piano generare | — |
| `ageRange`, `sex`, `heightCm` | [TDEE] + [Profilo] | — |
| `currentWeightKg` | [TDEE] + [Training] (carico consigliato) + peso iniziale Body | — |
| `targetWeightKg` | [Profilo] + [UI] | — |
| `neckCm,chestCm,waistCm,hipsCm,armCm,thighCm` | **[inutilizzato]** (persistiti in `onboarding_answers`, mai letti da alcun planner/UI) | **[Rimuovere candidato]** oppure **[Keep-no-algoritmo]** se usati per profilo/coach — decisione da rendere esplicita |
| `goal` | [TDEE]+[Profilo]+[AI]+[Dieta]+[UI] | — |
| `hasDeadline`, `deadlineDate`, `successWeightKg` | **[inutilizzato]** | **[Keep+Use]** — collegabile al target calorico (§4.1, punto 3) |
| `jobActivity` | [TDEE] | — |
| `dailySteps` | **[inutilizzato]** | **[Keep+Use]** — collegabile al TDEE (§4.1, punto 2) |
| `sleepHoursRange`, `sleepQuality` | **[inutilizzato]** | **[Keep+Use]** (P2 — integrazione sonno) |
| `dietHistory` | **[inutilizzato]** | **[Rimuovere candidato]** oppure **[Keep-no-algoritmo]** |
| `eatingOut` | **[inutilizzato]** | **[Keep+Use]** (P2) |
| `mealsPerDay`, `breakfastTime`, `lunchTime`, `dinnerTime`, `snacks` | [Dieta] (`meal-slots.ts`) + [AI] | — |
| `dietaryPattern` | [Dieta] (`food-pools.ts`) + [AI] + [UI] | — |
| `dietaryPatternOther` | **[inutilizzato]** | **[Rimuovere candidato]** oppure **[Keep-no-algoritmo]** |
| `allergies`, `intolerances`, `excludedFoods` | [Dieta] + [AI] + [UI] | — |
| `includedFoods` | **[AI soltanto]** — non filtra i pool alimentari deterministici | **[Dieta] + [AI]** — una volta applicata la correzione di §4.4 (vincolo su `buildFoodPools()`) |
| `preferredProteins/Carbs/Fats`(+`Other`) | [Dieta]; i campi `Other` (testo libero) **[inutilizzato]** | i campi `Other`: **[Rimuovere candidato]** oppure **[Keep-no-algoritmo]** |
| `hungerLevel`, `cravings` | **[inutilizzato]** | **[Keep+Use]** (P2) |
| `coffeeIntake`, `alcoholIntake`, `supplements` | **[inutilizzato]** | **[Keep-no-algoritmo]** — utili solo a profilo/coach |
| `activitiesPracticed` | [Profilo]+[Training]+[AI]+[UI] | — |
| `freq_gym`, `freq_running` | [Training]+[TDEE]+[AI] | — |
| `freq_<altre attività>` | solo [TDEE] (bump calorico), non influenza il piano training | invariato per design, non un problema da correggere |
| `focus_gym`, `focus_running` | [Training]+[AI] | — |
| `availableDays` | [Training]+[AI]+[UI] | — |
| `sessionDuration` | [Training]+[UI] (non passato all'AI) | — |
| `trainingLocation` | [Training]+[AI]+[UI] | — |
| `equipment` | **[inutilizzato]** — raccolto ma `HOME_EXERCISES` non è filtrato per attrezzatura | **[Keep+Use]** — §4.3/§13 punto 3: bug funzionale da correggere, non solo miglioramento |
| `hasPain`/`painDetails`, `cannotDoExercises`/`cannotDoDetails`, `recentInjuries`/`recentInjuriesDetails` | [Training] (`deriveExerciseExclusions` → `selectExercises`) + [AI] | — |

---

## 12. Schema Postgres — riepilogo tabelle

| Tabella | Chiave | Colonne principali | RLS |
|---|---|---|---|
| `profiles` | `user_id` PK | name, sex, age_range, goal, sports[], height_cm, target_weight_kg, daily_calorie_target, protein/carbs/fats_g, hydration_target_ml | per-utente |
| `onboarding_answers` | `user_id` PK | `answers jsonb` (blob unico) | per-utente |
| `body_metrics` | `(user_id, date)` PK | weight_kg, body_fat_pct, muscle_mass_kg, shoulders/chest/biceps/waist/hips/thigh_cm, resting_heart_rate, sleep_hours, **`source`** (nuovo: `onboarding`\|`manual`\|`import`), **`is_baseline`** (nuovo: boolean) — colonne aggiunte per supportare baseline multiple senza perdita di storico, §6/§0.3 Passo 3 | per-utente |
| `body_photos` | `id` PK | user_id, date, pose, storage_path | per-utente + Storage `progress-photos` (privato) |
| `food_items` | `id` PK (testo) | name, category, kcal100, protein100, carbs100, fats100, default_portion_g | solo select (catalogo condiviso) |
| `meal_entries` | `id` PK | user_id, date, slot (6 valori), food_id, grams | per-utente |
| `nutrition_seeded_dates` | `(user_id,date)` PK | — | per-utente |
| `diet_plans` / `training_plans` *(modello precedente — vedi sotto)* | `user_id` PK | generated_at, duration_months, goal, `plan jsonb` (intero) | per-utente |
| `exercise_sets` | `id` PK | user_id, source (`static_template`\|`generated_plan`), exercise_id, exercise_name, template_id, reps, weight_kg, date | per-utente |
| `exercise_completions` | `(user_id,exercise_id,date)` PK | — | per-utente |
| `training_settings` | `user_id` PK | weekly_plan jsonb (sistema statico legacy) | per-utente |
| `chat_messages` | `id` PK | user_id, role (`user`\|`assistant`), content, created_at | per-utente |
| `knowledge_chunks` | `id` PK | source, source_file, chunk_index, page_number, content, embedding vector(1024) | **nessuna policy** — accesso solo via RPC `match_knowledge_chunks` |
| `coach_insights` | `id` PK | user_id, tone, headline, body, generated_at, dismissed | per-utente (scrittura solo edge function) |

### 12 bis — Nuovo modello dati proposto: versioning dei piani

> Sezione proposta, non ancora implementata. Sostituisce `diet_plans`/`training_plans` (un blob JSON intero per utente, senza versioning né storico) con un modello normalizzato che conserva ogni versione generata e la rende interrogabile.

```
plan_versions
  id, user_id, plan_type, version, status,
  created_at, effective_from, effective_to,
  trigger, input_snapshot_id, algorithm_version

nutrition_targets
  id, user_id, plan_version_id, target_date,
  calories, protein_g, carbs_g, fat_g, hydration_ml

training_plan_days
  id, plan_version_id, date, session_type, duration, focus

training_exercises
  id, plan_day_id, exercise_id, order,
  sets, rep_min, rep_max, rir_target, rest_seconds, load_strategy

training_sets
  id, workout_id, exercise_id, set_number,
  planned_reps, actual_reps, planned_load, actual_load, rir, completed
```

`algorithm_version` e `input_snapshot_id` (in `plan_versions`) permettono di ricondurre ogni versione del piano esattamente all'input del questionario e alla versione della logica di generazione usata — rilevante anche per l'output di `generate-plan-strategy` (§4.2). Ogni decisione dell'Adaptation Engine (§4.1 bis) che produce un nuovo target crea una nuova riga in `plan_versions` (`trigger = 'adaptation'`), mai una modifica in place di `nutrition_targets` — è ciò che rende interrogabile lo storico delle correzioni nel tempo.

---

## 13. Problemi noti / punti deboli identificati

Emersi dall'analisi del codice — utili come punto di partenza per un redesign, non richieste già in corso:

1. **`stepsHistory` è sempre vuoto** (`src/lib/mock/activity.ts`) — l'anello "passi" e le kcal-da-passi in Home sono sempre 0: non c'è alcuna feature reale di step-tracking, è un placeholder residuo. → vedi §5 bis (modello di visualizzazione proposto) e §10 (integrazione wearable, P3).
2. **Due sistemi Training paralleli**: il sistema statico (`training-store.ts`) è morto lato UI ma vivo lato dati/chat AI — genera confusione se non documentato (fatto qui, §7). → raccomandazione di redesign: rimozione definitiva, vedi §7.
3. **`equipment`** raccolto nel questionario ma mai usato per filtrare gli esercizi "a casa". → promosso da nota a **correzione richiesta** (bug funzionale, non solo miglioramento), vedi §4.3 e §11.
4. **13+ campi del questionario non usati da nessun planner**: misure corporee dettagliate, deadline, step giornalieri, sonno, storico diete, mangiare fuori, gusti "Other" testuali, fame/voglie, caffè/alcol, integratori. Sono raccolti e persistiti ma non influenzano alcun output. → classificazione dettagliata **Keep+Use / Keep-no-algoritmo / Rimuovere candidato** in §3.2 e §11 (sostituisce la precedente indicazione generica "candidati sia per essere rimossi... sia per essere collegati").
5. **`includedFoods`** arriva solo al prompt AI (testo per il "rationale"), non al planner deterministico dei pool alimentari — un utente che scrive "vorrei più quinoa" non la vedrà mai comparire nel piano. → promosso da nota a **correzione richiesta**, vedi §4.4.
6. **Due `sharePct` diversi e non unificati** per i pasti: quello statico in `nutrition-store.ts` (per la UI di logging manuale/target-per-slot) e quello calcolato in `meal-slots.ts` (per il piano generato) — valori di peso diversi per lo stesso concetto. → soluzione proposta (`MealDistributionPolicy` unica), vedi §8.
7. **Validazione orario pasti solo a valle**: il campo UI (`question-field.tsx`) accetta qualsiasi testo per `breakfastTime`/`lunchTime`/`dinnerTime`; la regex `HH:MM` e il fallback silenzioso sono solo in `meal-slots.ts` — un utente che scrive "9" invece di "09:00" non riceve alcun errore, semplicemente il suo orario viene ignorato e sostituito dal default.
8. **`computePlanDurationMonths()` è sempre 6**, nonostante il nome suggerisca dipendenza dalle risposte — nessuna risposta del questionario (es. `hasDeadline`/`deadlineDate`) influenza la durata del piano.
9. **`exercise-log-row.tsx`** è un componente orfano (modello legacy), non montato da nessuna schermata attiva.
10. **`removePhoto`** non passa mai `storagePath`, quindi il file immagine resta nello Storage anche dopo l'eliminazione della riga in `body_photos` (accumulo silenzioso).

### Edge case da gestire esplicitamente

> Tabella di partenza fornita dalla revisione critica — da validare riga per riga con il team prodotto prima di considerarla definitiva, non sostituisce un'analisi di dettaglio caso per caso.

**Casi P0 (blocco critico) — comportamento atteso:**

| Caso | Comportamento atteso |
|---|---|
| Peso impossibile | Reject |
| Altezza impossibile | Reject |
| Calorie target sotto soglia di sicurezza | Reject / revisione |
| Nessun esercizio compatibile | Non usare Plank automaticamente (§4.3/§7 bis) |
| Generazione piano AI fallisce | Fallback deterministico (già presente, §4.2) |
| Persistenza piano su DB fallisce | Non impostare `hasOnboarded=true` |
| Dati di tracking insufficienti | Nessuna adattazione del piano (§4.1 bis) |
| Peso variato improvvisamente (±5%) | Trattare come outlier da rivedere |
| Cambio obiettivo | Nuova plan version (§12 bis) |
| Cambio peso significativo | Nuova stima (§4.1 bis) |
| Modifica profilo | Ricalcolo anteprima + richiesta di conferma |
| Allergia incompatibile col piano | Validazione hard (non solo filtro best-effort come oggi in `food-pools.ts`) |
| Equipment incompatibile | Validazione hard (§4.3) |
| Training con flag infortunio attivo | Vincolo di sicurezza |

**Casi P1 (da gestire ma non bloccanti):**

- Cambio giorni disponibili
- Aumento/riduzione frequenza di allenamento
- Settimane consecutive senza workout registrato
- Settimane con calorie non tracciate
- Duplicazione di una entry
- Modifica retroattiva di un peso già registrato
- Gestione timezone
- Cambio giorno a mezzanotte durante una sessione
- Piano scaduto (oltre i 6 mesi)
- Utilizzo dell'app offline
- Retry di chiamate API fallite
- Doppio tap sul bottone "genera piano"
- Generazione simultanea di due piani per lo stesso utente

Alcuni di questi edge case sono già coperti concettualmente da altre sezioni di questo documento: "nessun esercizio compatibile" → §4.3/§7 bis; "cambio obiettivo"/"cambio peso significativo" → §12 bis (versioning) e §4.1 bis (adaptive engine); "allergia incompatibile" → già gestita da `food-pools.ts` ma va resa esplicitamente una regola hard, non solo un filtro best-effort.

---

## 14. API di dominio (proposta)

> Sezione proposta, non ancora implementata — aggiunta in risposta al rischio segnalato in §1 ("business logic sul client"). Elenco degli endpoint concettuali suggeriti dalla revisione critica, non ancora un contratto API definitivo:

```
POST /onboarding
POST /nutrition/estimate
POST /plans/generate
GET  /nutrition/today
GET  /nutrition/trend
POST /nutrition/entries
PUT  /nutrition/entries/:id
GET  /training/today
POST /training/workouts/:id/complete
POST /training/sets
GET  /body/trend
POST /body/measurements
POST /plans/:id/review
POST /plans/:id/regenerate
POST /adaptation/evaluate
```

`POST /adaptation/evaluate` è il cuore del sistema adattivo descritto in §4.1 bis: è l'endpoint che eseguirebbe il Trend Engine + Adaptation Decision Engine e, se necessario, produrrebbe una nuova `plan_version` (§12 bis). Nessuno di questi endpoint esiste oggi nel codice — la logica corrispondente vive negli store client (`src/lib/nutrition/`, `src/lib/planning/`) descritti nei capitoli precedenti.
