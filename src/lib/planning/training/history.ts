/**
 * Month-to-month traceability (engine v5): how each muscle group's weekly volume changed and why,
 * and which exercises changed and why. Built only from the two months' prescriptions and the
 * decisions the planner knows it took; a change with no known cause is reported as such.
 */
import type { TrainingMonthPlan } from '../types';
import { CATALOG_BY_ID } from './catalog';

export type MonthContext = {
  block: string;
  prevBlock: string | null;
  gymSessions: number;
  prevGymSessions: number;
  sessionMinutes: number;
  prevSessionMinutes: number;
  checkinVolume: number | null;
  checkinFromThisMonth: boolean;
  splitChanged: boolean;
  frozenGroups: Set<string>;
  newlyFrozen: Set<string>;
  fatigueTrim: boolean;
  timeCapped: boolean;
  deloadWeek: boolean;
  rotationMonth: boolean;
  avoidAreas: Set<string>;
  replaceIds: Set<string>;
};

const workouts = (m: TrainingMonthPlan) => m.weeklySplit.filter((d) => d.type === 'workout');

export function volumeChanges(prev: TrainingMonthPlan | undefined, cur: TrainingMonthPlan, c: MonthContext): NonNullable<TrainingMonthPlan['volumeChanges']> {
  if (!prev?.weeklyVolume || !cur.weeklyVolume) return [];
  return cur.weeklyVolume
    .filter((v) => v.target > 0 || v.direct > 0)
    .map((v) => {
      const p = prev.weeklyVolume!.find((x) => x.group === v.group);
      const previous = p?.fractional ?? 0;
      const change = previous > 0 ? (v.fractional - previous) / previous : v.fractional > 0 ? 1 : 0;
      const reasons: string[] = [];
      let temporary = false;
      if (c.newlyFrozen.has(v.group)) reasons.push('gruppo sospeso per dolore');
      if (c.gymSessions !== c.prevGymSessions) reasons.push(`sedute di forza da ${c.prevGymSessions} a ${c.gymSessions}`);
      if (c.sessionMinutes !== c.prevSessionMinutes) reasons.push(`durata delle sedute da ${c.prevSessionMinutes} a ${c.sessionMinutes} minuti`);
      if (c.splitChanged) reasons.push('struttura settimanale cambiata');
      if (c.checkinFromThisMonth && c.checkinVolume != null && c.checkinVolume !== 1) {
        reasons.push(`check-in: volume ×${c.checkinVolume.toFixed(2)}`);
        if (c.checkinVolume < 1) temporary = true;
      }
      if (c.prevBlock && c.block !== c.prevBlock) {
        reasons.push(`blocco da ${c.prevBlock} a ${c.block}`);
        if (c.block === 'consolidamento') temporary = true;
      } else if (c.block === 'accumulo' && c.prevBlock === 'accumulo' && change > 0) reasons.push('accumulo: volume in leggera crescita');
      if (c.fatigueTrim) reasons.push('ridotto per la fatica stimata');
      if (c.timeCapped && change < 0) reasons.push('limite di tempo');
      const significant = Math.abs(change) >= 0.15 && Math.abs(v.fractional - previous) >= 1.5;
      const reason = reasons.length ? reasons.join('; ') : significant ? 'riequilibrio tra le sedute (nessuna decisione esplicita)' : 'invariato';
      return {
        group: v.group,
        label: v.label,
        previous,
        current: v.fractional,
        changePct: Math.round(change * 100),
        direct: v.direct,
        indirect: v.indirect,
        frequency: v.frequency,
        deload: c.deloadWeek,
        temporary,
        reason,
      };
    });
}

export function exerciseChanges(prev: TrainingMonthPlan | undefined, cur: TrainingMonthPlan, c: MonthContext): NonNullable<TrainingMonthPlan['exerciseChanges']> {
  if (!prev) return [];
  const out: NonNullable<TrainingMonthPlan['exerciseChanges']> = [];
  const pw = workouts(prev);
  const cw = workouts(cur);
  cw.forEach((d, i) => {
    const pd = pw.find((x) => x.title === d.title) ?? pw[i];
    if (!pd) return;
    const before = pd.exercises ?? [];
    const after = d.exercises ?? [];
    const removed = before.filter((x) => !after.some((y) => y.id === x.id));
    const added = after.filter((x) => !before.some((y) => y.id === x.id));
    const used = new Set<string>();
    for (const a of added) {
      const group = CATALOG_BY_ID.get(a.id)?.primary;
      const from = removed.find((r) => !used.has(r.id) && CATALOG_BY_ID.get(r.id)?.primary === group);
      if (from) used.add(from.id);
      out.push({ session: d.title, from: from?.name ?? null, to: a.name, role: a.role, reason: reasonFor(from?.id ?? null, a.id, a.role ?? '', c) });
    }
    for (const r of removed.filter((x) => !used.has(x.id))) out.push({ session: d.title, from: r.name, to: null, role: r.role, reason: reasonFor(r.id, null, r.role ?? '', c) });
  });
  return out;
}

function reasonFor(fromId: string | null, toId: string | null, role: string, c: MonthContext): string {
  const from = fromId ? CATALOG_BY_ID.get(fromId) : null;
  if (from && from.areas.some((a) => c.avoidAreas.has(a))) return 'dolore segnalato nella zona che l’esercizio carica';
  if (fromId && c.replaceIds.has(fromId)) return 'esercizio da sostituire (richiesta o non eseguibile)';
  if (c.splitChanged) return 'nuova struttura settimanale';
  if (c.gymSessions !== c.prevGymSessions || c.sessionMinutes !== c.prevSessionMinutes) return 'sedute diverse per numero o durata';
  if (c.rotationMonth && role !== 'main') return 'rotazione degli esercizi accessori a inizio ciclo (ogni 3 mesi)';
  if (c.fatigueTrim) return 'riduzione per la fatica stimata';
  if (c.checkinFromThisMonth && c.checkinVolume != null && c.checkinVolume !== 1) return 'volume cambiato al check-in';
  if (c.prevBlock && c.block !== c.prevBlock) return `cambio di blocco (${c.prevBlock} → ${c.block})`;
  void toId;
  return '';
}
