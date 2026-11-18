# Motore della dieta (framework Fit Lab)

Il piano alimentare segue la gerarchia del framework Fit Lab:

```
profilo → target nutrizionali → struttura del pasto → alimenti → quantità → ricette → varietà
```

Nessuna chiamata AI per utente: il motore è deterministico (costo zero). Il catalogo viene da un file Excel che si modifica a mano; l'AI di strategia (`generate-plan-strategy`) scrive solo i testi dei mesi.

## Pool di ricette standard a rotazione

La dieta usa un **pool fisso di ricette** (`fitlab/dishes.ts`), ognuna con il suo nome, la sua preparazione (`recipes.ts`) e la sua foto (`dish-images.ts`):

| Pasto | Ricette | Struttura |
|---|---|---|
| **Colazione** | 20 (B01–B20) | Porridge, uova, pane con ricotta o fiocchi di latte, yogurt greco con cereali o frutta, latte con cereali |
| **Merenda** | 20 (S01–S20) | Yogurt greco con frutta o avena, pane con marmellata, panini con affettato (una volta a settimana), crackers con tonno, hummus, frutta |
| **Pranzo** | 50 (L01–L50) | **Primo** (una fonte di carboidrati) + **secondo** (una fonte di proteine) + **contorno** (una verdura) + **olio extravergine d'oliva**. Veloce: niente pesce da cuocere (il tonno in scatola va bene) |
| **Cena** | 50 (D01–D50) | Stessa struttura del pranzo, con il pesce |
| **Riserva** | 4 (R01–R04) | Legumi accanto a un cereale, per chi non mangia carne, pesce, uova né latticini |

Gli ingredienti di una ricetta **non cambiano** da persona a persona: cambiano solo i grammi, calcolati sui macro del pasto. Per questo la foto mostra sempre il piatto descritto dal nome. Le alternative in un ruolo sono solo alimenti uguali nel piatto (pasta e pasta senza glutine, riso e riso basmati, yogurt greco 0% e 2%): si usa il primo consentito alla persona.

