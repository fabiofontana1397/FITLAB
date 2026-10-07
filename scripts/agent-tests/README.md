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
