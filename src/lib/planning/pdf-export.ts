import * as Print from 'expo-print';

import { PDF_LOGO_DATA_URI } from './pdf-logo';
import type { DietDayPlan, PlanMealItem } from './types';

// Native only — expo-print's `html` param works correctly here. The web
// build resolves to pdf-export.web.ts instead (a real client-side PDF via
// jsPDF), since expo-print's web shim ignores `html` entirely and just
// calls window.print() on the live app.

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** "Petto di pollo (150g)" — or "Uova (2 uova)" for count-based foods, see
 * food-quantity.ts — as a bullet with the food name in bold; when the plan
 * offers same-role swaps, a nested bullet "in alternativa: Tonno (150g), …"
 * follows it, indented. */
function formatItemHtml(item: PlanMealItem): string {
  const base = `<strong>${escapeHtml(item.name)}</strong> (${escapeHtml(item.quantityLabel)})`;
  if (!item.substitutes?.length) return `<li>${base}</li>`;
  const subs = item.substitutes.map((s) => `${escapeHtml(s.name)} (${escapeHtml(s.quantityLabel)})`).join(', ');
  return `<li>${base}<ul><li class="alt">in alternativa: ${subs}</li></ul></li>`;
}

/**
 * Print stylesheet for the exported PDF. The colours below are deliberately
 * NOT theme tokens and deliberately do not follow the app's light/dark
 * setting: this is ink on paper (or on a white PDF page), so it is always
 * dark text on a light sheet no matter how the phone is set.
 */
const BRAND_STYLE = `
  .brand { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .brand-logo { height: 28px; }
  .brand-tagline { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
`;

const BRAND_HTML = `
  <div class="brand">
    <img class="brand-logo" src="${PDF_LOGO_DATA_URI}" alt="FitLab" />
    <span class="brand-tagline">Build your best</span>
  </div>
`;

// Shared by both single-month plan exports (diet and training) — a single
// month's worth of content on one page, with day-heading rows spanning the
// full table width so the day name appears once per day, not once per row.
const PLAN_PDF_STYLE = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #16171b; padding: 28px; }
  ${BRAND_STYLE}
  h1 { font-size: 22px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 0 0 4px; }
  .phase-note { font-size: 12px; color: #333; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  td.day { font-weight: 700; background: #fff8f5; }
  .info { margin: 0 0 4px; font-size: 12px; }
  .info strong, .macros strong { color: #16171b; }
  .macros-title { font-size: 12px; font-weight: 700; margin: 8px 0 2px; }
  ul { margin: 0; padding-left: 14px; font-size: 11px; }
  ul.macros { font-size: 12px; margin-bottom: 16px; }
  ul ul { margin-top: 2px; padding-left: 14px; }
  li { margin: 0 0 2px; }
  li::marker { color: #FF7A00; }
  li.alt { font-style: italic; color: #666; list-style-type: '– '; }
  td.time { font-weight: 700; }
  td.total { font-weight: 700; white-space: nowrap; }
  .footer { margin-top: 20px; font-size: 10px; color: #999; }
`;

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
 * each day's name appearing once as its own heading row above that day's
 * meals rather than repeated on every row. */
export async function exportDietPlanPdf(input: DietPlanPdfInput) {
  const rows = input.weeklySplit
    .map((day) => {
      const dayHeading = `<tr><td class="day" colspan="3">${escapeHtml(day.weekday)}</td></tr>`;
      const mealRows = day.meals
        .map(
          (meal) => `
        <tr>
          <td class="time">${escapeHtml(meal.time)}<br/>${escapeHtml(meal.label)}</td>
          <td>${meal.isFreeMeal ? '<em>Pasto libero — scegli tu, senza eccessi</em>' : `<ul>${meal.items.map(formatItemHtml).join('')}</ul>`}</td>
          <td class="total">${meal.totalKcal} kcal</td>
        </tr>`
        )
        .join('');
      return dayHeading + mealRows;
    })
    .join('');

  const title = `Piano alimentare di ${input.userName}`;
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${PLAN_PDF_STYLE}</style>
</head>
<body>
  ${BRAND_HTML}
  <h1>${escapeHtml(title)}</h1>
  <p class="info"><strong>Obiettivo:</strong> ${escapeHtml(input.goalNote)}</p>
  <p class="info"><strong>Durata piano:</strong> ${input.totalMonths} mesi</p>
  <h2>${escapeHtml(input.monthTitle)}</h2>
  <p class="phase-note">${escapeHtml(input.monthFocus)}</p>
  <div class="macros-title">Target giornalieri</div>
  <ul class="macros">
    <li><strong>Calorie:</strong> ${input.calorieTarget} kcal/giorno</li>
    <li><strong>Proteine:</strong> ${input.macroTargetsG.protein} g</li>
    <li><strong>Carboidrati:</strong> ${input.macroTargetsG.carbs} g</li>
    <li><strong>Grassi:</strong> ${input.macroTargetsG.fats} g</li>
  </ul>
  <table>
    <thead><tr><th>Pasto</th><th>Alimenti</th><th>Totale</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Generato da FITLAB. Il piano si aggiorna nel tempo in base ai tuoi progressi reali.</div>
</body>
</html>`;

  await Print.printAsync({ html });
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

/** "3-0-1" -> "3-0-1 (3s negativa, 0s isometria, 1s spinta)" for the PDF's
 * description column — same cadence notation shown in the app's exercise cards. */
function describeTempo(tempo: string): string {
  const parts = tempo.split('-');
  if (parts.length !== 3) return tempo;
  const detail = parts.map((seconds, i) => `${seconds}s ${TEMPO_PHASE_LABELS[i]}`).join(', ');
  return `${tempo} (${detail})`;
}

export async function exportTrainingPlanPdf(input: TrainingPlanPdfInput) {
  let lastDay = '';
  const rows = input.rows
    .map((row) => {
      const dayHeading =
        row.weekday !== lastDay
          ? `<tr><td class="day" colspan="6">${escapeHtml(row.weekday)} · ${escapeHtml(row.dayTitle)}</td></tr>`
          : '';
      lastDay = row.weekday;
      return `${dayHeading}
        <tr>
          <td><strong>${escapeHtml(row.name)}</strong></td>
          <td>${row.sets ?? '—'}</td>
          <td>${row.reps ? escapeHtml(row.reps) : '—'}</td>
          <td>${row.rest ? escapeHtml(row.rest) : '—'}</td>
          <td>${row.tempo ? escapeHtml(describeTempo(row.tempo)) : '—'}</td>
          <td>${row.carico ? escapeHtml(row.carico) : '—'}</td>
        </tr>`;
    })
    .join('');

  const title = `Piano di allenamento di ${input.userName}`;
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${PLAN_PDF_STYLE}</style>
</head>
<body>
  ${BRAND_HTML}
  <h1>${escapeHtml(title)}</h1>
  <p class="info"><strong>Obiettivo:</strong> ${escapeHtml(input.goalNote)}</p>
  <p class="info"><strong>Durata piano:</strong> ${input.totalMonths} mesi</p>
  <h2>${escapeHtml(input.monthTitle)}</h2>
  <p class="phase-note">${escapeHtml(input.monthFocus)}</p>
  <table>
    <thead><tr><th>Esercizio</th><th>Serie</th><th>Ripetizioni</th><th>Recupero</th><th>Descrizione</th><th>Carico</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Generato da FITLAB. Il piano si aggiorna nel tempo in base ai tuoi progressi reali.</div>
</body>
</html>`;

  await Print.printAsync({ html });
}
