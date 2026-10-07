# Come i dati del questionario e dei piani popolano l'app

Mappa ricavata leggendo il codice (analisi statica) e confermata, dove indicato con ✅, da un controllo automatico in
`scripts/agent-tests/flow.ts` (`npm run agents:test`). Le voci senza ✅ sono ipotesi dell'analisi, non ancora verificate con un test.

## 1. Il percorso dei dati

1. **Domande** → `onboarding-store.setAnswer` salva l'intero blocco di risposte sul server (`onboarding_answers`) a ogni risposta. I numeri sono stringhe, lette con `parseNumericAnswer`.
2. **"Conferma"** (`onboarding.tsx` → `confirmProfile`) esegue in ordine:
   1. `computeNutritionTargets` → calorie, macro, idratazione (una sola volta);
   2. `finalizeOnboarding` → il **profilo** riceve solo 9 campi: obiettivo, sport, sesso, età, altezza, peso obiettivo, calorie, macro, idratazione;
   3. `resetStartingWeight` → peso di partenza nel diario del corpo;
   4. `generatePlans` → strategia AI (se disponibile) + piano alimentare + piano di allenamento (`dietPlan = null` se modalità "allenamento", `trainingPlan = null` se "dieta").
3. Tutto il resto (`mode`, peso attuale, lavoro, durata sedute, giorni disponibili, `freq_*`…) vive **solo nelle risposte**: le schermate che lo servono leggono `useOnboardingStore.answers`.

## 2. Da dove legge ogni schermata

| Schermata | Legge | Note |
|---|---|---|
| **Home** | target kcal dal mese corrente del piano alimentare (se manca, dal profilo); sesso/età/altezza dal profilo; peso dal diario del corpo; lavoro e durata sedute dalle risposte; allenamenti dal piano di allenamento | Obiettivo settimanale = target×7 − dispendio stimato a piena aderenza (modello diverso da quello del target) |
| **Nutrizione** | calorie e macro del mese corrente (profilo solo come ripiego); pasti del giorno dal piano per "Segui il piano" | I 6 pasti sono fissi (`MEAL_SLOTS`), non quelli scelti dall'utente |
| **Allenamento** | settimana del mese corrente del piano per giorno; durata e kcal dalle risposte e dal peso | Le sedute di corsa sono solo testo |
| **Dettaglio allenamento** | esercizi del giorno, GIF e istruzioni dal catalogo | |
| **Progressi** | peso e misure dal diario del corpo; peso obiettivo dal **profilo** | |
| **Profilo** | profilo, risposte (abitudini, sport), stima iniziale | "Sport" mostra `profile.sports` |
| **Piani (dieta/allenamento)** | mesi, pasti, esercizi del piano | I mesi si sbloccano per tempo **e** check-in; le tab usano solo il tempo |
| **Chat e insight (AI)** | profilo (target kcal, proteine), voci pasti, peso | Il contesto di allenamento usa ancora la scheda statica "Push/Pull/Legs" del vecchio store |

## 3. Domande senza effetto

✅ Raccolte ma non lette da nessuna parte: `generalActivityLevel`, `bedTime`, `wakeTime`, `sleepQuality`, `dietaryPatternOther`, `preferredProteinsOther`, `preferredCarbsOther`, `preferredFatsOther`.

