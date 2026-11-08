/**
 * The official Fit Lab recipe catalog: how each dish is prepared. It is deliberately separate from the other layers:
 *  - dishes.ts      what goes in a dish (roles and the foods allowed in each), no quantities;
 *  - recipes.ts     this file: description, numbered steps, times, difficulty, equipment, no quantities either;
 *  - solver.ts      the grams, solved per person from their meal targets;
 *  - the plan       the calories and macros of the portion actually assigned (computed from the catalog foods).
 * The steps never state a weight: they name the ingredient by its role ("il cereale", "la proteina"), so they hold for
 * every food the dish allows and for every portion size. Ids and names are the official ones: do not change them.
 */
import type { SlotKind } from './catalog';
import { DISHES, type Dish } from './dishes';

export type RecipeDifficulty = 'Facile' | 'Media';

export type Recipe = {
  /** Dish id in dishes.ts (PL001…). */
  id: string;
  /** Official name. */
  name: string;
  /** The meal the catalog assigns it to. Dishes are also usable in the other slots their dishes.ts `kinds` allow. */
  meal: SlotKind;
  description: string;
  steps: string[];
  prepMinutes: number;
  cookMinutes: number;
  /** prepMinutes + cookMinutes, derived. */
  totalMinutes: number;
  difficulty: RecipeDifficulty;
  equipment: string[];
};

/** How the weights shown in the plan are to be read, for every recipe. */
export const WEIGHT_BASIS_NOTE =
  'Le grammature di cereali, pasta, riso, legumi secchi, carne e pesce sono riferite all’alimento crudo o secco, come indicato accanto a ogni quantità ("a crudo", "a secco"). Verdure e frutta sono al netto degli scarti. Pane, yogurt, affettati, formaggi freschi, legumi in scatola (sgocciolati) e prodotti pronti sono pesati così come si consumano. L’olio extravergine e i condimenti sono sempre inclusi nei valori nutrizionali.';

type Spec = Omit<Recipe, 'totalMinutes'>;
const recipe = (s: Spec): Recipe => ({ ...s, totalMinutes: s.prepMinutes + s.cookMinutes });

const BF: SlotKind = 'breakfast';
const SN: SlotKind = 'snack';
const LU: SlotKind = 'lunch';
const DI: SlotKind = 'dinner';

