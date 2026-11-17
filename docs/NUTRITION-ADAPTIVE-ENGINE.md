# Motore nutrizionale adattivo (check-in mensile)

Alla fine di ogni mese del piano il motore legge **tutte** le risposte del check-in insieme alle pesate e ai pasti registrati, capisce **perché** il mese è andato così e sceglie l'intervento più adatto. Le calorie sono uno degli interventi possibili, non la risposta automatica al peso.

Il motore è deterministico: stessi dati, stessa decisione. Calcoli, limiti e controlli di sicurezza non dipendono dall'AI. Un agente AI può solo proporre una lettura strutturata delle note (`NoteFacts`) o una proposta (`RecalibrationProposal`), che passano dagli stessi controlli.

## Moduli

| Modulo | File | Ruolo |
|---|---|---|
| A — Monitoraggio | `src/domain/nutrition/monitoring.ts` | Raccoglie e valida ogni risposta. Le note libere diventano fatti strutturati: pasti fuori casa, eventi temporanei, condizioni particolari, alimenti da togliere o desiderati. Ciò che non capisce diventa una domanda di chiarimento. |
| B — Analisi | `src/domain/nutrition/analysis.ts` | Trend del peso (media mobile a 7 giorni, medie settimanali, regressione, ultime due settimane, % del peso, anomalie), aderenza (punteggio e cause), sostenibilità (fame, energia, recupero, quantità). |
| C — Decisione | `src/domain/nutrition/decision.ts` | Gerarchia decisionale fissa (sotto). Restituisce passo calorico, interventi, regole applicate e alternative escluse. |
| D — Calcolo e limiti | `src/domain/targets.ts`, `src/domain/nutrition/safety.ts` | Fabbisogno, calorie, macro, target per giorno. Limiti permanenti, soglia individuale, casi da supervisionare, stima dinamica del dispendio. |
| E — Pasti | `src/lib/planning/diet-planner.ts`, `fitlab/meal-builder.ts`, `fitlab/pools.ts` | Applica gli adattamenti decisi (`DietAdaptations`). |
| F — Validazione | `src/domain/nutrition/validation.ts` | Controlli matematici, nutrizionali e strutturali del mese generato e dell'aggiornamento. |
| G — Spiegazione | `src/domain/recalibration.ts` | Cambi in italiano per l'utente, motivi, domande e `DecisionLog` completo. |

Orchestrazione: `recalibrate()` in `src/domain/recalibration.ts`, chiamata da `plan-store.recalibrateMonth`. Tutti i parametri modificabili stanno in `src/domain/nutrition/params.ts` (`NUTRITION_PARAMS`).

## Gerarchia decisionale

1. **Qualità dei dati e supervisione.** Con una situazione da supervisionare (vedi sotto) le calorie non si toccano. Con pesate insufficienti le calorie restano e si chiedono più pesate. Con una variazione temporanea spiegata da un evento si conferma e si rivaluta il mese dopo.
2. **Aderenza.** Se è bassa, i numeri non cambiano: si interviene su orari, quantità, alimenti e organizzazione. Fa eccezione la sicurezza, cioè un dimagrimento troppo rapido. Se è parziale e c'è una causa individuata (pasti fuori, pasti saltati, orari, stress, viaggi), si interviene sulla causa. Se è parziale senza causa, il passo calorico si dimezza.
3. **Andamento del peso**, con soglie relative al peso e al ritmo previsto (sotto).
4. **Fame, energia, recupero.** Con fame frequente, energia bassa o porzioni scarse un taglio si riduce a 50 kcal. Con energia molto bassa, o fame costante più stanchezza, nessuna restrizione.
5. **Difficoltà organizzative e alimentari**: orari, preparazione, organizzazione, pasti saltati, pasti fuori.
6. **Sostenibilità.** Niente oscillazioni: un passo opposto a quello del mese prima si dimezza, tranne quando corregge un ritmo troppo rapido.
7. **Calorie**, entro i limiti di sicurezza.
8. **Macro.** Profilo "sazietà" (+0,2 g/kg di proteine entro il 30% delle calorie) con fame frequente in deficit o mantenimento.
9. **Pasti, orari, alimenti**: adattamenti del piano.
10. **Generazione** del nuovo mese (`buildPlans`) e **validazione**.

Interventi possibili (`InterventionKind`): conferma, aumento o riduzione delle calorie, macro, distribuzione dei pasti, orari, alimenti, densità energetica, riduzione o aumento del volume, pasti fuori casa, settimana semplificata, richiesta di informazioni, valutazione professionale, segnale per l'allenamento. Più interventi possono convivere.

### Regole

