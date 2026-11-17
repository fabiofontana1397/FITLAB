/**
 * Weekly volume per muscle group, in fractional sets (direct sets count 1,
 * sets where the group is a synergist count 0.5 — Pelland et al. 2024).
 *
 * Starting points (hypertrophy, intermediate): about 10–14 fractional sets per
 * week for the large groups, fewer for groups that already get plenty of
 * indirect work. The dose–response for hypertrophy has diminishing returns
 * (Schoenfeld, Ogborn & Krieger 2017; Pelland et al. 2024), so volume is scaled
 * by level and recovery capacity rather than pushed as high as possible:
 *   - beginners grow with less (×0.65), advanced lifters tolerate and often need more (×1.2);
 *   - strength: big lifts keep their volume, accessories are reduced;
 *   - energy deficit, age ≥55, health/endurance goals: lower;
 *   - the time the person actually has caps everything.
 */
import { CATALOG_BY_ID, PROGRAMMED_GROUPS, type MuscleGroup } from './catalog';
import type { Level, ProgramModel, ProgramProfile } from './profile';

/** Intermediate hypertrophy baseline, fractional sets per week. */
const BASE: Record<MuscleGroup, number> = {
  chest: 12,
  lats: 10,
  upperBack: 9,
  frontDelts: 0,
  sideDelts: 10,
  rearDelts: 7,
  quads: 12,
  hamstrings: 9,
  glutes: 9,
  adductors: 0,
  calves: 6,
  biceps: 8,
  triceps: 8,
  forearms: 0,
  abs: 6,
};

const LEVEL_FACTOR: Record<Level, number> = { beginner: 0.65, intermediate: 1, advanced: 1.2 };

/** Groups that carry the main lifts: strength programs keep their volume. */
const PRIME_MOVERS = new Set<MuscleGroup>(['chest', 'quads', 'hamstrings', 'glutes', 'lats', 'upperBack']);

function modelFactor(model: ProgramModel, group: MuscleGroup): number {
  switch (model) {
    case 'strength':
      return PRIME_MOVERS.has(group) ? 0.9 : 0.6;
    case 'fatLoss':
      return 0.85;
    case 'recomposition':
      return 0.9;
    case 'muscularEndurance':
      return 0.8;
    case 'health':
      return 0.6;
    case 'hybridEndurance':
      return group === 'quads' || group === 'hamstrings' || group === 'glutes' ? 0.5 : 0.55;
    default:
      return 1;
  }
}

export type VolumeTarget = { group: MuscleGroup; sets: number; min: number; max: number };

/** Weekly fractional-set target per programmed group, before the session time cap. */
export function weeklyTargets(p: ProgramProfile, extra?: { volumeFactor?: number; groupSets?: Partial<Record<MuscleGroup, number>> }): VolumeTarget[] {
  const age = p.isOlder ? 0.85 : 1;
  const deficit = p.inDeficit && p.model !== 'fatLoss' ? 0.9 : 1;
  return PROGRAMMED_GROUPS.map((group) => {
    const raw = BASE[group] * LEVEL_FACTOR[p.level] * modelFactor(p.model, group) * age * deficit * (extra?.volumeFactor ?? 1) + (extra?.groupSets?.[group] ?? 0);
    const sets = Math.max(group === 'abs' || group === 'calves' ? 2 : 3, Math.round(raw));
    return { group, sets, min: Math.max(2, Math.round(sets * 0.7)), max: Math.round(sets * 1.4) };
  });
}

/** Minutes a set takes, rest included (work ≈ 45 s). */
export function setMinutes(restSec: number): number {
  return 0.75 + restSec / 60;
}

export type GroupVolume = { group: MuscleGroup; direct: number; indirect: number; fractional: number; frequency: number; target: number };

/** Direct, indirect and fractional weekly sets per group for a built week. */
export function measureVolume(sessions: { exercises: { id: string; sets: number }[] }[], targets: VolumeTarget[]): GroupVolume[] {
  const acc = new Map<MuscleGroup, { direct: number; indirect: number; days: Set<number> }>();
  const get = (g: MuscleGroup) => {
    if (!acc.has(g)) acc.set(g, { direct: 0, indirect: 0, days: new Set() });
    return acc.get(g)!;
  };
  sessions.forEach((s, i) => {
    for (const x of s.exercises) {
      const def = CATALOG_BY_ID.get(x.id);
      if (!def) continue;
      const p = get(def.primary);
      p.direct += x.sets;
      p.days.add(i);
      for (const g of def.secondary) {
        const v = get(g);
        v.indirect += x.sets;
        v.days.add(i);
      }
    }
  });
  const groups = new Set<MuscleGroup>([...targets.map((t) => t.group), ...acc.keys()]);
  return [...groups].map((group) => {
    const a = acc.get(group) ?? { direct: 0, indirect: 0, days: new Set<number>() };
    return {
      group,
      direct: a.direct,
      indirect: a.indirect,
      fractional: a.direct + a.indirect * 0.5,
      frequency: a.days.size,
      target: targets.find((t) => t.group === group)?.sets ?? 0,
    };
  });
}