export const RECIPES: Recipe[] = [
  // =============================================================== COLAZIONE
  recipe({ id: 'PL001', name: "Porridge d'avena, yogurt e frutti di bosco", meal: BF, prepMinutes: 5, cookMinutes: 5, difficulty: 'Facile', equipment: ['Pentolino', 'Cucchiaio', 'Ciotola'],
    description: "Porridge caldo di fiocchi d'avena con yogurt fresco e frutta, per una colazione sazia e ricca di fibre.",
    steps: ["Metti i fiocchi d'avena in un pentolino con acqua (o la bevanda che preferisci) e cuoci a fuoco dolce 4-5 minuti, mescolando, fino a una consistenza cremosa.", 'Versa il porridge in una ciotola e lascialo intiepidire un minuto.', 'Aggiungi lo yogurt o lo skyr e i frutti di bosco.', 'Completa con la frutta secca e una spolverata di cannella.'] }),
  recipe({ id: 'PL003', name: "Porridge di avena e albumi d'uovo", meal: BF, prepMinutes: 5, cookMinutes: 6, difficulty: 'Media', equipment: ['Pentolino', 'Frusta o forchetta', 'Ciotola'],
    description: "Porridge d'avena arricchito con albumi, che si gonfiano e lo rendono soffice e proteico.",
    steps: ["Cuoci i fiocchi d'avena in acqua a fuoco dolce per 3 minuti, mescolando.", 'Abbassa il fuoco al minimo e versa a filo gli albumi, mescolando con energia per non farli coagulare a pezzi.', 'Cuoci altri 2-3 minuti finché il composto è denso e cremoso.', 'Trasferisci in una ciotola e completa con la frutta tagliata, la cannella e il burro di arachidi o le mandorle.'] }),
  recipe({ id: 'PL004', name: 'Bowl di yogurt greco, muesli e kiwi', meal: BF, prepMinutes: 5, cookMinutes: 0, difficulty: 'Facile', equipment: ['Ciotola', 'Coltello'],
    description: 'Bowl fresco e veloce, senza cottura: yogurt, cereali croccanti e frutta.',
    steps: ['Versa lo yogurt (o lo skyr) in una ciotola.', 'Sbuccia e affetta la frutta.', 'Aggiungi il muesli (o i cereali) sopra lo yogurt, senza mescolare, per mantenerlo croccante.', 'Completa con la frutta e i semi o la frutta secca.'] }),
  recipe({ id: 'PL005', name: 'Toast integrale con ricotta e marmellata', meal: BF, prepMinutes: 5, cookMinutes: 3, difficulty: 'Facile', equipment: ['Tostapane o piastra', 'Coltello'],
    description: 'Pane tostato con ricotta cremosa e marmellata: dolce, leggero e proteico.',
    steps: ['Tosta le fette di pane fino a doratura.', 'Spalma la ricotta (o i fiocchi di latte) sul pane ancora tiepido.', 'Distribuisci la marmellata sopra la ricotta.', 'Servi con la frutta fresca a parte.'] }),
  recipe({ id: 'PL006', name: 'Avocado toast', meal: BF, prepMinutes: 8, cookMinutes: 8, difficulty: 'Media', equipment: ['Pentolino', 'Padellina antiaderente', 'Forchetta', 'Tostapane'],
    description: 'Pane tostato con avocado schiacciato e uova: colazione salata, ricca di grassi buoni e proteine.',
    steps: ['Tosta il pane.', "Schiaccia l'avocado con una forchetta, con un pizzico di pepe e basilico.", 'Cuoci le uova: sode (9 minuti in acqua bollente) oppure in padella antiaderente senza grassi aggiunti.', "Spalma l'avocado sul pane, adagia le uova a fette o intere e completa con pepe nero e basilico."] }),
  recipe({ id: 'PL007', name: "Pancake d'avena con yogurt e banana", meal: BF, prepMinutes: 10, cookMinutes: 10, difficulty: 'Media', equipment: ['Frullatore o mixer', 'Padella antiaderente', 'Spatola'],
    description: "Pancake soffici fatti con farina d'avena e uova, serviti con yogurt e frutta.",
    steps: ["Frulla i fiocchi d'avena fino a ottenere una farina grossolana.", 'Aggiungi le uova (o gli albumi) e un pizzico di cannella e frulla fino a una pastella liscia.', 'Scalda una padella antiaderente a fuoco medio-basso e versa la pastella a mestolini.', 'Cuoci 2-3 minuti per lato, finché compaiono le bolle in superficie, poi girali.', 'Impila i pancake e servi con lo yogurt e la frutta a fette.'] }),
  recipe({ id: 'PL008', name: 'Pane di segale con fiocchi di latte e marmellata', meal: BF, prepMinutes: 5, cookMinutes: 0, difficulty: 'Facile', equipment: ['Coltello'],
    description: 'Pane di segale con formaggio fresco e marmellata, pronto in pochi minuti.',
    steps: ['Taglia il pane a fette.', 'Distribuisci i fiocchi di latte (o la ricotta) sul pane.', 'Aggiungi la marmellata.', 'Accompagna con la frutta fresca.'] }),
  recipe({ id: 'PL009', name: 'Fette biscottate con yogurt e marmellata', meal: BF, prepMinutes: 3, cookMinutes: 0, difficulty: 'Facile', equipment: ['Coltello'],
    description: 'Fette biscottate croccanti con yogurt cremoso e marmellata o miele.',
    steps: ['Disponi le fette biscottate su un piatto.', 'Spalma lo yogurt (o lo skyr) in modo uniforme.', 'Completa con la marmellata o il miele e servi subito, perché restino croccanti.'] }),
  recipe({ id: 'PL010', name: 'Kefir con avena e mela', meal: BF, prepMinutes: 5, cookMinutes: 0, difficulty: 'Facile', equipment: ['Barattolo o ciotola', 'Coltello'],
    description: "Kefir con fiocchi d'avena ammorbiditi e mela croccante: colazione fresca per l'intestino.",
    steps: ["Metti i fiocchi d'avena in un barattolo o in una ciotola e coprili con il kefir.", 'Lascia riposare almeno 5 minuti (meglio una notte in frigorifero) per ammorbidirli.', 'Taglia la mela a cubetti e aggiungila.', 'Completa con la frutta secca e la cannella.'] }),
  recipe({ id: 'PL011', name: 'Toast con fesa di tacchino e frutta', meal: BF, prepMinutes: 5, cookMinutes: 4, difficulty: 'Facile', equipment: ['Piastra o tostapane', 'Coltello'],
    description: 'Toast salato con fesa di tacchino e formaggio leggero, accompagnato da frutta fresca.',
    steps: ['Farcisci una fetta di pane con la fesa di tacchino (o la mozzarella) e un pizzico di origano e pepe.', 'Chiudi con la seconda fetta e scalda su una piastra o in un tostapane per 3-4 minuti, girando una volta.', 'Taglia in diagonale e servi con la frutta fresca.'] }),

  // ================================================================ SPUNTINO
  recipe({ id: 'PL012', name: 'Yogurt greco con frutta e mandorle', meal: SN, prepMinutes: 3, cookMinutes: 0, difficulty: 'Facile', equipment: ['Ciotola', 'Coltello'],
    description: 'Yogurt con frutta di stagione e frutta secca: sazia e si prepara in un attimo.',
    steps: ['Versa lo yogurt in una ciotola.', 'Taglia la frutta a pezzi e distribuiscila sopra.', 'Completa con le mandorle (o le noci) spezzettate.'] }),
  recipe({ id: 'PL013', name: 'Skyr con banana e semi di chia', meal: SN, prepMinutes: 3, cookMinutes: 0, difficulty: 'Facile', equipment: ['Ciotola', 'Coltello'],
    description: 'Skyr ad alto contenuto proteico con frutta e semi ricchi di omega 3.',
    steps: ['Metti lo skyr in una ciotola.', 'Affetta la banana e adagiala sopra.', 'Cospargi i semi di chia e mescola leggermente: dopo qualche minuto si idratano e il composto diventa più cremoso.'] }),
  recipe({ id: 'PL014', name: 'Pane integrale con ricotta', meal: SN, prepMinutes: 3, cookMinutes: 0, difficulty: 'Facile', equipment: ['Coltello'],
    description: 'Pane integrale con ricotta e aromi: spuntino salato, leggero e proteico.',
    steps: ['Taglia il pane a fette.', 'Spalma la ricotta (o i fiocchi di latte).', "Condisci con pepe nero e un pizzico di origano."] }),
  recipe({ id: 'PL015', name: 'Bresaola con pane e rucola', meal: SN, prepMinutes: 5, cookMinutes: 0, difficulty: 'Facile', equipment: ['Coltello'],
    description: 'Affettato magro con rucola e pane, condito con limone: spuntino senza cottura.',
    steps: ['Lava e asciuga la rucola.', 'Disponi le fette di bresaola (o di tacchino) su un piatto.', 'Aggiungi la rucola e condisci con qualche goccia di limone e pepe nero.', 'Servi con il pane a fette.'] }),
  recipe({ id: 'PL016', name: 'Fette biscottate con yogurt e marmellata', meal: SN, prepMinutes: 3, cookMinutes: 0, difficulty: 'Facile', equipment: ['Coltello'],
    description: 'Fette biscottate croccanti con yogurt cremoso e marmellata o miele, in versione spuntino.',
    steps: ['Disponi le fette biscottate su un piatto.', 'Spalma lo yogurt (o lo skyr) in modo uniforme.', 'Completa con la marmellata o il miele e mangia subito.'] }),
  recipe({ id: 'PL017', name: 'Bowl di yogurt greco, muesli e kiwi', meal: SN, prepMinutes: 5, cookMinutes: 0, difficulty: 'Facile', equipment: ['Ciotola', 'Coltello'],
    description: 'Bowl fresco di yogurt, cereali e frutta, senza cottura.',
    steps: ['Versa lo yogurt in una ciotola.', 'Sbuccia e affetta la frutta.', 'Aggiungi il muesli e completa con la frutta e i semi o la frutta secca.'] }),
  recipe({ id: 'PL018', name: 'Hummus con carote e crackers', meal: SN, prepMinutes: 10, cookMinutes: 0, difficulty: 'Facile', equipment: ['Frullatore o mixer', 'Coltello'],
    description: 'Crema di ceci con limone e paprika da intingere con verdure crude e crackers.',
    steps: ['Scola i ceci e frullali con olio extravergine, succo di limone, un po’ di aglio e un cucchiaio di acqua, fino a una crema liscia.', 'Aggiusta di sapore con paprika e pepe.', 'Taglia le carote (o altre verdure crude) a bastoncini.', 'Servi l’hummus con le verdure e i crackers.'] }),
  recipe({ id: 'PL019', name: 'Frutta fresca e frutta secca', meal: SN, prepMinutes: 3, cookMinutes: 0, difficulty: 'Facile', equipment: ['Coltello'],
    description: 'Spuntino portatile: frutta di stagione e una porzione di frutta secca.',
    steps: ['Lava e taglia la frutta fresca.', 'Pesa la frutta secca e accompagnala alla frutta.', 'Per portarlo con te, riponi tutto in un contenitore con chiusura ermetica.'] }),
  recipe({ id: 'PL020', name: 'Kefir con frutti di bosco', meal: SN, prepMinutes: 3, cookMinutes: 0, difficulty: 'Facile', equipment: ['Bicchiere o ciotola'],
    description: 'Kefir fresco con frutti di bosco e semi, pronto in pochi minuti.',
    steps: ['Versa il kefir in un bicchiere o in una ciotola.', 'Aggiungi i frutti di bosco (se surgelati, scongelali prima).', 'Cospargi con i semi di lino o di chia e mescola.'] }),
  recipe({ id: 'PL021', name: 'Toast con avocado e uovo sodo', meal: SN, prepMinutes: 5, cookMinutes: 9, difficulty: 'Media', equipment: ['Pentolino', 'Tostapane', 'Forchetta'],
    description: 'Pane tostato con avocado e uovo sodo: spuntino saziante e portatile.',
    steps: ['Cuoci l’uovo in acqua bollente per 9 minuti, poi raffreddalo sotto acqua fredda e sgusciala.', 'Tosta il pane.', 'Schiaccia l’avocado con limone e pepe e spalmalo sul pane.', 'Affetta l’uovo e adagialo sopra. Se preferisci, sostituiscilo con fiocchi di latte o ricotta.'] }),
  recipe({ id: 'PL022', name: 'Budino proteico con frutta', meal: SN, prepMinutes: 3, cookMinutes: 0, difficulty: 'Facile', equipment: ['Ciotola', 'Coltello'],
    description: 'Budino o yogurt proteico con frutta fresca e mandorle.',
    steps: ['Versa il budino (o lo yogurt proteico) in una ciotola o in un bicchiere.', 'Taglia la frutta a pezzetti e aggiungila.', 'Completa con le mandorle a lamelle o tritate.'] }),

  // ======================================================= PRANZO E CENA
  recipe({ id: 'PL023', name: 'Pasta integrale al pomodoro, pollo e zucchine', meal: LU, prepMinutes: 10, cookMinutes: 20, difficulty: 'Facile', equipment: ['Pentola', 'Padella', 'Colapasta'],
    description: 'Primo completo: pasta con sugo di pomodoro, straccetti di pollo e zucchine.',
    steps: ['Porta a bollore l’acqua e cuoci la pasta al dente secondo i tempi della confezione.', 'Taglia le zucchine a dadini e il pollo a straccetti.', 'In padella scalda l’olio extravergine con l’aglio, rosola il pollo 4-5 minuti, poi aggiungi le zucchine e cuoci 5 minuti.', 'Versa la passata di pomodoro e cuoci 8-10 minuti, regolando di sale.', 'Scola la pasta, mantecala nel sugo e completa con basilico fresco.'] }),
  recipe({ id: 'PL024', name: 'Riso integrale con salmone e broccoli', meal: DI, prepMinutes: 10, cookMinutes: 35, difficulty: 'Media', equipment: ['Pentola', 'Teglia o padella', 'Vaporiera o pentola con cestello'],
    description: 'Riso integrale servito con salmone alle erbe e broccoli al vapore.',
    steps: ['Cuoci il riso integrale in acqua bollente per il tempo indicato (circa 30-35 minuti) e scolalo.', 'Dividi i broccoli in cimette e cuocili al vapore 8-10 minuti.', 'Cuoci il salmone in padella antiaderente o in forno a 180 °C per 10-12 minuti, con limone, prezzemolo e pepe.', 'Condisci riso e broccoli con l’olio extravergine e servi con il salmone.'] }),
  recipe({ id: 'PL025', name: 'Farro con tacchino, melanzane e pomodori', meal: LU, prepMinutes: 15, cookMinutes: 30, difficulty: 'Media', equipment: ['Pentola', 'Padella', 'Colapasta'],
    description: 'Farro con bocconcini di tacchino e verdure mediterranee.',
    steps: ['Cuoci il farro in acqua bollente secondo i tempi indicati (circa 25-30 minuti) e scolalo.', 'Taglia melanzane e pomodori a dadini e il tacchino a bocconcini.', 'In padella scalda l’olio, rosola il tacchino 5 minuti, aggiungi le melanzane e cuoci 8 minuti, poi i pomodori per altri 5.', 'Unisci il farro, mescola, aggiusta di sale e profuma con origano e basilico.'] }),
  recipe({ id: 'PL026', name: 'Pasta, merluzzo, pomodori e spinaci', meal: DI, prepMinutes: 10, cookMinutes: 20, difficulty: 'Facile', equipment: ['Pentola', 'Padella', 'Colapasta'],
    description: 'Pasta con merluzzo a pezzetti, pomodorini e spinaci.',
    steps: ['Cuoci la pasta al dente in acqua salata.', 'In padella scalda l’olio con l’aglio, aggiungi i pomodori a pezzi e cuoci 5 minuti.', 'Unisci il merluzzo a cubetti e cuoci 5-6 minuti, poi gli spinaci per 2-3 minuti, finché appassiscono.', 'Scola la pasta, saltala nella padella con il condimento e completa con prezzemolo e limone.'] }),
  recipe({ id: 'PL027', name: 'Riso basmati con ceci e verdure mediterranee', meal: LU, prepMinutes: 10, cookMinutes: 20, difficulty: 'Facile', equipment: ['Pentola', 'Padella'],
    description: 'Riso profumato con ceci e peperoni e zucchine speziati con curcuma e paprika.',
    steps: ['Sciacqua il riso e cuocilo in acqua bollente salata per 10-12 minuti (basmati), poi scolalo.', 'Taglia peperoni e zucchine a dadini e saltali in padella con l’olio per 10 minuti.', 'Aggiungi i ceci scolati, la curcuma e la paprika e scalda 3 minuti.', 'Unisci il riso, mescola e completa con succo di limone.'] }),
  recipe({ id: 'PL028', name: 'Patate al forno con orata e fagiolini', meal: DI, prepMinutes: 15, cookMinutes: 35, difficulty: 'Media', equipment: ['Forno', 'Teglia', 'Pentola'],
    description: 'Orata al forno con patate profumate al rosmarino e fagiolini lessati.',
    steps: ['Scalda il forno a 200 °C.', 'Taglia le patate a tocchetti, condiscile con parte dell’olio, sale e rosmarino e infornale per 15 minuti.', 'Aggiungi il pesce nella stessa teglia con limone e prezzemolo e cuoci altri 15-20 minuti.', 'Nel frattempo lessa i fagiolini per 10-12 minuti.', 'Servi tutto insieme, condendo i fagiolini con un filo di olio e limone.'] }),
  recipe({ id: 'PL029', name: 'Pasta e lenticchie con contorno di finocchi', meal: LU, prepMinutes: 10, cookMinutes: 30, difficulty: 'Facile', equipment: ['Pentola', 'Padella', 'Colapasta'],
    description: 'Pasta e lenticchie al pomodoro con finocchi crudi o stufati.',
    steps: ['Se usi lenticchie secche, cuocile in acqua per 25 minuti; quelle in scatola vanno solo sciacquate.', 'In pentola scalda l’olio con aglio e rosmarino, aggiungi la passata e le lenticchie e cuoci 10 minuti.', 'Cuoci la pasta al dente e uniscila al sugo con un mestolo di acqua di cottura.', 'Affetta i finocchi e servili come contorno, crudi o stufati in padella con poco olio.'] }),
  recipe({ id: 'PL030', name: 'Polenta con manzo magro e cavolo nero', meal: DI, prepMinutes: 10, cookMinutes: 45, difficulty: 'Media', equipment: ['Pentola', 'Padella', 'Frusta'],
    description: 'Polenta morbida con straccetti di manzo magro e cavolo nero stufato.',
    steps: ['Porta a bollore l’acqua salata e versa a pioggia la farina di mais, mescolando con la frusta; cuoci secondo i tempi della confezione (anche solo 8 minuti per l’istantanea).', 'Pulisci il cavolo nero eliminando la costa centrale e stufalo in padella con olio, aglio e un goccio d’acqua per 10-15 minuti.', 'In un’altra padella rosola il manzo a pezzetti con rosmarino e pepe per 8-10 minuti.', 'Servi la polenta con il manzo e il cavolo nero.'] }),
  recipe({ id: 'PL031', name: 'Cous cous con gamberi e zucchine', meal: LU, prepMinutes: 10, cookMinutes: 12, difficulty: 'Facile', equipment: ['Pentolino', 'Padella'],
    description: 'Cous cous leggero con gamberi saltati e zucchine, profumato al limone.',
    steps: ['Versa il cous cous in una ciotola, coprilo con acqua bollente salata (stessa altezza), copri e lascia gonfiare 5 minuti, poi sgrana con una forchetta.', 'Taglia le zucchine a dadini e saltale in padella con olio e aglio per 6 minuti.', 'Aggiungi i gamberi sgusciati e cuoci 3-4 minuti.', 'Unisci il cous cous, aggiungi limone e prezzemolo e mescola.'] }),
  recipe({ id: 'PL032', name: 'Pasta al ragù leggero con contorno di insalata', meal: DI, prepMinutes: 15, cookMinutes: 45, difficulty: 'Media', equipment: ['Pentola', 'Casseruola', 'Colapasta'],
    description: 'Pasta con ragù di manzo magro e verdure, accompagnata da insalata fresca.',
    steps: ['Trita finemente la carota e rosolala in poco olio, poi unisci il manzo magro macinato e cuoci 8-10 minuti sgranandolo.', 'Aggiungi la passata di pomodoro, sala e cuoci a fuoco dolce con il coperchio per 30 minuti, aggiungendo acqua se serve.', 'Cuoci la pasta al dente, scolala e condiscila con il ragù e basilico.', 'Servi con insalata e pomodori, conditi con un filo di olio.'] }),
  recipe({ id: 'PL034', name: 'Riso venere con tonno e zucchine', meal: DI, prepMinutes: 10, cookMinutes: 35, difficulty: 'Facile', equipment: ['Pentola', 'Padella'],
    description: 'Riso nero profumato con tonno al naturale e zucchine saltate.',
    steps: ['Cuoci il riso in acqua salata per il tempo indicato (circa 35 minuti) e scolalo.', 'Taglia le zucchine a rondelle e saltale in padella con olio per 8 minuti.', 'Scola il tonno e uniscilo al riso insieme alle zucchine.', 'Completa con limone, basilico e pepe nero.'] }),
  recipe({ id: 'PL035', name: 'Pasta con ricotta e spinaci, carciofi di contorno', meal: LU, prepMinutes: 10, cookMinutes: 20, difficulty: 'Facile', equipment: ['Pentola', 'Padella', 'Colapasta'],
    description: 'Pasta con crema di ricotta e spinaci, accompagnata da carciofi.',
    steps: ['Cuoci la pasta al dente.', 'Appassisci gli spinaci in padella con un filo di olio per 3-4 minuti.', 'Lavora la ricotta con un mestolo di acqua di cottura fino a renderla cremosa.', 'Scola la pasta e mescolala con ricotta e spinaci, con pepe nero.', 'Cuoci i carciofi a spicchi in padella con olio e acqua per 12-15 minuti e servili di contorno.'] }),
  recipe({ id: 'PL036', name: 'Patate dolci con hamburger di pollo e insalata', meal: DI, prepMinutes: 10, cookMinutes: 35, difficulty: 'Media', equipment: ['Forno', 'Teglia', 'Padella antiaderente'],
    description: 'Patate dolci al forno con hamburger di pollo e insalata mista.',
    steps: ['Scalda il forno a 200 °C.', 'Taglia le patate dolci a spicchi, condiscile con olio, paprika e rosmarino e cuocile 30-35 minuti.', 'Cuoci l’hamburger in padella antiaderente 4-5 minuti per lato, finché è ben cotto.', 'Condisci l’insalata con olio e limone e servi tutto insieme.'] }),
  recipe({ id: 'PL037', name: 'Orzo con fagioli borlotti e zucchine', meal: LU, prepMinutes: 10, cookMinutes: 35, difficulty: 'Facile', equipment: ['Pentola', 'Padella'],
    description: 'Orzo con borlotti e zucchine, piatto unico di cereali e legumi.',
    steps: ['Cuoci l’orzo in acqua bollente salata (25-30 minuti se perlato) e scolalo.', 'Soffriggi in olio aglio, rosmarino e un pizzico di peperoncino, poi aggiungi le zucchine a dadini e cuoci 8 minuti.', 'Unisci i fagioli già cotti e scolati e scalda 5 minuti.', 'Mescola con l’orzo e servi caldo o tiepido.'] }),
  recipe({ id: 'PL038', name: 'Salmone al forno con riso e asparagi', meal: DI, prepMinutes: 10, cookMinutes: 25, difficulty: 'Media', equipment: ['Forno', 'Teglia', 'Pentola'],
    description: 'Filetto di salmone al forno con riso basmati e asparagi.',
    steps: ['Scalda il forno a 180 °C.', 'Adagia il salmone in una teglia con timo, limone e pepe e cuoci 12-15 minuti.', 'Cuoci il riso in acqua salata (10-12 minuti per il basmati) e scolalo.', 'Lessa o cuoci al vapore gli asparagi 8-10 minuti.', 'Condisci con olio extravergine e servi insieme.'] }),
  recipe({ id: 'PL039', name: 'Gnocchi al pomodoro con mozzarella e melanzane', meal: LU, prepMinutes: 10, cookMinutes: 20, difficulty: 'Facile', equipment: ['Pentola', 'Padella'],
    description: 'Gnocchi di patate con sugo di pomodoro, melanzane e mozzarella filante.',
    steps: ['Taglia le melanzane a dadini e saltale in padella con olio per 8-10 minuti.', 'Aggiungi la passata e cuoci 8 minuti con basilico.', 'Cuoci gli gnocchi in acqua bollente salata: sono pronti quando vengono a galla.', 'Scolali, mantecali nel sugo, aggiungi la mozzarella a cubetti e mescola finché fonde. Profuma con origano.'] }),
  recipe({ id: 'PL040', name: 'Lenticchie in umido con pane integrale e cavolfiore', meal: DI, prepMinutes: 10, cookMinutes: 30, difficulty: 'Facile', equipment: ['Casseruola', 'Pentola o forno'],
    description: 'Lenticchie in umido al pomodoro con pane integrale e cavolfiore.',
    steps: ['Soffriggi in olio aglio e rosmarino, aggiungi la passata e le lenticchie (già cotte e sgocciolate, o secche da cuocere prima) e cuoci 15 minuti.', 'Dividi il cavolfiore in cimette e cuocilo al vapore o in forno a 200 °C per 15-20 minuti.', 'Servi le lenticchie con il pane integrale e il cavolfiore.'] }),
  recipe({ id: 'PL041', name: 'Riso rosso con tacchino e carote', meal: LU, prepMinutes: 10, cookMinutes: 40, difficulty: 'Media', equipment: ['Pentola', 'Padella'],
    description: 'Riso rosso con bocconcini di tacchino e carote profumate al timo.',
    steps: ['Cuoci il riso in acqua salata per circa 35-40 minuti e scolalo.', 'Taglia le carote a rondelle sottili e il tacchino a bocconcini.', 'Rosola il tacchino in padella con olio e timo per 6 minuti, poi aggiungi le carote e un goccio d’acqua e cuoci 10 minuti.', 'Unisci il riso, aggiusta con limone e pepe e servi. Il finocchio, se previsto, va servito a parte.'] }),
  recipe({ id: 'PL042', name: 'Quinoa con ceci, zucca e spinaci', meal: LU, prepMinutes: 15, cookMinutes: 25, difficulty: 'Media', equipment: ['Pentola', 'Padella', 'Teglia'],
    description: 'Quinoa con ceci, zucca arrostita e spinaci freschi.',
    steps: ['Sciacqua la quinoa sotto acqua fredda, poi cuocila 12-15 minuti in acqua bollente salata e scolala.', 'Taglia la zucca a cubetti e arrostiscila in forno a 200 °C con olio, rosmarino e paprika per 20 minuti.', 'Appassisci gli spinaci in padella 3 minuti.', 'Unisci quinoa, ceci scolati, zucca e spinaci, condisci con limone.'] }),
  recipe({ id: 'PL043', name: 'Lonza magra con patate e cavolini di Bruxelles', meal: DI, prepMinutes: 15, cookMinutes: 40, difficulty: 'Media', equipment: ['Forno', 'Teglia', 'Padella'],
    description: 'Lonza di maiale magra al forno con patate e cavolini di Bruxelles.',
    steps: ['Scalda il forno a 200 °C.', 'Taglia le patate a tocchetti e i cavolini a metà; condiscili con olio, sale, rosmarino e aglio e cuocili in teglia 30-35 minuti.', 'Rosola la lonza in padella antiaderente 4-5 minuti per lato, con pepe e rosmarino, poi falla riposare un minuto.', 'Affetta e servi con le verdure.'] }),
  recipe({ id: 'PL044', name: 'Pasta di legumi con pomodoro e contorno di zucchine', meal: LU, prepMinutes: 10, cookMinutes: 20, difficulty: 'Facile', equipment: ['Pentola', 'Padella', 'Colapasta'],
    description: 'Pasta di legumi al pomodoro con ricotta o lenticchie e zucchine di contorno.',
    steps: ['Cuoci la pasta di legumi al dente (seguendo con attenzione i tempi: scuoce facilmente).', 'Scalda in padella olio e passata con basilico per 10 minuti.', 'Condisci la pasta con il sugo e completa con la ricotta (o le lenticchie) e pepe.', 'Salta le zucchine a rondelle con olio e servile di contorno.'] }),
  recipe({ id: 'PL045', name: 'Merluzzo al forno con cous cous e peperoni', meal: DI, prepMinutes: 15, cookMinutes: 20, difficulty: 'Media', equipment: ['Forno', 'Teglia', 'Pentolino'],
    description: 'Merluzzo al forno con peperoni e cous cous.',
    steps: ['Scalda il forno a 190 °C.', 'Taglia i peperoni a strisce e disponili in teglia con olio e paprika; cuoci 10 minuti.', 'Aggiungi il merluzzo, limone e prezzemolo e cuoci altri 10-12 minuti.', 'Prepara il cous cous coprendolo con acqua bollente salata per 5 minuti e sgranalo con una forchetta.', 'Servi il pesce con i peperoni e il cous cous.'] }),
  recipe({ id: 'PL046', name: 'Farro con fagioli cannellini e carciofi', meal: LU, prepMinutes: 10, cookMinutes: 30, difficulty: 'Facile', equipment: ['Pentola', 'Padella'],
    description: 'Farro con fagioli cannellini e carciofi, piatto unico vegetale.',
    steps: ['Cuoci il farro in acqua salata per 25-30 minuti e scolalo.', 'Pulisci i carciofi e tagliali a spicchi sottili; cuocili in padella con olio, aglio e un goccio d’acqua per 12-15 minuti.', 'Aggiungi i fagioli già cotti e scolati e scalda 3-4 minuti.', 'Unisci il farro, completa con prezzemolo e limone.'] }),
  recipe({ id: 'PL047', name: 'Frittata con pane integrale e contorno di spinaci', meal: DI, prepMinutes: 10, cookMinutes: 10, difficulty: 'Facile', equipment: ['Padella antiaderente', 'Frusta o forchetta'],
    description: 'Frittata alle erbe con pane integrale e spinaci saltati.',
    steps: ['Appassisci gli spinaci in padella con un filo di olio per 3-4 minuti e tienine una parte da parte per il contorno.', 'Sbatti le uova (e gli albumi, se previsti) con pepe, un pizzico di sale e basilico.', 'Versa in una padella antiaderente appena unta, cuoci a fuoco medio-basso 4 minuti, gira e cuoci altri 2-3 minuti.', 'Servi con il pane integrale e gli spinaci.'] }),
  recipe({ id: 'PL048', name: 'Pasta al tonno con pomodori e contorno di lattuga', meal: LU, prepMinutes: 10, cookMinutes: 15, difficulty: 'Facile', equipment: ['Pentola', 'Padella', 'Colapasta'],
    description: 'Pasta con tonno al naturale, pomodorini e basilico, con lattuga di contorno.',
    steps: ['Cuoci la pasta al dente.', 'In padella scalda l’olio con aglio e peperoncino, aggiungi i pomodori a pezzi e cuoci 6-7 minuti.', 'Spegni il fuoco, unisci il tonno sgocciolato e il basilico.', 'Scola la pasta, saltala nel condimento e servi con la lattuga condita con olio e limone.'] }),
];

const BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

/** The recipe of a dish, or undefined for dishes outside the official catalog (the extra "X…" dishes). */
export function recipeForDish(dishId: string | undefined): Recipe | undefined {
  return dishId ? BY_ID.get(dishId) : undefined;
}

/** What goes in a recipe, by role, without quantities: the single source is the dish (dishes.ts). */
export function recipeComposition(dishId: string): Pick<Dish, 'base' | 'protein' | 'extraProtein' | 'sides' | 'spread' | 'fat' | 'oil' | 'sauce' | 'aromas'> | undefined {
  const d = DISHES.find((x) => x.id === dishId);
  return d && { base: d.base, protein: d.protein, extraProtein: d.extraProtein, sides: d.sides, spread: d.spread, fat: d.fat, oil: d.oil, sauce: d.sauce, aromas: d.aromas };
}
