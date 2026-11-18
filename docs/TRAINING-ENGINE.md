# Motore dell’allenamento (v4, `training-4`)

Il motore progetta un programma di allenamento completo invece di riempire una scheda da un catalogo:

```
profilo → modello di programmazione → giorni e split → periodizzazione → volume per gruppo muscolare
→ sedute (esercizi, blocchi, ordine, tempo) → serie/ripetizioni/RIR/recuperi/tempo → carichi → corsa → sicurezza
→ check-in mensile → nuova calibrazione → mesi successivi ricostruiti
```

È deterministico (nessuna chiamata AI per utente) e ogni scelta è motivata nel piano (`TrainingPlan.rationale`, `orderingReason`, `notes` della seduta, `mesocycle` del mese).

## 1. Base scientifica

Si distingue sempre tra evidenza, principio consolidato e pratica dei preparatori. Nessun programma di un atleta professionista è copiato.

| Tema | Cosa si usa | Fonte | Tipo |
|---|---|---|---|
| Volume | Relazione dose-risposta con rendimenti decrescenti; serie contate in modo **frazionario** (1 diretta, 0,5 indiretta) | Schoenfeld, Ogborn, Krieger 2017; Pelland et al. 2024 | Meta-analisi |
| Volume per seduta | Oltre ~11 serie frazionarie per muscolo in una seduta il guadagno non si misura più | Remmert et al. 2025 (preprint) | Meta-regressione, da confermare |
| Frequenza | A parità di volume conta poco per l'ipertrofia: serve a distribuire il volume | Schoenfeld 2016/2019; Grgic 2018; Pelland 2024 | Meta-analisi |
| Carichi e ripetizioni | Ipertrofia simile su un ampio intervallo di carichi; la forza massima richiede carichi alti | Schoenfeld et al. 2017, 2021 | Meta-analisi / review |
| Vicinanza al cedimento | Il cedimento non è necessario; 1-3 RIR bastano per l'ipertrofia, la forza è poco sensibile al RIR | Refalo et al. 2023; Robinson et al. 2024 | Meta-analisi |
| RIR / RPE | Scala RPE basata sul RIR; stime imprecise soprattutto nei principianti | Zourdos et al. 2016; Helms et al. 2016; Steele et al. 2017 | Studi sperimentali |
| Recuperi | Recuperi più lunghi preservano le ripetizioni delle serie successive | Schoenfeld et al. 2016 | RCT |
| Ordine | Grandi gruppi prima dei piccoli, multiarticolari prima dei monoarticolari | ACSM 2009 | Position stand |
| Lunghezza muscolare | Lavorare in allungamento sembra utile per l'ipertrofia | Wolf et al. 2023 | Meta-analisi (evidenza in evoluzione) |
| Deload | Periodo di stress ridotto per dissipare la fatica, da inserire quando serve | Bell et al. 2023 | Consenso Delphi (opinione esperta) |
| Deficit calorico | Allenamento di forza strutturato per conservare la massa magra | Helms et al. 2014/2015 | Review |
| Corsa + forza | Interferenza legata a frequenza e durata della corsa; separare le sedute intense | Wilson et al. 2012; Schumann et al. 2022 | Meta-analisi |

Approccio "alla Presti" (pratica, non evidenza): qualità dell'esecuzione, esercizi regolabili e adatti alla persona, volume gestito e individuale. Nel motore diventa: esercizi stabili e misurabili quando non ci sono dati sulla persona, stessi esercizi principali per tutto il piano, varietà solo sugli accessori, sostituzioni guidate dal feedback (dolore, preferenze).

## 2. Audit del motore precedente (`training-2`)

| Problema | Causa nel codice | Correzione |
|---|---|---|
| 3×10 / 3×12 frequenti | Una tabella di schemi per ruolo uguale per tutti; `adattamento` dava 3×10-12 a tutti | `prescription.ts`: schemi per modello × ruolo × blocco, range per tipo di esercizio |
| Carichi iniziali bassi | `bwMultiplier` × 0,55 per chi non si è mai allenato × 0,85 in adattamento × fattore ripetizioni | `loads.ts`: 1RM stimato per sesso, livello ed età, carico per ripetizioni + RIR (Epley), −10%, marcato "da calibrare" |
| Tempo quasi sempre uguale | Un tempo per ruolo | `tempoFor`: profilo dell'esercizio (pesante, allungamento, contrazione, macchina, corpo libero) |
| Gruppi alternati senza criterio | Esercizi in ordine di lista per split, ruoli assegnati dopo | `session-builder.ts`: blocchi per gruppo, multiarticolari prima, core in fondo, motivazione per ogni esercizio |
| Progressione non applicata a tutti | +4%/mese arrotondato a 2,5 kg: spesso invisibile; +3% del check-in valido un mese | Doppia progressione sugli storici; stima mensile mai decrescente, ancorata al peso del questionario |
| Volume che cambia troppo | +1 serie dal terzo mese, −1 serie dal check-in e consolidamento con meno serie, tutto insieme | Volume per gruppo con variazioni del 5-15% e motivate; consolidamento −12% |
| Richieste non recepite | Il check-in leggeva solo energia e dolori | Domande di approfondimento (giorni, split, zone doloranti), note lette per dolore e giorni, tempo |
| Attrezzatura non rispettata | All'aperto si usavano elastici senza chiederli | Domanda attrezzatura anche per aperto/misto, catalogo con attrezzi richiesti, controllo indipendente |

