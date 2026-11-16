/**
 * The standard meals of the Fit Lab diet. A dish says which foods may play which role, with the names used in the
 * catalog (data/fitlab workbook). Quantities are not here: they are solved afterwards from the person's targets
 * (fitlab/solver.ts).
 *
 * A FIXED POOL OF STANDARD RECIPES, rotated across the weeks and the plan updates: 20 breakfasts, 20 snacks, 50 lunches,
 * 50 dinners (+ 4 reserve dishes for who eats no meat, fish, eggs or dairy). Every recipe has its own name and photo
 * (dish-images.ts): its foods never change with the person's preferences, which only decide how often a recipe comes up.
 * Only the grams (and so the calories and macros) are fitted to each person.
 *  - pranzo e cena   primo (ONE carbohydrate source) + secondo (ONE protein source) + contorno (ONE vegetable)
 *                    + extra virgin olive oil, the only added fat. Lunch is quick: no fish to cook (canned tuna is fine).
 *  - colazione       classic breakfasts (porridge, eggs, bread with ricotta and jam, yogurt…).
 *  - merenda         yogurt, bread with jam, sandwiches (cold cuts: once a week at most), fruit.
 * The alternatives listed in a role are only foods that look and are eaten the same way (pasta / gluten-free pasta,
 * rice / basmati, greek yogurt 0% / 2%): the first allowed one is used, so the photo always shows the plate.
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
  /** The recipe's name, as shown in the plan (fixed: the pool recipes have no placeholders). */
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
const LU: SlotKind[] = ['lunch'];
const DI: SlotKind[] = ['dinner'];
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

