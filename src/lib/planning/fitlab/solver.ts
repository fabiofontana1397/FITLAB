/**
 * Quantities of a meal, solved AFTER the dish and its foods are chosen (Fit Lab order:
 * structure → foods → quantities). Protein, carbohydrate and fat of the whole meal are
 * matched together by coordinate descent over the grams of the variable foods, inside
 * realistic portion limits (no 400 g of yogurt, no 6 eggs), then rounded to practical
 * units (whole eggs, whole bananas, 5 g steps) and polished.
 *
 * Grams are in the state of the catalog: dry pasta and rice, raw meat and fish, cooked legumes.
 */
import { UNITS, type Role } from './catalog';
import type { FitLabFood } from './foods';

export type Macros = { protein: number; carbs: number; fats: number };

export type PortionVar = {
  food: FitLabFood;
  role: Role;
  min: number;
  max: number;
  step: number;
  /** Smallest amount worth listing as an ingredient (a fat below it is left out). */
  minUse: number;
  grams: number;
};

type Range = [number, number];

const BY_NAME: Record<string, Range> = {
  // proteins
  "Albume d'uovo": [60, 250],
  'Yogurt greco 0%': [100, 300],
  'Yogurt greco 2%': [100, 300],
  Skyr: [100, 300],
  'Yogurt proteico': [100, 300],
  'Yogurt magro': [125, 300],
  Kefir: [150, 300],
  'Fiocchi di latte': [80, 250],
  'Ricotta magra': [60, 170],
  Mozzarella: [60, 125],
  'Mozzarella light': [60, 125],
  'Parmigiano Reggiano': [10, 40],
  'Latte vaccino': [150, 300],
  'Latte senza lattosio': [150, 300],
  'Bevanda di soia non zuccherata': [150, 300],
  'Bevanda di mandorla non zuccherata': [150, 300],
  'Bevanda di cocco non zuccherata': [150, 300],
  Tofu: [80, 220],
  Seitan: [80, 200],
  Edamame: [80, 200],
  'Tonno al naturale': [60, 160],
  Gamberi: [100, 250],
  Bresaola: [30, 70],
  'Fesa di tacchino affettata': [30, 100],
  'Prosciutto crudo': [30, 70],
  'Hamburger di pollo magro': [100, 200],
  'Hamburger di tacchino magro': [100, 200],
  'Hamburger di merluzzo': [100, 200],
  'Hamburger di salmone': [100, 200],
  Sardine: [80, 200],
  // carbohydrates (dry weights for pasta, rice and cereals)
  'Gnocchi di patate': [150, 350],
  Patate: [150, 400],
  'Patate dolci': [150, 400],
  Polenta: [40, 120],
  'Cous cous': [40, 120],
  'Crema di riso': [20, 70],
  "Fiocchi d'avena": [20, 100],
  'Avena istantanea': [20, 100],
  Muesli: [20, 80],
  'Granola con frutta secca': [20, 60],
  'Cereali integrali': [20, 80],
  'Cereali da colazione senza zuccheri aggiunti': [20, 70],
  'Crackers integrali': [20, 60],
  'Grano saraceno': [40, 120],
  Quinoa: [40, 120],
  // fats
  'Olio extravergine di oliva': [5, 15],
  Avocado: [30, 60],
  Olive: [20, 50],
  Pesto: [10, 40],
  'Cioccolato fondente': [10, 30],
  // fruit
  Uva: [75, 200],
  'Frutti di bosco': [50, 250],
  Mirtilli: [50, 200],
  Fragole: [100, 250],
  Anguria: [150, 400],
  Melone: [150, 300],
  Ananas: [100, 250],
  Mango: [100, 200],
  Cachi: [100, 250],
  Pompelmo: [150, 300],
};

/** Most units of a counted food in one meal. */
const MAX_UNITS: Record<string, number> = {
  'Uova intere': 3,
  'Budino proteico': 1,
  'Bevanda proteica': 1,
  'Barretta proteica': 2,
  'Gallette di riso': 6,
  'Gallette di mais': 6,
  'Gallette di farro': 6,
  'Fette biscottate integrali': 6,
  Albicocca: 4,
  Prugna: 3,
};
const MIN_UNITS: Record<string, number> = { 'Gallette di riso': 2, 'Gallette di mais': 2, 'Gallette di farro': 2, 'Fette biscottate integrali': 2, Albicocca: 2 };

function defaultRange(food: FitLabFood): Range {
  switch (food.category) {
    case 'Proteine':
      if (food.sub === 'Legumi') return [50, 300];
      if (food.sub === 'Preparazioni di carne' || food.sub === 'Preparazioni di pesce') return [100, 200];
      return [100, 280]; // meat and fish, raw
    case 'Carboidrati':
      if (food.sub === 'Pane e prodotti da forno') return [30, 160];
      if (food.sub === 'Pasta e derivati') return [40, 130];
      if (food.sub === 'Cereali') return [40, 130];
      return [20, 100];
    case 'Grassi':
      if (food.sub === 'Oli') return [5, 15];
      if (food.sub === 'Semi') return [5, 20];
      if (food.sub === 'Creme di frutta a guscio') return [10, 30];
      return [10, 40]; // nuts
    case 'Frutta':
      return [75, 300];
    default:
      return [20, 200];
  }
}

