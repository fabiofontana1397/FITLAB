/**
 * Exports an Excel workbook with the diets the engine builds for the 20 simulated questionnaires:
 * which dishes and foods it puts together (no grams, calories or macros), plus the Fit Lab food catalog
 * the engine starts from. Run with:  npm run agents:excel
 *
 * The plans come from the same function the app uses (domain/plan-engine.ts buildPlans), so what is in
 * the file is what a person with those answers would get.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import ExcelJS from 'exceljs';

import { buildPlans } from '@/domain/plan-engine';
import { buildUserContext } from '@/domain/user-context';
import { findFood } from '@/lib/mock/food-database';
import { DISHES } from '@/lib/planning/fitlab/dishes';
import { findQuestion } from '@/lib/questionnaire/schema';

import { PERSONAS } from './personas';

const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const SLOT_LABEL: Record<string, string> = {
  colazione: 'Colazione',
  spuntinoMattina: 'Spuntino mattina',
  pranzo: 'Pranzo',
  spuntinoPomeriggio: 'Spuntino pomeriggio',
  cena: 'Cena',
  spuntinoSera: 'Spuntino pre-nanna',
};
const SLOT_ORDER = Object.keys(SLOT_LABEL);
const MONTHS_SHOWN = [1, 2];

// ------------------------------------------------------------------ catalog --
// The Fit Lab guide exactly as provided: meal → category → foods, with what each one is in the app.
type GuideRow = { meal: string; category: string; sub?: string; food: string; app: string; note?: string };

const guide: GuideRow[] = [];
function add(meal: string, category: string, foods: [string, string, string?][], sub?: string) {
  for (const [food, app, note] of foods) guide.push({ meal, category, sub, food, app, note });
}

add('Colazione', 'Proteine', [
  ['Yogurt greco 0%', 'greek-yogurt-0'], ['Skyr', 'skyr'], ['Yogurt proteico', 'yogurt-protein'], ['Latte senza lattosio', 'milk-lactose-free'],
  ['WPI / Whey', 'whey-protein', 'Stessa polvere di proteine whey'], ['Uova', 'eggs'], ['Albumi', 'egg-whites'], ['Fiocchi di latte', 'cottage-cheese'], ['Kefir', 'kefir'], ['Ricotta magra', 'ricotta-magra'],
]);
add('Colazione', 'Carboidrati', [
  ['Fiocchi d’avena', 'oats'], ['Avena istantanea', 'oats', 'Stesso alimento dei fiocchi d’avena'], ['Pane integrale', 'bread-wholegrain'], ['Pane di segale', 'bread-rye'],
  ['Fette biscottate integrali', 'fette-biscottate'], ['Muesli', 'muesli'], ['Cereali integrali', 'cereals-wholegrain'], ['Gallette di riso', 'rice-cakes'], ['Crema di riso', 'cream-of-rice'], ['Granola', 'granola'],
]);
add('Colazione', 'Frutta / Grassi', [['Banana', 'banana'], ['Mela', 'apple'], ['Kiwi', 'kiwi'], ['Frutti di bosco', 'blueberries', 'Nell’app: mirtilli e fragole'], ['Arancia', 'orange'], ['Fragole', 'strawberries']], 'Frutta');
add('Colazione', 'Frutta / Grassi', [['Mandorle', 'almonds'], ['Noci', 'walnuts'], ['Burro di arachidi 100%', 'peanut-butter'], ['Semi di chia', 'chia-seeds']], 'Grassi');
add('Spuntino', 'Proteine', [
  ['Yogurt greco 0%', 'greek-yogurt-0'], ['Skyr', 'skyr'], ['Yogurt proteico', 'yogurt-protein'], ['WPI / Whey', 'whey-protein'], ['Budino proteico', 'protein-pudding'],
  ['Barretta proteica', 'protein-bar'], ['Bevanda proteica', 'protein-drink'], ['Fiocchi di latte', 'cottage-cheese'], ['Kefir', 'kefir'], ['Bresaola', 'bresaola'],
]);
add('Spuntino', 'Carboidrati', [
  ['Banana', 'banana'], ['Mela', 'apple'], ['Pera', 'pear'], ['Kiwi', 'kiwi'], ['Arancia', 'orange'], ['Frutti di bosco', 'blueberries', 'Nell’app: mirtilli e fragole'],
  ['Gallette di riso', 'rice-cakes'], ['Gallette di mais', 'corn-cakes'], ['Pane integrale', 'bread-wholegrain'], ['Fette biscottate integrali', 'fette-biscottate'],
]);
add('Spuntino', 'Grassi', [
  ['Mandorle', 'almonds'], ['Noci', 'walnuts'], ['Nocciole', 'hazelnuts'], ['Pistacchi', 'pistachios'], ['Anacardi', 'cashews'], ['Burro di arachidi 100%', 'peanut-butter'],
  ['Burro di mandorle 100%', 'almond-butter'], ['Semi di chia', 'chia-seeds'], ['Semi di zucca', 'pumpkin-seeds'], ['Avocado', 'avocado'],
]);

const mainProtein: [string, string, string?][] = [
  ['Pollo', 'chicken-breast', 'Nell’app: petto di pollo'], ['Tacchino', 'turkey-breast', 'Nell’app: petto di tacchino'], ['Manzo magro', 'beef-lean'],
  ['Tonno al naturale', 'tuna-canned'], ['Salmone', 'salmon'], ['Merluzzo', 'cod'], ['Orata', 'sea-bream'], ['Gamberi', 'shrimp'], ['Uova', 'eggs'],
  ['Legumi', 'chickpeas', 'Nell’app: ceci, lenticchie, fagioli borlotti e cannellini'],
];
const mainCarb: [string, string, string?][] = [
  ['Riso', 'rice-basmati', 'Nell’app: riso basmati'], ['Pasta', 'pasta'], ['Cous cous', 'couscous'], ['Patate', 'potato'], ['Patate dolci', 'sweet-potato'], ['Farro', 'farro-cooked'],
  ['Quinoa', 'quinoa'], ['Pane integrale', 'bread-wholegrain'], ['Gnocchi', 'gnocchi'], ['Polenta', 'polenta-cooked'],
];
const mainFat: [string, string, string?][] = [
  ['Olio EVO', 'olive-oil'], ['Avocado', 'avocado'], ['Mandorle', 'almonds'], ['Noci', 'walnuts'], ['Nocciole', 'hazelnuts'], ['Pistacchi', 'pistachios'], ['Anacardi', 'cashews'],
  ['Semi di chia', 'chia-seeds'], ['Semi di lino', 'flaxseed'], ['Tahina', 'tahini'],
];
const mainVeg: [string, string, string?][] = [
  ['Zucchine', 'zucchini'], ['Broccoli', 'broccoli'], ['Spinaci', 'spinach'], ['Carote', 'carrot'], ['Pomodori', 'cherry-tomato', 'Nell’app: pomodorini'], ['Peperoni', 'bell-pepper-red', 'Nell’app: peperone rosso'],
  ['Melanzane', 'eggplant'], ['Insalata', 'mixed-salad', 'Nell’app: insalata mista'], ['Cavolfiore', 'cauliflower'], ['Fagiolini', 'green-beans'],
];
add('Pranzo', 'Proteine', mainProtein);
add('Pranzo', 'Carboidrati', mainCarb);
add('Pranzo', 'Grassi', mainFat);
add('Pranzo', 'Verdure', mainVeg);
add('Cena', 'Proteine', [...mainProtein.slice(0, 3), ['Vitello', 'veal-cutlet', 'Nell’app: cotoletta di vitello'], ...mainProtein.slice(4, 5), mainProtein[3], ...mainProtein.slice(5)]);
add('Cena', 'Carboidrati', mainCarb);
add('Cena', 'Grassi', mainFat);
add('Cena', 'Verdure', mainVeg);

// ----------------------------------------------------------------- helpers --
const clean = (name: string) => name.replace(/\s*\([^)]*\)/g, '').trim();
const appName = (id: string) => (findFood(id) ? clean(findFood(id)!.name) : `⚠ non presente (${id})`);

function lab(id: string, value: unknown): string {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return '';
  const q = findQuestion(id);
  const one = (v: unknown) => q?.options?.find((o) => o.value === v)?.label ?? String(v);
  return Array.isArray(value) ? value.map(one).join(', ') : one(value);
}

const MODE_LABEL: Record<string, string> = { both: 'Dieta e allenamento', diet: 'Solo dieta', training: 'Solo allenamento' };
const GOAL_LABEL: Record<string, string> = {
  loseFat: 'Perdere grasso', gainMuscle: 'Aumentare massa muscolare', maintainImprove: 'Mantenimento e forma fisica',
  gainStrength: 'Aumentare forza', improveEndurance: 'Migliorare resistenza', generalHealth: 'Salute generale',
};
const SEX_LABEL: Record<string, string> = { male: 'Uomo', female: 'Donna', unspecified: '—' };

type Role = 'Proteine' | 'Carboidrati e legumi' | 'Grassi' | 'Verdure' | 'Frutta';
function roleOf(foodId: string): Role | null {
  const f = findFood(foodId);
  if (!f) return null;
  if (f.category === 'proteine' || f.category === 'latticini') return 'Proteine';
  if (f.category === 'carboidrati' || f.category === 'legumi') return 'Carboidrati e legumi';
  if (f.category === 'grassi') return 'Grassi';
  if (f.category === 'verdura') return 'Verdure';
  if (f.category === 'frutta') return 'Frutta';
  return foodId === 'protein-bar' ? 'Proteine' : null;
}

// ------------------------------------------------------------------- styling --
const FONT = 'Arial';
const NAVY = 'FF1F3A5F';
const BAND = 'FFEEF3F9';
const ACCENT = 'FFFFF4E5';

function styleSheet(ws: ExcelJS.Worksheet, widths: number[], headerRow = 1) {
  ws.columns.forEach((c, i) => (c.width = widths[i] ?? 14));
  const header = ws.getRow(headerRow);
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });
  ws.eachRow((row, n) => {
    if (n === headerRow) return;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: FONT, size: 10, bold: cell.font?.bold };
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFBFC8D4' } } };
    });
  });
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRow }];
}

function band(ws: ExcelJS.Worksheet, keyCol: number, fromRow = 2) {
  let last = '';
  let on = false;
  for (let r = fromRow; r <= ws.rowCount; r++) {
    const key = String(ws.getRow(r).getCell(keyCol).value ?? '');
    if (key !== last) {
      on = !on;
      last = key;
    }
    if (on) ws.getRow(r).eachCell({ includeEmpty: true }, (c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } }));
  }
}

// -------------------------------------------------------------------- build --
async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FITLAB';
  wb.created = new Date();

  // the 20 questionnaires that produce a diet (a training-only questionnaire has none)
  const runs = PERSONAS.map((persona) => {
    const ctx = buildUserContext(persona.answers);
    return { persona, ctx, diet: buildPlans(ctx).diet };
  })
    .filter((r): r is { persona: (typeof PERSONAS)[number]; ctx: ReturnType<typeof buildUserContext>; diet: NonNullable<typeof r.diet> } => r.diet != null)
    .slice(0, 20)
    .map((r, i) => ({ ...r, n: i + 1 }));

  // 1. Leggimi
  const info = wb.addWorksheet('Leggimi');
  info.columns = [{ width: 110 }];
  const lines: [string, boolean?][] = [
    ['Diete generate dall’agente — 20 questionari simulati', true],
    ['', false],
    ['Scopo: capire come l’agente mette insieme gli alimenti e che tipo di pasti propone. Grammature, calorie e macro sono volutamente omesse.', false],
    ['', false],
    ['Come leggere i fogli', true],
    ['• Questionari — le 20 persone simulate e le risposte che orientano la dieta (età, obiettivo, pasti scelti, esclusioni, preferenze, abitudini).', false],
    ['• Diete — per ogni persona, giorno e pasto: nome del piatto, alimenti divisi in proteine / carboidrati / grassi / verdure / frutta e ingredienti per insaporire.', false],
    ['• Settimana per pasto — la stessa dieta in forma di tabella: una riga per pasto, un giorno per colonna, per vedere a colpo d’occhio la varietà.', false],
    ['• Varietà — per ogni persona e pasto: quanti piatti diversi in una settimana e quante volte torna lo stesso (regola: al massimo 3).', false],
    ['• Piatti — la libreria di ricette dell’agente: quali alimenti può abbinare in ogni piatto.', false],
    ['• Catalogo Fit Lab — l’elenco degli alimenti della tua guida, diviso per pasto e per proteine / carboidrati / grassi / verdure / frutta, con il nome che ha nell’app.', false],
    ['', false],
    ['Note', true],
    ['• Sono mostrati il mese 1 e il mese 2. Dentro un mese la settimana è la stessa per tutte le settimane; da un mese all’altro i piatti cambiano.', false],
    ['• "Pasto libero" è la cena del sabato lasciata alla scelta della persona.', false],
    ['• I piani sono creati con la stessa funzione che usa l’app (nessuna chiamata AI): un utente con quelle risposte riceverebbe esattamente questi piatti.', false],
    ['• Nel catalogo "Frutti di bosco" corrisponde nell’app a mirtilli e fragole; "Legumi" a ceci, lenticchie, fagioli borlotti e cannellini.', false],
  ];
  lines.forEach(([text, bold], i) => {
    const cell = info.getCell(i + 1, 1);
    cell.value = text;
    cell.font = { name: FONT, size: bold ? (i === 0 ? 14 : 11) : 10, bold: !!bold, color: { argb: bold ? NAVY : 'FF222222' } };
    cell.alignment = { wrapText: true, vertical: 'top' };
  });

  // 2. Questionari
  const qs = wb.addWorksheet('Questionari');
  qs.columns = [
    { header: 'N°' }, { header: 'Persona' }, { header: 'Descrizione' }, { header: 'Età' }, { header: 'Sesso' }, { header: 'Altezza (cm)' }, { header: 'Peso (kg)' },
    { header: 'Obiettivo' }, { header: 'Peso obiettivo (kg)' }, { header: 'Cosa ha scelto' }, { header: 'Pasti al giorno' }, { header: 'Alimentazione' },
    { header: 'Allergie / intolleranze' }, { header: 'Alimenti esclusi' }, { header: 'Alimenti da includere' }, { header: 'Proteine preferite' },
    { header: 'Carboidrati preferiti' }, { header: 'Grassi preferiti' }, { header: 'Cosa mangia di solito' }, { header: 'Pasti fuori casa' },
  ];
  for (const { n, persona } of runs) {
    const a = persona.answers as Record<string, unknown>;
    const usual = [
      a.usualBreakfast ? `Colazione: ${a.usualBreakfast}` : '',
      a.usualMorningSnack ? `Spuntino mattina: ${a.usualMorningSnack}` : '',
      a.usualLunch ? `Pranzo: ${a.usualLunch}` : '',
      a.usualAfternoonSnack ? `Merenda: ${a.usualAfternoonSnack}` : '',
      a.usualDinner ? `Cena: ${a.usualDinner}` : '',
    ].filter(Boolean).join(' · ');
    const meals = Array.isArray(a.mealsSelected) ? (a.mealsSelected as string[]).map((m) => SLOT_LABEL[m] ?? m).join(', ') : 'Colazione, Pranzo, Cena';
    qs.addRow([
      n, persona.name, persona.summary, Number(a.age), SEX_LABEL[String(a.sex)] ?? String(a.sex), Number(a.heightCm), Number(a.currentWeightKg),
      GOAL_LABEL[String(a.goal)] ?? String(a.goal), a.targetWeightKg ? Number(a.targetWeightKg) : '—', MODE_LABEL[String(a.mode ?? 'both')] ?? 'Dieta e allenamento', meals,
      lab('dietaryPattern', a.dietaryPattern) || 'Nessuna', (a.allergiesIntolerances as string) || '—', (a.excludedFoods as string) || '—', (a.includedFoods as string) || '—',
      lab('preferredProteins', a.preferredProteins) || '—', lab('preferredCarbs', a.preferredCarbs) || '—', lab('preferredFats', a.preferredFats) || '—', usual || '—', lab('eatingOut', a.eatingOut) || '—',
    ]);
  }
  styleSheet(qs, [5, 30, 60, 7, 9, 10, 9, 24, 12, 20, 34, 16, 24, 20, 20, 30, 30, 26, 44, 20]);

  // 3. Diete (long format)
  const diets = wb.addWorksheet('Diete');
  diets.columns = [
    { header: 'Persona' }, { header: 'Mese' }, { header: 'Giorno' }, { header: 'Pasto' }, { header: 'Piatto' }, { header: 'Proteine' },
    { header: 'Carboidrati e legumi' }, { header: 'Grassi' }, { header: 'Verdure' }, { header: 'Frutta' }, { header: 'Per insaporire' },
  ];
  for (const { persona, diet } of runs) {
    for (const monthIndex of MONTHS_SHOWN) {
      const month = diet.months.find((m) => m.monthIndex === monthIndex);
      if (!month) continue;
      month.weeklySplit.forEach((day, dayIdx) => {
        for (const meal of [...day.meals].sort((a, b) => SLOT_ORDER.indexOf(a.slotId) - SLOT_ORDER.indexOf(b.slotId))) {
          if (meal.isFreeMeal) {
            diets.addRow([persona.name, monthIndex, WEEKDAYS[dayIdx], SLOT_LABEL[meal.slotId], 'Pasto libero', '', '', '', '', '', '']);
            continue;
          }
          const by: Record<Role, string[]> = { Proteine: [], 'Carboidrati e legumi': [], Grassi: [], Verdure: [], Frutta: [] };
          for (const item of meal.items) {
            const role = roleOf(item.foodId);
            if (role) by[role].push(clean(item.name));
          }
          diets.addRow([
            persona.name, monthIndex, WEEKDAYS[dayIdx], SLOT_LABEL[meal.slotId] ?? meal.label, meal.recipe?.name ?? '—',
            by.Proteine.join(' + '), by['Carboidrati e legumi'].join(' + '), by.Grassi.join(' + '), by.Verdure.join(' + '), by.Frutta.join(' + '),
            meal.recipe?.flavorings.join(', ') ?? '',
          ]);
        }
      });
    }
  }
  styleSheet(diets, [34, 6, 12, 18, 44, 28, 30, 24, 18, 16, 28]);
  diets.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 11 } };
  band(diets, 1);

  // 4. Settimana per pasto (matrix) + 5. Varietà
  const week = wb.addWorksheet('Settimana per pasto');
  week.columns = [{ header: 'Persona' }, { header: 'Mese' }, { header: 'Pasto' }, ...WEEKDAYS.map((d) => ({ header: d }))];
  const variety = wb.addWorksheet('Varietà');
  variety.columns = [
    { header: 'Persona' }, { header: 'Mese' }, { header: 'Pasto' }, { header: 'Piatti diversi (su 7 giorni)' }, { header: 'Stesso pasto: max volte a settimana' },
    { header: 'Stessa preparazione: max volte' }, { header: 'Regola (max 3)' },
  ];
  let worst = 0;
  for (const { persona, diet } of runs) {
    for (const monthIndex of MONTHS_SHOWN) {
      const month = diet.months.find((m) => m.monthIndex === monthIndex);
      if (!month) continue;
      const slots = [...new Set(month.weeklySplit.flatMap((d) => d.meals.map((m) => m.slotId)))].sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b));
      for (const slot of slots) {
        const cells = month.weeklySplit.map((d) => {
          const m = d.meals.find((x) => x.slotId === slot);
          return m?.isFreeMeal ? 'Pasto libero' : (m?.recipe?.name ?? '—');
        });
        week.addRow([persona.name, monthIndex, SLOT_LABEL[slot], ...cells]);
        const real = month.weeklySplit.map((d) => d.meals.find((x) => x.slotId === slot)).filter((m) => m && !m.isFreeMeal);
        const names = new Map<string, number>();
        const dishes = new Map<string, number>();
        for (const m of real) {
          names.set(m!.recipe!.name, (names.get(m!.recipe!.name) ?? 0) + 1);
          dishes.set(m!.recipe!.dishId ?? '?', (dishes.get(m!.recipe!.dishId ?? '?') ?? 0) + 1);
        }
        const maxName = Math.max(...names.values());
        const maxDish = Math.max(...dishes.values());
        worst = Math.max(worst, maxName, maxDish);
        variety.addRow([persona.name, monthIndex, SLOT_LABEL[slot], names.size, maxName, maxDish, maxName <= 3 && maxDish <= 3 ? 'Rispettata' : 'NON rispettata']);
      }
    }
  }
  styleSheet(week, [34, 6, 20, 30, 30, 30, 30, 30, 30, 30]);
  band(week, 1);
  styleSheet(variety, [34, 6, 20, 16, 20, 18, 16]);
  band(variety, 1);
  variety.eachRow((row, n) => {
    if (n > 1 && row.getCell(7).value === 'NON rispettata') row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8C9C9' } };
  });

  // 6. Piatti (recipe library)
  const dishSheet = wb.addWorksheet('Piatti');
  dishSheet.columns = [
    { header: 'Piatto (modello)' }, { header: 'Pasti' }, { header: 'Proteine ammesse' }, { header: 'Carboidrati ammessi' }, { header: 'Grassi ammessi' },
    { header: 'Verdure ammesse' }, { header: 'Frutta ammessa' }, { header: 'Per insaporire' }, { header: 'Note' },
  ];
  const KIND_LABEL: Record<string, string> = { breakfast: 'Colazione', snack: 'Spuntino', lunch: 'Pranzo', dinner: 'Cena' };
  const names = (ids?: string[]) => (ids ?? []).map(appName).join(', ');
  for (const d of DISHES) {
    dishSheet.addRow([
      d.name.replace(/\{p\}/g, '[proteina]').replace(/\{pc\}/g, '[proteina cotta]').replace(/\{c\}/g, '[carboidrato]').replace(/\{v\}/g, '[verdura]').replace(/\{f\}/g, '[grasso]').replace(/\{fr\}/g, '[frutta]'),
      d.kinds.map((k) => KIND_LABEL[k]).join(', '), names(d.protein) + (d.meatlessProtein ? ` (solo vegetariani: ${names(d.meatlessProtein)})` : ''), names(d.carb), names(d.fat), names(d.veg), names(d.fruit),
      d.flavor.join(', '), [d.portable ? 'Trasportabile' : '', d.meatless ? 'Solo senza carne e pesce' : ''].filter(Boolean).join(' · '),
    ]);
  }
  styleSheet(dishSheet, [44, 16, 46, 40, 36, 40, 30, 30, 24]);
  band(dishSheet, 2);

  // 7. Catalogo Fit Lab
  const cat = wb.addWorksheet('Catalogo Fit Lab');
  cat.columns = [{ header: 'Pasto' }, { header: 'Categoria' }, { header: 'Tipo' }, { header: 'N°' }, { header: 'Alimento (dalla tua guida)' }, { header: 'Nell’app' }, { header: 'Note' }];
  const counters = new Map<string, number>();
  for (const row of guide) {
    const key = `${row.meal}|${row.category}`;
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    const present = findFood(row.app);
    cat.addRow([row.meal, row.category, row.sub ?? '', n, row.food, present ? clean(present.name) : '⚠ non presente', row.note ?? '']);
  }
  styleSheet(cat, [14, 18, 10, 6, 32, 30, 48]);
  cat.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };
  let prev = '';
  let shade = false;
  for (let r = 2; r <= cat.rowCount; r++) {
    const key = `${cat.getRow(r).getCell(1).value}|${cat.getRow(r).getCell(2).value}`;
    if (key !== prev) {
      shade = !shade;
      prev = key;
    }
    if (shade) cat.getRow(r).eachCell({ includeEmpty: true }, (c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } }));
  }

  for (const [ws, color] of [[info, 'FF1F3A5F'], [qs, 'FF4F81BD'], [diets, 'FFE67E22'], [week, 'FFE67E22'], [variety, 'FF27AE60'], [dishSheet, 'FF8E44AD'], [cat, 'FFC0392B']] as const) ws.properties.tabColor = { argb: color };

  const dir = join(process.cwd(), 'scripts', 'agent-tests', 'reports');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'fitlab-20-diete.xlsx');
  await wb.xlsx.writeFile(file);
  console.log(`Creato ${file}\n  questionari: ${runs.length}, righe nel foglio Diete: ${diets.rowCount - 1}, ripetizione massima in una settimana: ${worst}`);
}

void main();
