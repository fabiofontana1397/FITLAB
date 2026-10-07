# Architettura dei piani: come ci lavorano gli agenti

Tutta la logica che decide **quanto mangiare e come allenarsi** vive in `src/domain/*`: funzioni pure
(nessun import di React Native, store o rete), con input e output tipizzati. Gli schermi e gli agenti AI
non ricalcolano nulla: chiamano il dominio.

## Principi

1. **Una sola persona, normalizzata una volta.** `buildUserContext(answers)` trasforma le risposte del
   questionario in un `UserContext` (sesso, età, altezza, peso, obiettivo, stile di vita, programma di
   allenamento, `issues`). Tutto il resto parte da qui. Frequenze "ogni due settimane / mensile" valgono 1.
2. **Un solo modello energetico.** `energy.ts` calcola metabolismo, NEAT e costo di ogni seduta
   (palestra o corsa). `targets.ts` ne deriva le calorie: ogni giorno della settimana ha il proprio
   target = fabbisogno di quel giorno (allenamento incluso) ± ritmo dell'obiettivo. Se l'allenamento
   cambia, la dieta cambia con lui.
3. **L'AI propone, il dominio decide.** Nessun numero (calorie, macro, serie, carichi) passa dall'AI senza
   `applyGuardrails`. L'AI di strategia (`generate-plan-strategy`) scrive solo metodologia e testi dei mesi.
4. **Gli agenti non toccano i mesi già vissuti.** Rigenerazioni e ricalibrazioni partono dal mese
   successivo (`preserveMonthsBefore`).
5. **Tutto è testabile senza app.** `npm run agents:test` esegue personas, controlli sui piani,
   controlli statici sul codice e una simulazione a ciclo chiuso della ricalibrazione.

## Moduli

| Modulo | Ruolo |
|---|---|
| `domain/user-context.ts` | `buildUserContext`, `LIMITS` (range validi), `cleanAnswersForMode` |
| `domain/energy.ts` | `bmr`, `baselineKcal`, `sessionKcal`, `dayEnergy`, `weekEnergy` |
| `domain/targets.ts` | `computeTargets(ctx, settimana, {calorieAdjustment})` → `PlanTargets` (calorie, macro, idratazione, target per giorno), `weeklyBalanceGoal`, `weeksToGoal`, `planDurationMonths` |
| `domain/plan-engine.ts` | `buildPlans(ctx, {strategy, calibration, preserveMonthsBefore, existing})` → dieta + allenamento coerenti |
| `domain/recalibration.ts` | `recalibrate(input)` → verdetto, nuova calibrazione, cambi spiegati; `applyGuardrails` |
| `domain/profile.ts` | `profileFromContext` per il profilo utente |
| `lib/planning/diet-planner.ts` + `lib/planning/fitlab/*` | Dieta secondo il framework Fit Lab: catalogo per pasto → ricette → quantità risolte su calorie e macro (vedi `docs/DIET-ENGINE.md`) |
| `lib/planning/training-planner.ts` | Split, progressione, rotazione, `tuning` dalla calibrazione |
| `lib/planning/month-adherence.ts` | Fatti del mese: sedute fatte, giorni tracciati, calorie medie, segnali del check-in |

## Il ciclo mensile

Alla fine di ogni mese del piano (anche il primo) l'utente fa il check-in (`app/monthly-checkin.tsx`):

1. `monthWindow` + `weightsInMonth` + `computeMonthAdherence` raccolgono i fatti reali.
2. `plan-store.recalibrateMonth` chiama `recalibrate`:
   - misura il trend di peso (kg/settimana) e lo confronta con quello atteso dal piano;
   - verdetti: `on_track`, `too_slow`, `plateau`, `wrong_direction`, `too_fast`, `low_adherence`,
     `insufficient_data`;
   - **bassa aderenza → non si cambiano i numeri** (il problema è seguire il piano, non il piano);
   - altrimenti aggiorna `PlanCalibration` (`calorieAdjustment`, `setsDelta`, `loadFactor`, `mealVariant`)
     con passo massimo `MAX_MONTHLY_STEP` (150 kcal) e tetto `MAX_TOTAL_ADJUSTMENT` (500 kcal).
