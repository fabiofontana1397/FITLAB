# Motore nutrizionale adattivo (check-in mensile)

Alla fine di ogni mese del piano il motore legge **tutte** le risposte del check-in insieme alle pesate e ai pasti registrati, capisce **perché** il mese è andato così e sceglie l'intervento più adatto. Le calorie sono uno degli interventi possibili, non la risposta automatica al peso.

Il motore è deterministico: stessi dati, stessa decisione. Calcoli, limiti e controlli di sicurezza non dipendono dall'AI. Un agente AI può solo proporre una lettura strutturata delle note (`NoteFacts`) o una proposta (`RecalibrationProposal`), che passano dagli stessi controlli.

## Novità di fitlab-9

Refactoring mirato su sostituzioni, macronutrienti, pasti liberi e varietà. Architettura, profili, target e motore adattivo sono invariati.

**Sostituzioni** (`lib/planning/fitlab/meal-builder.ts`, `lib/planning/substitution.ts`)

- Un'alternativa proposta (`item.substitutes`) è solo un suggerimento: il menu non cambia. Ogni alternativa porta i valori del catalogo per la sua porzione (kcal, P, C, G, fibre), la classificazione `equivalent` / `tradeoff` e una nota sulle differenze.
- La porzione è dimensionata per **ruolo**: una fonte proteica mantiene le proteine, una fonte di carboidrati mantiene carboidrati ed energia, un grasso mantiene i grassi, le verdure si scambiano per porzione. Tolleranze in `NUTRITION_PARAMS.substitution` (nutriente del ruolo ±20%; energia ±25% / ±15% / ±20% o entro 40, 40, 30 kcal). Se nessun alimento resta nella tolleranza, i più vicini (entro il 25%) sono proposti come compromesso dichiarato.
- `applySubstitution(plan, req, person)` applica un'alternativa: rifiuta se non è più compatibile con regime, allergie, esclusioni; ricalcola alimento, pasto, nome della ricetta; giornata e settimana sono derivate dai pasti; se la giornata esce dalla banda ±2,5% ribilancia gli altri alimenti (non quello sostituito). `substitutedFrom` traccia l'originale, che diventa a sua volta un'alternativa. Azione di store: `usePlanStore.applySubstitution`; nell'app il pulsante «Usa» sotto ogni alternativa.

**Motore dei macronutrienti** (`diet-planner.reconcileDay`)

