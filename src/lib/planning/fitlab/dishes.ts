/**
 * The recipe layer of the Fit Lab framework. A dish says which foods may play which role, with the names used in the
 * catalog (data/fitlab workbook), so only pairings that make culinary sense can ever be built. Quantities are not here:
 * they are solved afterwards from the person's targets (fitlab/solver.ts).
 *
 * Roles (the workbook's columns):
 *  - base      primo / carbohydrate         - protein   secondo / protein source
 *  - sides     contorno (vegetables) or fruit; each inner list is one side to pick from
 *  - spread    jam or honey                 - fat       nuts, seeds, avocado, nut butters, pesto
 *  - oil       extra virgin olive oil as cooking / seasoning fat
 *  - sauce     tomato passata               - aromas    free flavourings (herbs, spices, lemon)
 * The FIRST food of every list is the dish as written in the workbook (PLxxx); the others are its allowed alternatives.
 * Dishes marked source 'extra' are additional Mediterranean dishes proposed by the agent.
 */
import type { SlotKind } from './catalog';
import { foodByName } from './foods';

export type Dish = {
  id: string;
  source: 'excel' | 'extra';
  kinds: SlotKind[];
  /** Name template: {base} {protein} {s1} {s2} {fat} {spread}. */
  name: string;
  base?: string[];
  protein: string[];
  /** A protein that complements the main one when the meal is short of protein (e.g. egg whites with a frittata). */
  extraProtein?: string[];
  sides?: string[][];
  spread?: string[];
  fat?: string[];
  oil?: boolean;
  sauce?: boolean;
  aromas: string[];
  portable?: boolean;
  /** Takes time to prepare (oven, long-cooking grains, ragù, soups…): kept for dinner, lunch needs quick dishes. */
  slow?: boolean;
  /** The fat is named in the dish (avocado toast, pesto): it is always in the meal, never rounded away. */
  fatRequired?: boolean;
};

type Spec = Omit<Dish, 'source' | 'kinds'> & { kinds: SlotKind[] };
const BF: SlotKind[] = ['breakfast'];
const SN: SlotKind[] = ['snack'];
const BFSN: SlotKind[] = ['breakfast', 'snack'];
const MAIN: SlotKind[] = ['lunch', 'dinner'];

const excel = (s: Spec): Dish => ({ source: 'excel', ...s });
const extra = (s: Spec): Dish => ({ source: 'extra', ...s });

const OATS = ["Fiocchi d'avena", 'Avena istantanea'];
const BERRIES = ['Frutti di bosco', 'Mirtilli', 'Fragole'];
const FRUIT_BF = ['Banana', 'Mela', 'Kiwi', 'Frutti di bosco', 'Arancia', 'Fragole', 'Pera', 'Pesca'];
const FRUIT_SN = ['Mela', 'Pera', 'Kiwi', 'Banana', 'Arancia', 'Frutti di bosco', 'Pesca', 'Uva'];
const PASTA = ['Pasta', 'Pasta integrale'];
const RICE = ['Riso', 'Riso integrale', 'Riso basmati'];
// legume dishes are low in protein per kcal: a complementary source is added when the meal falls short
const LEGUME_BOOST = ['Ricotta magra', 'Uova intere', 'Tofu', 'Parmigiano Reggiano', 'Mozzarella light'];
const FISH_WHITE = ['Merluzzo', 'Orata', 'Trota'];

