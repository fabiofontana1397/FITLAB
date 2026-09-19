import * as Print from 'expo-print';

import type { DietDayPlan, PlanMealItem } from './types';

// Native only — expo-print's `html` param works correctly here. The web
// build resolves to pdf-export.web.ts instead (a real client-side PDF via
// jsPDF), since expo-print's web shim ignores `html` entirely and just
// calls window.print() on the live app.

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** "Petto di pollo (150g)" — or "Uova (2 uova)" for count-based foods, see
 * food-quantity.ts — plus, when the plan offers same-role swaps,
 * " — in alternativa: Tonno (150g), Uova (2 uova)" appended after it. */
function formatItem(item: PlanMealItem): string {
  const base = `${item.name} (${item.quantityLabel})`;
  if (!item.substitutes?.length) return base;
  const subs = item.substitutes.map((s) => `${s.name} (${s.quantityLabel})`).join(', ');
  return `${base} — in alternativa: ${subs}`;
}

const BRAND_STYLE = `
  .brand { display: flex; align-items: baseline; gap: 8px; margin-bottom: 14px; }
  .brand-mark { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #16171b; }
  .brand-mark .accent { color: #FF7A00; }
  .brand-tagline { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
`;

const BRAND_HTML = `
  <div class="brand">
    <span class="brand-mark">FIT<span class="accent">BRO</span></span>
    <span class="brand-tagline">Il tuo coach personale</span>
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
  .meta { font-size: 11px; color: #666; margin-bottom: 4px; }
  .goal { font-size: 12px; color: #333; margin-bottom: 18px; }
  h2 { font-size: 15px; margin: 0 0 4px; }
  .phase-note { font-size: 12px; color: #333; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  td.day { font-weight: 700; background: #fff8f5; }
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
          <td>${escapeHtml(meal.time)} · ${escapeHtml(meal.label)}</td>
          <td>${meal.items.map((i) => escapeHtml(formatItem(i))).join('<br/>')}</td>
          <td>${meal.totalKcal} kcal</td>
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
  <div class="meta">Durata piano totale: ${input.totalMonths} mesi</div>
  <div class="goal">${escapeHtml(input.goalNote)}</div>
  <h2>${escapeHtml(input.monthTitle)}</h2>
  <p class="phase-note">${escapeHtml(input.monthFocus)}</p>
  <p class="phase-note"><strong>${input.calorieTarget} kcal/giorno</strong> · Proteine ${input.macroTargetsG.protein}g · Carboidrati ${input.macroTargetsG.carbs}g · Grassi ${input.macroTargetsG.fats}g</p>
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
          <td>${escapeHtml(row.name)}</td>
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
  <div class="meta">Durata piano totale: ${input.totalMonths} mesi</div>
  <div class="goal">${escapeHtml(input.goalNote)}</div>
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