export function portionBounds(food: FitLabFood, role: Role, opts: { eggRoom?: number; cookingFat?: boolean; bigMeal?: boolean } = {}): { min: number; max: number; step: number; minUse: number } {
  const unit = UNITS[food.name];
  if (unit) {
    let maxUnits = food.name === 'Uova intere' ? Math.min(3, Math.floor((opts.eggRoom ?? 200) / 50)) : (MAX_UNITS[food.name] ?? 2);
    const minUnits = Math.min(MIN_UNITS[food.name] ?? 1, Math.max(maxUnits, 1));
    maxUnits = Math.max(maxUnits, minUnits);
    return { min: minUnits * unit.grams, max: maxUnits * unit.grams, step: unit.grams, minUse: unit.grams };
  }
  let [min, max] = BY_NAME[food.name] ?? defaultRange(food);
  if (food.name === 'Olio extravergine di oliva' && opts.bigMeal) max = 25; // two spoons for a very large meal
  const minUse = role === 'fat' ? Math.max(min, 5) : min;
  if (role === 'fat') min = opts.cookingFat && food.name === 'Olio extravergine di oliva' ? 5 : 0;
  const step = food.sub === 'Pane e prodotti da forno' || food.sub === 'Preparazioni di carne' || food.sub === 'Preparazioni di pesce' ? 10 : food.category === 'Frutta' ? 25 : 5;
  return { min, max, step, minUse: role === 'fat' ? minUse : step };
}

// Errors are weighed in kcal (protein ×4, carbs ×4, fat ×9), with protein counting a bit more.
const W = { protein: 26, carbs: 16, fats: 81 };

export function macrosOfGrams(food: FitLabFood, grams: number): Macros {
  const k = grams / 100;
  return { protein: food.p * k, carbs: food.c * k, fats: food.f * k };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return { protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fats: a.fats + b.fats };
}

export const ZERO: Macros = { protein: 0, carbs: 0, fats: 0 };
export const kcalOfMacros = (m: Macros) => m.protein * 4 + m.carbs * 4 + m.fats * 9;

function objective(total: Macros, target: Macros): number {
  const dp = total.protein - target.protein;
  const dc = total.carbs - target.carbs;
  const df = total.fats - target.fats;
  return W.protein * dp * dp + W.carbs * dc * dc + W.fats * df * df;
}

/**
 * Chooses the grams of `vars` so that fixed + variable foods land on `target`.
 * Mutates and returns `vars` (grams set, rounded). `error` is the root of the weighted
 * squared error: roughly "how many kcal off" the meal is.
 */
export function solvePortions(fixed: Macros, vars: PortionVar[], target: Macros): { vars: PortionVar[]; total: Macros; error: number } {
  const per = vars.map((v) => ({ p: v.food.p / 100, c: v.food.c / 100, f: v.food.f / 100 }));
  const g = vars.map((v) => (v.min + v.max) / 2);

  for (let iter = 0; iter < 80; iter++) {
    let moved = 0;
    for (let i = 0; i < vars.length; i++) {
      let rp = target.protein - fixed.protein;
      let rc = target.carbs - fixed.carbs;
      let rf = target.fats - fixed.fats;
      for (let j = 0; j < vars.length; j++) {
        if (j === i) continue;
        rp -= g[j] * per[j].p;
        rc -= g[j] * per[j].c;
        rf -= g[j] * per[j].f;
      }
      const num = W.protein * per[i].p * rp + W.carbs * per[i].c * rc + W.fats * per[i].f * rf;
      const den = W.protein * per[i].p ** 2 + W.carbs * per[i].c ** 2 + W.fats * per[i].f ** 2;
      const next = den > 0 ? Math.min(Math.max(num / den, vars[i].min), vars[i].max) : vars[i].min;
      moved = Math.max(moved, Math.abs(next - g[i]));
      g[i] = next;
    }
    if (moved < 0.05) break;
  }

  // practical units
  for (let i = 0; i < vars.length; i++) {
    const { step, min, max } = vars[i];
    g[i] = Math.min(Math.max(Math.round(g[i] / step) * step, min), max);
  }
  const totalOf = () => vars.reduce((acc, v, i) => addMacros(acc, macrosOfGrams(v.food, g[i])), fixed);

  // polish: try one step either way on each food while the error improves
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (let i = 0; i < vars.length; i++) {
      for (const dir of [-1, 1]) {
        const cand = g[i] + dir * vars[i].step;
        if (cand < vars[i].min || cand > vars[i].max) continue;
        const before = objective(totalOf(), target);
        const old = g[i];
        g[i] = cand;
        if (objective(totalOf(), target) < before - 1e-6) improved = true;
        else g[i] = old;
      }
    }
    if (!improved) break;
  }

  vars.forEach((v, i) => (v.grams = g[i]));
  const total = totalOf();
  return { vars, total, error: Math.sqrt(objective(total, target)) };
}