export const DISHES: Dish[] = [
  // =============================================================== COLAZIONE
  excel({ id: 'PL001', kinds: BF, name: "Porridge d'avena, {protein} e {s1}", base: OATS, protein: ['Yogurt greco 0%', 'Skyr', 'Yogurt greco 2%'], sides: [[...BERRIES, 'Banana', 'Mela']], fat: ['Noci', 'Mandorle'], aromas: ['Cannella'] }),
  excel({ id: 'PL002', kinds: BF, name: 'Porridge di crema di riso, {protein} e {s1}', base: ['Crema di riso'], protein: ['Latte senza lattosio', 'Latte vaccino', 'Bevanda di soia non zuccherata'], extraProtein: ['Yogurt greco 0%', 'Skyr', "Albume d'uovo"], sides: [['Banana', 'Mela', 'Pera']], fat: ['Burro di arachidi 100%', 'Burro di mandorle 100%', 'Nocciole'], aromas: ['Cannella'] }),
  excel({ id: 'PL003', kinds: BF, name: "Porridge d'avena e albumi con {s1}", base: OATS, protein: ["Albume d'uovo"], sides: [['Fragole', 'Mirtilli', 'Banana', 'Mela']], fat: ['Burro di arachidi 100%', 'Mandorle'], aromas: ['Cannella'] }),
  excel({ id: 'PL004', kinds: BFSN, name: 'Bowl di {protein}, {base} e {s1}', base: ['Muesli', 'Cereali integrali', 'Granola con frutta secca'], protein: ['Yogurt greco 2%', 'Yogurt greco 0%', 'Skyr'], sides: [['Kiwi', 'Mela', 'Frutti di bosco']], fat: ['Semi di chia', 'Noci', 'Mandorle'], aromas: [] }),
  excel({ id: 'PL005', kinds: BF, name: 'Toast con {protein} e marmellata', base: ['Pane integrale', 'Pane di segale'], protein: ['Ricotta magra', 'Fiocchi di latte'], spread: ['Marmellata light'], sides: [['Kiwi', 'Pesca', 'Pera']], aromas: [] }),
  excel({ id: 'PL006', kinds: BF, name: 'Avocado toast con {protein}', base: ['Pane integrale', 'Pane di segale'], protein: ['Uova intere'], extraProtein: ["Albume d'uovo"], fat: ['Avocado'], aromas: ['Pepe nero', 'Basilico'] }),
  excel({ id: 'PL007', kinds: BF, name: "Pancake d'avena con {s1}", base: ["Fiocchi d'avena"], protein: ['Uova intere', "Albume d'uovo"], extraProtein: ['Yogurt greco 0%', 'Skyr'], sides: [['Banana', 'Mela', 'Frutti di bosco']], aromas: ['Cannella'] }),
  excel({ id: 'PL008', kinds: BF, name: '{base} con {protein} e marmellata', base: ['Pane di segale', 'Pane integrale'], protein: ['Fiocchi di latte', 'Ricotta magra'], spread: ['Marmellata light'], sides: [['Pesca', 'Mela', 'Pera']], aromas: [] }),
  excel({ id: 'PL009', kinds: BFSN, name: 'Fette biscottate con {protein} e marmellata', base: ['Fette biscottate integrali'], protein: ['Yogurt greco 0%', 'Skyr', 'Yogurt proteico'], spread: ['Marmellata light', 'Miele'], aromas: [] }),
  excel({ id: 'PL010', kinds: BF, name: 'Kefir con avena e {s1}', base: ["Fiocchi d'avena"], protein: ['Kefir', 'Yogurt magro', 'Yogurt greco 0%'], extraProtein: ['Skyr', 'Yogurt proteico', 'Fiocchi di latte'], sides: [['Mela', 'Pera', 'Banana']], fat: ['Nocciole', 'Mandorle', 'Noci'], aromas: ['Cannella'] }),
  excel({ id: 'PL011', kinds: BF, name: 'Toast con {protein} e {s1}', base: ['Pane integrale', 'Pane di segale'], protein: ['Fesa di tacchino affettata', 'Mozzarella light', 'Mozzarella'], sides: [['Mela', 'Pera', 'Kiwi']], aromas: ['Origano', 'Pepe nero'] }),
  extra({ id: 'X101', kinds: BF, name: '{protein} con {base} e {s1}', base: ['Cereali integrali', 'Cereali da colazione senza zuccheri aggiunti', 'Muesli'], protein: ['Latte vaccino', 'Latte senza lattosio', 'Bevanda di soia non zuccherata'], extraProtein: ['Yogurt greco 0%', 'Skyr', 'Yogurt proteico'], sides: [['Banana', 'Mela', 'Pera', 'Frutti di bosco']], fat: ['Mandorle', 'Noci'], aromas: [] }),
  extra({ id: 'X102', kinds: BFSN, name: '{base} con {protein} e {s1}', base: ['Gallette di riso', 'Gallette di farro', 'Gallette di mais'], protein: ['Ricotta magra', 'Fiocchi di latte', 'Yogurt greco 0%'], sides: [FRUIT_BF], fat: ['Burro di mandorle 100%', 'Burro di arachidi 100%', 'Nocciole'], aromas: [] }),
  extra({ id: 'X103', kinds: BF, name: 'Uova strapazzate con {base} e {s1}', base: ['Pane integrale', 'Pane di segale'], protein: ['Uova intere'], extraProtein: ["Albume d'uovo"], sides: [['Arancia', 'Kiwi', 'Mela']], aromas: ['Pepe nero', 'Prezzemolo'] }),
  extra({ id: 'X104', kinds: BF, name: 'Overnight oats con {protein} e {s1}', base: OATS, protein: ['Skyr', 'Yogurt greco 0%', 'Yogurt proteico'], sides: [FRUIT_BF], fat: ['Semi di chia', 'Semi di lino', 'Mandorle'], aromas: ['Cannella'] }),
  extra({ id: 'X105', kinds: BF, name: 'Crema di riso con {protein} e {s1}', base: ['Crema di riso'], protein: ['Yogurt greco 0%', 'Skyr', 'Yogurt proteico'], sides: [['Banana', 'Mela', 'Frutti di bosco']], fat: ['Burro di mandorle 100%', 'Nocciole', 'Noci'], aromas: ['Cannella'] }),
  extra({ id: 'X106', kinds: BF, name: "Porridge d'avena con {protein} e {s1}", base: OATS, protein: ['Bevanda di soia non zuccherata', 'Bevanda di mandorla non zuccherata'], extraProtein: ['Tofu', 'Bevanda proteica'], sides: [FRUIT_BF], fat: ['Burro di arachidi 100%', 'Semi di chia', 'Noci'], aromas: ['Cannella'] }),

  // ================================================================ SPUNTINO
  excel({ id: 'PL012', kinds: SN, name: '{protein} con {s1} e {fat}', protein: ['Yogurt greco 0%', 'Skyr', 'Yogurt greco 2%'], sides: [FRUIT_SN], fat: ['Mandorle', 'Noci', 'Pistacchi'], aromas: [] }),
  excel({ id: 'PL013', kinds: SN, name: '{protein} con {s1} e {fat}', protein: ['Skyr', 'Yogurt greco 0%'], sides: [['Banana', 'Mela', 'Pera']], fat: ['Semi di chia', 'Semi di lino'], aromas: [] }),
  excel({ id: 'PL014', kinds: SN, name: '{base} con {protein}', base: ['Pane integrale', 'Pane di segale'], protein: ['Ricotta magra', 'Fiocchi di latte'], aromas: ['Origano', 'Pepe nero'] }),
  excel({ id: 'PL015', kinds: SN, name: '{protein} con pane e rucola', base: ['Pane integrale', 'Pane di segale'], protein: ['Bresaola', 'Fesa di tacchino affettata', 'Prosciutto crudo'], sides: [['Rucola']], aromas: ['Limone', 'Pepe nero'] }),
  excel({ id: 'PL018', kinds: SN, name: 'Hummus di ceci con {s1} e crackers', base: ['Crackers integrali'], protein: ['Ceci'], sides: [['Carote', 'Cetrioli', 'Sedano', 'Finocchi']], oil: true, aromas: ['Limone', 'Aglio', 'Paprika'], portable: true }),
  excel({ id: 'PL019', kinds: SN, name: 'Frutta fresca e frutta secca', protein: [], sides: [FRUIT_SN], fat: ['Noci', 'Mandorle', 'Pistacchi', 'Nocciole'], aromas: [], portable: true }),
  excel({ id: 'PL020', kinds: SN, name: '{protein} con {s1} e {fat}', protein: ['Kefir', 'Yogurt magro', 'Yogurt greco 0%'], sides: [BERRIES], fat: ['Semi di lino', 'Semi di chia'], aromas: [] }),
  excel({ id: 'PL021', kinds: SN, name: 'Toast con avocado e {protein}', base: ['Pane integrale'], protein: ['Uova intere', 'Tofu'], fat: ['Avocado'], aromas: ['Pepe nero', 'Limone'], portable: true }),
  excel({ id: 'PL022', kinds: SN, name: '{protein} con {s1} e {fat}', protein: ['Budino proteico', 'Yogurt proteico'], sides: [['Kiwi', 'Mela', 'Fragole']], fat: ['Mandorle'], aromas: [] }),
  extra({ id: 'X201', kinds: SN, name: '{s1} e scaglie di {protein}', protein: ['Parmigiano Reggiano'], sides: [['Pera', 'Mela']], fat: ['Noci'], aromas: [], portable: true }),
  extra({ id: 'X202', kinds: SN, name: '{protein} con noci e miele', protein: ['Yogurt greco 0%', 'Skyr'], spread: ['Miele'], fat: ['Noci', 'Mandorle'], aromas: ['Cannella'] }),
  extra({ id: 'X203', kinds: SN, name: 'Edamame e {base}', base: ['Gallette di riso', 'Gallette di mais', 'Gallette di farro'], protein: ['Edamame'], fat: ['Semi di sesamo'], aromas: ['Limone'], portable: true }),
  extra({ id: 'X204', kinds: SN, name: 'Crackers con {protein} e {s1}', base: ['Crackers integrali'], protein: ['Tonno al naturale'], sides: [['Pomodori', 'Cetrioli']], oil: true, aromas: ['Limone', 'Pepe nero'], portable: true }),
  extra({ id: 'X205', kinds: SN, name: 'Pane integrale con {protein} e avocado', base: ['Pane integrale', 'Pane di segale'], protein: ['Fesa di tacchino affettata', 'Bresaola', 'Prosciutto crudo'], fat: ['Avocado'], aromas: ['Limone', 'Pepe nero'] }),
  extra({ id: 'X206', kinds: SN, name: '{protein} e {s1}', protein: ['Barretta proteica'], sides: [['Mela', 'Banana', 'Arancia', 'Pera']], aromas: [], portable: true }),
  extra({ id: 'X207', kinds: SN, name: '{protein} con {s1} e {fat}', protein: ['Bevanda proteica'], sides: [['Banana', 'Mela', 'Pera']], fat: ['Mandorle', 'Nocciole'], aromas: [], portable: true }),
  extra({ id: 'X208', kinds: SN, name: 'Bruschetta con {protein} e pomodori', base: ['Pane integrale', 'Gallette di farro'], protein: ['Mozzarella light', 'Mozzarella'], sides: [['Pomodori']], oil: true, aromas: ['Basilico', 'Origano'] }),

  // ======================================================= PRANZO E CENA
  excel({ id: 'PL023', kinds: MAIN, name: '{base} al pomodoro, {protein} e {s1}', base: ['Pasta integrale', 'Pasta'], protein: ['Petto di pollo', 'Petto di tacchino'], sides: [['Zucchine']], oil: true, sauce: true, aromas: ['Basilico', 'Aglio'] }),
  excel({ id: 'PL024', kinds: MAIN, name: '{base} con {protein} e {s1}', base: ['Riso integrale', 'Riso basmati'], protein: ['Salmone', 'Trota'], sides: [['Broccoli']], oil: true, aromas: ['Limone', 'Prezzemolo', 'Pepe nero'] }),
  excel({ id: 'PL025', kinds: MAIN, name: '{base} con {protein}, {s1} e {s2}', base: ['Farro', 'Cous cous'], protein: ['Petto di tacchino', 'Petto di pollo'], sides: [['Melanzane', 'Zucchine'], ['Pomodori']], oil: true, aromas: ['Origano', 'Basilico'] }),
  excel({ id: 'PL026', kinds: MAIN, name: '{base} con {protein}, {s2} e {s1}', base: PASTA, protein: ['Merluzzo', 'Orata'], sides: [['Spinaci', 'Bietole'], ['Pomodori']], oil: true, aromas: ['Aglio', 'Prezzemolo', 'Limone'] }),
  excel({ id: 'PL027', kinds: MAIN, name: '{base} con {protein} e verdure mediterranee', base: ['Riso basmati', 'Quinoa'], protein: ['Ceci'], extraProtein: LEGUME_BOOST, sides: [['Peperoni'], ['Zucchine']], oil: true, aromas: ['Curcuma', 'Paprika', 'Limone'], portable: true }),
  excel({ id: 'PL028', kinds: MAIN, name: '{base} al forno con {protein} e {s1}', base: ['Patate'], protein: ['Orata', 'Merluzzo', 'Trota'], sides: [['Fagiolini']], oil: true, aromas: ['Rosmarino', 'Limone', 'Prezzemolo'] }),
  excel({ id: 'PL029', kinds: MAIN, name: '{base} e {protein} con contorno di {s1}', base: PASTA, protein: ['Lenticchie', 'Ceci'], extraProtein: LEGUME_BOOST, sides: [['Finocchi']], oil: true, sauce: true, aromas: ['Rosmarino', 'Aglio'] }),
  excel({ id: 'PL030', kinds: MAIN, name: '{base} con {protein} e {s1}', base: ['Polenta'], protein: ['Manzo magro', 'Lonza di maiale magra'], sides: [['Cavolo nero']], oil: true, aromas: ['Rosmarino', 'Pepe nero', 'Aglio'] }),
  excel({ id: 'PL031', kinds: MAIN, name: '{base} con {protein} e {s1}', base: ['Cous cous', 'Riso'], protein: ['Gamberi', 'Merluzzo'], sides: [['Zucchine']], oil: true, aromas: ['Limone', 'Prezzemolo', 'Aglio'] }),
  excel({ id: 'PL032', kinds: MAIN, name: '{base} al ragù leggero con contorno di {s1}', base: PASTA, protein: ['Manzo magro'], sides: [['Lattuga', 'Rucola'], ['Pomodori']], oil: true, sauce: true, aromas: ['Carote', 'Basilico'] }),
  excel({ id: 'PL033', kinds: MAIN, name: '{base} con {protein}, {s1} e {s2}', base: ['Quinoa', 'Riso integrale'], protein: ['Tofu', 'Seitan'], sides: [['Broccoli'], ['Peperoni']], oil: true, aromas: ['Limone', 'Zenzero', 'Salsa di soia'], portable: true }),
  excel({ id: 'PL034', kinds: MAIN, name: '{base} con {protein} e {s1}', base: ['Riso venere', 'Riso integrale'], protein: ['Tonno al naturale', 'Sgombro'], sides: [['Zucchine']], oil: true, aromas: ['Limone', 'Basilico', 'Pepe nero'], portable: true }),
  excel({ id: 'PL035', kinds: MAIN, name: '{base} con {protein} e {s1}, {s2} di contorno', base: PASTA, protein: ['Ricotta magra', 'Tofu'], sides: [['Spinaci'], ['Carciofi']], oil: true, aromas: ['Pepe nero'] }),
  excel({ id: 'PL036', kinds: MAIN, name: '{base} con {protein} e insalata', base: ['Patate dolci', 'Patate'], protein: ['Hamburger di pollo magro', 'Hamburger di tacchino magro'], sides: [['Lattuga', 'Rucola'], ['Pomodori']], oil: true, aromas: ['Rosmarino', 'Paprika', 'Limone'] }),
  excel({ id: 'PL037', kinds: MAIN, name: '{base} con {protein} e {s1}', base: ['Orzo', 'Farro'], protein: ['Fagioli borlotti', 'Fagioli cannellini'], extraProtein: LEGUME_BOOST, sides: [['Zucchine']], oil: true, aromas: ['Aglio', 'Rosmarino', 'Peperoncino'], portable: true }),
  excel({ id: 'PL038', kinds: MAIN, name: '{protein} al forno con {base} e {s1}', base: ['Riso basmati', 'Riso integrale'], protein: ['Salmone', 'Trota'], sides: [['Asparagi']], oil: true, aromas: ['Limone', 'Timo', 'Pepe nero'] }),
  excel({ id: 'PL039', kinds: MAIN, name: '{base} al pomodoro con {protein} e {s1}', base: ['Gnocchi di patate'], protein: ['Mozzarella', 'Mozzarella light'], sides: [['Melanzane', 'Zucchine']], oil: true, sauce: true, aromas: ['Basilico', 'Origano'] }),
  excel({ id: 'PL040', kinds: MAIN, name: '{protein} in umido con {base} e {s1}', base: ['Pane integrale'], protein: ['Lenticchie', 'Fagioli', 'Fagioli cannellini'], extraProtein: LEGUME_BOOST, sides: [['Cavolfiore']], oil: true, sauce: true, aromas: ['Rosmarino', 'Aglio'] }),
  excel({ id: 'PL041', kinds: MAIN, name: '{base} con {protein} e {s1}', base: ['Riso rosso', 'Riso integrale'], protein: ['Petto di tacchino', 'Petto di pollo'], sides: [['Carote'], ['Finocchi']], oil: true, aromas: ['Limone', 'Timo', 'Pepe nero'] }),
  excel({ id: 'PL042', kinds: MAIN, name: '{base} con {protein}, {s1} e {s2}', base: ['Quinoa', 'Farro'], protein: ['Ceci'], extraProtein: LEGUME_BOOST, sides: [['Zucca'], ['Spinaci']], oil: true, aromas: ['Rosmarino', 'Paprika', 'Limone'], portable: true }),
  excel({ id: 'PL043', kinds: MAIN, name: '{protein} con {base} e {s1}', base: ['Patate'], protein: ['Lonza di maiale magra', 'Petto di tacchino'], sides: [['Cavolini di Bruxelles']], oil: true, aromas: ['Rosmarino', 'Aglio', 'Pepe nero'] }),
  excel({ id: 'PL044', kinds: MAIN, name: '{base} al pomodoro con {protein} e {s1}', base: ['Pasta di legumi'], protein: ['Ricotta magra', 'Tofu'], sides: [['Zucchine']], oil: true, sauce: true, aromas: ['Basilico', 'Pepe nero'] }),
  excel({ id: 'PL045', kinds: MAIN, name: '{protein} al forno con {base} e {s1}', base: ['Cous cous'], protein: ['Merluzzo', 'Orata'], sides: [['Peperoni']], oil: true, aromas: ['Limone', 'Prezzemolo', 'Paprika'] }),
  excel({ id: 'PL046', kinds: MAIN, name: '{base} con {protein} e {s1}', base: ['Farro', 'Orzo'], protein: ['Fagioli cannellini', 'Fagioli borlotti'], extraProtein: LEGUME_BOOST, sides: [['Carciofi']], oil: true, aromas: ['Aglio', 'Prezzemolo', 'Limone'], portable: true }),
  excel({ id: 'PL047', kinds: MAIN, name: 'Frittata con {base} e contorno di {s1}', base: ['Pane integrale'], protein: ['Uova intere'], extraProtein: ["Albume d'uovo"], sides: [['Spinaci', 'Bietole']], oil: true, aromas: ['Pepe nero', 'Basilico'] }),
  excel({ id: 'PL048', kinds: MAIN, name: '{base} con {protein}, {s1} e contorno di {s2}', base: PASTA, protein: ['Tonno al naturale', 'Sgombro'], sides: [['Pomodori'], ['Lattuga']], oil: true, aromas: ['Aglio', 'Basilico', 'Peperoncino'], portable: true }),
  excel({ id: 'PL049', kinds: MAIN, name: '{protein} con {base}, {s1} e {s2}', base: ['Riso basmati', 'Quinoa'], protein: ['Tofu', 'Seitan'], sides: [['Cavolo cappuccio'], ['Carote']], oil: true, aromas: ['Zenzero', 'Salsa di soia'] }),

  extra({ id: 'X301', kinds: MAIN, name: 'Risotto con {s1} e {protein}', base: ['Riso', 'Riso lungo B'], protein: ['Gamberi'], sides: [['Zucca']], oil: true, aromas: ['Prezzemolo', 'Pepe nero'] }),
  extra({ id: 'X302', kinds: MAIN, name: 'Risotto ai {s1} con {protein}', base: RICE, protein: ['Petto di pollo', 'Petto di tacchino'], sides: [['Funghi']], oil: true, aromas: ['Prezzemolo', 'Aglio'] }),
  extra({ id: 'X303', kinds: MAIN, name: '{base} al pesto con {protein} e {s1}', base: PASTA, protein: ['Petto di pollo', 'Petto di tacchino'], sides: [['Fagiolini', 'Pomodori']], fat: ['Pesto'], aromas: ['Pepe nero'] }),
  extra({ id: 'X304', kinds: MAIN, name: '{base} alla Norma leggera con {protein}', base: PASTA, protein: ['Ricotta magra'], sides: [['Melanzane']], oil: true, sauce: true, aromas: ['Basilico', 'Pepe nero'] }),
  extra({ id: 'X305', kinds: MAIN, name: 'Insalata di {base} con {protein}, {s1} e {s2}', base: RICE, protein: ['Tonno al naturale', 'Sgombro', 'Uova intere'], sides: [['Pomodori', 'Peperoni'], ['Carote', 'Cetrioli']], oil: true, aromas: ['Basilico', 'Limone'], portable: true }),
  extra({ id: 'X306', kinds: MAIN, name: 'Insalata di {base} con {protein} e verdure', base: ['Farro', 'Orzo'], protein: ['Ceci', 'Fagioli cannellini'], extraProtein: LEGUME_BOOST, sides: [['Pomodori', 'Cetrioli'], ['Rucola', 'Lattuga']], oil: true, aromas: ['Limone', 'Prezzemolo'], portable: true }),
  extra({ id: 'X307', kinds: MAIN, name: 'Insalata di {base} con {protein}, {s1} e {s2}', base: PASTA, protein: ['Mozzarella light', 'Tonno al naturale', 'Uova intere'], sides: [['Pomodori'], ['Rucola', 'Lattuga']], oil: true, aromas: ['Basilico', 'Origano'], portable: true }),
  extra({ id: 'X308', kinds: MAIN, name: '{protein} al limone con {base} al forno e {s1}', base: ['Patate'], protein: ['Petto di pollo', 'Petto di tacchino'], sides: [['Fagiolini', 'Broccoli', 'Carote']], oil: true, aromas: ['Limone', 'Rosmarino'] }),
  extra({ id: 'X309', kinds: MAIN, name: 'Spezzatino di {protein} con {base} e {s1}', base: ['Polenta'], protein: ['Manzo magro', 'Lonza di maiale magra'], sides: [['Carote', 'Sedano']], oil: true, sauce: true, aromas: ['Rosmarino', 'Salvia'] }),
  extra({ id: 'X310', kinds: MAIN, name: '{protein} alla livornese con {base}', base: ['Patate'], protein: FISH_WHITE, sides: [['Pomodori']], oil: true, aromas: ['Prezzemolo', 'Aglio', 'Peperoncino'] }),
  extra({ id: 'X311', kinds: MAIN, name: 'Zuppa di {protein} e {base}', base: ['Farro', 'Orzo'], protein: ['Ceci', 'Fagioli borlotti', 'Lenticchie'], extraProtein: LEGUME_BOOST, sides: [['Carote', 'Sedano']], oil: true, aromas: ['Rosmarino', 'Aglio'] }),
  extra({ id: 'X312', kinds: MAIN, name: 'Minestrone con {base} e {protein}', base: ['Orzo', 'Farro'], protein: ['Fagioli borlotti', 'Fagioli cannellini'], extraProtein: LEGUME_BOOST, sides: [['Zucchine', 'Cavolo cappuccio'], ['Carote', 'Sedano']], oil: true, aromas: ['Prezzemolo', 'Pepe nero'] }),
  extra({ id: 'X313', kinds: MAIN, name: '{protein} con {base} e {s1}', base: ['Cous cous'], protein: ['Salmone', 'Trota'], sides: [['Zucchine']], oil: true, aromas: ['Limone', 'Prezzemolo'] }),
  extra({ id: 'X314', kinds: MAIN, name: '{protein} alla pizzaiola con {base}', base: RICE, protein: ['Petto di tacchino', 'Petto di pollo'], sides: [['Pomodori']], oil: true, sauce: true, aromas: ['Origano', 'Aglio'] }),
  extra({ id: 'X315', kinds: MAIN, name: '{protein} al pomodoro con {base} e {s1}', base: ['Pane integrale', 'Patate', 'Polenta'], protein: ['Hamburger di tacchino magro', 'Hamburger di pollo magro'], sides: [['Spinaci', 'Bietole', 'Broccoli']], oil: true, sauce: true, aromas: ['Basilico', 'Prezzemolo'] }),
  extra({ id: 'X316', kinds: MAIN, name: '{base} e {protein} con {s1}', base: ['Pasta', 'Pasta integrale', 'Orzo'], protein: ['Fagioli borlotti', 'Fagioli cannellini', 'Fagioli'], extraProtein: LEGUME_BOOST, sides: [['Sedano', 'Carote']], oil: true, sauce: true, aromas: ['Rosmarino', 'Aglio'] }),
  extra({ id: 'X317', kinds: MAIN, name: '{base} con {protein} e {s1}', base: PASTA, protein: ['Sardine'], sides: [['Finocchi']], oil: true, aromas: ['Limone', 'Prezzemolo', 'Peperoncino'] }),
  extra({ id: 'X318', kinds: MAIN, name: '{base} con {protein}, {s1} e {s2}', base: ['Cous cous'], protein: ['Petto di pollo', 'Petto di tacchino'], sides: [['Zucchine', 'Carote'], ['Peperoni', 'Pomodori']], oil: true, aromas: ['Curcuma', 'Limone', 'Zenzero'] }),
  extra({ id: 'X319', kinds: MAIN, name: '{protein} con {base} e {s1}', base: ['Patate', 'Patate dolci'], protein: ['Hamburger di merluzzo', 'Hamburger di salmone'], sides: [['Lattuga', 'Rucola'], ['Pomodori']], oil: true, aromas: ['Limone', 'Prezzemolo'] }),
  extra({ id: 'X320', kinds: MAIN, name: 'Frittata con {base} e {s1}', base: ['Patate'], protein: ['Uova intere'], extraProtein: ["Albume d'uovo"], sides: [['Zucchine', 'Peperoni', 'Funghi']], oil: true, aromas: ['Pepe nero', 'Prezzemolo'] }),
  extra({ id: 'X321', kinds: MAIN, name: '{base} con {protein} e {s1}', base: PASTA, protein: ['Gamberi'], sides: [['Zucchine', 'Pomodori']], oil: true, aromas: ['Aglio', 'Prezzemolo', 'Limone'] }),
  extra({ id: 'X322', kinds: MAIN, name: '{base} con {protein} e verdure grigliate', base: ['Quinoa', 'Riso integrale'], protein: ['Petto di pollo', 'Petto di tacchino', 'Tofu'], sides: [['Zucchine', 'Melanzane', 'Peperoni']], oil: true, aromas: ['Origano', 'Limone'] }),
  extra({ id: 'X323', kinds: MAIN, name: 'Bowl di {base} con {protein}, {s1} e {s2}', base: ['Grano saraceno', 'Riso integrale'], protein: ['Tonno al naturale', 'Salmone', 'Tofu'], sides: [['Cetrioli', 'Carote'], ['Rucola', 'Lattuga']], oil: true, aromas: ['Limone', 'Salsa di soia'], portable: true }),
  extra({ id: 'X324', kinds: MAIN, name: '{protein} con {base} e verdure al forno', base: ['Patate'], protein: ['Seitan', 'Tofu'], sides: [['Peperoni', 'Zucchine', 'Funghi']], oil: true, aromas: ['Rosmarino', 'Paprika'] }),
  extra({ id: 'X325', kinds: MAIN, name: 'Straccetti di {protein} con rucola e {base}', base: ['Patate'], protein: ['Manzo magro'], sides: [['Rucola', 'Radicchio'], ['Pomodori']], oil: true, aromas: ['Rosmarino', 'Limone'] }),
  extra({ id: 'X326', kinds: MAIN, name: '{protein} con {base} e {s1}', base: ['Riso integrale', 'Riso basmati'], protein: ['Edamame', 'Tofu'], sides: [['Carote', 'Broccoli'], ['Cavolo cappuccio']], oil: true, aromas: ['Salsa di soia', 'Zenzero'] }),
  extra({ id: 'X327', kinds: MAIN, name: '{protein} con {base} e {s1}', base: ['Polenta', 'Patate'], protein: ['Lonza di maiale magra', 'Petto di tacchino'], sides: [['Cavolo nero', 'Bietole', 'Cavolo cappuccio']], oil: true, aromas: ['Salvia', 'Rosmarino'] }),
  extra({ id: 'X328', kinds: MAIN, name: '{base} con {protein} e {s1}', base: ['Farro', 'Orzo', 'Cous cous'], protein: ['Salmone', 'Sgombro', 'Tonno al naturale'], sides: [['Zucchine', 'Pomodori', 'Cetrioli']], oil: true, aromas: ['Limone', 'Basilico'], portable: true }),
];

// Dishes that need real preparation time: oven, polenta, ragù, stews and soups, risotto, black/red rice, farro and barley, roasting.
const SLOW = new Set([
  'PL025', 'PL028', 'PL029', 'PL030', 'PL032', 'PL034', 'PL036', 'PL037', 'PL038', 'PL040', 'PL041', 'PL042', 'PL043', 'PL045', 'PL046',
  'X301', 'X302', 'X308', 'X309', 'X310', 'X311', 'X312', 'X314', 'X315', 'X316', 'X319', 'X320', 'X324', 'X325', 'X327',
]);
for (const d of DISHES) d.slow = SLOW.has(d.id);
const FAT_REQUIRED = new Set(['PL006', 'PL021', 'X205', 'X303']);
for (const d of DISHES) d.fatRequired = FAT_REQUIRED.has(d.id);

// Every food named in a dish must exist in the catalog (a typo fails loudly at load, not silently at plan time).
for (const d of DISHES) {
  for (const name of [...(d.base ?? []), ...d.protein, ...(d.extraProtein ?? []), ...(d.sides ?? []).flat(), ...(d.spread ?? []), ...(d.fat ?? []), ...d.aromas]) foodByName(name);
}
