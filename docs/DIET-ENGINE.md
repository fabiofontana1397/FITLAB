# Motore della dieta (framework Fit Lab)

Il piano alimentare è costruito nell'ordine definito dal framework Fit Lab:

```
profilo → target nutrizionali → struttura del pasto → alimenti → quantità → ricette → varietà
```

Nessuna chiamata AI per utente: il motore è deterministico (costo zero) e usa il catalogo e le ricette scritti una volta in `src/lib/planning/fitlab/`. L'AI di strategia (`generate-plan-strategy`) scrive solo i testi dei mesi.

## Come nasce un pasto

| Passo | Dove | Cosa fa |
|---|---|---|
| 1. Target | `domain/targets.ts` | Calorie e macro di ogni giorno (allenamento incluso), poi quota per pasto da `lib/nutrition/meal-distribution.ts` (colazione ≈ 24%, spuntino ≈ 12%, pranzo ≈ 34%, cena ≈ 31%) |
| 2. Catalogo | `fitlab/catalog.ts` | Per ogni pasto (colazione, spuntino, pranzo, cena) le liste di proteine, carboidrati, grassi, verdura e frutta del framework |
| 3. Filtri | `fitlab/pools.ts` | Allergie, intolleranze, esclusioni, dieta (vegetariana…); pesi dalle preferenze, dagli alimenti "di solito" e da quelli richiesti; chi mangia spesso fuori ha pranzi trasportabili |
| 4. Ricetta | `fitlab/dishes.ts` | Il piatto dice quali alimenti possono stare insieme ("Porridge proteico", "Pasta al tonno", "Bowl", "Poke", "Frittata"…): gli abbinamenti senza senso sono impossibili |
| 5. Quantità | `fitlab/solver.ts` | Grammi calcolati insieme su proteine, carboidrati e grassi del pasto, con porzioni realistiche (uova intere, frutta a pezzi, niente 400 g di yogurt) |
| 6. Scelta | `fitlab/meal-builder.ts` | Prova i piatti migliori e le combinazioni di alimenti, tiene la più vicina ai target con meno ripetizioni (stessa proteina mai a pranzo e cena, piatti diversi nella settimana) |
| 7. Sostituzioni | `meal-builder.ts` | Alimenti della stessa categoria, con la quantità ricalcolata sul nutriente che l'alimento porta (non grammo per grammo) |

Regole del framework verificate dal banco di prova: spuntini senza cottura, nessun latticino/integratore a pranzo e cena, verdura a pranzo e cena, ogni pasto è un piatto con nome, alimenti fuori catalogo solo come fallback quando le esclusioni svuotano una categoria.

## Aggiungere un alimento o un piatto

- **Alimento**: aggiungilo a `lib/mock/food-database.ts` (valori per 100 g da CREA/USDA), poi al catalogo del pasto in `fitlab/catalog.ts` e, se serve, al nome breve (`SHORT`). Se si conta a pezzi (barretta, galletta) aggiungilo a `UNIT_GRAMS` in `solver.ts` e a `food-quantity.ts`.
- **Piatto**: aggiungi una voce a `DISHES` in `fitlab/dishes.ts` con i ruoli ammessi. `npm run agents:test` controlla (Q0) che ogni alimento sia nel catalogo del pasto e che gli spuntini non richiedano cottura.
- Per piatti pensati solo per vegetariani usa `meatless: true` / `meatlessProtein`.

## Piani già salvati

Un piano senza nomi di piatto (generato prima di questo motore) viene riconosciuto come obsoleto e ricostruito dalla tab Nutrizione **mantenendo data di inizio, calibrazione e storico dei check-in** (`generatePlans(..., { keepProgress: true })`).

## Cosa non fa (ancora)

Stagionalità, budget e tempo a disposizione per cucinare non sono domande del questionario: il motore non li usa. I pasti fuori casa sono gestiti solo scegliendo piatti trasportabili a pranzo. Le fonti esterne (CREA, USDA…) non vengono consultate a runtime: i valori sono scritti nel database una volta.
