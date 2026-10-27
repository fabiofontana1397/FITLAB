// Metro doesn't honor jsPDF's package.json "browser" export condition on
// web and resolves the bare specifier to its Node build instead, which
// uses an AMD-style `require(["html2canvas"], ...)` call Metro's static
// analyzer can't parse (`Invalid call` bundling error). Importing the
// ES module build by its explicit subpath sidesteps that resolution
// entirely.
import jsPDF from 'jspdf/dist/jspdf.es.min.js';
import autoTable from 'jspdf-autotable';

import { PDF_LOGO_ASPECT, PDF_LOGO_DATA_URI } from './pdf-logo';
import type { DietDayPlan, PlanMealItem } from './types';

// Web build of pdf-export — resolved automatically instead of pdf-export.ts
// by Metro/TS on web. expo-print's web shim ignores the `html` it's given
// and just calls window.print() on the live app (so "Scarica PDF" printed a
// screenshot of the screen, not the plan). Building a real PDF client-side
// with jsPDF sidesteps that entirely and downloads an actual .pdf file,
// which is also far more reliable on mobile browsers than a print dialog.

const ORANGE: [number, number, number] = [255, 122, 0];
const INK: [number, number, number] = [22, 23, 27];
const MUTED: [number, number, number] = [102, 102, 102];
const BODY: [number, number, number] = [51, 51, 51];
const MARGIN = 40;

function drawLetterhead(doc: jsPDF, pageWidth: number): number {
  let y = 46;
  const logoHeight = 22;
  doc.addImage(PDF_LOGO_DATA_URI, 'PNG', MARGIN, y - logoHeight + 4, logoHeight * PDF_LOGO_ASPECT, logoHeight);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(153, 153, 153);
  doc.text('BUILD YOUR BEST', pageWidth - MARGIN, y, { align: 'right' });

  y += 10;
  doc.setDrawColor(230, 230, 230);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  return y + 26;
}

type RunStyle = 'normal' | 'bold' | 'italic';
type Run = { text: string; style: RunStyle };
type RichLine = { x: number; runs: Run[] };

/** Flows styled runs into lines no wider than `width`, as bullet paragraphs:
 * the first line of each paragraph starts at `indent`, wrapped lines at
 * `indent + hang` so the text lines up under the first word, not the bullet. */
function layoutRich(
  doc: jsPDF,
  paragraphs: { indent: number; hang: number; runs: Run[] }[],
  width: number
): RichLine[] {
  const lines: RichLine[] = [];
  for (const para of paragraphs) {
    let line: RichLine = { x: para.indent, runs: [] };
    let used = para.indent;
    for (const run of para.runs) {
      doc.setFont('helvetica', run.style);
      for (let word of run.text.match(/\s*\S+\s*/g) ?? []) {
        if (used + doc.getTextWidth(word.trim()) > width && line.runs.length > 0) {
          lines.push(line);
          line = { x: para.indent + para.hang, runs: [] };
          used = para.indent + para.hang;
          word = word.trimStart();
        }
        line.runs.push({ text: word, style: run.style });
        used += doc.getTextWidth(word);
      }
    }
    lines.push(line);
  }
  return lines;
}

/** "Petto di pollo (150g)" — or "Uova (2 uova)" for count-based foods, see
 * food-quantity.ts. Each item is a bullet with the food name in bold; when the
 * plan offers same-role swaps, an indented "– in alternativa: …" line in italics
 * follows it. */
function mealParagraphs(items: PlanMealItem[]) {
  return items.flatMap((item) => {
    const paras: { indent: number; hang: number; runs: Run[] }[] = [
      {
        indent: 0,
        hang: 8,
        runs: [
          { text: '• ', style: 'normal' as const },
          { text: item.name, style: 'bold' as const },
          { text: ` (${item.quantityLabel})`, style: 'normal' as const },
        ],
      },
    ];
    if (item.substitutes?.length) {
      const subs = item.substitutes.map((sub) => `${sub.name} (${sub.quantityLabel})`).join(', ');
      paras.push({
        indent: 10,
        hang: 8,
        runs: [{ text: `– in alternativa: ${subs}`, style: 'italic' as const }],
      });
    }
    return paras;
  });
}

const BODY_FONT_SIZE = 9;
const CELL_PADDING = 6;
const DIET_ITEMS_COL_WIDTH = 390;

/** "Label: value" with the label in bold; a long value wraps under itself. */
function drawInfoLine(doc: jsPDF, label: string, value: string, x: number, y: number, maxWidth: number): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(`${label}:`, x, y);
  const labelWidth = doc.getTextWidth(`${label}: `);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BODY);
  const lines: string[] = doc.splitTextToSize(value, maxWidth - labelWidth);
  doc.text(lines, x + labelWidth, y);
  return y + lines.length * 12 + 2;
}