## 3. Moduli

| Modulo | Responsabilità |
|---|---|
| `training/catalog.ts` | 71 esercizi con muscolo primario e regione, secondari (0,5 serie), pattern, tipo, livello tecnico, stabilità, porzione caricata (allungamento/contrazione), attrezzatura, tipo di carico, incremento minimo, 1RM stimato rispetto al peso corporeo, zone articolari, indicazioni tecniche |
| `training/profile.ts` | Livello (anni + tecnica + età: in caso di disaccordo vince la lettura prudente), modello (ipertrofia, forza, dimagrimento, ricomposizione, resistenza muscolare, salute, corsa con forza), obiettivo secondario, attrezzatura, esclusioni, note per minorenni e over 55 |
| `training-days.ts` | Giorni, precedenza corsa/palestra dichiarata, disposizione che tiene le corse intense lontane dalle gambe, recupero di una seduta saltata |
| `training/split.ts` | Full Body, Upper/Lower, Upper/Lower+Full, PPL, PPL+UL, Push/Pull, split per gruppo (solo su richiesta) |
| `training/periodization.ts` | Blocchi mensili (adattamento, accumulo, intensificazione, consolidamento), 4 settimane con RIR e note, scarico condizionale o deciso dal check-in |
| `training/volume.ts` | Target settimanale per gruppo e misura di serie dirette, indirette, frazionarie e frequenza |
| `training/session-builder.ts` | Scelta degli esercizi, blocchi, ordine, uso del tempo libero, superset antagonisti e tagli quando il tempo non basta |
| `training/prescription.ts` | Serie, range, RIR, RPE, recupero, tempo, tecnica di intensificazione, criterio di progressione |
| `training/loads.ts` | Carico iniziale da calibrare, stima mensile, doppia progressione, 1RM di seduta |
| `training/running.ts` | Corsa facile, lungo, ripetute, ritmo medio con durata, intensità, struttura e progressione |
| `training/adaptation.ts` | Check-in mensile dell'allenamento |
| `training/safety.ts` | Controllo finale: attrezzatura, zone doloranti, cedimento, serie, durata, volume massimo |
| `training-planner.ts` | Orchestratore; mantiene i mesi già vissuti |

## 4. Regole principali

**Livello.** Principiante se la tecnica è da principiante o l'esperienza è sotto i 6 mesi; avanzato solo con tecnica avanzata e almeno 3 anni (sotto i 60 anni); altrimenti intermedio.

**Split.** Principiante 3 giorni → Full Body A/B/C; intermedio 3 giorni → Upper/Lower + Full Body; avanzato 3 giorni con sedute lunghe → PPL; 4 giorni → Upper/Lower ×2 (avanzato con sedute lunghe → Push/Pull con gambe); 5 giorni → Upper/Lower + PPL; 6 → PPL ×2. La preferenza dichiarata vince se è applicabile ai giorni. La split per gruppo muscolare non è mai scelta da sola: ogni seduta supererebbe il volume utile per seduta.

**Volume (serie frazionarie a settimana, intermedio in ipertrofia).** Petto 12, dorsali 10, alta schiena 9, deltoide laterale 10, posteriore 7, quadricipiti 12, femorali 9, glutei 9, polpacci 6, bicipiti 8, tricipiti 8, core 6. Principiante ×0,65, avanzato ×1,2; forza: ×0,9 sui gruppi dei fondamentali, ×0,6 sugli accessori; dimagrimento ×0,85; salute ×0,6; over 55 ×0,85. Se il tempo non basta, i gruppi grandi conservano più volume dei piccoli (che ricevono lavoro indiretto) e il piano lo dichiara.