3. `buildPlans` rigenera dieta e allenamento **dal mese successivo**, con la nuova calibrazione.
4. Calibrazione e storico stanno nel jsonb dei piani (`DietPlan.calibration`, `recalibrations`): nessuna migrazione.

## Come si inserisce un agente AI

Un agente che vuole decidere al posto della regola deterministica restituisce un `RecalibrationProposal`
(`calorieAdjustment`, `setsDelta`, `loadFactor`, `note`). `applyGuardrails(proposal, input)` lo riporta
dentro i limiti (passo mensile, tetto, minimo calorico di sicurezza, nessuna salita di carico con bassa
aderenza). Il risultato ha la stessa forma di `recalibrate`, quindi lo schermo e il salvataggio non cambiano.

Il contesto per gli agenti conversazionali (chat, insight) è `buildClientContext()`
(`src/lib/assistant/build-client-context.ts`): oggi del giorno dal piano generato, aderenza a 14 giorni e un
riepilogo `plan` (obiettivo, mese, fase, bilancio calorico previsto, ultima ricalibrazione). Lato Deno la
stessa forma è in `supabase/functions/_shared/agents/types.ts` (`describePlan` la trasforma in una riga di prompt).

## Cosa NON fare

- Non calcolare calorie o spesa energetica negli schermi: usa `useUserContext` + `domain/*`.
- Non far scrivere all'AI target calorici o carichi senza passare da `applyGuardrails`.
- Non rigenerare mesi già passati.
- Non importare store o React Native da `src/domain` (rompe i test e l'esecuzione degli agenti).

## Persone di prova

Il progetto è per persone comuni (16–60 anni, sedentarie o molto attive, principianti o esperte). Casi
clinici (obesità, celiachia, diete vegane stretta…) richiedono un dietologo e restano fuori dal perimetro:
non vanno aggiunti ai test.

## Costi dell'AI (strategia del piano)

`generate-plan-strategy` è pensata per costare il minimo:

- **Nessuna ricerca web**: usa solo le due guide interne (RAG).
- **Modello economico** (`STRATEGY_MODEL`, Haiku) con uscita a schema fisso.
- **Cache per profilo simile** (`plan_strategy_cache`, migrazione `0019`): la chiave è una firma grossolana (obiettivo, attività, esperienza, fascia d'età, vincoli…). Se un profilo uguale ha già una strategia, la funzione risponde subito senza chiamare né il modello né gli embedding. La firma coincide con tutto ciò che il modello vede, quindi nel testo condiviso non finiscono peso, altezza, età esatta o pasti abituali. Se la tabella manca la cache si disattiva e la funzione funziona comunque.
- Se cambi prompt o schema, incrementa `CACHE_VERSION` nella funzione.
- Il test `npm run agents:test -- --ai` richiede `--persona <id>` (o `--all`) per non spendere per sbaglio.

## Coach senza AI (default)

Chat e consigli della Home rispondono **senza chiamare Claude**: `src/lib/assistant/local-coach.ts` (funzioni pure) li scrive dai dati già presenti nell'app (peso e tendenza, piano del mese, allenamento di oggi, pasti, aderenza, check-in dovuto). `coach-facts.ts` raccoglie i dati dagli store. Su dolori, farmaci e integratori rimanda a un professionista.

Per riattivare il coach AI (chat, insight, analisi foto) imposta `EXPO_PUBLIC_AI_COACH=true` in `.env` e tieni deployate le funzioni; se la chiamata fallisce risponde comunque il coach locale. Il banco di prova `npm run agents:test` controlla il coach locale (C1–C5) senza spendere crediti.
