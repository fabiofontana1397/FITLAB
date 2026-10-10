/**
 * Exports an Excel workbook with the diets the engine builds for the 20 simulated questionnaires:
 * which dishes and foods it puts together (no grams, calories or macros), the dish library the agent
 * draws from (the workbook's dishes plus the agent's own) and the Fit Lab catalog with its nutrition values.
 * Run with:  npm run agents:excel
 *
 * The plans come from the same function the app uses (domain/plan-engine.ts buildPlans), so what is in
 * the file is what a person with those answers would get.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import ExcelJS from 'exceljs';

import { buildPlans } from '@/domain/plan-engine';
import { buildUserContext } from '@/domain/user-context';
import { DISHES } from '@/lib/planning/fitlab/dishes';
import { FITLAB_FOODS } from '@/lib/planning/fitlab/foods';
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

// ----------------------------------------------------------------- helpers --
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
const KIND_LABEL: Record<string, string> = { breakfast: 'Colazione', snack: 'Spuntino', lunch: 'Pranzo', dinner: 'Cena' };
const REGIME_LABEL: Record<string, string> = { omni: 'Onnivoro', veg: 'Vegetariano', vegan: 'Vegano', pesc: 'Pescetariano' };
const MEAL_ORDER = ['breakfast', 'snack', 'lunch', 'dinner'];

type Column = 'Proteine' | 'Carboidrati e legumi' | 'Grassi' | 'Verdure' | 'Frutta' | 'Altro';
const COLUMN_OF: Record<string, Column> = { protein: 'Proteine', carb: 'Carboidrati e legumi', fat: 'Grassi', veg: 'Verdure', fruit: 'Frutta', extra: 'Altro' };

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

function band(ws: ExcelJS.Worksheet, keyCol: number, fromRow = 2, color = BAND) {
  let last = '';
  let on = false;
  for (let r = fromRow; r <= ws.rowCount; r++) {
    const key = String(ws.getRow(r).getCell(keyCol).value ?? '');
    if (key !== last) {
      on = !on;
      last = key;
    }
    if (on) ws.getRow(r).eachCell({ includeEmpty: true }, (c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }));
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
    ['L’agente usa principalmente gli alimenti e i piatti del file "fitlab-catalogo-piatti.xlsx" (catalogo di 170 alimenti, 49 piatti mediterranei) e ne propone altri nello stesso stile.', false],
    ['', false],
    ['Come leggere i fogli', true],
    ['• Questionari — le 20 persone simulate e le risposte che orientano la dieta (età, obiettivo, pasti scelti, esclusioni, preferenze, abitudini).', false],
    ['• Diete — per ogni persona, giorno e pasto: nome del piatto, alimenti divisi in proteine / carboidrati / grassi / verdure / frutta, altro (marmellata, passata) e condimenti per insaporire.', false],
    ['• Settimana per pasto — la stessa dieta in forma di tabella: una riga per pasto, un giorno per colonna, per vedere a colpo d’occhio la varietà.', false],
    ['• Varietà — per ogni persona e pasto: quanti piatti diversi in una settimana e quante volte torna lo stesso (regola: al massimo 3).', false],
    ['• Piatti — la libreria di ricette: i piatti del tuo file (origine "File") e quelli aggiunti dall’agente (origine "Agente"), con gli alimenti ammessi in ogni ruolo. Il primo alimento di ogni lista è quello scritto nel tuo file, gli altri sono le alternative.', false],
    ['• Catalogo Fit Lab — i 170 alimenti con regimi, allergeni, stato (secco / crudo / cotto) e valori nutrizionali per 100 g.', false],
    ['', false],
    ['Note', true],
    ['• Sono mostrati il mese 1 e il mese 2. Dentro un mese la settimana è la stessa per tutte le settimane; da un mese all’altro i piatti cambiano.', false],
    ['• "Pasto libero" è la cena del sabato lasciata alla scelta della persona.', false],
    ['• Nei piani i pesi sono quelli indicati nel catalogo: pasta, riso e cereali a secco, carne e pesce a crudo, legumi cotti.', false],
    ['• I piani sono creati con la stessa funzione che usa l’app (nessuna chiamata AI): un utente con quelle risposte riceverebbe esattamente questi piatti.', false],
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
    { header: 'Carboidrati e legumi' }, { header: 'Grassi' }, { header: 'Verdure' }, { header: 'Frutta' }, { header: 'Altro (marmellata, passata)' }, { header: 'Condimenti per insaporire' },
  ];
  for (const { persona, diet } of runs) {
    for (const monthIndex of MONTHS_SHOWN) {
      const month = diet.months.find((m) => m.monthIndex === monthIndex);
      if (!month) continue;
      month.weeklySplit.forEach((day, dayIdx) => {
        for (const meal of [...day.meals].sort((a, b) => SLOT_ORDER.indexOf(a.slotId) - SLOT_ORDER.indexOf(b.slotId))) {
          if (meal.isFreeMeal) {
            diets.addRow([persona.name, monthIndex, WEEKDAYS[dayIdx], SLOT_LABEL[meal.slotId], 'Pasto libero', '', '', '', '', '', '', '']);
            continue;
          }
          const by: Record<Column, string[]> = { Proteine: [], 'Carboidrati e legumi': [], Grassi: [], Verdure: [], Frutta: [], Altro: [] };
          for (const item of meal.items) by[COLUMN_OF[item.role ?? 'extra']].push(item.name);
          diets.addRow([
            persona.name, monthIndex, WEEKDAYS[dayIdx], SLOT_LABEL[meal.slotId] ?? meal.label, meal.recipe?.name ?? '—',
            by.Proteine.join(' + '), by['Carboidrati e legumi'].join(' + '), by.Grassi.join(' + '), by.Verdure.join(' + '), by.Frutta.join(' + '), by.Altro.join(' + '),
            meal.recipe?.flavorings.join(', ') ?? '',
          ]);
        }
      });
    }
  }
  styleSheet(diets, [34, 6, 12, 18, 52, 28, 30, 24, 22, 16, 22, 30]);
  diets.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 12 } };
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
  let fromFile = 0;
  let totalMeals = 0;
  const sourceOf = new Map(DISHES.map((d) => [d.id, d.source]));
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
          totalMeals++;
          if (sourceOf.get(m!.recipe!.dishId ?? '') === 'excel') fromFile++;
        }
        const maxName = Math.max(...names.values());
        const maxDish = Math.max(...dishes.values());
        worst = Math.max(worst, maxName, maxDish);
        variety.addRow([persona.name, monthIndex, SLOT_LABEL[slot], names.size, maxName, maxDish, maxName <= 3 && maxDish <= 3 ? 'Rispettata' : 'NON rispettata']);
      }
    }
  }
  styleSheet(week, [34, 6, 20, 32, 32, 32, 32, 32, 32, 32]);
  band(week, 1);
  styleSheet(variety, [34, 6, 20, 16, 20, 18, 16]);
  band(variety, 1);
  variety.eachRow((row, n) => {
    if (n > 1 && row.getCell(7).value === 'NON rispettata') row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8C9C9' } };
  });

  // 6. Piatti (recipe library)
  const dishSheet = wb.addWorksheet('Piatti');
  dishSheet.columns = [
    { header: 'ID' }, { header: 'Origine' }, { header: 'Pasti' }, { header: 'Piatto (modello)' }, { header: 'Primo / base' }, { header: 'Secondo / proteine' },
    { header: 'Proteine di completamento' }, { header: 'Contorni / frutta' }, { header: 'Grassi / accompagnamento' }, { header: 'Olio EVO' }, { header: 'Passata' }, { header: 'Condimenti e aromi' }, { header: 'Trasportabile' },
  ];
  const TOKENS: [RegExp, string][] = [[/\{base\}/g, '[base]'], [/\{protein\}/g, '[proteina]'], [/\{s1\}/g, '[contorno 1]'], [/\{s2\}/g, '[contorno 2]'], [/\{fat\}/g, '[grasso]'], [/\{spread\}/g, '[marmellata]']];
  const list = (names?: string[]) => (names ?? []).join(', ');
  for (const d of [...DISHES].sort((a, b) => MEAL_ORDER.indexOf(a.kinds[0]) - MEAL_ORDER.indexOf(b.kinds[0]) || a.id.localeCompare(b.id))) {
    let name = d.name;
    for (const [re, to] of TOKENS) name = name.replace(re, to);
    dishSheet.addRow([
      d.id, d.source === 'excel' ? 'File' : 'Agente', d.kinds.map((k) => KIND_LABEL[k]).join(', '), name, list(d.base), list(d.protein), list(d.extraProtein),
      (d.sides ?? []).map((g) => g.join(' / ')).join('  +  ') + (d.spread ? `${d.sides ? '  +  ' : ''}${d.spread.join(' / ')}` : ''), list(d.fat), d.oil ? 'Sì' : '', d.sauce ? 'Sì' : '', d.aromas.join(', '), d.portable ? 'Sì' : '',
    ]);
  }
  styleSheet(dishSheet, [8, 9, 18, 52, 32, 40, 32, 44, 32, 8, 8, 30, 12]);
  dishSheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 13 } };
  band(dishSheet, 3);

  // 7. Catalogo Fit Lab (with nutrition)
  const cat = wb.addWorksheet('Catalogo Fit Lab');
  cat.columns = [
    { header: 'ID' }, { header: 'Alimento' }, { header: 'Categoria' }, { header: 'Sottocategoria' }, { header: 'Pasti compatibili' }, { header: 'Regimi alimentari' }, { header: 'Allergeni' },
    { header: 'Stato (peso riferito a)' }, { header: 'Kcal/100 g' }, { header: 'Proteine/100 g' }, { header: 'Carboidrati/100 g' }, { header: 'Grassi/100 g' }, { header: 'Fibre/100 g' },
  ];
  for (const f of FITLAB_FOODS) {
    cat.addRow([
      f.id.toUpperCase(), f.name, f.category, f.sub, f.meals.map((m) => KIND_LABEL[m]).join('; '), f.regimes.map((r) => REGIME_LABEL[r]).join('; '), f.allergens, f.state, f.kcal, f.p, f.c, f.f, f.fib,
    ]);
  }
  styleSheet(cat, [9, 34, 18, 26, 30, 38, 36, 36, 10, 11, 12, 10, 10]);
  cat.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 13 } };
  let prev = '';
  let shade = false;
  for (let r = 2; r <= cat.rowCount; r++) {
    const key = String(cat.getRow(r).getCell(3).value);
    if (key !== prev) {
      shade = !shade;
      prev = key;
    }
    if (shade) cat.getRow(r).eachCell({ includeEmpty: true }, (c) => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } }));
  }

  for (const [ws, color] of [[info, 'FF1F3A5F'], [qs, 'FF4F81BD'], [diets, 'FFE67E22'], [week, 'FFE67E22'], [variety, 'FF27AE60'], [dishSheet, 'FF8E44AD'], [cat, 'FFC0392B']] as const) ws.properties.tabColor = { argb: color };

  const dir = join(process.cwd(), 'scripts', 'agent-tests', 'reports');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, process.argv[2] ?? 'fitlab-20-diete.xlsx');
  await wb.xlsx.writeFile(file);
  console.log(
    `Creato ${file}\n  questionari: ${runs.length}, righe nel foglio Diete: ${diets.rowCount - 1}, ripetizione massima in una settimana: ${worst}, pasti con piatti del tuo file: ${Math.round((fromFile / totalMeals) * 100)}%`
  );
}

void main();
