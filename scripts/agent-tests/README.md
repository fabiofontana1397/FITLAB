# Test dei piani (questionario → dieta e allenamento)

Banco di prova per verificare che, partendo da un questionario di onboarding, l'app produca piani sensati.

```bash
npm run agents:test                              # tutte le persone
npm run agents:test -- --persona anna-ginocchio  # una sola
npm run agents:test -- --verbose                 # stampa anche le note informative
```

Il comando esce con codice 1 se c'è almeno un errore (❌), quindi si può usare come controllo prima di un deploy.
Il report leggibile viene scritto in `scripts/agent-tests/reports/latest.md`.

## Come funziona

| File | Cosa fa |
|---|---|
| `personas.ts` | Questionari finti ma completi (stessi id e valori di `src/lib/questionnaire/schema.ts`), ognuno con una descrizione e le aspettative ("deficit", "niente latticini", "nessun esercizio per il ginocchio"…). |
| `run.ts` | Per ogni persona esegue la stessa pipeline dell'onboarding: calcolo dei target, durata, piano alimentare, piano di allenamento (generatori deterministici, senza strategia AI) e poi i controlli. |
| `checks.ts` | I controlli, indipendenti dal codice dei generatori: target calorici e macro, calorie e macro reali dei pasti, alimenti vietati (vegano, allergie), porzioni realistiche, sedute/settimana, split in base all'esperienza, limitazioni fisiche, attrezzatura a casa, progressione dei mesi, coerenza dieta ↔ allenamento. |

Livelli: ❌ errore (il piano è sbagliato), ⚠️ avviso (discutibile), ℹ️ nota.

## Aggiungere una persona

Aggiungi un oggetto a `PERSONAS` in `personas.ts` (usa `base({...})` per partire da un questionario completo e cambiare solo
ciò che serve) e, se vuoi, imposta `expect` per le regole specifiche (`calories`, `gymSessions`, `avoidAreas`, `forbiddenFoodIds`…).

## Seconda fase: l'app viene popolata correttamente?

`flow.ts` ricostruisce cosa leggono Home, Nutrizione, Allenamento, Progressi e Profilo dopo l'onboarding (stessi helper delle
schermate) e cerca valori mancanti, incoerenti o fuorvianti. La mappa completa dei dati è in `docs/DATA-FLOW.md`.
Include anche `checkGlobal`, controlli strutturali sul codice (id dei pasti, peso obiettivo di default, gestione errori…).

Personaggi pensati apposta per questa fase: `tommaso-saltuario`, `nina-senza-peso-obiettivo`, `omar-ex-allenamento`.

## Modalità AI (facoltativa)

```bash
TEST_EMAIL=… TEST_PASSWORD=… npm run agents:test -- --ai --persona marco-32   # una persona
# --all per tutte (16 richieste, costose)
```

Chiede la strategia all'agente Claude reale (funzione `generate-plan-strategy` sul progetto Supabase online, consuma token)
e controlla anche la strategia restituita. Consuma crediti: da usare solo quando cambia il prompt o la funzione, e su una persona alla volta.

## Simulazione della ricalibrazione mensile

`simulate.ts` fa girare, per ogni persona, un ciclo chiuso su più mesi: un "corpo" simulato (metabolismo come previsto, più lento,
più veloce, oppure aderenza dimezzata) segue il piano, pesa e fa il check-in; il motore (`domain/recalibration.ts`) ricalibra
dieta e allenamento. Invarianti verificate (M1–M7): mai sotto il minimo calorico, passo mensile e tetto totale rispettati,
nessun cambio sui mesi passati, bassa aderenza non cambia i numeri, peso che converge verso l'obiettivo, dieta e allenamento
sempre coerenti. Il log mostra "60 scenari ok" quando tutto passa.

Persone: solo persone comuni (16–60 anni, sedentarie o molto attive, principianti o esperte). Casi clinici (obesità, celiachia,
veganismo stretto…) richiedono un dietologo e non fanno parte dei test.