**Prescrizioni (esempi).** Ipertrofia: principale 6-10 RIR 2 con 150 s, complementare 8-12 RIR 2 con 120 s, isolamento 10-15 RIR 1 con 75 s (alzate laterali 12-20). Forza: principale 3-5 RIR 2 con 210 s. Principianti: RIR ≥2 e recuperi un po' più brevi. Cedimento (RIR 0) mai sui multiarticolari, mai per principianti e minorenni.

**Tempo** (eccentrica-pausa in allungamento-concentrica-pausa in contrazione): pesanti 2-0-1-0 (2-0-X-0 per la forza), allungamento 3-1-1-0, contrazione 2-0-1-1, macchine 3-0-1-0, principianti in adattamento 3-0-1-0.

**Carichi.** Mese 1: stima prudente "da calibrare" con istruzioni. Dopo: stima che non scende finché non ci sono dati. Con lo storico: doppia progressione (range completato con il RIR previsto → +1 incremento reale; serie molto più facili → +2; sotto il range due volte → −8%).

**Tecniche di intensificazione.** Solo avanzati in ipertrofia, solo sull'ultimo isolamento a cavi o macchine (myo-reps in accumulo, drop set in intensificazione); top set + back-off sui principali di forza in intensificazione; superset antagonisti quando il tempo è poco (non per principianti).

**Check-in.** Bassa aderenza → capire la causa (tempo → sedute più corte; altrimenti −15% di serie), mai più volume. Prestazioni in calo + stanchezza o dolori → settimana di scarico. Dolori con prestazioni in crescita → RIR +1, volume invariato. Prestazioni in crescita e energia alta → volume +5% fino a +10%. Prestazioni stabili con RIR registrato molto sopra il previsto → RIR −1. Dolore (domanda o note) → zona esclusa, progressione congelata, invito a una valutazione. Giorni e split richiesti → applicati davvero.

## 5. Domande aggiunte

- Questionario: attrezzatura anche per chi si allena all'aperto o in modo misto (con sbarra e parallele), precedenza tra palestra e corsa per chi fa entrambe.
- Check-in: dolore articolare con zona, quanti giorni (se chiede di cambiarli), quale struttura (se chiede di cambiarla).

## 6. Cosa non fa ancora

- Gruppi muscolari prioritari, esercizi graditi o non graditi e obiettivi secondari non sono chiesti nel questionario: il motore li supporta (`groupSets`, `replaceIds`) ma per ora li usa solo il check-in.
- L'AI di strategia (`generate-plan-strategy`) scrive solo i testi dei mesi: le split suggerite dall'AI non sono più usate, perché la split deriva dal volume e dai vincoli.
- Gli 1RM stimati sono punti di partenza: senza storico il carico va sempre calibrato.

## 7. Test

```
npx tsx scripts/agent-tests/training-cases.ts     # 26 casi + indicatori di qualità su 360 profili
npx tsx scripts/agent-tests/training-journey.ts   # 7 utenti di regressione con check-in mensili
npm run agents:test                               # 22 questionari, controlli su dieta e allenamento
```

## 8. Refactoring v4 (`training-4`)

Correzioni mirate su `training-3`: ogni decisione del motore deve essere applicata agli esercizi e verificata su ciò che è prescritto, mai su un flag.

### Audit: cause delle anomalie

| Anomalia | Causa | Tipo |
|---|---|---|
| Scarico dichiarato ma serie invariate (Luca M5, Elena M4) | `setsFactor` e `rirOffset` restavano nei metadati del mesociclo; la seduta aveva un'unica prescrizione mensile | generazione |
| Petto e quadricipiti a 0, alta schiena e bicipiti sopra obiettivo con dolori (Elena) | il riempimento del tempo libero alzava ogni gruppo fino al massimo, anche quando altri erano esclusi per dolore | calcolo |
| Full Body senza tirata (Paolo) | nessun controllo degli schemi motori; Y-T-W tolto per stare in 4 esercizi | validazione |
| Alta schiena sovradosata (Luca, Marco) | lo stacco rumeno e gli stacchi contavano l'alta schiena come sinergico (è un isometrico) e il riempimento arrivava al massimo | calcolo |
| Polpacci a 0 (Marco) | il gruppo tolto per tempo non veniva più reintrodotto | generazione |
| Due sedute di forza consecutive con la corsa (Andrea) | giorni fissi da uno schema settimanale, assegnati senza ragionare su tutta la settimana | generazione |
| Stacco rumeno con bilanciere e con manubri nella stessa seduta | la selezione penalizzava lo stesso schema ma non lo escludeva | generazione |
| Confronto uguale per tutte le versioni nel report | metriche calcolate da un file sovrascritto, non dai dataset | validazione |
| Carichi che salivano a calendario | proiezione mensile senza dati di prestazione | calcolo |