| Regola | Quando | Cosa fa |
|---|---|---|
| R1 | Minorenne, gravidanza, allattamento, condizione medica, storia di disturbi alimentari | Calorie invariate, verdetto `professional_review` |
| R2 | Pesate insufficienti, trend non rappresentativo, variazione temporanea | Calorie invariate, richiesta di dati |
| R3 | Aderenza bassa | Nessun cambio dei numeri, piano più facile, interventi di sostenibilità |
| R4 | Aderenza parziale con causa (o senza: passo dimezzato) | Si interviene sulla causa |
| R5 | Dimagrimento: in linea / lento / stallo / peso in aumento / troppo rapido | 0 / −100 / −150 / −150 / +100 (solo con dati buoni e aderenza adeguata) |
| R6 | Massa: stallo / lento / troppo rapido | +150 / +100 / −100 (il rapido solo se costante per tutto il mese) |
| R7 | Mantenimento: peso che sale o scende in modo costante | ∓100 (variazione isolata: nessun intervento) |
| R8 | Fame, energia, recupero | Taglio ridotto o annullato; dimagrimento rapido con fame o stanchezza: +50 |
| R9 | Quantità eccessive o scarse | Distribuzione, volume, densità; in massa l'aumento resta entro 100 kcal |
| R10 | Correzione opposta al mese prima | Passo dimezzato (non per i ritmi troppo rapidi) |
| R11 | Fame frequente | Profilo sazietà, più verdura, distribuzione più uniforme (con 4 o più pasti) |
| R12 | Orari | Orari richiesti applicati; altrimenti orari flessibili (±60 min) e domanda |
| R13 | Alimenti | Esclusione degli alimenti da togliere, nuovi preferiti, rotazione rafforzata |
| R14 | Pasti fuori casa | N pranzi o cene "fuori casa" con budget e indicazioni, senza compensare |
| R15 | Preparazione, organizzazione, stress, pasti saltati | Settimana semplificata |
| R16 | Tempo, giorni, recupero dell'allenamento | Segnalati al piano di allenamento, non modificati dal motore nutrizionale |
| R17 | Attività cambiata | Stima del dispendio non aggiornata quel mese |
| R18 | Circonferenza vita | Registrata nel log |
| R19 | Informazione non chiara | Domanda di chiarimento, nessuna interpretazione inventata |
| R20 | Un limite di sicurezza modifica il passo | Intervento riscritto e motivato |

## Peso

