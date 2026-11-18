import { buildUserContext, type Answers, type UserContext } from '@/domain/user-context';

import { WEEKDAY_PATTERN } from './exercise-library';
import { weekKinds } from './training/running';
import type { PlanConflict } from './types';

export type TrainingSchedule = {
  /** Weekday indices (0=Lun, matching WEEKDAY_LABELS/mondayIndex) assigned a gym session. */
  gymSlots: number[];
  /** Weekday indices assigned a running session. */
  runSlots: number[];
  /** 7-entry, true for any day in gymSlots or runSlots. */
  isTrainingDay: boolean[];
  /** Set when the requested sessions did not fit the available days: what was decided and why. */
  conflict: string | null;
  /** Engine v5: easy runs done on the same day as a strength session (two moments of the day). */
  doubles: number;
  /** Engine v5: structured conflicts (requests vs availability), with decision and alternatives. */
  conflicts: PlanConflict[];
};

/**
 * Single source of truth for "which weekdays are training days, and which
 * of those are gym vs running".
 *
 * Rules: gym/running frequency come from the questionnaire (less than weekly
 * counts as one session a week); the total never exceeds the days the person
 * can train; a week always keeps at least one rest day. When gym + running do
 * not fit, the activity the person said comes first (answer `trainingPriority`)
 * keeps its sessions; without an answer they share the days in proportion and
 * the plan says so, so the choice is never hidden.
 */
export function resolveSchedule(ctx: Pick<UserContext, 'training'>, override?: { availableDays?: number }): TrainingSchedule {
  const isTrainingDay: boolean[] = new Array(7).fill(false);
  const t = ctx.training;
  if (!t || (!t.gym && !t.running)) return { gymSlots: [], runSlots: [], isTrainingDay, conflict: null, doubles: 0, conflicts: [] };

  // A check-in can change the days the person has: with only gym, the sessions follow the new days.
  const wantedGym = t.gym ? Math.max(override?.availableDays != null && !t.running ? override.availableDays : t.gym.daysPerWeek, 1) : 0;
  const wantedRun = t.running ? Math.max(t.running.daysPerWeek, 1) : 0;
  let gymDays = wantedGym;
  let runDays = wantedRun;
  const available = Math.max(1, Math.min(override?.availableDays ?? t.availableDays, 6));
  const wanted = gymDays + runDays;
  let conflict: string | null = null;
  let doubles = 0;
  const conflicts: PlanConflict[] = [];
  if (wanted > available) {
    if (gymDays > 0 && runDays > 0) {
      // 1) can the extra sessions be done on the same day as another one? Only an EASY run with a strength
      //    session, never two hard sessions; only if the person said they have time for two moments in a day.
      const needed = wanted - available;
      const easy = weekKinds(t.running!.focus, wantedRun).filter((k) => k === 'easy').length;
      const doublesPossible = available >= 2 && easy >= needed && needed <= gymDays;
      const alternatives = [
        ...(doublesPossible ? [`Doppie sedute: ${needed === 1 ? 'una corsa facile' : `${needed} corse facili`} nello stesso giorno di una seduta di forza (in due momenti, almeno 6 ore di distanza): tutte le ${wanted} sedute restano.`] : []),
        `Precedenza alla corsa: ${Math.min(wantedRun, available - 1)} corse e ${available - Math.min(wantedRun, available - 1)} sedute di forza.`,
        `Precedenza alla palestra: ${Math.min(wantedGym, available - 1)} sedute di forza e ${available - Math.min(wantedGym, available - 1) === 1 ? '1 corsa' : `${available - Math.min(wantedGym, available - 1)} corse`}.`,
      ];
      if (doublesPossible && t.doubleSessions === true) {
        doubles = needed;
        conflicts.push({
          id: 'sessions-vs-days',
          level: 2,
          title: `${wanted} allenamenti in ${available} giorni`,
          description: `Hai chiesto ${wantedGym} sedute di forza e ${wantedRun} corse ma hai ${available} giorni. Hai indicato che puoi allenarti due volte nello stesso giorno.`,
          alternatives,
          decision: `${needed === 1 ? 'Una corsa facile' : `${needed} corse facili`} nello stesso giorno di una seduta di forza: nessuna seduta tolta. Le corse impegnative restano in giorni separati.`,
          needsConfirmation: false,
        });
        conflict = conflicts[0].decision;
      } else {
        if (available < 2) {
          if (t.priority === 'running') {
            runDays = 1;
            gymDays = 0;
          } else {
            runDays = 0;
            gymDays = 1;
          }
        } else if (t.priority === 'gym') {
          gymDays = Math.min(gymDays, available - 1);
          runDays = available - gymDays;
        } else if (t.priority === 'running') {
          runDays = Math.min(runDays, available - 1);
          gymDays = available - runDays;
        } else {
          gymDays = Math.max(1, Math.min(gymDays, Math.round((gymDays / wanted) * available)));
          runDays = Math.max(1, available - gymDays);
          if (gymDays + runDays > available) gymDays = available - runDays;
        }
        const decided = t.priority === 'gym' || t.priority === 'running' || t.priority === 'balanced';
        const why = t.doubleSessions === false ? 'Hai indicato che non puoi fare due attività nello stesso giorno.' : !doublesPossible ? 'Abbinare una corsa facile a una seduta di forza non basta a far stare tutte le sedute.' : 'Non sappiamo ancora se puoi fare due attività nello stesso giorno.';
        const who = t.priority === 'gym' ? 'la palestra ha la precedenza, come hai indicato' : t.priority === 'running' ? 'la corsa ha la precedenza, come hai indicato' : t.priority === 'balanced' ? 'dividi i giorni in proporzione, come hai indicato' : 'scelta provvisoria in proporzione, da confermare';
        conflicts.push({
          id: 'sessions-vs-days',
          level: 2,
          title: `${wanted} allenamenti in ${available} giorni`,
          description: `Hai chiesto ${wantedGym} sedute di forza e ${wantedRun} corse ma hai ${available} giorni. ${why}`,
          alternatives,
          decision: `${gymDays === 1 ? '1 seduta' : `${gymDays} sedute`} di forza e ${runDays === 1 ? '1 corsa' : `${runDays} corse`}: ${who}. ${wanted - gymDays - runDays === 1 ? 'Una seduta richiesta non entra' : `${wanted - gymDays - runDays} sedute richieste non entrano`} nella settimana.`,
          needsConfirmation: !decided,
        });
        conflict = `Hai chiesto ${wantedGym} sedute di palestra e ${wantedRun} di corsa ma hai ${available} giorni: ${who} (${gymDays} palestra, ${runDays} corsa).${!decided ? ' Scegli nel profilo quale attività ha la precedenza o se puoi fare due sedute nello stesso giorno.' : ''}`;
      }
    } else {
      gymDays = Math.min(gymDays, available);
      runDays = Math.min(runDays, available);
      if (wanted > available) {
        conflict = `Hai chiesto ${wanted} sedute ma hai ${available} giorni disponibili: la scheda ne prevede ${gymDays + runDays}.`;
        conflicts.push({ id: 'sessions-vs-days', level: 2, title: `${wanted} sedute in ${available} giorni`, description: conflict, alternatives: [`${available} sedute a settimana`, 'Aumentare i giorni disponibili nel profilo'], decision: `${gymDays + runDays} sedute, una per giorno disponibile.`, needsConfirmation: false });
      }
    }
  }
  gymDays = Math.min(gymDays, 6);
  runDays = Math.min(runDays, 6 - gymDays);

  // runs done on a strength day take no day of their own
  const combined = Math.max(gymDays + runDays - doubles, 1);
  const dayIndices = WEEKDAY_PATTERN[combined] ?? WEEKDAY_PATTERN[3];
  const gymSlots = dayIndices.slice(0, gymDays);
  const runSlots = dayIndices.slice(gymDays, gymDays + runDays - doubles);
  for (const dayIdx of [...gymSlots, ...runSlots]) isTrainingDay[dayIdx] = true;
  return { gymSlots, runSlots, isTrainingDay, conflict, doubles, conflicts };
}

