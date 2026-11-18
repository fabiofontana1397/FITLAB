/**
 * Version comparison of the training engine on the regression users, recomputed from the
 * exported datasets every time (never copied from an earlier run):
 *   before.json  — training-2
 *   v3.json      — training-3 (optional)
 *   v4.json      — training-4 (optional)
 *   data.json    — current engine
 * Every metric is derived from the months/days/exercises in the files, with the same formula
 * for every version (e.g. session minutes from sets and rests), so the numbers are comparable.
 *
 * Deloads are counted three ways (engine v5):
 *   planned     — deload weeks the plan schedules unconditionally;
 *   conditional — deload weeks to do "only if needed" (never counted as done);
 *   applied     — planned deload weeks whose prescriptions really lighten the week: fewer sets,
 *                 higher RIR with RPE = 10 − RIR, lower total volume, no intensification technique,
 *                 shorter runs when the week has runs. A flag alone never counts.
 *
 *   npx tsx scripts/agent-tests/training-compare.ts <dir>   → writes `compare` into <dir>/data.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { CATALOG_BY_ID, MUSCLE_SHORT } from '@/lib/planning/training/catalog';

type WeekRx = { week: number; sets: number; rir?: number; rpe?: number; technique?: { kind: string } | null; deload?: boolean };
type Ex = { id: string; name: string; sets: number; reps: string; restSec: number; rir?: number | null; kg: number | null; technique?: string | null; weeks?: WeekRx[] };
type Run = { minutes: number; weeks?: { week: number; minutes: number }[] };
type Day = { weekday: string; type: string; title: string; exercises?: Ex[]; run?: Run | null; extraRun?: Run | null };
type Finding = { level: string; groupKey?: string; code: string; message: string };
type Month = {
  monthIndex: number;
  days: Day[];
  mesocycle?: { weeks: { week: number; setsFactor: number; deload?: boolean; conditional?: boolean; label?: string }[] } | null;
  validation?: Finding[];
  fatigue?: { ratio: number; status: string } | null;
};
type User = { id: string; name: string; months: Month[] };
type Dataset = { engine: string; users: User[] };

export type VersionMetrics = {
  engine: string;
  split: string;
  sessions: string;
  weeklySets: number;
  exercisesPerWeek: number;
  distinctExercisesInPlan: number;
  avgSessionMinutes: number;
  groupSets: Record<string, number>;
  groupFrequency: Record<string, number>;
  schemes: number;
  mainLift: string;
  mainLiftKg: string;
  deloadPlanned: number;
  deloadConditional: number;
  deloadApplied: number;
  /** Kept for the earlier dashboards: same as deloadApplied / planned + conditional declared. */
  deloadEffective: number;
  deloadDeclared: number;
  warnings: number | null;
  uniqueProblems: number | null;
  fatigueRatio: number | null;
  doubleDays: number;
};

const workouts = (m: Month) => m.days.filter((d) => d.type === 'workout');

/** Is this deload week really lighter, in the prescriptions? */
export function deloadApplied(m: Month, week: number): { applied: boolean; checks: Record<string, boolean> } {
  const ex = workouts(m).flatMap((d) => d.exercises ?? []);
  const wk = (x: Ex) => x.weeks?.find((w) => w.week === week);
  const setsDown = ex.length > 0 && ex.every((x) => (wk(x)?.sets ?? x.sets) < x.sets || x.sets <= 1);
  const rirUp = ex.every((x) => x.rir == null || x.rir >= 4 || (wk(x)?.rir ?? -1) > x.rir);
  const rpeOk = ex.every((x) => wk(x)?.rir == null || wk(x)?.rpe === 10 - (wk(x)?.rir ?? 0));
  const total = ex.reduce((a, x) => a + x.sets, 0);
  const totalWeek = ex.reduce((a, x) => a + (wk(x)?.sets ?? x.sets), 0);
  const volumeDown = totalWeek < total;
  const noTechnique = ex.every((x) => !wk(x)?.technique || wk(x)!.technique!.kind === 'antagonistSuperset');
  const runs = m.days.flatMap((d) => [d.run, d.extraRun].filter((r): r is Run => !!r));
  const runsDown = runs.length === 0 || runs.every((r) => (r.weeks?.find((w) => w.week === week)?.minutes ?? r.minutes) < r.minutes);
  const checks = { setsDown, rirUp, rpeOk, volumeDown, noTechnique, runsDown };
  return { applied: Object.values(checks).every(Boolean), checks };
}

