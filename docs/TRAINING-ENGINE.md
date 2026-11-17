# Motore dell'allenamento (v3, `training-3`)

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
