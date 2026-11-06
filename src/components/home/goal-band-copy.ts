import { type GoalBand, type GoalBandState } from '@/domain/calorie-balance';
import { formatKcal, formatSignedKcal } from '@/lib/format-kcal';

// ─── Copy ───────────────────────────────────────────────────────────────────
// The wording of each state. It only describes the gap from the plan; it never
// tells the person to eat less or train more.

export type GoalBandCopy = {
  /** Short chip on the gauge: the one place the state is named. */
  badge: string;
  /** One sentence under the bar. */
  message: string;
  /** What the gap mostly depends on (intake or burned), when there is one. */
  cause: string | null;
  tone: 'good' | 'warn' | 'neutral';
};

const BASE: Record<Exclude<GoalBandState, 'missing'>, { badge: string; message: string; tone: 'good' | 'warn' }> = {
  reached: { badge: 'In range', message: 'Sei nel range previsto, continua così!', tone: 'good' },
  surplus: { badge: 'Surplus eccessivo', message: 'Hai assunto più calorie rispetto al tuo obiettivo', tone: 'warn' },
  deficit: { badge: 'Deficit eccessivo', message: 'Il deficit calorico è superiore al target previsto', tone: 'warn' },
  deficitShort: { badge: 'Deficit insufficiente', message: 'Sei ancora lontano dal deficit calorico desiderato', tone: 'warn' },
  surplusShort: { badge: 'Surplus insufficiente', message: 'Sei ancora lontano dal surplus calorico desiderato', tone: 'warn' },
};

export function goalBandCopy(band: GoalBand, { hasMeals, future }: { hasMeals: boolean; future: boolean }): GoalBandCopy {
  if (future) return { badge: 'Nessun dato', message: 'Giorno non ancora iniziato.', cause: null, tone: 'neutral' };
  if (band.state === 'missing') {
    return hasMeals
      ? { badge: 'Dati insufficienti', message: 'Mancano le calorie bruciate per leggere il bilancio.', cause: null, tone: 'neutral' }
      : { badge: 'Nessun pasto', message: 'Registra un pasto per vedere il bilancio rispetto al tuo obiettivo.', cause: null, tone: 'neutral' };
  }
  return { ...BASE[band.state], cause: causeText(band) };
}

function causeText(band: GoalBand): string | null {
  const over = band.deltaKcal > 0;
  const e = band.eatenVsPlanKcal;
  const b = band.burnedVsPlanKcal;
  switch (band.cause) {
    case 'eaten':
      return `Soprattutto per le assunte: ${formatKcal(e)} kcal ${over ? 'in più' : 'in meno'} del piano.`;
    case 'burned':
      return `Soprattutto per le bruciate: ${formatKcal(b)} kcal ${over ? 'in meno' : 'in più'} del piano.`;
    case 'both':
      return `Rispetto al piano: assunte ${formatSignedKcal(e)}, bruciate ${formatSignedKcal(b)} kcal.`;
    default:
      return null;
  }
}
