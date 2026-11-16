# Motore della dieta (framework Fit Lab)

Il piano alimentare segue la gerarchia del framework Fit Lab:

```
profilo → target nutrizionali → struttura del pasto → alimenti → quantità → ricette → varietà
```

Nessuna chiamata AI per utente: il motore è deterministico (costo zero). Il catalogo viene da un file Excel che si modifica a mano; l'AI di strategia (`generate-plan-strategy`) scrive solo i testi dei mesi.

## Struttura dei pasti: una fonte per ruolo

La dieta è volutamente standard: pasti semplici da preparare, in cui ogni alimento si sostituisce con un altro dello stesso ruolo.

| Pasto | Struttura |
|---|---|
| **Pranzo e cena** | **Primo** (una sola fonte di carboidrati) + **secondo** (una sola fonte di proteine) + **contorno** (una verdura) + **olio extravergine d'oliva**, unico grasso aggiunto. Qualsiasi primo va con qualsiasi secondo |
| **Colazione** | Porridge (con yogurt o con albumi) · avocado toast con uova · uova strapazzate con pane · frittata di albumi con pane · pane, ricotta e marmellata · yogurt greco con cereali integrali · latte proteico con cereali integrali · yogurt greco con avena |
| **Merenda** | Yogurt greco con frutta · yogurt greco con avena · pan bauletto con marmellata · panino con affettato (fesa di tacchino, bresaola o prosciutto crudo) |

Regole fisse, verificate dal banco di prova (Q13–Q16):

- **Mai due fonti di carboidrati nello stesso pasto** (pasta e pane, riso e patate) e **mai due fonti di proteine**. Se un pasto è molto abbondante cresce la porzione dell'unica fonte, non se ne aggiunge una seconda.
- **Primi**: pasta, pasta integrale, riso, riso basmati, riso integrale, patate, patate dolci, pane (integrale, di segale, bauletto), gallette (riso, mais, farro) e **legumi** (ceci, fagioli, lenticchie), che a pranzo e cena sono la fonte di carboidrati al posto del primo.
- **Secondi**: petto di pollo, petto di tacchino, vitello, manzo (bistecca), macinato di manzo magro, hamburger (manzo, pollo, tacchino), merluzzo, orata, lonza, salmone, tonno al naturale, uova.
- **Contorni**: zucchine, insalata, pomodori, broccoli, spinaci, fagiolini, carote, finocchi, peperoni, melanzane, cavolfiore, bietole, più le verdure preferite dalla persona.
- **Affettati al massimo una volta a settimana** (in tutta la settimana, non per pasto).
- **Legumi al massimo una volta al giorno.**
- **Sostituzioni standard**: ogni primo elenca altri primi, ogni secondo altri secondi, ogni contorno altre verdure, con la quantità già ricalcolata. A colazione e merenda si sostituisce tra alimenti dello stesso tipo (yogurt con yogurt, pane con pane, uova con albumi).

Eccezioni, solo quando le esclusioni della persona non lasciano alternative:

- chi non mangia carne ha come secondi anche uova, albumi, fiocchi di latte, mozzarella light e ricotta; chi non mangia né carne né pesce anche i legumi, accanto a un cereale;
- chi non può mangiare i pasti standard di colazione o merenda (per esempio senza latticini) riceve i pasti di riserva (`reserve` in `dishes.ts`): frutta e frutta secca, uova sode con pane, latte senza lattosio o bevanda di soia con cereali, porridge con bevanda vegetale.

## Fonti dei dati