/** A bullet list of "Label: value" lines, label in bold, indented under a heading. */
function drawBulletList(doc: jsPDF, items: { label: string; value: string }[], x: number, y: number): number {
  doc.setFontSize(10);
  for (const item of items) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...ORANGE);
    doc.text('•', x, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.text(`${item.label}:`, x + 10, y);
    const labelWidth = doc.getTextWidth(`${item.label}: `);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BODY);
    doc.text(item.value, x + 10 + labelWidth, y);
    y += 13;
  }
  return y;
}

/** Month heading in bold, then its focus text. */
function drawMonthBlock(doc: jsPDF, pageWidth: number, title: string, focus: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(title, MARGIN, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BODY);
  const focusLines = doc.splitTextToSize(focus, pageWidth - MARGIN * 2);
  doc.text(focusLines, MARGIN, y);
  return y + focusLines.length * 12 + 8;
}

function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(153, 153, 153);
  doc.text(
    'Generato da FITLAB. Il piano si aggiorna nel tempo in base ai tuoi progressi reali.',
    MARGIN,
    pageHeight - 24
  );
  doc.text(String(doc.getNumberOfPages()), pageWidth - MARGIN, pageHeight - 24, { align: 'right' });
}

export type DietPlanPdfInput = {
  userName: string;
  goalNote: string;
  totalMonths: number;
  monthTitle: string;
  monthFocus: string;
  calorieTarget: number;
  macroTargetsG: { protein: number; carbs: number; fats: number };
  weeklySplit: DietDayPlan[];
};

/** Exports only the currently selected month's plan — one page, one table,
 * each day's name appearing once as its own heading row (spanning the full
 * table width) above that day's meals rather than repeated on every row. */
export async function exportDietPlanPdf(input: DietPlanPdfInput) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = drawLetterhead(doc, pageWidth);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(`Piano alimentare di ${input.userName}`, MARGIN, y);
  y += 20;

  const contentWidth = pageWidth - MARGIN * 2;
  y = drawInfoLine(doc, 'Obiettivo', input.goalNote, MARGIN, y, contentWidth);
  y = drawInfoLine(doc, 'Durata piano', `${input.totalMonths} mesi`, MARGIN, y, contentWidth);
  y += 10;

  y = drawMonthBlock(doc, pageWidth, input.monthTitle, input.monthFocus, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text('Target giornalieri', MARGIN, y);
  y += 14;
  y = drawBulletList(
    doc,
    [
      { label: 'Calorie', value: `${input.calorieTarget} kcal/giorno` },
      { label: 'Proteine', value: `${input.macroTargetsG.protein} g` },
      { label: 'Carboidrati', value: `${input.macroTargetsG.carbs} g` },
      { label: 'Grassi', value: `${input.macroTargetsG.fats} g` },
    ],
    MARGIN + 10,
    y
  );
  y += 8;

  // The foods column is drawn by hand (bold names, bullets, indented
  // alternatives, which autoTable can't style per word). The cell text is
  // only blank lines so autoTable reserves the right row height.
  doc.setFontSize(BODY_FONT_SIZE);
  const itemsInner = DIET_ITEMS_COL_WIDTH - CELL_PADDING * 2;
  const mealLines = new Map<string, RichLine[]>();
  const body = input.weeklySplit.flatMap((day) => [
    [{ content: day.weekday, colSpan: 3, styles: { fontStyle: 'bold' as const, fillColor: [255, 248, 245] as [number, number, number], textColor: INK } }],
    ...day.meals.map((meal) => {
      const key = `${day.weekday}|${meal.time}|${meal.label}`;
      const paragraphs = meal.isFreeMeal
        ? [{ indent: 0, hang: 0, runs: [{ text: 'Pasto libero — scegli tu, senza eccessi', style: 'italic' as const }] }]
        : mealParagraphs(meal.items);
      const lines = layoutRich(doc, paragraphs, itemsInner);
      mealLines.set(key, lines);
      return [
        { content: `${meal.time}\n${meal.label}`, styles: { fontStyle: 'bold' as const, textColor: INK }, key },
        { content: lines.map(() => ' ').join('\n'), key },
        { content: `${meal.totalKcal} kcal`, styles: { fontStyle: 'bold' as const, textColor: INK } },
      ];
    }),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Pasto', 'Alimenti', 'Totale']],
    body,
    rowPageBreak: 'avoid',
    styles: { fontSize: BODY_FONT_SIZE, cellPadding: CELL_PADDING, textColor: BODY, valign: 'top' },
    headStyles: { fillColor: ORANGE, textColor: 255 },
    alternateRowStyles: { fillColor: [247, 247, 248] },
    columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: DIET_ITEMS_COL_WIDTH }, 2: { cellWidth: 55 } },
    didDrawCell: (data) => {
      const key = (data.cell.raw as { key?: string } | null)?.key;
      if (data.section !== 'body' || data.column.index !== 1 || !key) return;
      const lines = mealLines.get(key);
      if (!lines) return;
      const lineHeight = BODY_FONT_SIZE * doc.getLineHeightFactor();
      doc.setFontSize(BODY_FONT_SIZE);
      lines.forEach((line, i) => {
        let x = data.cell.x + CELL_PADDING + line.x;
        const lineY = data.cell.y + CELL_PADDING + i * lineHeight;
        for (const run of line.runs) {
          doc.setFont('helvetica', run.style);
          doc.setTextColor(...(run.style === 'italic' ? MUTED : run.style === 'bold' ? INK : BODY));
          doc.text(run.text.trimEnd(), x, lineY, { baseline: 'top' });
          x += doc.getTextWidth(run.text);
        }
      });
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, pageWidth, doc.internal.pageSize.getHeight());
  }

  doc.save(`piano-alimentare-${input.userName}.pdf`);
}