Usate in un solo punto: `dailySteps` e `sleepHoursRange` (solo ritocchi al fabbisogno al momento dell'onboarding), `eatingOut`, `coffeeIntake`, `alcoholIntake` (solo elenco in Profilo), `equipment` (solo scheda a casa). `dietaryPattern` ha effetto solo per vegano/vegetariano/pescetariano (mediterranea, low carb, altro: nessuno). Nel check-in mensile solo `checkinHungerLevel` è usata.

L'agente AI di strategia **non vede**: età, sesso, altezza, peso, peso obiettivo, lavoro, passi, sonno, attrezzatura e liste di proteine/carboidrati/grassi preferiti.

## 4. Problemi trovati

Verificati con un controllo automatico (✅ = riproducibile con `npm run agents:test`):

| # | Problema | Dove |
|---|---|---|
| ✅ G1 | Gli id dei pasti inseriti con "Segui il piano" (`plan-<data>-<pasto>-<n>`) non contengono l'utente, ma `meal_entries.id` è chiave primaria globale: due utenti che seguono il piano nello stesso giorno si scontrano e il salvataggio sul server fallisce in silenzio | `nutrition-store.ts`, migrazione `0010` |
| ✅ G5 | Chi abbandona il questionario a metà: le risposte parziali sono già sul server e al riavvio `hasOnboarded` diventa vero; arriva in Home con profilo a zero e le tab generano piani con target 0 kcal | `onboarding-store.ts`, `_layout.tsx` |
| ✅ P2/G3 | Peso obiettivo facoltativo: se vuoto il profilo salva 75 kg (anche nella direzione sbagliata rispetto all'obiettivo); Progressi e Profilo usano quel valore, il piano dura 4 mesi | `onboarding.tsx` |
| ✅ P3 | Rifacendo il questionario in modalità "solo dieta" restano le vecchie risposte di allenamento: il fabbisogno conta ancora quegli allenamenti e la dieta alterna giorni di allenamento/riposo | `targets.ts`, `training-days.ts` |
| ✅ P4 | "Una volta ogni 2 settimane" / "una volta al mese" per la palestra: il piano programma comunque 3 sedute a settimana, il fabbisogno ne conta 0 | `training-days.ts` |
| ✅ P1 | Utente solo dieta: il profilo salva "palestra" come sport per default | `onboarding.tsx` |
| ✅ N1 | La tab Nutrizione mostra sempre 6 pasti con orari fissi, anche se l'utente ne fa 3 | `nutrition.tsx` |
| ✅ N3 | Nel giorno della cena libera, "Segui il piano" riempie solo il 55–73% delle calorie del giorno | `diet-planner.ts`, `nutrition-store.ts` |
| ✅ H1 | Obiettivo settimanale mostrato in Home molto diverso da quello voluto dal piano (es. −434 contro −3332 kcal/sett.) | `index.tsx`, `use-weekly-energy.ts` |
| ✅ G4 | `generatePlans` senza `try/catch`: un errore lascia il caricamento infinito | `plan-store.ts` |
| ℹ️ S2 | Le sedute di corsa non hanno dettaglio, spunta né calorie previste | `training.tsx` |
| ℹ️ S3/S4 | Utenti "solo dieta" o "solo allenamento": la tab dell'altro piano resta visibile con messaggi poco adatti | `training.tsx`, `nutrition.tsx` |
| ℹ️ G2 | Giorno della settimana dei piani sbagliato di uno per utenti a ovest di Greenwich | `mondayIndex` su date ISO |

Da verificare (analisi statica, non ancora coperti da test):

- Le tab Nutrizione/Allenamento rigenerano **entrambi** i piani quando ne manca uno e possono farlo prima che finisca la sincronizzazione (azzerano `generatedAt`, creano versioni, possono cancellare un piano sul server).
- Il target adattato dal motore di adattamento aggiorna solo il profilo: Home e Nutrizione continuano a mostrare il target del mese del piano; chat e insight mostrano quello del profilo.
- Il check-in mensile rigenera dal mese dopo quello appena sbloccato e perde la strategia AI; usa come base la kcal del profilo e non quella del piano.
- "Sport praticati → Modifica" in Profilo non fa nulla (`/onboarding` viene rimandato in Home).
- Modello energetico diverso tra target (lavoro + 3%/allenamento + passi + sonno) e Home (basale × lavoro + MET); le uscite di corsa non danno calorie previste.
- Peso mai aggiornato nei target dopo le pesate; `suggestNextLoad` (RIR) non è mai chiamata; `plan-theory-modal.tsx` non è usato.
- Funzioni Supabase: il prompt della strategia ignora molti dati; `adaptation-evaluate` conta anche i giorni riempiti dal piano come assunzione reale.

## 5. Utenti con un solo piano

- **Solo dieta** (`mode='diet'`): nessuna domanda di allenamento. Home mostra "Allenamenti 0/0", ma "Registra allenamento" funziona; Allenamento mostra "Nessun programma generato…" (frase fuorviante).
- **Solo allenamento** (`mode='training'`): calorie e macro sono comunque calcolate e salvate nel profilo; Home e Nutrizione le mostrano; la tab Nutrizione ha tutti e 6 i pasti e nessun piano ("Nessun piano generato"). "Rivedi il mio target" in Profilo modifica un target che nessun piano usa.
- **Solo corsa**: piano con sedute di corsa soltanto come testo, nessun dettaglio esercizi, nessuna spunta.