| Cosa | Dove | Come si modifica |
|---|---|---|
| **Catalogo alimenti** (157): categoria, regimi, allergeni, stato (secco/crudo/cotto), kcal e macro per 100 g | `data/fitlab/fitlab-catalogo-piatti.xlsx`, foglio "Catalogo Fit Lab" | Modifica l'Excel, poi `npm run catalog:import` rigenera `src/lib/planning/fitlab/data/foods.generated.ts` |
| **Valori nutrizionali** | `scripts/catalog/nutrition-data.ts` → colonne dell'Excel | `npx tsx scripts/catalog/fill-nutrition.ts <in.xlsx> <out.xlsx>` |
| **Pasti standard** e liste di primi, secondi e contorni | `src/lib/planning/fitlab/dishes.ts` | Modifica le liste `PRIMI`, `SECONDI`, `CONTORNI` o aggiungi un pasto: i nomi degli alimenti devono essere quelli del catalogo (un errore blocca il caricamento). Ogni pasto ha una ricetta in `recipes.ts` (`npm run recipes:check`) |

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
| 3. Pasto | `fitlab/dishes.ts` | Il pasto standard definisce i ruoli: base (primo), proteine (secondo), contorno (verdura o frutta), olio EVO, aromi. Un solo alimento per ruolo |
| 4. Quantità | `fitlab/solver.ts` | Grammi calcolati insieme su proteine, carboidrati e grassi del pasto, con porzioni realistiche e pesi nello stato del catalogo |
| 5. Scelta | `fitlab/meal-builder.ts` | Prova i pasti e le combinazioni primo / secondo / contorno, tiene la più vicina ai target con meno ripetizioni |
| 6. Sostituzioni | `meal-builder.ts` | Liste standard (primo per primo, secondo per secondo, verdura per verdura), con la quantità ricalcolata sul nutriente che l'alimento porta |

**Pranzo veloce, pesce a cena.** Il pesce da cuocere va a cena (il tonno in scatola va bene a pranzo). Controllo Q10 nel banco di prova.

Gli spuntini sono senza cottura.

## Alimenti preferiti (questionario)

Nel questionario, step "Preferenze alimentari", ci sono **cinque selettori** — proteine, carboidrati, grassi, frutta, verdura — ognuno con l'elenco degli alimenti del catalogo (raggruppati per tipo, con ricerca). Le risposte sono id del catalogo (`preferredProteins`, `preferredCarbs`, `preferredFats`, `preferredFruit`, `preferredVegetables`); i codici generici delle risposte vecchie ("chicken", "rice"…) vengono tradotti negli alimenti che intendevano (`lib/questionnaire/food-preferences.ts`).

Il motore li usa come alimenti **preferenziali**, mese dopo mese:

- hanno un peso alto (×2) e, se ne hai scelti alcuni in un componente, gli altri di quel componente restano possibili ma meno probabili;
- un alimento preferito non ancora comparso nella settimana è favorito, così tutti i preferiti arrivano in tavola;
- a pranzo e cena possono fare da primo o da secondo se sono della stessa famiglia di quelli standard (un altro cereale, un altro pesce), e qualsiasi verdura preferita può fare da contorno; colazioni e merende restano quelle standard (cambia solo la frutta);
- restano validi tutti i filtri: regime, allergeni, esclusioni, pranzo veloce, spuntini senza cottura.

Il banco di prova (Q11) verifica che gli alimenti scelti con i nuovi selettori compaiano nella settimana di ogni mese.

## Varietà categorica

In una settimana lo stesso pasto non torna più di 2 volte per slot (penalità quasi proibitiva dalla seconda ripetizione), lo stesso primo non più di 2 a pranzo e 2 a cena e mai a pranzo e cena dello stesso giorno, la stessa proteina non più di 3 tra pranzi e cene e mai a pranzo e cena dello stesso giorno. Il banco di prova misura la ripetizione massima su tutte le persone (Q7/Q9).

## Piani già salvati

Un piano generato da una versione precedente (`DietPlan.engine` ≠ `DIET_ENGINE_VERSION`) viene ricostruito dalla tab Nutrizione **mantenendo data di inizio, calibrazione e storico dei check-in**.

## Cosa non fa (ancora)

Stagionalità, budget e tempo a disposizione per cucinare non sono domande del questionario: il motore non li usa. I pasti fuori casa sono gestiti solo scegliendo piatti trasportabili a pranzo. Le fonti esterne non vengono consultate a runtime: i valori sono scritti nel catalogo una volta.
