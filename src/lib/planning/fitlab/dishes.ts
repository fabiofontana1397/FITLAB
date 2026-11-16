/**
 * The standard meals of the Fit Lab diet. A dish says which foods may play which role, with the names used in the
 * catalog (data/fitlab workbook). Quantities are not here: they are solved afterwards from the person's targets
 * (fitlab/solver.ts).
 *
 * The structure is deliberately plain, so every meal is quick to prepare and every food is easy to swap:
 *  - pranzo e cena   primo (ONE carbohydrate source) + secondo (ONE protein source) + contorno (ONE vegetable)
 *                    + extra virgin olive oil, the only added fat. Any primo goes with any secondo.
 *  - colazione       one of a short list of classic breakfasts (porridge, eggs, bread with ricotta and jam, yogurt…).
 *  - merenda         yogurt, oats, bread with jam, or a sandwich with cold cuts (cold cuts: once a week at most).
 * A meal never has two carbohydrate sources (pasta AND bread) nor two protein sources: meal-builder.ts enforces it.
 *
 * Roles:
 *  - base      primo / carbohydrate         - protein   secondo / protein source
 *  - sides     contorno (vegetable) or fruit; each inner list is one side to pick from
 *  - spread    jam or honey                 - fat       avocado, nut butter (breakfast only)
 *  - oil       extra virgin olive oil       - aromas    free flavourings (herbs, spices, lemon, tomato passata)
 * The FIRST food of every list is the default; the others are its alternatives.
 */
import type { SlotKind } from './catalog';
import { foodByName } from './foods';

export type Dish = {
  id: string;
  kinds: SlotKind[];
  /** Name template: {base} {protein} {s1} {fat} {spread}. */
  name: string;
  base?: string[];
  protein: string[];
  /** Protein sources that join when the person can eat fewer than four of `protein` (who eats no meat: eggs and fresh cheese;
   * who eats no fish either also gets legumes next to a cereal, see meal-builder.ts). */
  proteinFallback?: string[];
  sides?: string[][];
  spread?: string[];
  fat?: string[];
  /** Nuts added only for who picked them in the questionnaire (a spoonful on yogurt or porridge). */
  fatIfPreferred?: string[];
  oil?: boolean;
  aromas: string[];
  portable?: boolean;
  /** Small fixed-by-recipe ingredients (milk in a porridge, honey, a squeeze of lemon): `grams` is the amount for a
   * `refKcal` meal (default 400), scaled with the meal's calories and rounded to `step`. The first allowed food of `foods` is used;
   * when none is allowed (e.g. no milk for a vegan) the ingredient is left out. Always counted in the nutrition of the meal. */
  accessories?: { foods: string[]; grams: number; step: number }[];
  refKcal?: number;
  /** The fat is named in the dish (avocado toast): it is always in the meal, never rounded away. */
  fatRequired?: boolean;
  /** A quick lunch (bread, rice cakes): at dinner the other primi come first (pasta, rice, potatoes, legumes). */
  rareAtDinner?: boolean;
  /** Not one of the standard meals: used only when the person's exclusions leave too few of them for a varied week. */
  reserve?: boolean;
};

const BF: SlotKind[] = ['breakfast'];
const SN: SlotKind[] = ['snack'];
const MAIN: SlotKind[] = ['lunch', 'dinner'];

// ------------------------------------------------------------ standard lists --

/** Primo: one carbohydrate source. */
export const PRIMI = {
  pasta: ['Pasta', 'Pasta integrale'],
  riso: ['Riso', 'Riso basmati', 'Riso integrale'],
  patate: ['Patate', 'Patate dolci'],
  // pan bauletto is a breakfast and snack bread: never a primo at lunch or dinner
  pane: ['Pane integrale', 'Pane di segale'],
  gallette: ['Gallette di riso', 'Gallette di mais', 'Gallette di farro'],
  legumi: ['Ceci', 'Fagioli cannellini', 'Lenticchie', 'Fagioli borlotti', 'Fagioli'],
};

