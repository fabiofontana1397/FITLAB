/**
 * Version comparison of the training engine on the regression users, recomputed from the
 * exported datasets every time (never copied from an earlier run):
 *   before.json  — training-2
 *   v3.json      — training-3 (optional)
 *   data.json    — current engine
 * Every metric is derived from the months/days/exercises in the files, with the same formula
 * for every version (e.g. session minutes from sets and rests), so the numbers are comparable.
 *
 *   npx tsx scripts/agent-tests/training-compare.ts <dir>   → writes `compare` into <dir>/data.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { CATALOG_BY_ID, MUSCLE_SHORT } from '@/lib/planning/training/catalog';

type Ex = { id: string; name: string; sets: number; reps: string; restSec: number; kg: number | null; weeks?: { week: number; sets: number }[] };
type Day = { weekday: string; type: string; title: string; exercises?: Ex[] };
type Month = { monthIndex: number; days: Day[]; mesocycle?: { weeks: { week: number; setsFactor: number; deload?: boolean; conditional?: boolean }[] } | null };
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
  deloadDeclared: number;
  deloadEffective: number;
};

const workouts = (m: Month) => m.days.filter((d) => d.type === 'workout');

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
  let declared = 0;
  let effective = 0;
  for (const m of u.months) {
    for (const wk of m.mesocycle?.weeks ?? []) {
      if (!(wk.deload || wk.setsFactor < 1)) continue;
      declared++;
      const all = workouts(m).flatMap((d) => d.exercises ?? []);
      const sets = all.reduce((a, x) => a + (x.weeks?.find((y) => y.week === wk.week)?.sets ?? x.sets), 0);
      const ordinary = all.reduce((a, x) => a + x.sets, 0);
      if (sets < ordinary) effective++;
    }
  }
  return {
    engine,
    split: [...new Set(w.map((d) => d.title.replace(/ [12AB]$/, '')))].join(' / '),
    sessions: m1.days.filter((d) => d.type !== 'rest').map((d) => `${d.weekday} ${d.title}`).join(', '),
    weeklySets: ex.reduce((a, x) => a + x.sets, 0),
    exercisesPerWeek: ex.length,
    distinctExercisesInPlan: new Set(u.months.flatMap((m) => workouts(m).flatMap((d) => (d.exercises ?? []).map((x) => x.id)))).size,
    avgSessionMinutes: w.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / w.length) : 0,
    groupSets,
    groupFrequency: Object.fromEntries(Object.entries(freq).map(([k, v]) => [k, v.size])),
    schemes: new Set(ex.map((x) => `${x.sets}×${x.reps}`)).size,
    mainLift: main?.name ?? '—',
    mainLiftKg: lastKg.length ? `${lastKg[0]} → ${lastKg[lastKg.length - 1]} kg` : '—',
    deloadDeclared: declared,
    deloadEffective: effective,
  };
}

export function compareVersions(before: Dataset, prev: Dataset | null, current: Dataset) {
  const users = current.users.map((u) => {
    const b = before.users.find((x) => x.id === u.id);
    const p = prev?.users.find((x) => x.id === u.id);
    return { id: u.id, name: u.name, v2: b ? metrics(before.engine, b) : null, v3: p ? metrics(prev!.engine, p) : null, v4: metrics(current.engine, u) };
  });
  return {
    computedAt: new Date().toISOString(),
    sources: { before: before.engine, previous: prev?.engine ?? null, current: current.engine },
    metrics: ['split', 'sessions', 'weeklySets', 'exercisesPerWeek', 'distinctExercisesInPlan', 'avgSessionMinutes', 'groupSets', 'groupFrequency', 'schemes', 'mainLift', 'mainLiftKg', 'deloadDeclared', 'deloadEffective'],
    users,
  };
}

if (require.main === module) {
  const dir = process.argv[2] ?? '.';
  const load = (f: string) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const data = load('data.json');
  const prev = existsSync(`${dir}/v3.json`) ? load('v3.json') : null;
  delete data.compare;
  data.compare = compareVersions(load('before.json'), prev, data);
  writeFileSync(`${dir}/data.json`, JSON.stringify(data));
  for (const u of data.compare.users) console.log(`${u.id}: serie ${u.v2?.weeklySets ?? '—'} → ${u.v3?.weeklySets ?? '—'} → ${u.v4.weeklySets} · scarichi effettivi ${u.v3?.deloadEffective ?? '—'}/${u.v3?.deloadDeclared ?? '—'} → ${u.v4.deloadEffective}/${u.v4.deloadDeclared}`);
}
