/**
 * Fatigue management (engine v5): estimates the stress a planned week puts on the person, beyond
 * the number of sets. Every value is an estimate in "effective sets" (a working set of a
 * multi-joint exercise at RIR 2 ≈ 1), built only from what is prescribed:
 *
 *  - effort: a set close to failure costs more than one far from it (×1.24 at RIR 0 … ×0.76 at RIR 4);
 *    intensification techniques add to it (Helms et al. on RIR-based effort; Refalo et al. 2023 on
 *    proximity to failure and fatigue);
 *  - systemic cost: heavy lower-body compounds (squat, hinge, lunge) cost the most, other free-weight
 *    compounds more than machines, isolations and core the least;
 *  - local load per muscle group: direct sets plus indirect sets with their share, per day;
 *  - joint stress: sets of exercises that load knee, shoulder, lower back, hip, wrist;
 *  - running: minutes × intensity (easy < long < tempo < intervals), on the systemic total and on the legs;
 *  - close stimuli: the same group trained hard on consecutive days, across different sessions.
 *
 * Capacity is individual, never a universal set limit: it starts from the training level and is lowered
 * by age, an energy deficit, short sleep and poor recovery reported at the check-ins. The ratio
 * load / capacity gives the status; the planner trims volume only when the week is clearly excessive,
 * and always says so.
 */
import type { UserContext } from '@/domain/user-context';

import type { TrainingDayPlan } from '../types';
import { CATALOG_BY_ID, indirectShareOf, MUSCLE_SHORT, type MuscleGroup } from './catalog';
import type { Level } from './profile';

export type FatigueStatus = 'low' | 'ok' | 'high' | 'excessive';
export const FATIGUE_LABEL: Record<FatigueStatus, string> = { low: 'bassa', ok: 'adeguata', high: 'elevata', excessive: 'eccessiva' };

export type FatigueReport = {
  /** Weekly systemic load (effective sets, running included). */
  weekly: number;
  /** Personal weekly capacity (same unit). */
  capacity: number;
  ratio: number;
  status: FatigueStatus;
  /** Capacity factors applied (for the explanation). */
  capacityNotes: string[];
  days: { weekday: string; strength: number; running: number; total: number; legs: number }[];
  groups: { group: MuscleGroup; label: string; load: number; sessions: number; closeStimuli: string[] }[];
  joints: { area: string; load: number }[];
  runningShare: number;
  notes: string[];
};

const AREA_LABEL: Record<string, string> = { knee: 'ginocchio', shoulder: 'spalla', lowerBack: 'zona lombare', wrist: 'polso', hip: 'anca' };
const BASE_CAPACITY: Record<Level, number> = { beginner: 55, intermediate: 85, advanced: 115 };
const RUN_PER_10MIN: Record<string, number> = { easy: 0.8, long: 1.0, tempo: 1.8, intervals: 2.2 };
const LEGS: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];

export function effortWeight(rir: number | undefined): number {
  const r = rir ?? 2;
  return Math.max(0.7, Math.min(1.35, 1 + 0.12 * (2 - r)));
}

function systemicFactor(id: string, repsMax: number | undefined): number {
  const e = CATALOG_BY_ID.get(id);
  if (!e) return 1;
  let f = e.kind === 'core' ? 0.5 : e.kind === 'isolation' ? 0.6 : e.pattern === 'squat' || e.pattern === 'hinge' || e.pattern === 'lunge' ? 1.6 : e.loadType === 'barbell' ? 1.3 : 1.1;
  if (e.kind === 'compound' && repsMax != null && repsMax <= 6) f += 0.1;
  return f;
}

export function personalCapacity(level: Level, ctx: Pick<UserContext, 'age' | 'training'> & { sleepHours?: number | null; inDeficit?: boolean }, recovery?: ('good' | 'ok' | 'poor')[]): { capacity: number; notes: string[] } {
  let c = BASE_CAPACITY[level];
  const notes = [`livello ${level === 'beginner' ? 'principiante' : level === 'intermediate' ? 'intermedio' : 'avanzato'}: ${c}`];
  if (ctx.age >= 60) {
    c *= 0.75;
    notes.push('età ≥60: −25%');
  } else if (ctx.age >= 50) {
    c *= 0.85;
    notes.push('età ≥50: −15%');
  }
  if (ctx.inDeficit) {
    c *= 0.9;
    notes.push('deficit calorico: −10%');
  }
  if (ctx.sleepHours != null && ctx.sleepHours < 6) {
    c *= 0.85;
    notes.push('sonno sotto le 6 ore: −15%');
  } else if (ctx.sleepHours != null && ctx.sleepHours < 7) {
    c *= 0.93;
    notes.push('sonno 6-7 ore: −7%');
  }
  const last = recovery?.[recovery.length - 1];
  if (last === 'poor') {
    c *= 0.9;
    notes.push('recupero scarso all’ultimo check-in: −10%');
  }
  return { capacity: Math.round(c), notes };
}

