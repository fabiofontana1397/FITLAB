# Come i dati del questionario e dei piani popolano l'app

Stato dopo il rifacimento del dominio (`src/domain/*`, vedi [ARCHITECTURE-AGENTS.md](ARCHITECTURE-AGENTS.md)).
I controlli automatici stanno in `scripts/agent-tests/flow.ts` (`npm run agents:test`).

## 1. Il percorso dei dati

1. **Domande** → `onboarding-store.setAnswer` salva le risposte sul server (`onboarding_answers`). I numeri sono stringhe; il questionario (versione 3) ha limiti min/max per età, altezza, peso e peso obiettivo.
2. **"Conferma"** (`onboarding.tsx`):
   1. `cleanAnswersForMode` toglie le risposte dell'altra modalità (niente allenamenti fantasma per chi fa solo dieta);
   2. `buildUserContext(answers)` → persona normalizzata;
   3. `generatePlans` → `buildPlans` produce **insieme** dieta e allenamento (target calorici dal modello energetico, accoppiati alla settimana di allenamento); la strategia AI (se disponibile) aggiunge solo metodologia e testi;
   4. `profileFromContext` salva il profilo coi target del primo mese; `resetStartingWeight` il peso di partenza.
3. Il profilo è considerato completo quando ha un target calorico > 0 (non dalle risposte): chi abbandona il questionario a metà ricomincia dall'onboarding.
4. Alla sincronizzazione col server, `hasSynced` impedisce che il piano scaricato sovrascriva uno appena generato.

## 2. Da dove legge ogni schermata

| Schermata | Legge |
|---|---|
| **Home** | target del giorno dal piano alimentare; obiettivo settimanale = bilancio previsto dal piano (`weeklyBalanceGoal`); dispendio dal modello `domain/energy` |
| **Nutrizione** | pasti, calorie e macro **del giorno** dal piano (i pasti mostrati sono quelli scelti dall'utente); "Segui il piano" riempie il giorno fino al target; utenti solo allenamento vedono "Non richiesto" |
| **Allenamento** | settimana del mese corrente; durata e kcal da `sessionMinutes`/`sessionKcal` (stesso modello che fissa le calorie) |
| **Dettaglio allenamento** | esercizi del giorno dal piano |
| **Progressi** | peso e misure dal diario del corpo; peso obiettivo dal profilo (0 = non impostato → nessuna linea obiettivo) |
| **Profilo** | profilo e risposte; "Check-in mensile" al posto del vecchio "Rivedi il mio target" |
| **Check-in mensile** | peso del mese, sedute fatte, giorni tracciati, risposte → `recalibrateMonth` → dieta e allenamento riscritti dal mese dopo |
| **Chat e insight (AI)** | `buildClientContext`: oggi dal piano generato, aderenza 14 giorni, riepilogo del piano e ultima ricalibrazione |

Il giorno della settimana da una data ISO si calcola sempre con `isoMondayIndex` (`lib/mock/dates.ts`); `getDay()` locale è vietato (controllo G2).

## 3. Domande senza effetto

Raccolte ma non lette: `generalActivityLevel`, `bedTime`, `wakeTime`, `sleepQuality`, `dietaryPatternOther`, `preferredProteinsOther`, `preferredCarbsOther`, `preferredFatsOther`.

Usate poco: `eatingOut`, `coffeeIntake`, `alcoholIntake` (solo elenco in Profilo). Nel check-in mensile contano aderenza dichiarata, energia, fame, difficoltà e richieste di cambiamento.
L'agente AI di strategia ora riceve età, sesso, altezza, peso, peso obiettivo, lavoro, passi, sonno, attrezzatura e alimenti preferiti.

## 4. Problemi risolti (controllati da `npm run agents:test`)

G1 id pasti per utente · G2 giorno della settimana · G3/P2 peso obiettivo inventato · G4 caricamento infinito · G5 onboarding a metà · P1 sport per solo dieta · P3 risposte vecchie dopo cambio modalità · P4 frequenze "ogni 2 settimane/mese" · N1 pasti fissi · N3 cena libera · H1 obiettivo settimanale incoerente · rigenerazione dei piani da tab (race con il server) · check-in mensile (mese sbagliato, strategia persa, base kcal) · "Sport → Modifica" · modello energetico doppio · `adaptation-evaluate` (target solo nel profilo: sostituito dalla ricalibrazione, funzione marcata deprecata).

## 5. Ancora aperto

- **Corsa**: le sedute di corsa non hanno dettaglio né spunta nell'app (le calorie previste invece sì, via `runSessionKcal`).
- `suggestedNextLoadForExercise` (RIR) non è usata; `weekly-burn-chart.tsx` non è usato.
- Strategia AI e ricalibrazione AI (`RecalibrationProposal`) non ancora collegate end-to-end: oggi la ricalibrazione è deterministica con i guardrail.
- Il test `--ai` (funzione reale su Supabase) richiede `TEST_EMAIL`/`TEST_PASSWORD` e non è stato eseguito.