export type TrainingPlanPdfRow = {
  weekday: string;
  dayTitle: string;
  name: string;
  sets: number | null;
  reps: string | null;
  rest: string | null;
  tempo: string | null;
  carico: string | null;
};

export type TrainingPlanPdfInput = {
  userName: string;
  goalNote: string;
  totalMonths: number;
  monthIndex: number;
  monthTitle: string;
  monthFocus: string;
  rows: TrainingPlanPdfRow[];
};

const TEMPO_PHASE_LABELS = ['negativa', 'isometria', 'spinta'];

/** "3-0-1" -> "3-0-1 (3s negativa, 0s isometria, 1s spinta)" — same cadence
 * notation shown in the app's exercise cards. */
function describeTempo(tempo: string): string {
  const parts = tempo.split('-');
  if (parts.length !== 3) return tempo;
  const detail = parts.map((seconds, i) => `${seconds}s ${TEMPO_PHASE_LABELS[i]}`).join(', ');
  return `${tempo} (${detail})`;
}

export async function exportTrainingPlanPdf(input: TrainingPlanPdfInput) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = drawLetterhead(doc, pageWidth);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(`Piano di allenamento di ${input.userName}`, MARGIN, y);
  y += 20;

  const contentWidth = pageWidth - MARGIN * 2;
  y = drawInfoLine(doc, 'Obiettivo', input.goalNote, MARGIN, y, contentWidth);
  y = drawInfoLine(doc, 'Durata piano', `${input.totalMonths} mesi`, MARGIN, y, contentWidth);
  y += 10;

  y = drawMonthBlock(doc, pageWidth, input.monthTitle, input.monthFocus, y);

  // One heading row per training day, with that day's exercises under it.
  let lastDay = '';
  const body = input.rows.flatMap((row) => {
    const dayKey = `${row.weekday}|${row.dayTitle}`;
    const heading =
      dayKey !== lastDay
        ? [[{ content: `${row.weekday} · ${row.dayTitle}`, colSpan: 6, styles: { fontStyle: 'bold' as const, fillColor: [255, 248, 245] as [number, number, number], textColor: INK } }]]
        : [];
    lastDay = dayKey;
    return [
      ...heading,
      [
        { content: `• ${row.name}`, styles: { fontStyle: 'bold' as const, textColor: INK } },
        row.sets != null ? String(row.sets) : '—',
        row.reps ?? '—',
        row.rest ?? '—',
        row.tempo ? describeTempo(row.tempo) : '—',
        row.carico ?? '—',
      ],
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Esercizio', 'Serie', 'Rip.', 'Recupero', 'Descrizione', 'Carico']],
    body,
    rowPageBreak: 'avoid',
    styles: { fontSize: 8, cellPadding: 6, textColor: BODY },
    headStyles: { fillColor: ORANGE, textColor: 255 },
    alternateRowStyles: { fillColor: [247, 247, 248] },
    columnStyles: { 0: { cellWidth: 130, cellPadding: { top: 6, bottom: 6, left: 14, right: 6 } }, 4: { cellWidth: 140 } },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, pageWidth, doc.internal.pageSize.getHeight());
  }

  doc.save(`piano-allenamento-${input.userName}.pdf`);
}