function metrics(engine: string, u: User): VersionMetrics {
  const m1 = u.months[0];
  const w = workouts(m1);
  const ex = w.flatMap((d) => d.exercises ?? []);
  const groupSets: Record<string, number> = {};
  const freq: Record<string, Set<number>> = {};
  w.forEach((d, i) => {
    for (const x of d.exercises ?? []) {
      const g = CATALOG_BY_ID.get(x.id)?.primary;
      const key = g ? MUSCLE_SHORT[g] : 'non classificato';
      groupSets[key] = (groupSets[key] ?? 0) + x.sets;
      (freq[key] ??= new Set()).add(i);
    }
  });
  const minutes = w.map((d) => 8 + (d.exercises ?? []).reduce((a, x) => a + 1.5 + x.sets * (0.75 + x.restSec / 60), 0));
  const main = ex.find((x) => x.kg != null);
  const lastKg = main ? u.months.map((m) => workouts(m).flatMap((d) => d.exercises ?? []).find((x) => x.id === main.id)?.kg).filter((x): x is number => x != null) : [];
  let planned = 0;
  let conditional = 0;
  let applied = 0;
  for (const m of u.months)
    for (const wk of m.mesocycle?.weeks ?? []) {
      const isDeload = wk.deload || wk.setsFactor < 1;
      if (!isDeload) continue;
      const cond = wk.conditional ?? /se serve/.test(wk.label ?? '');
      if (cond) conditional++;
      else {
        planned++;
        if (deloadApplied(m, wk.week).applied) applied++;
      }
    }
  const hasValidation = u.months.some((m) => m.validation);
  const findings = u.months.flatMap((m) => (m.validation ?? []).filter((f) => f.level === 'warning' || f.level === 'blocker' || f.level === 'review'));
  return {
    engine,
    split: [...new Set(w.map((d) => d.title.replace(/ [12AB]$/, '')))].join(' / '),
    sessions: m1.days.filter((d) => d.type !== 'rest').map((d) => `${d.weekday} ${d.title}${d.extraRun ? ' + corsa' : ''}`).join(', '),
    weeklySets: ex.reduce((a, x) => a + x.sets, 0),
    exercisesPerWeek: ex.length,
    distinctExercisesInPlan: new Set(u.months.flatMap((m) => workouts(m).flatMap((d) => (d.exercises ?? []).map((x) => x.id)))).size,
    avgSessionMinutes: w.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / w.length) : 0,
    groupSets,
    groupFrequency: Object.fromEntries(Object.entries(freq).map(([k, v]) => [k, v.size])),
    schemes: new Set(ex.map((x) => `${x.sets}×${x.reps}`)).size,
    mainLift: main?.name ?? '—',
    mainLiftKg: lastKg.length ? `${lastKg[0]} → ${lastKg[lastKg.length - 1]} kg` : '—',
    deloadPlanned: planned,
    deloadConditional: conditional,
    deloadApplied: applied,
    deloadEffective: applied,
    deloadDeclared: planned + conditional,
    warnings: hasValidation ? findings.length : null,
    uniqueProblems: hasValidation ? new Set(findings.map((f) => f.groupKey ?? `${f.code}:${f.message}`)).size : null,
    fatigueRatio: m1.fatigue?.ratio ?? null,
    doubleDays: m1.days.filter((d) => d.extraRun).length,
  };
}

export function compareVersions(before: Dataset, prev: Dataset | null, current: Dataset, older?: Dataset | null) {
  // versions in order: training-2 (before), training-3 (older, optional), training-4 (prev, optional), current
  const versions = [before, older ?? null, prev, current];
  const users = current.users.map((u) => {
    const pick = (d: Dataset | null) => {
      const x = d?.users.find((y) => y.id === u.id);
      return x ? metrics(d!.engine, x) : null;
    };
    const [v2, v3, v4, v5] = versions.map(pick);
    return { id: u.id, name: u.name, v2, v3, v4, v5: v5!, versions: [v2, v3, v4, v5] };
  });
  return {
    computedAt: new Date().toISOString(),
    sources: { before: before.engine, older: older?.engine ?? null, previous: prev?.engine ?? null, current: current.engine },
    metrics: ['split', 'sessions', 'weeklySets', 'exercisesPerWeek', 'distinctExercisesInPlan', 'avgSessionMinutes', 'groupSets', 'groupFrequency', 'schemes', 'mainLift', 'mainLiftKg', 'deloadPlanned', 'deloadConditional', 'deloadApplied', 'warnings', 'uniqueProblems', 'fatigueRatio', 'doubleDays'],
    users,
  };
}

if (require.main === module) {
  const dir = process.argv[2] ?? '.';
  const load = (f: string) => (existsSync(`${dir}/${f}`) ? JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) : null);
  const data = load('data.json');
  delete data.compare;
  data.compare = compareVersions(load('before.json'), load('v4.json'), data, load('v3.json'));
  writeFileSync(`${dir}/data.json`, JSON.stringify(data));
  for (const u of data.compare.users)
    console.log(`${u.id}: serie ${u.versions.map((v: VersionMetrics | null) => v?.weeklySets ?? '—').join(' → ')} · scarichi applicati/programmati/condizionali ${u.versions.map((v: VersionMetrics | null) => (v ? `${v.deloadApplied}/${v.deloadPlanned}/${v.deloadConditional}` : '—')).join(' → ')}`);
}