- Ogni giornata è riconciliata da sola (nessuna compensazione tra giorni) con mosse di porzione singole o a coppie (più proteine e meno carboidrati a parità di energia) che minimizzano: energia fuori banda (dominante) ≫ scarto proteico (la carenza pesa il doppio dell'eccesso) > carboidrati e grassi, con una lieve centratura sul target. Pesi in `NUTRITION_PARAMS.macros`.
- Porzioni entro i limiti dell'alimento nel pasto e tra 60–160% della scelta iniziale (proteine 65–150%); uova ≤ 200 g al giorno; mai sotto la soglia di sicurezza.

**Pasti liberi** (`lib/planning/free-meal.ts`)

- Senza registrazione il pasto libero ha solo il budget: i suoi macro **non sono disponibili** e non valgono mai zero; la giornata è «parzialmente osservata» (V20 INFO) e i controlli sui macro valgono sulla quota con macro noti.
- `buildFreeMealLog` / `logFreeMeal`: alimenti e grammi → `measured` (valori del catalogo); descrizione con alimenti del catalogo → `estimated` (porzioni standard, scalate alle calorie dichiarate; metodo scritto); sole calorie o alimenti fuori catalogo → `calories_only` (macro non disponibili); niente calorie né alimenti → non registrato.
- Il diario non inserisce più una pizza fittizia al posto del pasto libero: inserisce solo alimenti registrati con i grammi.

**Varietà e fonti proteiche**

- Tetto settimanale per alimento proteico su **tutti** i pasti (4) e per le uova, intere e albumi insieme (4 pasti), quando esistono alternative; famiglia proteica ripetuta nella stessa giornata penalizzata anche a colazione e negli spuntini; rotazione tra mesi più forte (`previousMonthCost` 110).
- V8, V9 e V18 valutano le alternative realmente disponibili: una ripetizione imposta da regime ed esclusioni è INFO con il motivo, una evitabile è WARNING.
- Con restrizioni che non lasciano alcuna ricetta per un pasto il piano non viene pubblicato (V21 BLOCKER con spiegazione): nessun alimento inventato.

**Validatore**

- V14: alternativa proposta con differenze → INFO aggregato; valori mostrati diversi dal catalogo o alternativa presentata come equivalente senza esserlo → WARNING; sostituzione applicata senza ricalcolo → WARNING; alternativa o sostituzione incompatibile → BLOCKER; sostituzione applicata e ricalcolata → nessuna segnalazione.
- V16: scostamento giornaliero irrilevante (nessuna segnalazione), moderato (INFO aggregato, WARNING se ripetuto 3 giorni nella stessa direzione), significativo (WARNING); media settimanale fuori target; proteine insufficienti in g/kg; grassi oltre il 20–40% dell'energia; carboidrati sotto il minimo. Soglie in `NUTRITION_PARAMS.macroCheck`.

## Novità di fitlab-8

- **Motore di sicurezza prima di tutto.** `supervisionReasons` (in `nutrition/safety.ts`) viene chiamato per primo da `goalPace`/`computeTargets`, `buildPlans` e `recalibrate`.
  - **Condizioni:** minore età; gravidanza, allattamento, condizione medica o storia di disturbi alimentari, dalla nuova domanda `specialConditions` del questionario o dal check-in.
  - **Dal questionario:** nessun piano alimentare, nessun deficit o surplus (solo la stima del fabbisogno, a titolo informativo), nessun adattamento. La pagina Piani mostra `NutritionSupervisionCard` con indicazioni generali.
  - **Dal check-in:** il piano viene congelato (`DietPlan.supervision`, salvato con il piano) senza toccare lo storico: niente nuove rotazioni, calorie, macro né adattamenti.
  - **Riattivazione:** solo con `reactivateNutrition`, quando il questionario non segnala più la condizione **e** la persona conferma la valutazione di un professionista. Un aggiornamento del questionario non la riattiva.
- **Un'unica fonte dei valori nutrizionali.** Ogni alimento del piano porta grammi, kcal, proteine, carboidrati, grassi e fibre presi dal catalogo. Pasto, giorno e settimana sono sempre somme (`sumNutrition`, `withTotals`, `dayNutrition`): nessun valore scritto a mano.
  - **Fattori di conversione UE:** P 4, carboidrati disponibili 4, G 9, fibre 2 kcal/g. Il catalogo non ha polioli né alcol. Tutti i 157 alimenti tornano entro il 6%.
  - **Solutore delle porzioni:** il secondo passaggio toglie l'energia delle fibre dal target dei carboidrati, così le calorie di etichetta arrivano sul target.
- **Riconciliazione della giornata** (`reconcileDay`). Prima le proteine (fino al 95% del target), poi l'energia entro ±2,5% del target del giorno, senza mai scendere sotto la soglia giornaliera. Si muovono carboidrati, grassi e proteine a passi pratici, entro i limiti di porzione, e i sostituti si ricalcolano sulla nuova porzione.
- **Validazione a tre livelli e blocco della pubblicazione.**
  - **BLOCKER:** valori mancanti, valori diversi dal catalogo, somme sbagliate, alimenti non ammessi, limiti di sicurezza, giorno oltre ±8%, media settimanale oltre ±4%, calorie e macro oltre il 6%.
  - **WARNING:** varietà, sostituti, macro del giorno, giorno oltre ±5%.
  - **INFO.**
  - `buildPlans` valida ogni mese generato: con un BLOCKER il nuovo piano non viene pubblicato e resta quello precedente (`dietBlocked`, `dietIssues`).
- **Gerarchia tra preferenze e restrizioni:** sicurezza > allergie e intolleranze > esclusioni > regime > preferenze > varietà.
  - Un alimento richiesto che va in conflitto non viene salvato: il conflitto viene segnalato e si chiede conferma.
  - Il regime cambia solo con la conferma esplicita della domanda di check-in `checkinDietaryPattern`. Il profilo viene aggiornato e il piano rigenerato.
- **Varietà.**
  - Memoria di due mesi: costo 70 per una ricetta del mese prima, 35 per quella di due mesi prima; con rotazione rafforzata il costo sale a 120.
  - Niente stesso pranzo o cena due giorni di fila.
  - Alternanza delle categorie proteiche.
  - Le metriche (`varietyMetrics`) separano ripetizione della ricetta, alimento principale, fonte proteica, categorie e mese su mese. La ripetizione tra mesi è giudicata rispetto alle ricette compatibili con la persona: con un catalogo ristretto (per esempio pescetariana senza lattosio) è segnalata come inevitabile.
- **Sostituti equivalenti.** La porzione bilancia il nutriente del ruolo e l'energia: nutriente entro ±25%, energia entro ±25%. Se non esiste un equivalente si offre un solo sostituto entro ±40% (±60% per le proteine magre come il tonno), segnalato da V14.

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

## Test (fitlab-9)

`nutrition-journey.ts` esegue 71 test: i 57 di fitlab-8 con gli stessi identificativi e 14 nuovi (`t01`–`t14`): uova ↔ albume, yogurt 2% ↔ 0%, kefir ↔ yogurt, alternativa non scelta, sostituzione applicata su tutti i livelli (e rilevazione di quella non ricalcolata), giornata con macro fuori target, settimana in media ma giorni sbilanciati, pasto libero senza macro, pasto libero dettagliato e più pasti liberi, varietà di Elena su 4 mesi contro fitlab-8, ripetizione delle uova, restrizioni molto severe, sostituzione con allergene, cambio del numero di pasti. Ogni profilo ha anche una simulazione di quattro sostituzioni applicate (`substitutions` nel JSON).

Risultato: 63 superati, 0 falliti, 5 da professionista, 3 non valutabili. Nei piani generati: 0 blocker, 75 warning, 207 info (fitlab-8: 0, 419, 4). Banco di prova esistente: 0 errori, 10 avvisi (fitlab-8: 14).

```
npx tsx scripts/agent-tests/nutrition-journey.ts out.json   # regressione, scenari, validatore, test fitlab-9; exit 1 se fallisce
npx tsx scripts/agent-tests/run.ts                          # banco di prova esistente (22 questionari × scenari)
```

I sei utenti di `nutrition-cases.ts` hanno input **congelati**: le nuove decisioni si confrontano sempre con gli stessi dati. Ogni check-in è **superato**, **fallito**, **da valutare con un professionista** o **non valutabile** (dati insufficienti). Su ogni mese generato e su ogni aggiornamento girano `validateDietMonth` e `validateUpdate`. Un test passa solo senza blocker e sui risultati misurati.

Storico: fitlab-7 35/39 check-in superati; fitlab-8 49/57 test superati, 0 falliti.

## Eccezioni e limiti noti

- Per i minorenni non si genera un piano alimentare (fitlab-8): serve un professionista. Il piano di allenamento resta, con le sue regole.
- Durante la supervisione il piano di allenamento continua con le proprie regole: il motore nutrizionale non lo modifica.
- La Home e il diario usano ancora l'obiettivo calorico del profilo: per chi è sotto supervisione è la stima del fabbisogno (nessun deficit o surplus).
- Le note sono lette da un riconoscitore di parole chiave italiano. Ciò che non riconosce diventa una domanda. La lettura AI (`aiNoteFacts`) è prevista ma non collegata.
- Le circonferenze sono registrate ma non usate ancora per la ricomposizione: servono più mesi di dati.
- I segnali sull'allenamento vengono registrati; il piano di allenamento li applica con le sue regole (serie e carichi).
- Proteine sotto target per regimi con catalogo limitato (vegetariani e vegani): le proteine prescritte restano dal −9 al −13% sotto target per Giulia e più in basso per il profilo vegano, perché le ricette compatibili hanno fonti proteiche poco dense (legumi, latticini) e la porzione non può crescere oltre i limiti. Il validatore lo segnala (V16 settimana e proteine insufficienti); servono ricette o alimenti proteici vegetali nel catalogo.
- Elena (pescetariana senza lattosio): 7–8 pasti con uova a settimana, contro 8–9 in fitlab-8. Le colazioni compatibili senza uova sono due su sei e le uova sono tra i suoi alimenti preferiti; le altre ripetizioni sono scelte per non scendere con le proteine (priorità sopra la varietà). La ripetizione tra mesi resta al 59–63%.
- Il pasto libero si registra dal piano (`logFreeMeal`); il diario non ha ancora una schermata dedicata per descriverlo e mostra il giorno senza quel pasto finché non si inseriscono gli alimenti.
- In un caso di bassa aderenza con calorie invariate (banco storico, M4) il mese rigenerato coincide con quello precedente: con gli stessi input la scelta dei piatti è deterministica.
