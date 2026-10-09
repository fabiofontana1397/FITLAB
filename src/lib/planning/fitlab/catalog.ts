/**
 * Shared vocabulary of the Fit Lab diet engine: the meal kinds, the roles a food plays in a meal, and how
 * a food is called inside a dish name. The foods themselves live in foods.ts (generated from the workbook).
 */
import type { MealSlot } from '@/store/nutrition-store';

export type SlotKind = 'breakfast' | 'snack' | 'lunch' | 'dinner';
export type Role = 'protein' | 'carb' | 'fat' | 'veg' | 'fruit';

export const SLOT_KIND: Record<MealSlot, SlotKind> = {
  colazione: 'breakfast',
  spuntinoMattina: 'snack',
  pranzo: 'lunch',
  spuntinoPomeriggio: 'snack',
  cena: 'dinner',
  spuntinoSera: 'snack',
};

/** How a catalog food is named inside a dish ("Petto di pollo" → "pollo"). Anything not listed: the name in lower case. */
const SHORT: Record<string, string> = {
  'Petto di pollo': 'pollo',
  'Petto di tacchino': 'tacchino',
  'Lonza di maiale magra': 'lonza di maiale',
  'Cavolini di Bruxelles': 'cavolini di Bruxelles',
  'Ricotta magra': 'ricotta',
  'Parmigiano Reggiano': 'parmigiano',
  'Latte vaccino': 'latte',
  'Yogurt greco 0%': 'yogurt greco',
  'Yogurt greco 2%': 'yogurt greco',
  'Tonno al naturale': 'tonno',
  'Hamburger di pollo magro': 'hamburger di pollo',
  'Hamburger di tacchino magro': 'hamburger di tacchino',
  'Fesa di tacchino affettata': 'fesa di tacchino',
  "Albume d'uovo": 'albumi',
  'Uova intere': 'uova',
  "Fiocchi d'avena": 'avena',
  'Avena istantanea': 'avena',
  'Riso lungo B': 'riso',
  'Cereali da colazione senza zuccheri aggiunti': 'cereali',
  'Granola con frutta secca': 'granola',
  'Pan bauletto': 'pane in cassetta',
  'Gnocchi di patate': 'gnocchi',
  'Fette biscottate integrali': 'fette biscottate',
  'Olio extravergine di oliva': 'olio EVO',
  'Bevanda di soia non zuccherata': 'bevanda di soia',
  'Bevanda di mandorla non zuccherata': 'bevanda di mandorla',
  'Bevanda di cocco non zuccherata': 'bevanda di cocco',
};

export function short(name: string): string {
  return SHORT[name] ?? name.replace(/ 100%$/, '').toLowerCase();
}

/** Foods weighed as whole pieces or packs: grams of one unit and the words used to count them. */
export const UNITS: Record<string, { grams: number; one: string; many: string }> = {
  'Uova intere': { grams: 50, one: 'uovo', many: 'uova' },
  Banana: { grams: 120, one: 'banana', many: 'banane' },
  Mela: { grams: 150, one: 'mela', many: 'mele' },
  Arancia: { grams: 150, one: 'arancia', many: 'arance' },
  Pera: { grams: 150, one: 'pera', many: 'pere' },
  Pesca: { grams: 150, one: 'pesca', many: 'pesche' },
  Kiwi: { grams: 75, one: 'kiwi', many: 'kiwi' },
  Albicocca: { grams: 40, one: 'albicocca', many: 'albicocche' },
  Prugna: { grams: 60, one: 'prugna', many: 'prugne' },
  'Barretta proteica': { grams: 45, one: 'barretta', many: 'barrette' },
  'Budino proteico': { grams: 150, one: 'vasetto', many: 'vasetti' },
  'Bevanda proteica': { grams: 330, one: 'bottiglietta', many: 'bottigliette' },
  'Gallette di riso': { grams: 9, one: 'galletta', many: 'gallette' },
  'Gallette di mais': { grams: 10, one: 'galletta', many: 'gallette' },
  'Gallette di farro': { grams: 10, one: 'galletta', many: 'gallette' },
  'Fette biscottate integrali': { grams: 9, one: 'fetta', many: 'fette' },
};