/** Same as resolveSchedule, from raw questionnaire answers. */
export function resolveTrainingSchedule(answers: Answers): TrainingSchedule {
  return resolveSchedule(buildUserContext(answers));
}

/**
 * Places the week's gym sessions and runs. Strength and running are planned as ONE week:
 *  - two hard strength sessions are not put on consecutive days;
 *  - a leg session is not the day before a hard run (intervals, tempo, long run), and a hard run is
 *    not the day before a leg session (the first matters more: it spoils the quality session);
 *  - intervals/tempo and the long run are not back to back, nor are two hard runs;
 *  - the week wraps (Sunday is followed by Monday).
 * With running in the week the training days themselves are chosen (any weekday set that keeps a
 * rest day), because a fixed weekday pattern can force consecutive hard days; with gym only the
 * usual pattern is kept. Small exhaustive search (≤ 7 days). The cost of the chosen layout is
 * returned, with what could not be avoided.
 */
export function arrangeWeek(
  days: number[],
  gym: { legDay: boolean; load?: Record<string, number> }[],
  runs: { hard: boolean; kind?: string }[]
): { gymAt: number[]; runAt: number[]; compromises: string[] } {
  const n = gym.length + runs.length;
  if (n === 0) return { gymAt: [], runAt: [], compromises: [] };
  if (runs.length === 0) {
    // strength only: keep the usual days, but order the sessions so that two leg sessions are not back to back
    const slots = days.slice(0, n);
    const perms = (arr: number[]): number[][] => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((r) => [x, ...r])));
    let bestG: { cost: number; order: number[] } | null = null;
    for (const order of n <= 6 ? perms([...Array(n).keys()]) : [[...Array(n).keys()]]) {
      let cost = 0;
      for (let k = 0; k < n; k++) {
        const j = (k + 1) % n;
        if (!(n > 1 && (slots[j] - slots[k] + 7) % 7 === 1)) continue;
        const a = gym[order[k]];
        const b = gym[order[j]];
        if (a.legDay && b.legDay) cost += 2.5;
        // the same group trained hard (≥4 direct sets) on consecutive days, in different sessions
        for (const g of Object.keys(a.load ?? {})) if ((a.load![g] ?? 0) >= 4 && (b.load?.[g] ?? 0) >= 4) cost += 1;
      }
      // prefer the template's own order on ties (stable, recognisable week)
      cost += order.reduce((a, x, k) => a + (x === k ? 0 : 0.01), 0);
      if (!bestG || cost < bestG.cost - 1e-9) bestG = { cost, order };
    }
    const gymAt = new Array<number>(n);
    bestG!.order.forEach((sessionIdx, k) => (gymAt[sessionIdx] = slots[k]));
    const comp: string[] = [];
    if (bestG!.cost >= 2.5) comp.push('due sedute per le gambe consecutive');
    if (bestG!.cost % 2.5 >= 1 - 1e-6) comp.push('stimoli sullo stesso gruppo in giorni consecutivi');
    return { gymAt, runAt: [], compromises: comp };
  }
  const daySets: number[][] = [];
  if (runs.length > 0 && gym.length > 0 && n < 7) {
    const rec = (start: number, acc: number[]) => {
      if (acc.length === n) return void daySets.push(acc);
      for (let d = start; d < 7; d++) rec(d + 1, [...acc, d]);
    };
    rec(0, []);
  } else daySets.push(days.slice(0, n));
  const choose = (start: number, k: number, acc: number[]): number[][] => {
    if (acc.length === k) return [acc];
    const out: number[][] = [];
    for (let i = start; i < n; i++) out.push(...choose(i + 1, k, [...acc, i]));
    return out;
  };
  const perms = (arr: number[]): number[][] => (arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map((r) => [x, ...r])));
  const runOrders = perms([...Array(runs.length).keys()]);
  const given = new Set(days);
  let best: { cost: number; gymAt: number[]; runAt: number[]; compromises: string[] } | null = null;
  for (const slots of daySets) {
    for (const gymIdx of choose(0, gym.length, [])) {
      const runIdx = [...Array(n).keys()].filter((i) => !gymIdx.includes(i));
      for (const order of runOrders) {
        type K = { t: 'gym'; leg: boolean } | { t: 'run'; hard: boolean; quality: boolean; long: boolean };
        const kind: K[] = new Array(n);
        gymIdx.forEach((slot, i) => (kind[slot] = { t: 'gym', leg: gym[i].legDay }));
        runIdx.forEach((slot, i) => {
          const r = runs[order[i]];
          kind[slot] = { t: 'run', hard: r.hard, quality: r.kind === 'intervals' || r.kind === 'tempo', long: r.kind === 'long' };
        });
        let cost = 0;
        const why: string[] = [];
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          if (n > 1 && (slots[j] - slots[i] + 7) % 7 !== 1) continue;
          if (n === 1) continue;
          const a = kind[i];
          const b = kind[j];
          if (a.t === 'gym' && b.t === 'gym') {
            cost += 2;
            why.push('due sedute di forza consecutive');
          }
          if (a.t === 'gym' && a.leg && b.t === 'run' && b.hard) {
            cost += 3;
            why.push('una seduta con le gambe il giorno prima di una corsa impegnativa');
          }
          if (a.t === 'run' && a.hard && b.t === 'gym' && b.leg) {
            cost += 1.5;
            why.push('una corsa impegnativa il giorno prima di una seduta con le gambe');
          }
          if (a.t === 'run' && b.t === 'run' && a.hard && b.hard) {
            cost += (a.quality && b.long) || (a.long && b.quality) ? 2.5 : 2;
            why.push('due corse impegnative consecutive');
          }
        }
        cost += slots.filter((d) => !given.has(d)).length * 0.05 + slots.reduce((sum, x) => sum + x, 0) * 0.001;
        if (!best || cost < best.cost - 1e-9)
          best = { cost, gymAt: gymIdx.map((i) => slots[i]), runAt: order.map((_, k) => slots[runIdx[order.indexOf(k)]]), compromises: [...new Set(why)] };
      }
    }
  }
  return best ?? { gymAt: [], runAt: [], compromises: [] };
}

/**
 * A session was missed: where (if anywhere) to make it up this week.
 * Only ONE missed session is recovered, on the next free day that is not the
 * day before another session of the same type; anything else is skipped rather
 * than piling up sessions. Returns the weekday index to move it to, or null.
 */
export function rescheduleMissed(week: { type: string; title: string }[], missedIdx: number, todayIdx: number, alreadyRecovered: boolean): number | null {
  if (alreadyRecovered) return null;
  const missed = week[missedIdx];
  if (!missed || missed.type === 'rest') return null;
  for (let d = Math.max(todayIdx, missedIdx + 1); d < 7; d++) {
    if (week[d].type !== 'rest') continue;
    const next = week[d + 1];
    const prev = week[d - 1];
    const sameNext = next && next.type === missed.type && next.title === missed.title;
    const samePrev = prev && prev.type === missed.type && prev.title === missed.title && d - 1 !== missedIdx;
    if (sameNext || samePrev) continue;
    return d;
  }
  return null;
}