- **Anomalie**: una pesata lontana più di 1 kg (o dell'1,5% del peso) dalla mediana delle pesate entro ±4 giorni viene esclusa.
- **Qualità dei dati**:
  - **limitata**: almeno 3 pesate in 14 giorni. Basta per le decisioni di sicurezza.
  - **buona**: almeno 6 pesate in 21 giorni. Serve per qualsiasi taglio o aumento su stallo o lentezza.
- **Persistenza**: trend del mese, trend delle ultime due settimane e differenza tra medie settimanali vanno nella stessa direzione.
- **Classi**:
  - fermo: |ritmo| ≤ 0,1% del peso a settimana, oppure sotto il 25% del previsto;
  - lento: sotto il 60% del previsto;
  - troppo rapido: oltre il 150% del previsto; in dimagrimento anche oltre l'1% del peso a settimana, in massa solo oltre lo 0,5%;
  - mantenimento: stabile entro max(0,2 kg; 0,3% del peso) a settimana.
- **Variazione temporanea**: con un evento (viaggio, malattia, ciclo, pasti salati, allenamenti intensi, stress) la variazione è temporanea se non è costante nel mese o se nasce dall'ultima settimana.

## Limiti di sicurezza

Valgono per **ogni mese di ogni versione** del piano: `computeTargets` li applica sempre e il controllo F li riverifica.

- **Deficit** massimo del 20% sul dispendio stimato. È lo stesso limite del primo piano.
- **Surplus** massimo del 15% e comunque non più di 500 kcal.
- **Soglia individuale**: il maggiore tra il minimo per sesso (1200 / 1500 / 1350 kcal) e il 90% del metabolismo basale.
- **Grassi** non sotto 0,6 g/kg né sotto il 20% delle calorie. **Proteine** tra 1,2 e 2,4 g/kg di peso di riferimento. **Carboidrati**: avviso sotto i 100 g.
- **Tolleranza di deriva (2%)**: un target che supera di poco un limite solo perché il modello si è spostato (nuovo peso, nuova stima) non viene ricalcolato. Le decisioni non usano la tolleranza: un taglio non supera mai il limite.
- Un passo che supera un limite viene **bloccato o ridotto, con il motivo** (R20).

## Coerenza delle calorie

Il target del mese successivo è **il target seguito più il passo deciso**. Il modello energetico serve solo a collocare quel numero nel piano: giorni di allenamento e di riposo, mesi successivi. Quindi "calorie confermate" significa stesso target. Un'eventuale differenza (allenamento diverso nel mese dopo, un limite) è scritta in `DecisionLog.otherChanges`.

**Stima dinamica del dispendio.** La stima si aggiorna solo con dati affidabili: almeno 20 giorni di pasti registrati, peso di qualità buona, aderenza alta, attività invariata e nessun evento. Si calcola il dispendio osservato (mangiato − variazione di peso × 7700 / 7) e si prende metà della differenza dalla stima attuale. La stima si muove al massimo del 7,5% al mese e resta entro ±15% dal modello. Serve per i limiti di deficit e surplus, non decide da sola.

## Storico

Ogni check-in salva un `RecalibrationRecord` con il `DecisionLog`:

- target precedente e nuovo, passo e altre differenze motivate;
- dispendio del modello e stima, deficit o surplus in percentuale;
- macro prima e dopo, peso, aderenza, sostenibilità;
- feedback letti, interventi, regole, alternative escluse, controlli di sicurezza, domande;
- risultato atteso. Al check-in successivo si aggiunge il **risultato ottenuto**.

## Check-in

Domande nuove, tutte facoltative (`monthly-checkin-schema.ts`):

- direzione delle porzioni (compare se si indicano difficoltà con le quantità);
- pasti saltati, pasti fuori casa, attività rispetto al mese prima;
- eventi del mese, circonferenza vita;
- orari desiderati (compare se si vogliono cambiare gli orari);
- alimenti da togliere e da aggiungere (compaiono se si vogliono alimenti diversi);
- situazioni particolari.

Tra le difficoltà ci sono anche preparazione e organizzazione. Senza la direzione delle porzioni, il motore la deduce dalla fame solo quando è inequivocabile (e lo segnala); altrimenti chiede.

## Adattamenti dei pasti (`DietAdaptations`)

| Campo | Effetto |
|---|---|
| `mealTimes`, `timeWindowMin` | Orari nuovi o finestre flessibili (`PlanMeal.timeWindow`) |
| `distribution` | `even`: quote dei pasti più uniformi. `lighterMains`: −15% a pranzo e cena, spostato su colazione e spuntini |
| `energyDense` | Verdura dei pasti principali ×0,6, carboidrati più densi, frutta secca ammessa, +5 g d'olio massimo |
| `highVolume` | Verdura dei pasti principali ×1,5 |
| `strongVariety` | Le ricette del mese prima costano molto di più; massimo 2 volte la stessa proteina nei pasti principali |
| `simplify` | Colazioni e spuntini ricorrenti, piatti principali veloci o da portare con sé |
| `eatOut` | N pranzi o cene "fuori casa" con budget e indicazioni, mai nel giorno del pasto libero |
| `dislikedFoodIds`, `extraPreferredFoodIds` | Esclusione vincolante e nuovi preferiti (sempre filtrati da regime e allergie) |
| `macroProfile` | `satiety` |

Sempre: tonno in scatola al massimo 2 volte a settimana in tutto il piano.

## Test

```
npx tsx scripts/agent-tests/nutrition-journey.ts out.json   # 6 casi di regressione + 18 scenari, exit 1 se fallisce
npx tsx scripts/agent-tests/run.ts                          # banco di prova esistente (22 questionari × scenari)
```

I sei utenti di `nutrition-cases.ts` hanno input **congelati**: le nuove decisioni si confrontano sempre con gli stessi dati. Ogni check-in è **superato**, **fallito**, **da valutare con un professionista** o **non valutabile** (dati insufficienti). Su ogni mese generato e su ogni aggiornamento girano `validateDietMonth` e `validateUpdate`.

Risultati dell’ultima esecuzione (39 check-in: 21 dei sei utenti, 18 scenari): 35 superati, 0 falliti, 2 da valutare con un professionista (gravidanza, minorenne), 2 non valutabili (una sola pesata, due pesate). Il banco di prova esistente resta a 0 errori.

## Eccezioni e limiti noti

- Per i minorenni le calorie non vengono mai ricalibrate in automatico: serve un professionista.
- Le note sono lette da un riconoscitore di parole chiave italiano. Ciò che non riconosce diventa una domanda. La lettura AI (`aiNoteFacts`) è prevista ma non collegata.
- Le circonferenze sono registrate ma non usate ancora per la ricomposizione: servono più mesi di dati.
- I segnali sull'allenamento vengono registrati; il piano di allenamento li applica con le sue regole (serie e carichi).
