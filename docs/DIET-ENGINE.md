# Motore della dieta (framework Fit Lab)

Il piano alimentare segue la gerarchia del framework Fit Lab:

```
profilo → target nutrizionali → struttura del pasto → alimenti → quantità → ricette → varietà
```

Nessuna chiamata AI per utente: il motore è deterministico (costo zero). Catalogo e piatti vengono da un file Excel che si modifica a mano; l'AI di strategia (`generate-plan-strategy`) scrive solo i testi dei mesi.

## Fonti dei dati

| Cosa | Dove | Come si modifica |
|---|---|---|
| **Catalogo alimenti** (154): categoria, regimi, allergeni, stato (secco/crudo/cotto), kcal e macro per 100 g | `data/fitlab/fitlab-catalogo-piatti.xlsx`, foglio "Catalogo Fit Lab" | Modifica l'Excel, poi `npm run catalog:import` rigenera `src/lib/planning/fitlab/data/foods.generated.ts` |
| **Valori nutrizionali** | `scripts/catalog/nutrition-data.ts` → colonne dell'Excel | `npx tsx scripts/catalog/fill-nutrition.ts <in.xlsx> <out.xlsx>` |
| **Piatti** (dal file + aggiunti dall'agente) | `src/lib/planning/fitlab/dishes.ts` | Aggiungi una voce: i nomi degli alimenti devono essere quelli del catalogo (un errore blocca il caricamento) |

Il catalogo contiene solo alimenti comuni nella cucina italiana di tutti i giorni: niente tofu, seitan, edamame, polenta, quinoa, grano saraceno, riso rosso o venere, crema di riso, semi di canapa, noci e burro di macadamia, burro di anacardi e di noci, germogli, bevanda di cocco.

Convenzioni: valori per 100 g **nello stato del catalogo** (pasta e riso a secco, carne e pesce a crudo, legumi cotti); carboidrati disponibili (senza fibra); kcal = 4P + 4C + 9F + 2·fibre (Reg. UE 1169/2011). Sono medie di riferimento (CREA, USDA, etichette) da validare con un professionista.

## Calorie del giorno

```
calorie(giorno) = dispendio del giorno (metabolismo + attività quotidiana + allenamento previsto)
                  + bilancio dell'obiettivo (deficit, surplus o 0)
```

I giorni di allenamento mangiano di più, esattamente quanto brucia la seduta; i giorni di riposo mangiano meno. Così **ogni giorno** ha lo stesso bilancio (calorie − dispendio): è l'obiettivo che Home mostra, ed è anche la scomposizione esatta dello scostamento (calorie assunte contro piano e calorie bruciate contro piano). Proteine e grassi restano costanti, i carboidrati assorbono la variazione.

Unica eccezione: la soglia minima di sicurezza (`MIN_CALORIES`). Se un giorno di riposo di un piano piccolo e aggressivo scendesse sotto, resta alla soglia e la differenza viene tolta ai giorni che hanno margine, così la settimana mantiene il bilancio previsto (nota in `adjustments`). Il controllo C7 del banco di prova verifica che ogni giorno rispetti il bilancio.

## Come nasce un pasto

| Passo | Dove | Cosa fa |
|---|---|---|
| 1. Target | `domain/targets.ts` | Calorie e macro di ogni giorno (vedi «Calorie del giorno»), poi quota per pasto da `lib/nutrition/meal-distribution.ts` (colazione ≈ 24%, spuntino ≈ 12%, pranzo ≈ 34%, cena ≈ 31%) |
| 2. Filtri | `fitlab/pools.ts` | Regime alimentare e allergeni dalle colonne del catalogo, esclusioni per nome, pesi dalle preferenze / abitudini / alimenti richiesti; chi mangia spesso fuori ha pranzi trasportabili |
| 3. Ricetta | `fitlab/dishes.ts` | Il piatto definisce i ruoli: base (primo), proteine (secondo), contorni (verdure o frutta), grassi, olio EVO, passata, condimenti. Il primo alimento di ogni lista è quello scritto nel file, gli altri sono le alternative |
| 4. Quantità | `fitlab/solver.ts` | Grammi calcolati insieme su proteine, carboidrati e grassi del pasto, con porzioni realistiche e pesi nello stato del catalogo |
| 5. Scelta | `fitlab/meal-builder.ts` | Prova i piatti migliori e le combinazioni di alimenti, tiene la più vicina ai target con meno ripetizioni |
| 6. Sostituzioni | `meal-builder.ts` | Alimenti della stessa categoria compatibili col pasto, con la quantità ricalcolata sul nutriente che l'alimento porta |

**Pranzo veloce, pesce a cena.** A pranzo solo piatti veloci da preparare: i piatti lunghi (forno, ragù, zuppe, risotti, farro e orzo) restano per la cena (campo `slow` in `dishes.ts`), e il pesce da cuocere va a cena (il tonno in scatola va bene a pranzo). Controllo Q10 nel banco di prova.

Gli spuntini sono senza cottura; pranzo e cena hanno sempre una verdura e un carboidrato; la colazione ha proteine, carboidrati e frutta o grassi.

## Alimenti preferiti (questionario)

Nel questionario, step "Preferenze alimentari", ci sono **cinque selettori** — proteine, carboidrati, grassi, frutta, verdura — ognuno con l'elenco degli alimenti del catalogo (raggruppati per tipo, con ricerca). Le risposte sono id del catalogo (`preferredProteins`, `preferredCarbs`, `preferredFats`, `preferredFruit`, `preferredVegetables`); i codici generici delle risposte vecchie ("chicken", "rice"…) vengono tradotti negli alimenti che intendevano (`lib/questionnaire/food-preferences.ts`).

Il motore li usa come alimenti **preferenziali**, mese dopo mese:

- hanno un peso alto (×2) e, se ne hai scelti alcuni in un componente, gli altri di quel componente restano possibili ma meno probabili;
- un alimento preferito non ancora comparso nella settimana è favorito, così tutti i preferiti arrivano in tavola;
- possono sostituire gli alimenti di un piatto della stessa famiglia (un altro cereale, un'altra carne bianca) e qualsiasi verdura o frutta preferita può fare da contorno;
- restano validi tutti i filtri: regime, allergeni, esclusioni, pranzo veloce, spuntini senza cottura.

Il banco di prova (Q11) verifica che gli alimenti scelti con i nuovi selettori compaiano nella settimana di ogni mese.

## Varietà categorica

In una settimana lo stesso pasto non torna più di 2 volte per slot (penalità quasi proibitiva dalla seconda ripetizione), lo stesso piatto non più di 2, la stessa proteina non più di 3 tra pranzi e cene. Dove le esclusioni restringono il catalogo (lattosio, uova, regime vegetariano) restano comunque molte alternative nei piatti. Il banco di prova misura la ripetizione massima su tutte le persone (Q7/Q9).

## Piani già salvati

Un piano generato da una versione precedente (`DietPlan.engine` ≠ `DIET_ENGINE_VERSION`) viene ricostruito dalla tab Nutrizione **mantenendo data di inizio, calibrazione e storico dei check-in**.

## Cosa non fa (ancora)

Stagionalità, budget e tempo a disposizione per cucinare non sono domande del questionario: il motore non li usa. I pasti fuori casa sono gestiti solo scegliendo piatti trasportabili a pranzo. Le fonti esterne non vengono consultate a runtime: i valori sono scritti nel catalogo una volta.