/** Secondo: one protein source. Meat and white fish first; all of them go with every primo. */
export const SECONDI = [
  'Petto di pollo',
  'Petto di tacchino',
  'Vitello magro',
  'Manzo magro',
  'Macinato di manzo magro',
  'Hamburger di manzo magro',
  'Merluzzo',
  'Orata',
  'Hamburger di pollo magro',
  'Hamburger di tacchino magro',
  'Lonza di maiale magra',
  'Salmone',
  'Tonno al naturale',
  'Uova intere',
];
/** For who eats no meat: eggs and fresh cheese. */
export const SECONDI_VEG = ['Uova intere', "Albume d'uovo", 'Fiocchi di latte', 'Mozzarella light', 'Ricotta magra'];

/** Contorno: one classic vegetable (the person's preferred vegetables join the list, see meal-builder.ts). */
export const CONTORNI = ['Zucchine', 'Lattuga', 'Pomodori', 'Broccoli', 'Spinaci', 'Fagiolini', 'Carote', 'Finocchi', 'Peperoni', 'Melanzane', 'Cavolfiore', 'Bietole'];

const OATS = ["Fiocchi d'avena", 'Avena istantanea'];
const BREAD = ['Pane integrale', 'Pane di segale', 'Pan bauletto'];
const GREEK = ['Yogurt greco 0%', 'Yogurt greco 2%'];
const MILK = ['Latte vaccino', 'Latte senza lattosio', 'Bevanda di soia non zuccherata'];
const FRUIT = ['Banana', 'Mela', 'Frutti di bosco', 'Kiwi', 'Pera', 'Arancia', 'Fragole', 'Pesca'];
const NUTS = ['Mandorle', 'Noci', 'Nocciole', 'Pistacchi'];
const AROMI_CARNE = ['Limone', 'Rosmarino', 'Pepe nero'];

const main = (id: string, base: string[], extra: Partial<Dish> = {}): Dish => ({
  id,
  kinds: MAIN,
  name: '{base}, {protein} e {s1}',
  base,
  protein: SECONDI,
  proteinFallback: SECONDI_VEG,
  sides: [CONTORNI],
  oil: true,
  aromas: AROMI_CARNE,
  ...extra,
});