### Cosa cambia

- **Catena mesociclo → settimana → seduta → esercizio** (`periodization.ts`, `prescription.ts → weekPrescription`, `types.ts → ExerciseWeekRx`): ogni esercizio porta le prescrizioni effettive delle 4 settimane. Nello scarico: serie × `setsFactor` (il principale almeno 2), RIR + `rirOffset` (max 4), carico circa −10% arrotondato all'incremento, niente tecniche di intensità (il superset antagonista resta: fa solo risparmiare tempo). Lo scarico "se serve" dell'avanzato è condizionale: le prescrizioni ci sono, l'app non lo applica da sola. L'app mostra la settimana corrente (`training/week.ts`).
- **Dolori**: gli esercizi che caricano una zona indicata sono esclusi; se un gruppo resta senza varianti compatibili è sospeso, tracciato in `exclusions` con il motivo e il suo volume non va su altri gruppi. Con più zone o più gruppi sospesi il piano invita a una valutazione professionale. Nessuna diagnosi, nessun esercizio di recupero proposto.
- **Schemi motori** (`session-builder.ts → ensureCoverage, measureCoverage`): spinta, tirata, ginocchio, anca e core sulla settimana. Se manca uno schema si aggiunge o si sostituisce un accessorio che non è l'unico a coprire un altro schema; se l'attrezzatura permette solo una versione parziale (es. Y-T-W senza sbarra né elastico) lo stato è "parziale" e il limite è scritto nel piano.
- **Volume** (`balanceVolume`, `catalog.ts`): muscoli stabilizzatori separati dai sinergici (non contano), contributo indiretto configurabile per esercizio (`indirectShare`, default 0,5), riempimento fino a circa +20% dell'obiettivo e non al massimo, bilanciamento settimanale (aumenta i gruppi sotto l'80%, riduce le serie dirette oltre il 130%), gruppi senza lavoro diretto reintrodotti dove c'è spazio. Stato per gruppo: ok, sotto, sopra (solo per serie dirette), escluso, con motivo. La decisione di volume del check-in si applica dopo il tetto di tempo.
- **Settimana ibrida** (`training-days.ts → arrangeWeek`): con la corsa i giorni sono scelti insieme alle sedute, minimizzando forza consecutiva, gambe prima di corse dure, ripetute vicine al lungo. Il compromesso inevitabile è spiegato. Corsa: volume e intensità crescono in mesi alterni, il lungo resta entro il 45% della settimana, una settimana di recupero ogni tre mesi.
- **Similarità** (`nearDuplicate`): stesso gruppo, schema, porzione di ROM, regione, stabilità e tipo di carico (libero o macchina) = quasi identici, non nella stessa seduta salvo specializzazione.
- **Push/Pull/Legs su 4 giorni**: la quarta seduta è Full Body, così anche le gambe si allenano due volte.
- **Carichi**: nessun aumento a calendario; dal mese 2 resta il carico di partenza (adeguato a ripetizioni e RIR del mese) finché la doppia progressione sullo storico non decide un aumento.
- **Validatore a tre livelli** (`safety.ts → validateMonth`, salvato in `month.validation`): blocchi (attrezzatura, zone doloranti, prescrizioni non valide, scarico che non alleggerisce davvero, mesociclo e sedute disallineati), avvisi (volume fuori obiettivo, frequenza, esercizi quasi identici, settimana ibrida, recupero tra stimoli, schemi mancanti, durata), note (esclusioni, coperture parziali, motivazione degli scarichi).

### Modello dati

Nuovi campi opzionali, compatibili con i piani salvati: `TrainingExerciseEntry.weeks`, `activeWeek`; `run.weeks`; `mesocycle.weeks[].deload/conditional/sets`; `weeklyVolume[].status/reason`; `patternCoverage`, `exclusions`, `validation` sul mese. Catalogo: `stabilizers`, `indirectShare`. Il cambio di versione ricostruisce i piani `training-3` al primo avvio.

### Test

`npm run training:journey -- data.json`, `npm run training:compare -- <cartella>` (scrive `compare` in `data.json` ricalcolandolo da `before.json`, `v3.json`, `data.json`), `FITLAB_REPORT_DIR=<cartella> npm run training:cases -- cases.json`. I 26 casi precedenti restano (il 22 ora verifica anche le serie effettive) più i casi A–J (27–36).