**Rotazione.** In una settimana la stessa ricetta torna al massimo due volte per pasto; da un mese al successivo (e quando il piano viene aggiornato) le ricette del mese prima passano in coda, così il nuovo mese porta soprattutto ricette diverse (sui profili di prova cambia circa l'86% delle ricette tra mesi consecutivi).

**Preferenze del questionario.** Non cambiano gli ingredienti: fanno uscire più spesso le ricette che contengono gli alimenti scelti (il primo a pranzo e cena pesa di più, poi il secondo, poi contorno e frutta), e prima di tutto quelle con un alimento scelto non ancora mangiato in settimana.

**Esclusioni, regime e allergeni.** Una ricetta con un alimento escluso non entra nel piano. Le ricette di riserva (`reserve`) entrano solo quando ne restano meno di sei per quel pasto.

**Aggiungere una ricetta**: una riga in `dishes.ts` (nomi degli alimenti del catalogo), la preparazione in `recipes.ts` (`npm run recipes:check`) e la foto (`docs/MEAL-IMAGES.md`, `npm run meals:check`).

Regole fisse, verificate dal banco di prova (Q13–Q16):

- **Mai due fonti di carboidrati nello stesso pasto** (pasta e pane, riso e patate) e **mai due fonti di proteine**. Se un pasto è molto abbondante cresce la porzione dell'unica fonte, non se ne aggiunge una seconda.
- **Primi**: pasta, pasta integrale, riso, riso basmati, riso integrale, patate, patate dolci, pane (integrale, di segale), gallette (riso, mais, farro) e **legumi** (ceci, fagioli, lenticchie), che a pranzo e cena sono la fonte di carboidrati al posto del primo.
- **Secondi**: petto di pollo, petto di tacchino, vitello, manzo (bistecca), macinato di manzo magro, hamburger (manzo, pollo, tacchino), merluzzo, orata, lonza, salmone, tonno al naturale, uova.
- **Contorni**: zucchine, insalata, pomodori, broccoli, spinaci, fagiolini, carote, finocchi, peperoni, melanzane, cavolfiore, bietole, più le verdure preferite dalla persona.
- **Pan bauletto mai a pranzo o a cena** (è il pane di colazione e merenda). **A cena** pane e gallette sono un'ultima risorsa: si usano pasta, riso, patate e legumi.
- **Affettati al massimo una volta a settimana** (in tutta la settimana, non per pasto).
- **Legumi al massimo una volta al giorno.**
- **Sostituzioni standard**: ogni primo elenca altri primi, ogni secondo altri secondi, ogni contorno altre verdure, con la quantità già ricalcolata. A colazione e merenda si sostituisce tra alimenti dello stesso tipo (yogurt con yogurt, pane con pane, uova con albumi).

Eccezioni, solo quando le esclusioni della persona non lasciano alternative:

- chi non mangia carne trova nel pool le ricette con uova, mozzarella, ricotta e fiocchi di latte; chi non mangia né carne né pesce riceve anche le ricette di riserva con i legumi accanto a un cereale;
- chi non può mangiare abbastanza colazioni o merende standard (per esempio senza latticini) riceve quelle di riserva: frutta e frutta secca, latte senza lattosio o bevanda di soia con cereali, porridge con bevanda vegetale, pane con burro di arachidi.

## Adattamenti dal check-in mensile

Il check-in può cambiare come si costruiscono i mesi successivi (`DietAdaptations`, `calibration.diet`): orari nuovi o flessibili, distribuzione delle calorie tra i pasti, pasti più densi o più voluminosi, rotazione rafforzata, settimana semplificata, pranzi o cene fuori casa con budget e indicazioni, alimenti da togliere e nuovi preferiti. Il tonno in scatola compare al massimo due volte a settimana. Dettagli e regole in `docs/NUTRITION-ADAPTIVE-ENGINE.md`.

## Fonti dei dati

| Cosa | Dove | Come si modifica |
|---|---|---|
| **Catalogo alimenti** (157): categoria, regimi, allergeni, stato (secco/crudo/cotto), kcal e macro per 100 g | `data/fitlab/fitlab-catalogo-piatti.xlsx`, foglio "Catalogo Fit Lab" | Modifica l'Excel, poi `npm run catalog:import` rigenera `src/lib/planning/fitlab/data/foods.generated.ts` |
| **Valori nutrizionali** | `scripts/catalog/nutrition-data.ts` → colonne dell'Excel | `npx tsx scripts/catalog/fill-nutrition.ts <in.xlsx> <out.xlsx>` |
| **Pool di ricette** | `src/lib/planning/fitlab/dishes.ts` | Una riga per ricetta: i nomi degli alimenti devono essere quelli del catalogo (un errore blocca il caricamento). Ogni ricetta ha la sua preparazione in `recipes.ts` (`npm run recipes:check`) e la sua foto (`npm run meals:check`). Le liste `PRIMI`, `SECONDI`, `CONTORNI` servono alle sostituzioni |

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
| 3. Ricetta | `fitlab/dishes.ts` | La ricetta del pool definisce gli alimenti: base (primo), proteine (secondo), contorno (verdura o frutta), olio EVO, aromi. Un solo alimento per ruolo |
| 4. Quantità | `fitlab/solver.ts` | Grammi calcolati insieme su proteine, carboidrati e grassi del pasto, con porzioni realistiche e pesi nello stato del catalogo |
| 5. Scelta | `fitlab/meal-builder.ts` | Prova le ricette del pool adatte alla persona (preferenze, varietà, rotazione), tiene quella più vicina ai target con meno ripetizioni |
| 6. Sostituzioni | `meal-builder.ts` | Liste standard (primo per primo, secondo per secondo, verdura per verdura), con la quantità ricalcolata sul nutriente che l'alimento porta |

**Pranzo veloce, pesce a cena.** Il pesce da cuocere va a cena (il tonno in scatola va bene a pranzo). Controllo Q10 nel banco di prova.

Gli spuntini sono senza cottura.

## Alimenti preferiti (questionario)

Nel questionario, step "Preferenze alimentari", ci sono **cinque selettori** — proteine, carboidrati, grassi, frutta, verdura — ognuno con l'elenco degli alimenti del catalogo (raggruppati per tipo, con ricerca). Le risposte sono id del catalogo (`preferredProteins`, `preferredCarbs`, `preferredFats`, `preferredFruit`, `preferredVegetables`); i codici generici delle risposte vecchie ("chicken", "rice"…) vengono tradotti negli alimenti che intendevano (`lib/questionnaire/food-preferences.ts`).

Il motore li usa come alimenti **preferenziali**, mese dopo mese:

- le ricette del pool che li contengono escono più spesso (gli alimenti non scelti dello stesso componente restano possibili ma meno probabili);
- una ricetta con un alimento preferito non ancora comparso nella settimana è favorita, così i preferiti arrivano in tavola;
- non cambiano gli ingredienti delle ricette: un alimento preferito che non compare in nessuna ricetta del pool non entra nel piano (va aggiunta una ricetta);
- restano validi tutti i filtri: regime, allergeni, esclusioni, pranzo veloce, spuntini senza cottura.

Il banco di prova (Q11) verifica che gli alimenti scelti compaiano nella settimana di ogni mese.

## Varietà categorica

In una settimana lo stesso pasto non torna più di 2 volte per slot (penalità quasi proibitiva dalla seconda ripetizione), lo stesso primo non più di 2 a pranzo e 2 a cena e mai a pranzo e cena dello stesso giorno, la stessa proteina non più di 3 tra pranzi e cene e mai a pranzo e cena dello stesso giorno. Il banco di prova misura la ripetizione massima su tutte le persone (Q7/Q9).

## Piani già salvati

Un piano generato da una versione precedente (`DietPlan.engine` ≠ `DIET_ENGINE_VERSION`) viene ricostruito dalla tab Nutrizione **mantenendo data di inizio, calibrazione e storico dei check-in**.

## Cosa non fa (ancora)

Stagionalità, budget e tempo a disposizione per cucinare non sono domande del questionario: il motore non li usa. I pasti fuori casa sono gestiti solo scegliendo piatti trasportabili a pranzo. Le fonti esterne non vengono consultate a runtime: i valori sono scritti nel catalogo una volta.