type RunLike = { kind: string; minutes: number };

/** Fatigue of one planned week. `extraRuns` are runs done on the same day as a strength session. */
export function weekFatigue(week: TrainingDayPlan[], capacity: { capacity: number; notes: string[] }): FatigueReport {
  const days = week.map((d) => ({ weekday: d.weekday, strength: 0, running: 0, total: 0, legs: 0 }));
  const local = new Map<MuscleGroup, number[]>();
  const joints = new Map<string, number>();
  const add = (g: MuscleGroup, i: number, v: number) => {
    if (!local.has(g)) local.set(g, new Array(week.length).fill(0));
    local.get(g)![i] += v;
  };
  const runOf = (r: RunLike, i: number) => {
    const per10 = RUN_PER_10MIN[r.kind] ?? 1;
    const load = (r.minutes / 10) * per10;
    days[i].running += load;
    const legLoad = (r.minutes / 10) * (r.kind === 'easy' || r.kind === 'long' ? 0.3 : 0.45);
    for (const g of LEGS) add(g, i, g === 'glutes' ? legLoad * 0.7 : legLoad);
  };
  week.forEach((d, i) => {
    if (d.type === 'workout') {
      for (const x of d.exercises ?? []) {
        const e = CATALOG_BY_ID.get(x.id);
        const w = effortWeight(x.rir) + (x.technique && x.technique.kind !== 'antagonistSuperset' ? 0.15 : 0);
        days[i].strength += x.sets * w * systemicFactor(x.id, x.repsMax);
        if (!e) continue;
        add(e.primary, i, x.sets * w);
        for (const g of e.secondary) add(g, i, x.sets * w * indirectShareOf(e, g));
        for (const a of e.areas) joints.set(a, (joints.get(a) ?? 0) + x.sets * w);
      }
      if (d.extraRun) runOf(d.extraRun, i);
    } else if (d.type === 'cardio' && d.run) runOf(d.run, i);
  });
  for (const [g, arr] of local) arr.forEach((v, i) => LEGS.includes(g) && (days[i].legs += v));
  for (const d of days) d.total = d.strength + d.running;
  const weekly = days.reduce((a, d) => a + d.total, 0);
  const running = days.reduce((a, d) => a + d.running, 0);
  const ratio = weekly / Math.max(1, capacity.capacity);
  const status: FatigueStatus = ratio < 0.55 ? 'low' : ratio <= 1 ? 'ok' : ratio <= 1.15 ? 'high' : 'excessive';
  // close stimuli: the same group with a substantial local load on two consecutive days (the week wraps)
  const groups = [...local.entries()]
    .map(([group, arr]) => {
      const close: string[] = [];
      if (week.length === 7)
        for (let i = 0; i < 7; i++) {
          const j = (i + 1) % 7;
          if (arr[i] >= 4 && arr[j] >= 4) close.push(`${week[i].weekday}→${week[j].weekday}`);
        }
      return { group, label: MUSCLE_SHORT[group], load: Math.round(arr.reduce((a, b) => a + b, 0) * 10) / 10, sessions: arr.filter((v) => v >= 1).length, closeStimuli: close };
    })
    .filter((g) => g.load > 0)
    .sort((a, b) => b.load - a.load);
  const notes: string[] = [];
  const peak = days.reduce((a, d) => (d.total > a.total ? d : a), days[0]);
  if (peak && peak.total > capacity.capacity * 0.35) notes.push(`${peak.weekday}: giornata molto impegnativa (${Math.round(peak.total)} serie effettive, oltre un terzo della capacità settimanale).`);
  for (const g of groups) if (g.closeStimuli.length) notes.push(`${g.label}: stimoli impegnativi in giorni consecutivi (${g.closeStimuli.join(', ')}).`);
  return {
    weekly: Math.round(weekly * 10) / 10,
    capacity: capacity.capacity,
    ratio: Math.round(ratio * 100) / 100,
    status,
    capacityNotes: capacity.notes,
    days: days.map((d) => ({ ...d, strength: Math.round(d.strength * 10) / 10, running: Math.round(d.running * 10) / 10, total: Math.round(d.total * 10) / 10, legs: Math.round(d.legs * 10) / 10 })),
    groups,
    joints: [...joints.entries()].map(([a, v]) => ({ area: AREA_LABEL[a] ?? a, load: Math.round(v * 10) / 10 })).sort((a, b) => b.load - a.load),
    runningShare: weekly > 0 ? Math.round((running / weekly) * 100) / 100 : 0,
    notes,
  };
}
