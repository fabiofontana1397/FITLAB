/**
 * How each standard meal is prepared. It is deliberately separate from the other layers:
 *  - dishes.ts      what goes in a dish (roles and the foods allowed in each), no quantities;
 *  - recipes.ts     this file: description, numbered steps, times, difficulty, equipment, no quantities either;
 *  - solver.ts      the grams, solved per person from their meal targets;
 *  - the plan       the calories and macros of the portion actually assigned (computed from the catalog foods).
 * The steps never state a weight: they name the ingredient by its role ("il cereale", "la proteina"), so they hold for
 * every food the dish allows and for every portion size. One recipe per dish id (scripts/check-recipes.ts).
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

export const RECIPES: Recipe[] = [
  // =============================================================== COLAZIONE
  recipe({ id: 'PL001', name: "Porridge d’avena, yogurt e frutta", meal: BF, prepMinutes: 5, cookMinutes: 8, difficulty: "Facile", equipment: ["Pentolino", "Cucchiaio", "Ciotola"],
    description: "Porridge cremoso di avena cotta nel latte, con yogurt greco e frutta.",
    steps: ["Versa l’avena e il latte in un pentolino.", "Cuoci a fuoco medio per circa 5-8 minuti, mescolando fino a ottenere una consistenza cremosa.", "Trasferisci il porridge in una ciotola e lascia intiepidire.", "Aggiungi lo yogurt greco.", "Completa con la frutta e, se ti piace, un pizzico di cannella."] }),
  recipe({ id: 'PL003', name: "Porridge d’avena e albumi", meal: BF, prepMinutes: 5, cookMinutes: 8, difficulty: "Media", equipment: ["Pentolino", "Cucchiaio o frusta", "Ciotola"],
    description: "Porridge d’avena cotto nel latte e reso denso e proteico dagli albumi, con burro di arachidi e cannella.",
    steps: ["Versa avena e latte in un pentolino.", "Cuoci a fuoco basso per circa 3 minuti.", "Aggiungi gli albumi poco alla volta, mescolando continuamente.", "Continua la cottura per altri 4-5 minuti, fino a ottenere una crema densa.", "Trasferisci in una ciotola e completa con burro di arachidi e cannella."] }),
  recipe({ id: 'ST-BF-UOVA-AVOCADO', name: "Avocado toast con uova", meal: BF, prepMinutes: 5, cookMinutes: 6, difficulty: "Facile", equipment: ["Tostapane", "Padella antiaderente", "Forchetta"],
    description: "Pane tostato con avocado schiacciato e uova.",
    steps: ["Tosta il pane.", "Schiaccia l’avocado con una forchetta, con qualche goccia di limone e pepe, e spalmalo sul pane.", "Cuoci le uova in padella antiaderente: all’occhio di bue, strapazzate o in camicia.", "Adagia le uova sul toast e servi."] }),
  recipe({ id: 'ST-BF-UOVA', name: "Uova strapazzate con pane", meal: BF, prepMinutes: 3, cookMinutes: 5, difficulty: "Facile", equipment: ["Padella antiaderente", "Spatola"],
    description: "Uova strapazzate morbide con pane tostato.",
    steps: ["Sbatti le uova con un pizzico di sale e pepe.", "Versale in una padella antiaderente calda e mescola a fuoco dolce per 2-3 minuti, finché sono cremose.", "Tosta il pane e servi insieme alle uova, con prezzemolo se ti piace."] }),
  recipe({ id: 'ST-BF-ALBUMI', name: "Frittata di albumi con pane", meal: BF, prepMinutes: 3, cookMinutes: 6, difficulty: "Facile", equipment: ["Padella antiaderente", "Spatola"],
    description: "Frittata leggera di soli albumi con pane tostato.",
    steps: ["Sbatti gli albumi con un pizzico di sale e pepe.", "Scalda l’olio in una padella antiaderente e versa gli albumi.", "Cuoci 2-3 minuti per lato, finché la frittata è soda.", "Servi con il pane tostato."] }),
  recipe({ id: 'PL005', name: "Pane con ricotta e marmellata", meal: BF, prepMinutes: 5, cookMinutes: 3, difficulty: "Facile", equipment: ["Tostapane o padella", "Coltello"],
    description: "Pane tostato con ricotta cremosa e marmellata.",
    steps: ["Taglia il pane a fette.", "Tostalo in padella o nel tostapane per 2-3 minuti.", "Distribuisci uniformemente la ricotta sulle fette.", "Aggiungi la marmellata.", "Servi caldo o tiepido."] }),
  recipe({ id: 'ST-BF-YOGURT-CEREALI', name: "Yogurt greco con cereali integrali e frutta", meal: BF, prepMinutes: 3, cookMinutes: 0, difficulty: "Facile", equipment: ["Ciotola", "Coltello"],
    description: "Yogurt greco con cereali integrali e frutta fresca, senza cottura.",
    steps: ["Versa lo yogurt greco in una ciotola.", "Aggiungi i cereali.", "Taglia la frutta a pezzi e completa."] }),
  recipe({ id: 'ST-BF-LATTE-CEREALI', name: "Latte proteico con cereali integrali e frutta", meal: BF, prepMinutes: 3, cookMinutes: 0, difficulty: "Facile", equipment: ["Tazza o ciotola"],
    description: "Latte proteico con cereali integrali e un frutto: pronto in un attimo.",
    steps: ["Versa il latte proteico in una tazza.", "Aggiungi i cereali.", "Accompagna con la frutta, a pezzi nella tazza o a parte."] }),
  recipe({ id: 'ST-BF-YOGURT-AVENA', name: "Yogurt greco con avena e frutta", meal: BF, prepMinutes: 3, cookMinutes: 0, difficulty: "Facile", equipment: ["Ciotola", "Coltello"],
    description: "Yogurt greco con avena e frutta: si può preparare anche la sera prima.",
    steps: ["Versa lo yogurt greco in una ciotola.", "Aggiungi l’avena e mescola.", "Completa con la frutta a pezzi e, se ti piace, la cannella.", "Lascia riposare qualche minuto (o tutta la notte in frigo) per ammorbidire l’avena."] }),
  recipe({ id: 'ST-BF-PORRIDGE-VEG', name: "Porridge d’avena con bevanda vegetale e frutta", meal: BF, prepMinutes: 5, cookMinutes: 8, difficulty: "Facile", equipment: ["Pentolino", "Cucchiaio", "Ciotola"],
    description: "Porridge senza latticini, cotto nella bevanda vegetale, con frutta e crema di frutta secca.",
    steps: ["Versa l’avena e la bevanda vegetale in un pentolino.", "Cuoci a fuoco medio per 5-8 minuti, mescolando.", "Trasferisci in una ciotola e completa con la frutta, la crema di frutta secca e la cannella."] }),
  recipe({ id: 'ST-BF-PANE-MARMELLATA', name: "Pane con marmellata e frutta", meal: BF, prepMinutes: 3, cookMinutes: 3, difficulty: "Facile", equipment: ["Tostapane", "Coltello"],
    description: "Pane tostato con crema di frutta secca e marmellata, con un frutto.",
    steps: ["Tosta il pane.", "Spalma la crema di frutta secca e la marmellata.", "Accompagna con la frutta."] }),

  // ================================================================= MERENDA
  recipe({ id: 'ST-SN-YOGURT', name: "Yogurt greco con frutta", meal: SN, prepMinutes: 3, cookMinutes: 0, difficulty: "Facile", equipment: ["Ciotola", "Coltello"],
    description: "Yogurt greco con un frutto: si prepara in un attimo.",
    steps: ["Versa lo yogurt greco in una ciotola.", "Taglia la frutta a pezzi e aggiungila."] }),
  recipe({ id: 'ST-SN-YOGURT-AVENA', name: "Yogurt greco con avena", meal: SN, prepMinutes: 3, cookMinutes: 0, difficulty: "Facile", equipment: ["Ciotola", "Cucchiaio"],
    description: "Yogurt greco con avena (fiocchi o farina d’avena), senza cottura.",
    steps: ["Versa lo yogurt greco in una ciotola.", "Aggiungi l’avena e mescola bene.", "Se ti piace, completa con un pizzico di cannella."] }),
  recipe({ id: 'ST-SN-BAULETTO', name: "Pan bauletto con marmellata", meal: SN, prepMinutes: 3, cookMinutes: 0, difficulty: "Facile", equipment: ["Coltello"],
    description: "Pan bauletto con marmellata, pronto in un minuto.",
    steps: ["Se preferisci, tosta leggermente il pane.", "Spalma la marmellata sulle fette."] }),
  recipe({ id: 'ST-SN-PANINO', name: "Panino con affettato magro", meal: SN, prepMinutes: 3, cookMinutes: 0, difficulty: "Facile", equipment: ["Coltello"],
    description: "Panino con fesa di tacchino, bresaola o prosciutto crudo: una volta a settimana.",
    steps: ["Apri il pane o prepara due fette.", "Farcisci con l’affettato.", "Per portarlo con te, avvolgilo nella carta o in un contenitore."] }),
  recipe({ id: 'PL019', name: 'Frutta fresca e frutta secca', meal: SN, prepMinutes: 3, cookMinutes: 0, difficulty: 'Facile', equipment: ['Coltello'],
    description: 'Spuntino portatile: frutta di stagione e una porzione di frutta secca.',
    steps: ['Lava e taglia la frutta fresca.', 'Pesa la frutta secca e accompagnala alla frutta.', 'Per portarlo con te, riponi tutto in un contenitore con chiusura ermetica.'] }),
  recipe({ id: 'ST-SN-UOVA', name: "Uova sode con pane", meal: SN, prepMinutes: 2, cookMinutes: 9, difficulty: "Facile", equipment: ["Pentolino"],
    description: "Uova sode con pane: si preparano in anticipo e si portano ovunque.",
    steps: ["Cuoci le uova in acqua bollente per 9 minuti, poi raffreddale sotto acqua fredda e sgusciale.", "Servile con il pane, con un pizzico di pepe."] }),
  recipe({ id: 'ST-SN-LATTE-CEREALI', name: "Latte con cereali", meal: SN, prepMinutes: 2, cookMinutes: 0, difficulty: "Facile", equipment: ["Tazza"],
    description: "Latte senza lattosio o bevanda di soia con cereali.",
    steps: ["Versa il latte o la bevanda in una tazza.", "Aggiungi i cereali."] }),

  // =========================================================== PRANZO E CENA
  // primo + secondo + contorno + olio: the steps name the roles, so they hold for every food the meal allows
  recipe({ id: 'ST-PASTA', name: 'Pasta, secondo e contorno', meal: LU, prepMinutes: 10, cookMinutes: 15, difficulty: 'Facile', equipment: ['Pentola', 'Padella o piastra', 'Colapasta'],
    description: 'Primo di pasta, un secondo di carne, pesce o uova e una verdura, conditi con olio extravergine.',
    steps: ['Cuoci la pasta al dente in acqua salata e scolala; se ti piace, condiscila con un po’ di passata di pomodoro scaldata con il basilico.', 'Cuoci il secondo: carne e hamburger alla piastra o in padella antiaderente ben calda, pochi minuti per lato; il pesce in padella o al forno a 180 °C per 10-15 minuti; il tonno al naturale va solo sgocciolato; le uova sode, strapazzate o in frittata.', 'Prepara il contorno: la verdura al vapore, lessata, grigliata o saltata in padella; insalata, pomodori, carote e finocchi anche crudi.', 'Condisci tutto con l’olio extravergine a crudo e insaporisci con gli aromi.'] }),
  recipe({ id: 'ST-RISO', name: 'Riso, secondo e contorno', meal: LU, prepMinutes: 10, cookMinutes: 18, difficulty: 'Facile', equipment: ['Pentola', 'Padella o piastra'],
    description: 'Riso in bianco, un secondo di carne, pesce o uova e una verdura, conditi con olio extravergine.',
    steps: ['Sciacqua il riso, cuocilo in acqua bollente salata per il tempo indicato sulla confezione e scolalo.', 'Cuoci il secondo: carne e hamburger alla piastra o in padella antiaderente ben calda, pochi minuti per lato; il pesce in padella o al forno a 180 °C per 10-15 minuti; il tonno al naturale va solo sgocciolato; le uova sode, strapazzate o in frittata.', 'Prepara il contorno: la verdura al vapore, lessata, grigliata o saltata in padella; insalata, pomodori, carote e finocchi anche crudi.', 'Condisci tutto con l’olio extravergine a crudo e insaporisci con gli aromi.'] }),
  recipe({ id: 'ST-PATATE', name: 'Patate, secondo e contorno', meal: LU, prepMinutes: 10, cookMinutes: 30, difficulty: 'Facile', equipment: ['Pentola o teglia', 'Padella o piastra'],
    description: 'Patate lesse o al forno, un secondo di carne, pesce o uova e una verdura, conditi con olio extravergine.',
    steps: ['Lessa le patate con la buccia per 25-30 minuti, oppure tagliale a tocchetti e cuocile in forno a 200 °C per 30 minuti.', 'Cuoci il secondo: carne e hamburger alla piastra o in padella antiaderente ben calda, pochi minuti per lato; il pesce in padella o al forno a 180 °C per 10-15 minuti; il tonno al naturale va solo sgocciolato; le uova sode, strapazzate o in frittata.', 'Prepara il contorno: la verdura al vapore, lessata, grigliata o saltata in padella; insalata, pomodori, carote e finocchi anche crudi.', 'Condisci tutto con l’olio extravergine a crudo e insaporisci con gli aromi.'] }),
  recipe({ id: 'ST-PANE', name: 'Pane, secondo e contorno', meal: LU, prepMinutes: 5, cookMinutes: 10, difficulty: 'Facile', equipment: ['Padella o piastra', 'Coltello'],
    description: 'Un secondo di carne, pesce o uova con verdura e pane, conditi con olio extravergine.',
    steps: ['Taglia il pane a fette; se preferisci, tostalo.', 'Cuoci il secondo: carne e hamburger alla piastra o in padella antiaderente ben calda, pochi minuti per lato; il pesce in padella o al forno a 180 °C per 10-15 minuti; il tonno al naturale va solo sgocciolato; le uova sode, strapazzate o in frittata.', 'Prepara il contorno: la verdura al vapore, lessata, grigliata o saltata in padella; insalata, pomodori, carote e finocchi anche crudi.', 'Condisci tutto con l’olio extravergine a crudo e insaporisci con gli aromi.'] }),
  recipe({ id: 'ST-GALLETTE', name: 'Gallette, secondo e contorno', meal: LU, prepMinutes: 5, cookMinutes: 10, difficulty: 'Facile', equipment: ['Padella o piastra'],
    description: 'Un secondo di carne, pesce o uova con verdura e gallette, conditi con olio extravergine: il più veloce da preparare.',
    steps: ['Tieni pronte le gallette: non richiedono preparazione.', 'Cuoci il secondo: carne e hamburger alla piastra o in padella antiaderente ben calda, pochi minuti per lato; il pesce in padella o al forno a 180 °C per 10-15 minuti; il tonno al naturale va solo sgocciolato; le uova sode, strapazzate o in frittata.', 'Prepara il contorno: la verdura al vapore, lessata, grigliata o saltata in padella; insalata, pomodori, carote e finocchi anche crudi.', 'Condisci tutto con l’olio extravergine a crudo e insaporisci con gli aromi.'] }),
  recipe({ id: 'ST-LEGUMI', name: 'Legumi, secondo e contorno', meal: LU, prepMinutes: 5, cookMinutes: 12, difficulty: 'Facile', equipment: ['Pentolino', 'Padella o piastra'],
    description: 'Ceci, fagioli o lenticchie al posto del primo, con un secondo di carne, pesce o uova e una verdura.',
    steps: ['Sciacqua i legumi già cotti (in scatola o in vetro) e scaldali in un pentolino con rosmarino; se parti dai legumi secchi, cuocili prima secondo i tempi della confezione.', 'Cuoci il secondo: carne e hamburger alla piastra o in padella antiaderente ben calda, pochi minuti per lato; il pesce in padella o al forno a 180 °C per 10-15 minuti; il tonno al naturale va solo sgocciolato; le uova sode, strapazzate o in frittata.', 'Prepara il contorno: la verdura al vapore, lessata, grigliata o saltata in padella; insalata, pomodori, carote e finocchi anche crudi.', 'Condisci tutto con l’olio extravergine a crudo e insaporisci con gli aromi.'] }),
];

const BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

/** The recipe of a dish. */
export function recipeForDish(dishId: string | undefined): Recipe | undefined {
  return dishId ? BY_ID.get(dishId) : undefined;
}

/** What goes in a recipe, by role, without quantities: the single source is the dish (dishes.ts). */
export function recipeComposition(dishId: string): Pick<Dish, 'base' | 'protein' | 'sides' | 'spread' | 'fat' | 'accessories' | 'oil' | 'aromas'> | undefined {
  const d = DISHES.find((x) => x.id === dishId);
  return d && { base: d.base, protein: d.protein, sides: d.sides, spread: d.spread, fat: d.fat, accessories: d.accessories, oil: d.oil, aromas: d.aromas };
}
