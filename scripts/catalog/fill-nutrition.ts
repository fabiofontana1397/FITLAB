/**
 * Fills the nutrition columns (Kcal, Proteine, Carboidrati, Grassi, Fibre, Fonte, Note) of the Fit Lab catalog workbook.
 *   npx tsx scripts/catalog/fill-nutrition.ts <input.xlsx> <output.xlsx>
 * Values come from nutrition-data.ts. Rows whose food has no entry are reported (and left empty).
 */
import ExcelJS from 'exceljs';

import { kcalOf, NUTRITION, SOURCE_TEXT } from './nutrition-data';

const norm = (s: string) => s.replace(/[’‘]/g, "'").trim();
const text = (v: unknown): string =>
  v && typeof v === 'object' && 'richText' in (v as object) ? (v as { richText: { text: string }[] }).richText.map((t) => t.text).join('') : String(v ?? '');

void (async () => {
  const [input, output] = process.argv.slice(2);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(input);
  const ws = wb.getWorksheet('Catalogo Fit Lab')!;
  const table = new Map(Object.entries(NUTRITION).map(([k, v]) => [norm(k), v]));
  const used = new Set<string>();
  const missing: string[] = [];
  let filled = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = norm(text(row.getCell(2).value));
    if (!name) continue;
    const n = table.get(name);
    if (!n) {
      missing.push(name);
      continue;
    }
    used.add(name);
    const state = text(row.getCell(9).value).split(';')[0].trim().toLowerCase();
    row.getCell(10).value = kcalOf(n);
    row.getCell(11).value = n.p;
    row.getCell(12).value = n.c;
    row.getCell(13).value = n.f;
    row.getCell(14).value = n.fib;
    row.getCell(15).value = SOURCE_TEXT[n.src];
    for (const c of [11, 12, 13, 14]) row.getCell(c).numFmt = '0.0';
    row.getCell(10).numFmt = '0';
    const note = text(row.getCell(16).value);
    const std = `Per 100 g di prodotto (${state || 'stato indicato'}); carboidrati disponibili (senza fibra); kcal = 4P+4C+9F+2 fibre (Reg. UE 1169/2011). Valori medi di riferimento da validare con un professionista.`;
    row.getCell(16).value = note ? `${note} ${std}` : std;
    row.commit?.();
    filled++;
  }
  await wb.xlsx.writeFile(output);
  console.log(`Alimenti compilati: ${filled}`);
  if (missing.length) console.log('Senza valori:', missing.join(', '));
  const unused = [...table.keys()].filter((k) => !used.has(k));
  if (unused.length) console.log('Valori non usati (nome non trovato nel file):', unused.join(', '));
})();