export const DISHES: Dish[] = [
  // =============================================================== COLAZIONE
  { id: 'PL001', kinds: BF, name: "Porridge d'avena, {protein} e {s1}", base: OATS, protein: GREEK, sides: [['Frutti di bosco', 'Mirtilli', 'Fragole', 'Banana', 'Mela']], fatIfPreferred: NUTS, accessories: [{ foods: MILK, grams: 150, step: 10 }], aromas: ['Cannella'] },
  { id: 'PL003', kinds: BF, name: "Porridge d'avena e albumi", base: OATS, protein: ["Albume d'uovo"], fat: ['Burro di arachidi 100%'], accessories: [{ foods: MILK, grams: 100, step: 10 }], aromas: ['Cannella'], fatRequired: true },
  { id: 'ST-BF-UOVA-AVOCADO', kinds: BF, name: 'Avocado toast con {protein}', base: BREAD, protein: ['Uova intere'], fat: ['Avocado'], aromas: ['Limone', 'Pepe nero'], fatRequired: true },
  { id: 'ST-BF-UOVA', kinds: BF, name: 'Uova strapazzate con {base}', base: BREAD, protein: ['Uova intere'], aromas: ['Pepe nero', 'Prezzemolo'] },
  { id: 'ST-BF-ALBUMI', kinds: BF, name: 'Frittata di albumi con {base}', base: BREAD, protein: ["Albume d'uovo"], oil: true, aromas: ['Pepe nero', 'Prezzemolo'] },
  { id: 'PL005', kinds: BF, name: '{base} con {protein} e marmellata', base: BREAD, protein: ['Ricotta magra'], spread: ['Marmellata light'], aromas: [] },
  { id: 'ST-BF-YOGURT-CEREALI', kinds: BF, name: '{protein} con {base} e {s1}', base: ['Cereali integrali', 'Muesli'], protein: GREEK, sides: [FRUIT], fatIfPreferred: NUTS, aromas: [] },
  { id: 'ST-BF-LATTE-CEREALI', kinds: BF, name: 'Latte proteico con {base} e {s1}', base: ['Cereali integrali', 'Cereali da colazione senza zuccheri aggiunti'], protein: ['Bevanda proteica'], sides: [FRUIT], aromas: [] },
  { id: 'ST-BF-YOGURT-AVENA', kinds: BF, name: '{protein} con avena e {s1}', base: OATS, protein: GREEK, sides: [FRUIT], fatIfPreferred: NUTS, aromas: ['Cannella'] },
  // reserve, for who eats neither dairy nor eggs
  { id: 'ST-BF-PORRIDGE-VEG', kinds: BF, name: "Porridge d'avena con {protein} e {s1}", base: OATS, protein: ['Bevanda di soia non zuccherata', 'Bevanda di mandorla non zuccherata'], sides: [FRUIT], fat: ['Burro di arachidi 100%', 'Burro di mandorle 100%'], aromas: ['Cannella'], reserve: true },
  { id: 'ST-BF-PANE-MARMELLATA', kinds: BF, name: '{base} con marmellata e {s1}', base: BREAD, protein: [], sides: [FRUIT], spread: ['Marmellata light'], fat: ['Burro di arachidi 100%', 'Burro di mandorle 100%'], aromas: [], reserve: true },

  // ================================================================= MERENDA
  { id: 'ST-SN-YOGURT', kinds: SN, name: '{protein} con {s1}', protein: GREEK, sides: [FRUIT], fatIfPreferred: NUTS, aromas: [] },
  { id: 'ST-SN-YOGURT-AVENA', kinds: SN, name: '{protein} con avena', base: OATS, protein: GREEK, aromas: ['Cannella'] },
  { id: 'ST-SN-BAULETTO', kinds: SN, name: '{base} con marmellata', base: ['Pan bauletto', 'Pane integrale'], protein: [], spread: ['Marmellata light'], aromas: [], portable: true },
  // cold cuts: once a week at most (meal-builder.ts)
  { id: 'ST-SN-PANINO', kinds: SN, name: 'Panino con {protein}', base: ['Pan bauletto', 'Pane integrale', 'Pane di segale'], protein: ['Fesa di tacchino affettata', 'Bresaola', 'Prosciutto crudo'], aromas: [], portable: true },
  // reserve, for who eats no dairy
  { id: 'ST-SN-UOVA', kinds: SN, name: 'Uova sode con {base}', base: BREAD, protein: ['Uova intere'], aromas: ['Pepe nero'], portable: true, reserve: true },
  { id: 'ST-SN-LATTE-CEREALI', kinds: SN, name: '{protein} con {base}', base: ['Cereali integrali', 'Cereali da colazione senza zuccheri aggiunti'], protein: ['Latte senza lattosio', 'Bevanda di soia non zuccherata'], aromas: [], reserve: true },
  { id: 'PL019', kinds: SN, name: 'Frutta fresca e frutta secca', protein: [], sides: [FRUIT], fat: ['Mandorle', 'Noci', 'Nocciole', 'Pistacchi'], aromas: [], portable: true, reserve: true, fatRequired: true },

  // =========================================================== PRANZO E CENA
  main('ST-PASTA', PRIMI.pasta, { aromas: ['Passata di pomodoro', 'Basilico', 'Limone'], portable: true }),
  main('ST-RISO', PRIMI.riso, { portable: true }),
  main('ST-PATATE', PRIMI.patate),
  main('ST-PANE', PRIMI.pane, { portable: true, rareAtDinner: true }),
  main('ST-GALLETTE', PRIMI.gallette, { portable: true, rareAtDinner: true }),
  // legumes are the carbohydrate source of the meal, next to a secondo like any other primo
  main('ST-LEGUMI', PRIMI.legumi, { aromas: ['Rosmarino', 'Limone', 'Pepe nero'], portable: true }),
];

// Every food named in a dish must exist in the catalog (a typo fails loudly at load, not silently at plan time).
for (const d of DISHES) {
  for (const name of [...(d.base ?? []), ...d.protein, ...(d.proteinFallback ?? []), ...(d.sides ?? []).flat(), ...(d.spread ?? []), ...(d.fat ?? []), ...(d.fatIfPreferred ?? []), ...d.aromas, ...(d.accessories ?? []).flatMap((a) => a.foods)]) foodByName(name);
}