export const DISHES: Dish[] = [
  // =============================================================== COLAZIONE
  { id: 'B01', kinds: BF, name: "Porridge d’avena con yogurt greco e frutti di bosco", base: ["Fiocchi d'avena", "Avena istantanea"], protein: ["Yogurt greco 0%", "Yogurt greco 2%"], sides: [["Frutti di bosco", "Mirtilli"]], accessories: [{ foods: ["Latte vaccino", "Latte senza lattosio", "Bevanda di soia non zuccherata"], grams: 150, step: 10 }], aromas: ["Cannella"] },
  { id: 'B02', kinds: BF, name: "Porridge d’avena con albumi e burro di arachidi", base: ["Fiocchi d'avena", "Avena istantanea"], protein: ["Albume d'uovo"], fat: ["Burro di arachidi 100%"], fatRequired: true, accessories: [{ foods: ["Latte vaccino", "Latte senza lattosio", "Bevanda di soia non zuccherata"], grams: 100, step: 10 }], aromas: ["Cannella"] },
  { id: 'B03', kinds: BF, name: "Porridge d’avena con yogurt greco e banana", base: ["Fiocchi d'avena", "Avena istantanea"], protein: ["Yogurt greco 0%", "Yogurt greco 2%"], sides: [["Banana"]], accessories: [{ foods: ["Latte vaccino", "Latte senza lattosio", "Bevanda di soia non zuccherata"], grams: 150, step: 10 }], aromas: ["Cannella"] },
  { id: 'B04', kinds: BF, name: "Avocado toast con uova", base: ["Pane integrale", "Pane di segale"], protein: ["Uova intere"], fat: ["Avocado"], fatRequired: true, aromas: ["Limone", "Pepe nero"] },
  { id: 'B05', kinds: BF, name: "Uova strapazzate con pane integrale e arancia", base: ["Pane integrale", "Pane di segale"], protein: ["Uova intere"], sides: [["Arancia"]], aromas: ["Pepe nero", "Prezzemolo"] },
  { id: 'B06', kinds: BF, name: "Frittata di albumi con pane integrale", base: ["Pane integrale", "Pane di segale"], protein: ["Albume d'uovo"], oil: true, aromas: ["Pepe nero", "Prezzemolo"] },
  { id: 'B07', kinds: BF, name: "Pane integrale con ricotta e marmellata", base: ["Pane integrale", "Pane di segale"], protein: ["Ricotta magra"], spread: ["Marmellata light"], aromas: [] },
  { id: 'B08', kinds: BF, name: "Fette biscottate con yogurt greco e marmellata", base: ["Fette biscottate integrali"], protein: ["Yogurt greco 0%", "Yogurt greco 2%"], spread: ["Marmellata light"], aromas: [] },
  { id: 'B09', kinds: BF, name: "Yogurt greco con muesli e kiwi", base: ["Muesli"], protein: ["Yogurt greco 0%", "Yogurt greco 2%"], sides: [["Kiwi"]], fat: ["Mandorle"], aromas: [] },
  { id: 'B10', kinds: BF, name: "Yogurt greco con cereali integrali e fragole", base: ["Cereali integrali", "Cereali da colazione senza zuccheri aggiunti"], protein: ["Yogurt greco 0%", "Yogurt greco 2%"], sides: [["Fragole"]], aromas: [] },
  { id: 'B11', kinds: BF, name: "Overnight oats con yogurt greco e banana", base: ["Fiocchi d'avena", "Avena istantanea"], protein: ["Yogurt greco 0%", "Yogurt greco 2%", "Skyr"], sides: [["Banana"]], fat: ["Semi di chia"], aromas: ["Cannella"] },
  { id: 'B12', kinds: BF, name: "Latte con cereali integrali, banana e mandorle", base: ["Cereali integrali", "Cereali da colazione senza zuccheri aggiunti"], protein: ["Latte vaccino", "Latte senza lattosio", "Bevanda di soia non zuccherata"], sides: [["Banana"]], fat: ["Mandorle"], aromas: [] },
  { id: 'B13', kinds: BF, name: "Pancake d’avena con yogurt e banana", base: ["Fiocchi d'avena"], protein: ["Uova intere", "Albume d'uovo"], sides: [["Banana"]], accessories: [{ foods: ["Latte vaccino", "Latte senza lattosio", "Bevanda di soia non zuccherata"], grams: 50, step: 10 }, { foods: ["Yogurt greco 0%", "Yogurt greco 2%"], grams: 100, step: 10 }], aromas: [] },
  { id: 'B14', kinds: BF, name: "Pane di segale con fiocchi di latte e marmellata", base: ["Pane di segale", "Pane integrale"], protein: ["Fiocchi di latte"], spread: ["Marmellata light"], aromas: [] },
  { id: 'B15', kinds: BF, name: "Skyr con banana e semi di chia", protein: ["Skyr", "Yogurt greco 0%"], sides: [["Banana"]], fat: ["Semi di chia"], aromas: [] },
  { id: 'B16', kinds: BF, name: "Kefir con avena, mela e noci", base: ["Fiocchi d'avena"], protein: ["Kefir"], sides: [["Mela"]], fat: ["Noci"], aromas: ["Cannella"] },
  { id: 'B17', kinds: BF, name: "Gallette di riso con ricotta, banana e burro di mandorle", base: ["Gallette di riso", "Gallette di mais"], protein: ["Ricotta magra"], sides: [["Banana"]], fat: ["Burro di mandorle 100%"], aromas: [] },
  { id: 'B18', kinds: BF, name: "Yogurt greco con avena e frutti di bosco", base: ["Fiocchi d'avena", "Avena istantanea"], protein: ["Yogurt greco 0%", "Yogurt greco 2%"], sides: [["Frutti di bosco", "Mirtilli"]], aromas: ["Cannella"] },
  { id: 'B19', kinds: BF, name: "Porridge con bevanda di soia, banana e burro di arachidi", base: ["Fiocchi d'avena", "Avena istantanea"], protein: ["Bevanda di soia non zuccherata", "Bevanda di mandorla non zuccherata"], sides: [["Banana"]], fat: ["Burro di arachidi 100%"], fatRequired: true, aromas: ["Cannella"], reserve: true },
  { id: 'B20', kinds: BF, name: "Pane integrale con burro di arachidi e mela", base: ["Pane integrale", "Pane di segale"], protein: [], sides: [["Mela"]], fat: ["Burro di arachidi 100%", "Burro di mandorle 100%"], fatRequired: true, aromas: [], reserve: true },

  // ================================================================= MERENDA
  { id: 'S01', kinds: SN, name: "Yogurt greco con frutti di bosco e mandorle", protein: ["Yogurt greco 0%", "Yogurt greco 2%"], sides: [["Frutti di bosco", "Mirtilli"]], fat: ["Mandorle"], aromas: [] },
  { id: 'S02', kinds: SN, name: "Yogurt greco con mela e noci", protein: ["Yogurt greco 0%", "Yogurt greco 2%"], sides: [["Mela"]], fat: ["Noci"], aromas: [] },
  { id: 'S03', kinds: SN, name: "Yogurt greco con avena e cannella", base: ["Fiocchi d'avena", "Avena istantanea"], protein: ["Yogurt greco 0%", "Yogurt greco 2%"], aromas: ["Cannella"] },
  { id: 'S04', kinds: SN, name: "Yogurt greco con noci e miele", protein: ["Yogurt greco 0%", "Yogurt greco 2%"], spread: ["Miele"], fat: ["Noci"], aromas: [] },
  { id: 'S05', kinds: SN, name: "Kefir con frutti di bosco e semi di lino", protein: ["Kefir", "Yogurt magro"], sides: [["Frutti di bosco", "Mirtilli"]], fat: ["Semi di lino"], aromas: [] },
  { id: 'S06', kinds: SN, name: "Pan bauletto con marmellata", base: ["Pan bauletto", "Pane integrale"], protein: [], spread: ["Marmellata light"], aromas: [], portable: true },
  { id: 'S07', kinds: SN, name: "Panino con fesa di tacchino", base: ["Pan bauletto", "Pane integrale"], protein: ["Fesa di tacchino affettata"], aromas: [], portable: true },
  { id: 'S08', kinds: SN, name: "Bresaola con pane e rucola", base: ["Pane integrale", "Pane di segale"], protein: ["Bresaola"], sides: [["Rucola"]], aromas: ["Limone", "Pepe nero"], portable: true },
  { id: 'S09', kinds: SN, name: "Pane integrale con ricotta", base: ["Pane integrale", "Pane di segale"], protein: ["Ricotta magra"], aromas: ["Origano", "Pepe nero"] },
  { id: 'S10', kinds: SN, name: "Crackers con tonno e pomodorini", base: ["Crackers integrali"], protein: ["Tonno al naturale"], sides: [["Pomodori"]], aromas: [], portable: true },
  { id: 'S11', kinds: SN, name: "Pane integrale con fesa di tacchino e avocado", base: ["Pane integrale", "Pane di segale"], protein: ["Fesa di tacchino affettata"], fat: ["Avocado"], fatRequired: true, aromas: [], portable: true },
  { id: 'S12', kinds: SN, name: "Hummus di ceci con carote e crackers", base: ["Crackers integrali"], protein: ["Ceci"], sides: [["Carote"]], oil: true, aromas: ["Limone", "Aglio"], portable: true },
  { id: 'S13', kinds: SN, name: "Pera con parmigiano e noci", protein: ["Parmigiano Reggiano"], sides: [["Pera"]], fat: ["Noci"], aromas: [], portable: true },
  { id: 'S14', kinds: SN, name: "Barretta proteica e mela", protein: ["Barretta proteica"], sides: [["Mela"]], aromas: [], portable: true },
  { id: 'S15', kinds: SN, name: "Bevanda proteica con banana e mandorle", protein: ["Bevanda proteica"], sides: [["Banana"]], fat: ["Mandorle"], aromas: [], portable: true },
  { id: 'S16', kinds: SN, name: "Bruschetta con mozzarella e pomodori", base: ["Pane integrale", "Pane di segale"], protein: ["Mozzarella light", "Mozzarella"], sides: [["Pomodori"]], aromas: ["Basilico", "Origano"] },
  { id: 'S17', kinds: SN, name: "Budino proteico con fragole e mandorle", protein: ["Budino proteico", "Yogurt proteico"], sides: [["Fragole"]], fat: ["Mandorle"], aromas: [] },
  { id: 'S18', kinds: SN, name: "Frutta fresca e frutta secca", protein: [], sides: [["Mela"]], fat: ["Mandorle", "Noci"], fatRequired: true, aromas: [], portable: true, reserve: true },
  { id: 'S19', kinds: SN, name: "Uova sode con pane integrale", base: ["Pane integrale", "Pane di segale"], protein: ["Uova intere"], aromas: ["Pepe nero"], portable: true },
  { id: 'S20', kinds: SN, name: "Latte senza lattosio con cereali integrali", base: ["Cereali integrali", "Cereali da colazione senza zuccheri aggiunti"], protein: ["Latte senza lattosio", "Bevanda di soia non zuccherata"], aromas: [], reserve: true },

  // ================================================================== PRANZO
  { id: 'L01', kinds: LU, name: "Pasta al pomodoro con pollo e zucchine", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Petto di pollo"], sides: [["Zucchine"]], oil: true, aromas: ["Passata di pomodoro", "Basilico"], portable: true },
  { id: 'L02', kinds: LU, name: "Pasta con tonno e pomodorini", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Tonno al naturale"], sides: [["Pomodori"]], oil: true, aromas: ["Basilico", "Origano"], portable: true },
  { id: 'L03', kinds: LU, name: "Pasta al pomodoro con ricotta e melanzane", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Ricotta magra"], sides: [["Melanzane"]], oil: true, aromas: ["Passata di pomodoro", "Basilico"], portable: true },
  { id: 'L04', kinds: LU, name: "Pasta al ragù di manzo con insalata", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Macinato di manzo magro"], sides: [["Lattuga"]], oil: true, aromas: ["Passata di pomodoro", "Basilico"], portable: true },
  { id: 'L05', kinds: LU, name: "Pasta con tacchino e broccoli", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Petto di tacchino"], sides: [["Broccoli"]], oil: true, aromas: ["Aglio", "Pepe nero"], portable: true },
  { id: 'L06', kinds: LU, name: "Insalata di pasta con mozzarella e pomodorini", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Mozzarella light", "Mozzarella"], sides: [["Pomodori"]], oil: true, aromas: ["Basilico", "Origano"], portable: true },
  { id: 'L07', kinds: LU, name: "Pasta integrale con pollo e peperoni", base: ["Pasta integrale", "Pasta", "Pasta di riso", "Pasta di mais"], protein: ["Petto di pollo"], sides: [["Peperoni"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L08', kinds: LU, name: "Pasta integrale con tonno e fagiolini", base: ["Pasta integrale", "Pasta", "Pasta di riso", "Pasta di mais"], protein: ["Tonno al naturale"], sides: [["Fagiolini"]], oil: true, aromas: ["Limone", "Prezzemolo"], portable: true },
  { id: 'L09', kinds: LU, name: "Riso con pollo e zucchine", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Petto di pollo"], sides: [["Zucchine"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L10', kinds: LU, name: "Insalata di riso con tonno e pomodorini", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Tonno al naturale"], sides: [["Pomodori"]], oil: true, aromas: ["Basilico", "Origano"], portable: true },
  { id: 'L11', kinds: LU, name: "Riso con tacchino e carote", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Petto di tacchino"], sides: [["Carote"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L12', kinds: LU, name: "Riso con manzo e peperoni", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Manzo magro"], sides: [["Peperoni"]], oil: true, aromas: ["Pepe nero", "Paprika"], portable: true },
  { id: 'L13', kinds: LU, name: "Insalata di riso con mozzarella e pomodorini", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Mozzarella light", "Mozzarella"], sides: [["Pomodori"]], oil: true, aromas: ["Basilico", "Origano"], portable: true },
  { id: 'L14', kinds: LU, name: "Riso basmati con pollo al curry e zucchine", base: ["Riso basmati", "Riso", "Riso integrale"], protein: ["Petto di pollo"], sides: [["Zucchine"]], oil: true, aromas: ["Curry", "Curcuma"], portable: true },
  { id: 'L15', kinds: LU, name: "Riso integrale con hamburger di pollo e insalata", base: ["Riso integrale", "Riso", "Riso basmati"], protein: ["Hamburger di pollo magro"], sides: [["Lattuga"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L16', kinds: LU, name: "Cous cous con pollo e peperoni", base: ["Cous cous"], protein: ["Petto di pollo"], sides: [["Peperoni"]], oil: true, aromas: ["Paprika", "Prezzemolo"], portable: true },
  { id: 'L17', kinds: LU, name: "Cous cous con tonno e zucchine", base: ["Cous cous"], protein: ["Tonno al naturale"], sides: [["Zucchine"]], oil: true, aromas: ["Limone", "Prezzemolo"], portable: true },
  { id: 'L18', kinds: LU, name: "Cous cous con tacchino e melanzane", base: ["Cous cous"], protein: ["Petto di tacchino"], sides: [["Melanzane"]], oil: true, aromas: ["Paprika", "Prezzemolo"], portable: true },
  { id: 'L19', kinds: LU, name: "Farro con tonno e pomodorini", base: ["Farro"], protein: ["Tonno al naturale"], sides: [["Pomodori"]], oil: true, aromas: ["Basilico", "Origano"], portable: true },
  { id: 'L20', kinds: LU, name: "Farro con pollo e zucchine", base: ["Farro"], protein: ["Petto di pollo"], sides: [["Zucchine"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L21', kinds: LU, name: "Orzo con tacchino e carote", base: ["Orzo"], protein: ["Petto di tacchino"], sides: [["Carote"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L22', kinds: LU, name: "Insalata di orzo con mozzarella e pomodorini", base: ["Orzo"], protein: ["Mozzarella light", "Mozzarella"], sides: [["Pomodori"]], oil: true, aromas: ["Basilico"], portable: true },
  { id: 'L23', kinds: LU, name: "Frittata di zucchine con patate", base: ["Patate"], protein: ["Uova intere"], sides: [["Zucchine"]], oil: true, aromas: ["Prezzemolo", "Pepe nero"], portable: true },
  { id: 'L24', kinds: LU, name: "Pollo al limone con patate e fagiolini", base: ["Patate"], protein: ["Petto di pollo"], sides: [["Fagiolini"]], oil: true, aromas: ["Limone", "Rosmarino"], portable: true },
  { id: 'L25', kinds: LU, name: "Hamburger di manzo con patate e insalata", base: ["Patate"], protein: ["Hamburger di manzo magro"], sides: [["Lattuga"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L26', kinds: LU, name: "Lonza con patate e spinaci", base: ["Patate"], protein: ["Lonza di maiale magra"], sides: [["Spinaci"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L27', kinds: LU, name: "Tacchino con patate e carote", base: ["Patate"], protein: ["Petto di tacchino"], sides: [["Carote"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L28', kinds: LU, name: "Hamburger di tacchino al pomodoro con pane e spinaci", base: ["Pane integrale", "Pane di segale"], protein: ["Hamburger di tacchino magro"], sides: [["Spinaci"]], oil: true, aromas: ["Passata di pomodoro", "Basilico"], portable: true },
  { id: 'L29', kinds: LU, name: "Pollo alla griglia con pane integrale e insalata", base: ["Pane integrale", "Pane di segale"], protein: ["Petto di pollo"], sides: [["Lattuga"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L30', kinds: LU, name: "Tonno con pane integrale e pomodori", base: ["Pane integrale", "Pane di segale"], protein: ["Tonno al naturale"], sides: [["Pomodori"]], oil: true, aromas: ["Origano", "Basilico"], portable: true },
  { id: 'L31', kinds: LU, name: "Uova strapazzate con pane integrale e spinaci", base: ["Pane integrale", "Pane di segale"], protein: ["Uova intere"], sides: [["Spinaci"]], oil: true, aromas: ["Pepe nero"], portable: true },
  { id: 'L32', kinds: LU, name: "Fiocchi di latte con pane di segale e cetrioli", base: ["Pane di segale", "Pane integrale"], protein: ["Fiocchi di latte"], sides: [["Cetrioli"]], oil: true, aromas: ["Pepe nero", "Prezzemolo"], portable: true },
  { id: 'L33', kinds: LU, name: "Gallette di riso con tonno e pomodori", base: ["Gallette di riso", "Gallette di mais"], protein: ["Tonno al naturale"], sides: [["Pomodori"]], oil: true, aromas: ["Origano"], portable: true },
  { id: 'L34', kinds: LU, name: "Gallette di riso con pollo e insalata", base: ["Gallette di riso", "Gallette di mais"], protein: ["Petto di pollo"], sides: [["Lattuga"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L35', kinds: LU, name: "Insalata di ceci con tonno e pomodori", base: ["Ceci"], protein: ["Tonno al naturale"], sides: [["Pomodori"]], oil: true, aromas: ["Prezzemolo", "Limone"], portable: true },
  { id: 'L36', kinds: LU, name: "Ceci con pollo e spinaci", base: ["Ceci"], protein: ["Petto di pollo"], sides: [["Spinaci"]], oil: true, aromas: ["Paprika", "Aglio"], portable: true },
  { id: 'L37', kinds: LU, name: "Lenticchie con uova sode e carote", base: ["Lenticchie"], protein: ["Uova intere"], sides: [["Carote"]], oil: true, aromas: ["Rosmarino", "Pepe nero"], portable: true },
  { id: 'L38', kinds: LU, name: "Fagioli cannellini con tonno e insalata", base: ["Fagioli cannellini"], protein: ["Tonno al naturale"], sides: [["Lattuga"]], oil: true, aromas: ["Prezzemolo", "Limone"], portable: true },
  { id: 'L39', kinds: LU, name: "Fagioli borlotti con tacchino e zucchine", base: ["Fagioli borlotti"], protein: ["Petto di tacchino"], sides: [["Zucchine"]], oil: true, aromas: ["Rosmarino", "Salvia"], portable: true },
  { id: 'L40', kinds: LU, name: "Patate dolci con pollo e broccoli", base: ["Patate dolci"], protein: ["Petto di pollo"], sides: [["Broccoli"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L41', kinds: LU, name: "Riso con vitello e funghi", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Vitello magro"], sides: [["Funghi"]], oil: true, aromas: ["Prezzemolo", "Aglio"], portable: true },
  { id: 'L42', kinds: LU, name: "Pasta integrale con ricotta e spinaci", base: ["Pasta integrale", "Pasta", "Pasta di riso", "Pasta di mais"], protein: ["Ricotta magra"], sides: [["Spinaci"]], oil: true, aromas: ["Pepe nero"], portable: true },
  { id: 'L43', kinds: LU, name: "Farro con fiocchi di latte e pomodorini", base: ["Farro"], protein: ["Fiocchi di latte"], sides: [["Pomodori"]], oil: true, aromas: ["Basilico"], portable: true },
  { id: 'L44', kinds: LU, name: "Straccetti di manzo con patate e rucola", base: ["Patate"], protein: ["Manzo magro"], sides: [["Rucola"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L45', kinds: LU, name: "Riso con lonza e peperoni", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Lonza di maiale magra"], sides: [["Peperoni"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L46', kinds: LU, name: "Cous cous con hamburger di pollo e pomodori", base: ["Cous cous"], protein: ["Hamburger di pollo magro"], sides: [["Pomodori"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L47', kinds: LU, name: "Gallette di mais con mozzarella e pomodori", base: ["Gallette di mais", "Gallette di riso"], protein: ["Mozzarella light", "Mozzarella"], sides: [["Pomodori"]], oil: true, aromas: ["Basilico", "Origano"], portable: true },
  { id: 'L48', kinds: LU, name: "Pasta con pollo e funghi", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Petto di pollo"], sides: [["Funghi"]], oil: true, aromas: ["Prezzemolo", "Aglio"], portable: true },
  { id: 'L49', kinds: LU, name: "Riso con tacchino e asparagi", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Petto di tacchino"], sides: [["Asparagi"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"], portable: true },
  { id: 'L50', kinds: LU, name: "Uova sode con patate e fagiolini", base: ["Patate"], protein: ["Uova intere"], sides: [["Fagiolini"]], oil: true, aromas: ["Prezzemolo", "Pepe nero"], portable: true },

  // ==================================================================== CENA
  { id: 'D01', kinds: DI, name: "Orata al forno con patate e fagiolini", base: ["Patate"], protein: ["Orata"], sides: [["Fagiolini"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D02', kinds: DI, name: "Manzo con patate al forno e cavolo nero", base: ["Patate"], protein: ["Manzo magro"], sides: [["Cavolo nero"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"] },
  { id: 'D03', kinds: DI, name: "Cous cous con gamberi e zucchine", base: ["Cous cous"], protein: ["Gamberi"], sides: [["Zucchine"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D04', kinds: DI, name: "Spezzatino di manzo con patate e carote", base: ["Patate"], protein: ["Manzo magro"], sides: [["Carote"]], oil: true, aromas: ["Rosmarino", "Passata di pomodoro"] },
  { id: 'D05', kinds: DI, name: "Salmone con cous cous e zucchine", base: ["Cous cous"], protein: ["Salmone"], sides: [["Zucchine"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D06', kinds: DI, name: "Hamburger di merluzzo con patate e insalata", base: ["Patate"], protein: ["Hamburger di merluzzo"], sides: [["Lattuga"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D07', kinds: DI, name: "Pasta con gamberi e zucchine", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Gamberi"], sides: [["Zucchine"]], oil: true, aromas: ["Aglio", "Prezzemolo"] },
  { id: 'D08', kinds: DI, name: "Lonza con patate e cavolo nero", base: ["Patate"], protein: ["Lonza di maiale magra"], sides: [["Cavolo nero"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"] },
  { id: 'D09', kinds: DI, name: "Pasta con sardine e finocchi", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Sardine"], sides: [["Finocchi"]], oil: true, aromas: ["Aglio", "Prezzemolo"] },
  { id: 'D10', kinds: DI, name: "Risotto alla zucca con gamberi", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Gamberi"], sides: [["Zucca"]], oil: true, aromas: ["Prezzemolo"] },
  { id: 'D11', kinds: DI, name: "Riso integrale con salmone e broccoli", base: ["Riso integrale", "Riso", "Riso basmati"], protein: ["Salmone"], sides: [["Broccoli"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D12', kinds: DI, name: "Merluzzo con patate e spinaci", base: ["Patate"], protein: ["Merluzzo"], sides: [["Spinaci"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D13', kinds: DI, name: "Riso con merluzzo e zucchine", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Merluzzo"], sides: [["Zucchine"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D14', kinds: DI, name: "Pasta con salmone e zucchine", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Salmone"], sides: [["Zucchine"]], oil: true, aromas: ["Pepe nero", "Prezzemolo"] },
  { id: 'D15', kinds: DI, name: "Pasta con merluzzo e pomodorini", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Merluzzo"], sides: [["Pomodori"]], oil: true, aromas: ["Aglio", "Prezzemolo"] },
  { id: 'D16', kinds: DI, name: "Trota al forno con patate e fagiolini", base: ["Patate"], protein: ["Trota"], sides: [["Fagiolini"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D17', kinds: DI, name: "Trota con riso basmati e asparagi", base: ["Riso basmati", "Riso", "Riso integrale"], protein: ["Trota"], sides: [["Asparagi"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D18', kinds: DI, name: "Salmone con patate dolci e spinaci", base: ["Patate dolci"], protein: ["Salmone"], sides: [["Spinaci"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D19', kinds: DI, name: "Sgombro con patate e insalata", base: ["Patate"], protein: ["Sgombro"], sides: [["Lattuga"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D20', kinds: DI, name: "Orata con riso e zucchine", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Orata"], sides: [["Zucchine"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D21', kinds: DI, name: "Gnocchi al pomodoro con mozzarella e melanzane", base: ["Gnocchi di patate"], protein: ["Mozzarella light", "Mozzarella"], sides: [["Melanzane"]], oil: true, aromas: ["Passata di pomodoro", "Basilico"] },
  { id: 'D22', kinds: DI, name: "Pasta con tacchino e cavolfiore", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Petto di tacchino"], sides: [["Cavolfiore"]], oil: true, aromas: ["Aglio", "Pepe nero"] },
  { id: 'D23', kinds: DI, name: "Riso con pollo e broccoli", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Petto di pollo"], sides: [["Broccoli"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"] },
  { id: 'D24', kinds: DI, name: "Vitello con patate e funghi", base: ["Patate"], protein: ["Vitello magro"], sides: [["Funghi"]], oil: true, aromas: ["Prezzemolo", "Aglio"] },
  { id: 'D25', kinds: DI, name: "Pasta al ragù di manzo con melanzane", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Macinato di manzo magro"], sides: [["Melanzane"]], oil: true, aromas: ["Passata di pomodoro", "Basilico"] },
  { id: 'D26', kinds: DI, name: "Ceci con merluzzo e pomodori", base: ["Ceci"], protein: ["Merluzzo"], sides: [["Pomodori"]], oil: true, aromas: ["Rosmarino", "Aglio"] },
  { id: 'D27', kinds: DI, name: "Lenticchie con tacchino e carote", base: ["Lenticchie"], protein: ["Petto di tacchino"], sides: [["Carote"]], oil: true, aromas: ["Rosmarino", "Pepe nero"] },
  { id: 'D28', kinds: DI, name: "Fagioli cannellini con gamberi e zucchine", base: ["Fagioli cannellini"], protein: ["Gamberi"], sides: [["Zucchine"]], oil: true, aromas: ["Rosmarino", "Aglio"] },
  { id: 'D29', kinds: DI, name: "Farro con salmone e asparagi", base: ["Farro"], protein: ["Salmone"], sides: [["Asparagi"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D30', kinds: DI, name: "Orzo con merluzzo e zucchine", base: ["Orzo"], protein: ["Merluzzo"], sides: [["Zucchine"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D31', kinds: DI, name: "Hamburger di salmone con patate e insalata", base: ["Patate"], protein: ["Hamburger di salmone"], sides: [["Lattuga"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D32', kinds: DI, name: "Frittata di spinaci con patate", base: ["Patate"], protein: ["Uova intere"], sides: [["Spinaci"]], oil: true, aromas: ["Pepe nero"] },
  { id: 'D33', kinds: DI, name: "Pasta con uova e zucchine", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Uova intere"], sides: [["Zucchine"]], oil: true, aromas: ["Pepe nero"] },
  { id: 'D34', kinds: DI, name: "Pasta integrale con tonno e broccoli", base: ["Pasta integrale", "Pasta", "Pasta di riso", "Pasta di mais"], protein: ["Tonno al naturale"], sides: [["Broccoli"]], oil: true, aromas: ["Aglio", "Peperoncino"] },
  { id: 'D35', kinds: DI, name: "Pollo con patate e peperoni", base: ["Patate"], protein: ["Petto di pollo"], sides: [["Peperoni"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"] },
  { id: 'D36', kinds: DI, name: "Tacchino con patate dolci e cavolini", base: ["Patate dolci"], protein: ["Petto di tacchino"], sides: [["Cavolini di Bruxelles"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"] },
  { id: 'D37', kinds: DI, name: "Hamburger di manzo con riso e insalata", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Hamburger di manzo magro"], sides: [["Lattuga"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"] },
  { id: 'D38', kinds: DI, name: "Merluzzo con cous cous e pomodorini", base: ["Cous cous"], protein: ["Merluzzo"], sides: [["Pomodori"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D39', kinds: DI, name: "Tagliata di manzo con patate e rucola", base: ["Patate"], protein: ["Manzo magro"], sides: [["Rucola"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"] },
  { id: 'D40', kinds: DI, name: "Gnocchi con salmone e spinaci", base: ["Gnocchi di patate"], protein: ["Salmone"], sides: [["Spinaci"]], oil: true, aromas: ["Pepe nero"] },
  { id: 'D41', kinds: DI, name: "Pasta con orata e pomodorini", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Orata"], sides: [["Pomodori"]], oil: true, aromas: ["Aglio", "Prezzemolo"] },
  { id: 'D42', kinds: DI, name: "Riso con gamberi e asparagi", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Gamberi"], sides: [["Asparagi"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },
  { id: 'D43', kinds: DI, name: "Pasta con ricotta e zucchine", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Ricotta magra"], sides: [["Zucchine"]], oil: true, aromas: ["Basilico", "Pepe nero"] },
  { id: 'D44', kinds: DI, name: "Pollo arrosto con patate e carote", base: ["Patate"], protein: ["Petto di pollo"], sides: [["Carote"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"] },
  { id: 'D45', kinds: DI, name: "Lonza con riso e spinaci", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Lonza di maiale magra"], sides: [["Spinaci"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"] },
  { id: 'D46', kinds: DI, name: "Hamburger di pollo con patate dolci e zucchine", base: ["Patate dolci"], protein: ["Hamburger di pollo magro"], sides: [["Zucchine"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"] },
  { id: 'D47', kinds: DI, name: "Farro con tacchino e melanzane", base: ["Farro"], protein: ["Petto di tacchino"], sides: [["Melanzane"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"] },
  { id: 'D48', kinds: DI, name: "Orzo con pollo e carote", base: ["Orzo"], protein: ["Petto di pollo"], sides: [["Carote"]], oil: true, aromas: ["Limone", "Rosmarino", "Pepe nero"] },
  { id: 'D49', kinds: DI, name: "Pasta con sgombro e pomodorini", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Sgombro"], sides: [["Pomodori"]], oil: true, aromas: ["Aglio", "Prezzemolo"] },
  { id: 'D50', kinds: DI, name: "Merluzzo con riso basmati e carote", base: ["Riso basmati", "Riso", "Riso integrale"], protein: ["Merluzzo"], sides: [["Carote"]], oil: true, aromas: ["Limone", "Prezzemolo", "Pepe nero"] },

  // ========================================= RISERVA (vegani: legumi accanto a un cereale)
  { id: 'R01', kinds: MAIN, name: "Riso con lenticchie e spinaci", base: ["Riso", "Riso basmati", "Riso integrale"], protein: ["Lenticchie"], sides: [["Spinaci"]], oil: true, aromas: ["Pepe nero"], portable: true, reserve: true },
  { id: 'R02', kinds: MAIN, name: "Pasta e ceci con zucchine", base: ["Pasta", "Pasta integrale", "Pasta di riso", "Pasta di mais"], protein: ["Ceci"], sides: [["Zucchine"]], oil: true, aromas: ["Rosmarino"], portable: true, reserve: true },
  { id: 'R03', kinds: MAIN, name: "Cous cous con ceci e peperoni", base: ["Cous cous"], protein: ["Ceci"], sides: [["Peperoni"]], oil: true, aromas: ["Paprika"], portable: true, reserve: true },
  { id: 'R04', kinds: MAIN, name: "Farro con fagioli e pomodori", base: ["Farro"], protein: ["Fagioli borlotti"], sides: [["Pomodori"]], oil: true, aromas: ["Basilico"], portable: true, reserve: true },
];

// Every food named in a dish must exist in the catalog (a typo fails loudly at load, not silently at plan time).
for (const d of DISHES) {
  for (const name of [...(d.base ?? []), ...d.protein, ...(d.proteinFallback ?? []), ...(d.sides ?? []).flat(), ...(d.spread ?? []), ...(d.fat ?? []), ...(d.fatIfPreferred ?? []), ...d.aromas, ...(d.accessories ?? []).flatMap((a) => a.foods)]) foodByName(name);
}
