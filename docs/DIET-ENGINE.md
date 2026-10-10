# Motore della dieta (framework Fit Lab)

Il piano alimentare segue la gerarchia del framework Fit Lab:

```
profilo → target nutrizionali → struttura del pasto → alimenti → quantità → ricette → varietà
```

Nessuna chiamata AI per utente: il motore è deterministico (costo zero). Catalogo e piatti vengono da un file Excel che si modifica a mano; l'AI di strategia (`generate-plan-strategy`) scrive solo i testi dei mesi.

## Fonti dei dati

| Cosa | Dove | Come si modifica |
|---|---|---|
| **Catalogo alimenti** (170): categoria, regimi, allergeni, stato (secco/crudo/cotto), kcal e macro per 100 g | `data/fitlab/fitlab-catalogo-piatti.xlsx`, foglio "Catalogo Fit Lab" | Modifica l'Excel, poi `npm run catalog:import` rigenera `src/lib/planning/fitlab/data/foods.generated.ts` |
| **Valori nutrizionali** | `scripts/catalog/nutrition-data.ts` → colonne dell'Excel | `npx tsx scripts/catalog/fill-nutrition.ts <in.xlsx> <out.xlsx>` |
| **Piatti** (49 dal file + 50 aggiunti dall'agente) | `src/lib/planning/fitlab/dishes.ts` | Aggiungi una voce: i nomi degli alimenti devono essere quelli del catalogo (un errore blocca il caricamento) |

Convenzioni: valori per 100 g **nello stato del catalogo** (pasta e riso a secco, carne e pesce a crudo, legumi cotti); carboidrati disponibili (senza fibra); kcal = 4P + 4C + 9F + 2·fibre (Reg. UE 1169/2011). Sono medie di riferimento (CREA, USDA, etichette) da validare con un professionista.

## Come nasce un pasto

| Passo | Dove | Cosa fa |
|---|---|---|
| 1. Target | `domain/targets.ts` | Calorie e macro di ogni giorno (allenamento incluso), poi quota per pasto da `lib/nutrition/meal-distribution.ts` (colazione ≈ 24%, spuntino ≈ 12%, pranzo ≈ 34%, cena ≈ 31%) |
| 2. Filtri | `fitlab/pools.ts` | Regime alimentare e allergeni dalle colonne del catalogo, esclusioni per nome, pesi dalle preferenze / abitudini / alimenti richiesti; chi mangia spesso fuori ha pranzi trasportabili |
| 3. Ricetta | `fitlab/dishes.ts` | Il piatto definisce i ruoli: base (primo), proteine (secondo), contorni (verdure o frutta), grassi, olio EVO, passata, condimenti. Il primo alimento di ogni lista è quello scritto nel file, gli altri sono le alternative |
| 4. Quantità | `fitlab/solver.ts` | Grammi calcolati insieme su proteine, carboidrati e grassi del pasto, con porzioni realistiche e pesi nello stato del catalogo |
| 5. Scelta | `fitlab/meal-builder.ts` | Prova i piatti migliori e le combinazioni di alimenti, tiene la più vicina ai target con meno ripetizioni |
| 6. Sostituzioni | `meal-builder.ts` | Alimenti della stessa categoria compatibili col pasto, con la quantità ricalcolata sul nutriente che l'alimento porta |

**Pranzo veloce, pesce a cena.** A pranzo solo piatti veloci da preparare: i piatti lunghi (forno, polenta, ragù, zuppe, risotti, riso nero/rosso, farro e orzo) restano per la cena (campo `slow` in `dishes.ts`), e il pesce da cuocere va a cena (il tonno in scatola va bene a pranzo). Controllo Q10 nel banco di prova.

Gli spuntini sono senza cottura; pranzo e cena hanno sempre una verdura e un carboidrato; la colazione ha proteine, carboidrati e frutta o grassi.

## Varietà categorica

In una settimana lo stesso pasto non torna più di 2 volte per slot (penalità quasi proibitiva dalla seconda ripetizione), lo stesso piatto non più di 2, la stessa proteina non più di 3 tra pranzi e cene. Dove le esclusioni restringono il catalogo (lattosio, uova, regime vegetariano) restano comunque molte alternative nei piatti. Il banco di prova misura la ripetizione massima su tutte le persone (Q7/Q9).

## Piani già salvati

Un piano generato da una versione precedente (`DietPlan.engine` ≠ `DIET_ENGINE_VERSION`) viene ricostruito dalla tab Nutrizione **mantenendo data di inizio, calibrazione e storico dei check-in**.

## Cosa non fa (ancora)

Stagionalità, budget e tempo a disposizione per cucinare non sono domande del questionario: il motore non li usa. I pasti fuori casa sono gestiti solo scegliendo piatti trasportabili a pranzo. Le fonti esterne non vengono consultate a runtime: i valori sono scritti nel catalogo una volta.
