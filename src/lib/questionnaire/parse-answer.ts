/**
 * Parses a questionnaire `number`-type answer, tolerating a comma decimal
 * separator ("76,5") the way quick-weight-sheet.tsx/quick-measurement-
 * sheet.tsx already do for Body tab entries. Without this, `Number("76,5")`
 * is `NaN`, and every call site historically did `Number(answers.x) ||
 * fallback` — since `NaN` is falsy, that silently produced the FALLBACK
 * value instead of the number the user actually typed (e.g. a redone
 * questionnaire with weight "76,5" landing on Home as the 80kg default).
 * An Italian keyboard's decimal-pad commonly types a comma, so this isn't
 * an edge case — every numeric onboarding question needs this, not just
 * weight.
 */
export function parseNumericAnswer(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const n = parseFloat(value.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
