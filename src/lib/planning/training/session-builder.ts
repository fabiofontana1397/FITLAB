/**
 * Session builder: turns a session template (groups in priority order) and the
 * weekly volume targets into an ordered list of exercises, organised in blocks.
 *
 *  - Each group's weekly target is divided by how many sessions train it.
 *  - Groups are filled in priority order, and the sets a compound gives its
 *    synergists (half a set each) are subtracted from what those groups still
 *    need: a session with heavy pressing needs less direct triceps work.
 *  - Exercises are chosen by fit, not at random: role (compound first),
 *    equipment, limitations, technical level, measurable progression, and —
 *    for hypertrophy — a preference for exercises that load the muscle at long
 *    lengths (Wolf et al. 2023) and for variety of pattern within a group.
 *  - Blocks follow the order of the groups; inside a block, multi-joint work
 *    comes before isolation (ACSM 2009: large before small, multi- before
 *    single-joint). Core work closes the session.
 *  - The session must fit the time the person has: antagonist supersets first
 *    (for intermediate/advanced, on isolation pairs), then fewer isolation sets,
 *    then lower-priority accessories are dropped — each decision is written down.
 */
import { CATALOG, indirectShareOf, MUSCLE_SHORT, type CatalogExercise, type Equipment, type MuscleGroup } from './catalog';
import type { Role } from './prescription';
import type { Level, ProgramProfile } from './profile';
import type { SessionTemplate } from './split';
import { setMinutes, type VolumeTarget } from './volume';

export type PlannedExercise = {
  def: CatalogExercise;
  group: MuscleGroup;
  role: Role;
  sets: number;
  blockId: string;
  blockName: string;
  blockOrder: number;
  orderingReason: string;
  supersetWith?: string;
};

export type PlannedSession = {
  template: SessionTemplate;
  exercises: PlannedExercise[];
  estimatedMinutes: number;
  notes: string[];
};

const ANTAGONISTS: [MuscleGroup, MuscleGroup][] = [
  ['biceps', 'triceps'],
  ['chest', 'upperBack'],
  ['quads', 'hamstrings'],
  ['sideDelts', 'rearDelts'],
  ['chest', 'lats'],
];

/** Reference version of each movement, preferred as a session's main lift when it fits. */
const STAPLES = new Set(['panca-piana', 'back-squat', 'romanian-deadlift', 'military-press', 'lat-machine', 'hack-squat', 'panca-manubri', 'leg-press']);

/** Lifts a strength program is built around and tests: squat, hinge, presses. */
const STRENGTH_MAIN = new Set(['squat', 'hinge', 'horizontalPush', 'verticalPush', 'inclinePush']);

const SMALL: Set<MuscleGroup> = new Set(['biceps', 'triceps', 'rearDelts', 'frontDelts', 'forearms']);

function maxTechnique(level: Level, role: Role, p: ProgramProfile): number {
  if (level !== 'beginner') return 3;
  return p.model === 'strength' && role === 'main' ? 3 : 2;
}

function available(e: CatalogExercise, equipment: Set<Equipment>): boolean {
  return e.equipment.every((x) => equipment.has(x));
}

function excluded(e: CatalogExercise, p: ProgramProfile, replaceIds: Set<string>): boolean {
  if (replaceIds.has(e.id)) return true;
  if (e.areas.some((a) => p.exclusions.areas.has(a))) return true;
  const text = p.exclusions.text;
  if (text.length > 0 && e.keywords.some((k) => text.includes(k.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()))) return true;
  return false;
}

/**
 * Two exercises are near-duplicates when they train the same primary group with the same
 * movement pattern, the same part of the range and the same region — e.g. a Romanian
 * deadlift with a barbell and one with dumbbells. Different angle, pattern, resistance
 * profile or region make them complementary, not redundant.
 */
export function nearDuplicate(a: CatalogExercise, b: CatalogExercise): boolean {
  const free = (e: CatalogExercise) => e.loadType === 'barbell' || e.loadType === 'dumbbell' || e.loadType === 'kettlebell';
  // a free-weight lift and a machine/cable version differ in stability and resistance profile: complementary
  return a.id !== b.id && a.primary === b.primary && a.pattern === b.pattern && a.lengthBias === b.lengthBias && (a.region ?? '') === (b.region ?? '') && free(a) === free(b) && a.stability === b.stability;
}

function score(e: CatalogExercise, want: 'compound' | 'any', role: Role, p: ProgramProfile, used: CatalogExercise[], sameGroup: CatalogExercise[]): number {
  let s = 0;
  if (want === 'compound') s += e.kind === 'compound' ? 6 : 0;
  else s += e.kind === 'isolation' ? 2 : 0;
  if (p.model === 'strength' && role === 'main' && e.loadType === 'barbell') s += 4;
  if (role === 'main') {
    // the session's key lift: bilateral, stable enough to load and measure; the standard version of the movement first
    if (e.stability !== 'low' || e.pattern === 'squat') s += 1;
    if (e.pattern === 'lunge') s -= 1;
    if (STAPLES.has(e.id)) s += 0.5;
  }
  if (p.model === 'strength' && e.id === 'stacco-da-terra') s += 2;
  if (p.model !== 'strength' && p.model !== 'health' && e.lengthBias === 'lengthened') s += e.kind === 'isolation' ? 2 : 1;
  if (p.level === 'beginner') s += (e.stability === 'high' ? 2 : e.stability === 'medium' ? 1 : 0) + (e.technique === 1 ? 1 : 0);
  if (p.level === 'advanced' && e.kind === 'isolation' && e.stability === 'high') s += 1;
  if (p.model === 'health' && e.stability === 'high') s += 1;
  if (e.loadType !== 'band' && e.loadType !== 'bodyweight') s += 1; // measurable progression
  else if (p.location === 'gym' && e.loadType === 'band') s -= 3; // in a gym a loadable version is always better
  else if (e.kind === 'compound' && e.repsBased) s += 0.5;
  if (used.some((u) => u.pattern === e.pattern)) s -= 3;
  if (sameGroup.length > 0) {
    if (sameGroup.every((u) => u.pattern !== e.pattern)) s += 1.5;
    if (sameGroup.every((u) => u.region !== e.region)) s += 1;
    if (sameGroup.every((u) => u.lengthBias !== e.lengthBias)) s += 0.5;
  }
  return s;
}

/**
 * Picks the best exercise for a slot. `rotation` (0, 1, 2…) changes the pick
 * among isolation candidates that score within one point of the best: the
 * accessories vary from one training wave to the next while the main lifts —
 * chosen on a clear score margin — stay the same, so their progression is
 * measurable over the whole plan.
 */
function pick(group: MuscleGroup, want: 'compound' | 'any', role: Role, p: ProgramProfile, used: CatalogExercise[], sameGroup: CatalogExercise[], replaceIds: Set<string>, avoidIds: Set<string>, rotation: number, allowSimilar = false): CatalogExercise | null {
  const pool = CATALOG.filter(
    (e) => e.primary === group && available(e, p.equipment) && !excluded(e, p, replaceIds) && e.technique <= maxTechnique(p.level, role, p) && !used.some((u) => u.id === e.id || (!allowSimilar && nearDuplicate(u, e)))
  );
  if (pool.length === 0) return null;
  const ranked = pool
    .map((e) => ({ e, s: score(e, want, role, p, used, sameGroup) - (avoidIds.has(e.id) ? 2.5 : 0) }))
    .sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id));
  if (want === 'any' && ranked[0].e.kind !== 'compound') {
    const close = ranked.filter((r) => r.s >= ranked[0].s - 1);
    return close[rotation % close.length].e;
  }
  return ranked[0].e;
}

/** Set range per exercise. Short sessions and health programs (few weekly sets per group) let a main lift go down to 2 sets. */
function roleBounds(role: Role, p?: ProgramProfile): [number, number] {
  const lowVolume = !!p && (p.sessionMinutes <= 30 || p.model === 'health');
  return role === 'main' ? [lowVolume ? 2 : 3, 5] : role === 'core' ? [2, 3] : [2, 4];
}

export function buildSession(args: {
  template: SessionTemplate;
  perSessionTarget: Map<MuscleGroup, number>;
  /** Upper bound per group in this session (weekly maximum / frequency, never above ≈11 fractional sets). */
  perSessionMax: Map<MuscleGroup, number>;
  p: ProgramProfile;
  restFor: (def: CatalogExercise, role: Role) => number;
  replaceIds: Set<string>;
  /** Exercises already used by an earlier session with the same template: vary the accessories. */
  avoidIds: Set<string>;
  rotation: number;
  /** Groups the person specialises: two similar variants in a session are allowed for them. */
  specialized?: Set<MuscleGroup>;
}): PlannedSession {
  const { template, perSessionTarget, perSessionMax, p, restFor, replaceIds, avoidIds, rotation } = args;
  const specialized = args.specialized ?? new Set<MuscleGroup>();
  let painBlocked = false;
  const notes: string[] = [];
  const got = new Map<MuscleGroup, number>();
  const add = (g: MuscleGroup, v: number) => got.set(g, (got.get(g) ?? 0) + v);
  const used: CatalogExercise[] = [];
  const out: PlannedExercise[] = [];
  let mains = 0;
  const maxMains = template.groups.length >= 6 ? 2 : 1;

  template.groups.forEach((group, gi) => {
    // front delts are only programmed directly in strength plans (overhead press practice)
    const target = perSessionTarget.get(group) ?? (group === 'frontDelts' ? 4.5 : 0);
    const need = target - (got.get(group) ?? 0);
    if (need < (SMALL.has(group) ? 1.5 : 1)) {
      if (target > 0) notes.push(`${MUSCLE_SHORT[group]}: lavoro indiretto sufficiente dagli esercizi multiarticolari della seduta.`);
      return;
    }
    const big = !SMALL.has(group) && group !== 'abs' && group !== 'calves';
    // a second exercise for the group only if it adds something (a different movement) or the volume needs it
    const firstHi = big ? 5 : 4;
    const hasOtherPattern = new Set(CATALOG.filter((e) => e.primary === group && available(e, p.equipment) && !excluded(e, p, replaceIds)).map((e) => e.pattern)).size > 1;
    const count = need > firstHi || (need >= 5.5 && big && hasOtherPattern) || (need >= 7 && hasOtherPattern) ? 2 : 1;
    const sameGroup: CatalogExercise[] = [];
    let remaining = need;
    for (let k = 0; k < count; k++) {
      const wantCompound: 'compound' | 'any' = k === 0 && big ? 'compound' : 'any';
      const mainSlot = k === 0 && big && mains < maxMains && gi <= 2;
      const tentativeRole: Role = group === 'abs' ? 'core' : mainSlot ? 'main' : 'secondary';
      const def = pick(group, wantCompound, tentativeRole, p, used, sameGroup, replaceIds, avoidIds, rotation + k, specialized.has(group));
      if (!def) {
        if (k > 0 && sameGroup.length) {
          // no non-redundant second exercise: its sets go to the first one, within its range
          const first = out.find((x) => x.def.id === sameGroup[0].id);
          if (first) {
            const before = first.sets;
            first.sets = Math.min(roleBounds(first.role, p)[1], first.sets + Math.max(1, Math.round(remaining)));
            add(group, first.sets - before);
            for (const s2 of first.def.secondary) add(s2, (first.sets - before) * indirectShareOf(first.def, s2));
          }
        }
        if (k === 0) {
          const blockedByPain = CATALOG.some((e) => e.primary === group && available(e, p.equipment) && e.areas.some((a) => p.exclusions.areas.has(a)));
          if (blockedByPain) painBlocked = true;
          notes.push(
            blockedByPain
              ? `${MUSCLE_SHORT[group]}: esclusi gli esercizi che caricano la zona dolorante che hai indicato. Chiedi a un fisioterapista o a un medico quali varianti puoi fare: la scheda non le introduce da sola.`
              : `${MUSCLE_SHORT[group]}: nessun esercizio possibile con l’attrezzatura che hai indicato.`
          );
        }
        break;
      }
      let role: Role = def.kind === 'core' ? 'core' : def.kind === 'isolation' ? 'isolation' : 'secondary';
      if (role === 'secondary' && mainSlot && (p.model !== 'strength' || STRENGTH_MAIN.has(def.pattern))) {
        role = 'main';
        mains++;
      }
      const [lo, hi] = roleBounds(role, p);
      const share = count - k;
      const sets = Math.max(lo, Math.min(hi, Math.round(remaining / share)));
      remaining -= sets;
      used.push(def);
      sameGroup.push(def);
      add(def.primary, sets);
      for (const s of def.secondary) add(s, sets * indirectShareOf(def, s));
      out.push({ def, group, role, sets, blockId: `${template.key}-${group}`, blockName: MUSCLE_SHORT[group], blockOrder: 0, orderingReason: '' });
    }
  });

  // order: blocks in group priority, compounds before isolations inside a block, core last
  // blocks that hold a main lift open the session; the others keep the template's priority order
  const mainGroups = new Set(out.filter((x) => x.role === 'main').map((x) => x.group));
  const groupOrder = (g: MuscleGroup) => (g === 'abs' ? 99 : template.groups.indexOf(g) - (mainGroups.has(g) ? 50 : 0));
  const roleOrder: Record<Role, number> = { main: 0, secondary: 1, isolation: 2, core: 3 };
  out.sort((a, b) => groupOrder(a.group) - groupOrder(b.group) || roleOrder[a.role] - roleOrder[b.role]);
  const blockIds = [...new Set(out.map((x) => x.blockId))];
  const fullBody = template.key.startsWith('fb');
  for (const x of out) {
    x.blockOrder = blockIds.indexOf(x.blockId) + 1;
    x.orderingReason =
      x.role === 'main'
        ? 'Esercizio principale: all’inizio, quando sei più fresco, perché è quello su cui misuri i progressi.'
        : x.role === 'secondary'
          ? 'Multiarticolare dopo il principale del blocco.'
          : x.role === 'core'
            ? 'Core a fine seduta: un tronco già affaticato renderebbe meno stabili i multiarticolari.'
            : fullBody
              ? 'Isolamento dopo i multiarticolari della seduta.'
              : `Isolamento che completa il blocco ${x.blockName.toLowerCase()}.`;
  }
  if (fullBody && out.length > 2) notes.push('Full Body: un blocco per gruppo, in ordine di impegno; l’alternanza tra gruppi è voluta e riduce la fatica locale.');

  // time budget
  const minutesOf = (list: PlannedExercise[]) => sessionMinutes(list, p, restFor);
  let est = minutesOf(out);
  // a session stays readable and focused: at most ~1 exercise every 8–10 minutes
  const maxExercises = p.sessionMinutes <= 30 ? 4 : p.sessionMinutes <= 45 ? 5 : p.sessionMinutes <= 60 ? 6 : p.sessionMinutes <= 85 ? 7 : 8;

  // Time left over: use it for more useful volume on the session's groups, up to their per-session maximum —
  // a long session with two exercises would waste the time the person has given.
  let fillGuard = 0;
  while (est < p.sessionMinutes * 0.8 && fillGuard++ < 20) {
    let added = false;
    for (const group of template.groups) {
      // fill up to a little over the target (never to the maximum: that is what over-dosed some groups); when a
      // group is excluded for pain, the others are not raised to compensate
      const max = Math.min(perSessionMax.get(group) ?? 0, (perSessionTarget.get(group) ?? 0) * (painBlocked ? 1 : 1.2));
      if ((got.get(group) ?? 0) + 1 > max) continue;
      const mine = out.filter((x) => x.group === group);
      const [, hi] = mine.length ? roleBounds(mine[mine.length - 1].role, p) : [0, 0];
      const grow = mine.find((x) => x.role !== 'main' && x.sets < hi) ?? (mine.length === 1 && mine[0].sets < roleBounds(mine[0].role, p)[1] ? mine[0] : undefined);
      if (grow && mine.length >= 2) {
        grow.sets++;
        add(group, 1);
        for (const s2 of grow.def.secondary) add(s2, indirectShareOf(grow.def, s2));
        added = true;
      } else if (mine.length < 2 && out.length < maxExercises && (got.get(group) ?? 0) + 2 <= max) {
        const def = pick(group, 'any', 'isolation', p, used, mine.map((x) => x.def), replaceIds, avoidIds, rotation + 1, specialized.has(group));
        if (!def) continue;
        const role: Role = def.kind === 'core' ? 'core' : def.kind === 'isolation' ? 'isolation' : 'secondary';
        used.push(def);
        add(def.primary, 2);
        for (const s2 of def.secondary) add(s2, 2 * indirectShareOf(def, s2));
        const at = out.reduce((last, x, i) => (x.group === group ? i : last), out.length - 1);
        out.splice(at + 1, 0, { def, group, role, sets: 2, blockId: `${template.key}-${group}`, blockName: MUSCLE_SHORT[group], blockOrder: 0, orderingReason: role === 'isolation' ? `Isolamento che completa il blocco ${MUSCLE_SHORT[group].toLowerCase()}.` : 'Multiarticolare dopo il principale del blocco.' });
        added = true;
      } else if (grow) {
        grow.sets++;
        add(group, 1);
        added = true;
      }
      est = minutesOf(out);
      if (est >= p.sessionMinutes * 0.8) break;
    }
    if (!added) break;
  }
  // too many exercises for the session: the lowest-priority isolations go, their sets move to the group's other exercise
  while (out.length > maxExercises) {
    const drop = [...out].reverse().find((x) => (x.role === 'isolation' || x.role === 'core') && out.some((y) => y !== x && y.group === x.group)) ?? [...out].reverse().find((x) => x.role === 'isolation' || x.role === 'core');
    if (!drop) break;
    out.splice(out.indexOf(drop), 1);
    const sibling = out.find((y) => y.group === drop.group);
    if (sibling) sibling.sets = Math.min(roleBounds(sibling.role, p)[1], sibling.sets + 1);
    else notes.push(`${drop.def.name} tolto per non superare ${maxExercises} esercizi nella seduta.`);
    est = minutesOf(out);
  }
  const blockIds2 = [...new Set(out.map((x) => x.blockId))];
  for (const x of out) x.blockOrder = blockIds2.indexOf(x.blockId) + 1;

  if (est > p.sessionMinutes && p.level !== 'beginner') {
    for (const [a, b] of ANTAGONISTS) {
      const xa = out.find((x) => x.group === a && x.role === 'isolation' && !x.supersetWith);
      const xb = out.find((x) => x.group === b && (x.role === 'isolation' || (x.role === 'secondary' && a === 'chest')) && !x.supersetWith && x !== xa);
      if (xa && xb) {
        xa.supersetWith = xb.def.id;
        xb.supersetWith = xa.def.id;
        notes.push(`Superset antagonista ${xa.def.name} + ${xb.def.name}: stesse serie, metà del tempo di recupero, senza togliere qualità ai gruppi che si alternano.`);
        est = minutesOf(out);
        if (est <= p.sessionMinutes) break;
      }
    }
  }
  // Still too long. Cuts in order of least harm: isolation/core sets down to 2, then a second exercise of the same
  // group goes (its sets move to the first), then accessories at 2 sets, then the main lifts at 3 sets.
  const byPriorityDesc = [...out].sort((a, b) => groupOrder(b.group) - groupOrder(a.group));
  for (const x of byPriorityDesc) if (est > p.sessionMinutes && (x.role === 'isolation' || x.role === 'core') && x.sets > 2) {
    x.sets = Math.max(2, x.sets - 1);
    est = minutesOf(out);
  }
  for (const x of [...byPriorityDesc]) {
    if (est <= p.sessionMinutes) break;
    const first = out.find((y) => y.group === x.group);
    if (!first || first === x || x.role === 'main') continue;
    out.splice(out.indexOf(x), 1);
    byPriorityDesc.splice(byPriorityDesc.indexOf(x), 1);
    first.sets = Math.min(roleBounds(first.role, p)[1], first.sets + 1);
    notes.push(`${x.def.name} accorpato a ${first.def.name} per stare nei ${p.sessionMinutes} minuti.`);
    est = minutesOf(out);
  }
  for (const x of byPriorityDesc) if (est > p.sessionMinutes && x.role !== 'main' && x.sets > 2) {
    x.sets = 2;
    est = minutesOf(out);
  }
  for (const x of out) if (est > p.sessionMinutes && x.role === 'main' && x.sets > 3) {
    x.sets = 3;
    est = minutesOf(out);
  }
  while (est > p.sessionMinutes + 3 && out.length > 3) {
    const drop =
      byPriorityDesc.find((x) => x.role === 'isolation' || x.role === 'core') ??
      byPriorityDesc.find((x) => x.role === 'secondary' && out.some((y) => y !== x && y.group === x.group)) ??
      byPriorityDesc.find((x) => x.role === 'secondary');
    if (!drop) break;
    out.splice(out.indexOf(drop), 1);
    byPriorityDesc.splice(byPriorityDesc.indexOf(drop), 1);
    notes.push(`${drop.def.name} tolto per stare nei ${p.sessionMinutes} minuti: il gruppo ${MUSCLE_SHORT[drop.group].toLowerCase()} è allenato nelle altre sedute o indirettamente.`);
    est = minutesOf(out);
  }
  return { template, exercises: out, estimatedMinutes: Math.round(est), notes };
}

/** Estimated minutes of a session: warm-up, set-up per exercise, sets with their rest (supersets share the rest). */
export function sessionMinutes(list: PlannedExercise[], p: ProgramProfile, restFor: (def: CatalogExercise, role: Role) => number): number {
  let m = p.sessionMinutes <= 30 ? 5 : 8; // warm-up and set-up of the first lift (shorter when the whole session is short)
  const seen = new Set<string>();
  for (const x of list) {
    if (seen.has(x.def.id)) continue;
    const partner = x.supersetWith ? list.find((y) => y.def.id === x.supersetWith) : null;
    if (partner) {
      seen.add(partner.def.id);
      m += 1.5 + Math.max(x.sets, partner.sets) * (1.5 + restFor(x.def, x.role) / 60);
    } else m += 1.5 + x.sets * setMinutes(restFor(x.def, x.role));
  }
  return m;
}

/** Weekly target per group divided over the sessions that train it. */
export function perSessionTargets(sessions: SessionTemplate[], targets: VolumeTarget[]): { target: Map<MuscleGroup, number>; max: Map<MuscleGroup, number> }[] {
  const freq = new Map<MuscleGroup, number>();
  for (const s of sessions) for (const g of new Set(s.groups)) freq.set(g, (freq.get(g) ?? 0) + 1);
  return sessions.map((s) => {
    const target = new Map<MuscleGroup, number>();
    const max = new Map<MuscleGroup, number>();
    for (const g of new Set(s.groups)) {
      const t = targets.find((x) => x.group === g);
      if (!t) continue;
      const f = freq.get(g) ?? 1;
      target.set(g, t.sets / f);
      // ≈11 fractional sets per muscle per session: beyond that, more sets add little (Remmert et al. 2025)
      max.set(g, Math.min(t.max / f, 11));
    }
    return { target, max };
  });
}

// ------------------------------------------------------------- week-level passes (engine v4)

export type PatternKey = 'push' | 'pull' | 'knee' | 'hip' | 'core';
export const PATTERN_LABEL: Record<PatternKey, string> = { push: 'Spinta', pull: 'Tirata', knee: 'Dominante di ginocchio', hip: 'Dominante d’anca', core: 'Core' };

/** Which fundamental pattern an exercise covers; `full` = a loadable multi-joint version, otherwise partial. */
export function patternOf(e: CatalogExercise): { key: PatternKey; full: boolean } | null {
  switch (e.pattern) {
    case 'horizontalPush':
    case 'inclinePush':
    case 'verticalPush':
      return { key: 'push', full: e.kind === 'compound' };
    case 'chestFly':
      return { key: 'push', full: false };
    case 'horizontalPull':
    case 'verticalPull':
      return { key: 'pull', full: e.kind === 'compound' };
    case 'squat':
    case 'lunge':
      return { key: 'knee', full: true };
    case 'kneeExtension':
      return { key: 'knee', full: false };
    case 'hinge':
    case 'hipExtension':
      return { key: 'hip', full: e.kind === 'compound' };
    case 'kneeFlexion':
      return { key: 'hip', full: false };
    case 'antiExtension':
    case 'antiRotation':
    case 'trunkFlexion':
      return { key: 'core', full: true };
    default:
      return null;
  }
}

const PATTERN_GROUPS: Record<PatternKey, MuscleGroup[]> = { push: ['chest', 'frontDelts'], pull: ['upperBack', 'lats'], knee: ['quads'], hip: ['hamstrings', 'glutes'], core: ['abs'] };

/** Best exercise covering a pattern, compatible with equipment, limits and level; prefers a full (loadable multi-joint) version. */
function pickForPattern(key: PatternKey, p: ProgramProfile, used: CatalogExercise[], replaceIds: Set<string>): CatalogExercise | null {
  const pool = CATALOG.filter((e) => {
    const po = patternOf(e);
    return po?.key === key && available(e, p.equipment) && !excluded(e, p, replaceIds) && e.technique <= maxTechnique(p.level, 'secondary', p) && !used.some((u) => u.id === e.id || nearDuplicate(u, e));
  });
  if (!pool.length) return null;
  const ranked = pool.map((e) => ({ e, s: (patternOf(e)!.full ? 10 : 0) + score(e, 'compound', 'secondary', p, used, []) })).sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id));
  return ranked[0].e;
}

function maxExercisesFor(p: ProgramProfile): number {
  return p.sessionMinutes <= 30 ? 4 : p.sessionMinutes <= 45 ? 5 : p.sessionMinutes <= 60 ? 6 : p.sessionMinutes <= 85 ? 7 : 8;
}

export type PatternCoverage = { pattern: PatternKey; status: 'full' | 'partial' | 'missing'; sessions: number; exercises: string[]; note?: string };

export function measureCoverage(sessions: PlannedSession[]): PatternCoverage[] {
  return (Object.keys(PATTERN_LABEL) as PatternKey[]).map((key) => {
    const hits = sessions.flatMap((s, i) => s.exercises.filter((x) => patternOf(x.def)?.key === key).map((x) => ({ i, x })));
    const full = hits.some((h) => patternOf(h.x.def)!.full);
    return { pattern: key, status: full ? 'full' : hits.length ? 'partial' : 'missing', sessions: new Set(hits.map((h) => h.i)).size, exercises: [...new Set(hits.map((h) => h.x.def.name))] };
  });
}

/**
 * Makes sure the week covers the fundamental patterns (push, pull, knee- and hip-dominant, core) when the
 * person's equipment and limits allow it. A missing pattern is added to the session that trains its groups
 * (or the shortest one), replacing a lower-priority isolation if the session is already full. Patterns that
 * cannot be trained properly are reported, never declared covered.
 */
export function ensureCoverage(sessions: PlannedSession[], p: ProgramProfile, restFor: (def: CatalogExercise, role: Role) => number, replaceIds: Set<string>): { notes: string[] } {
  const notes: string[] = [];
  if (!sessions.length) return { notes };
  for (const key of Object.keys(PATTERN_LABEL) as PatternKey[]) {
    const cov = measureCoverage(sessions).find((c) => c.pattern === key)!;
    if (cov.status === 'full') continue;
    const allUsed = sessions.flatMap((s) => s.exercises.map((x) => x.def));
    const def = pickForPattern(key, p, allUsed, replaceIds);
    if (!def || (cov.status === 'partial' && !patternOf(def)!.full)) {
      const painBlocked = CATALOG.some((e) => patternOf(e)?.key === key && available(e, p.equipment) && e.areas.some((a) => p.exclusions.areas.has(a)));
      if (cov.status === 'missing' || !def)
        notes.push(
          painBlocked
            ? `${PATTERN_LABEL[key]}: nessun esercizio compatibile con le zone doloranti indicate. Serve il parere di un professionista prima di reintrodurlo.`
            : cov.status === 'partial'
              ? `${PATTERN_LABEL[key]}: con l’attrezzatura indicata si allena solo in modo parziale (${cov.exercises.join(', ')}). Con una sbarra o un elastico si può aggiungere una versione completa.`
              : `${PATTERN_LABEL[key]}: nessun esercizio possibile con l’attrezzatura indicata.`
        );
      if (!def) continue;
      if (cov.status === 'partial') continue;
    }
    // the session that already trains the pattern's groups, else the one with fewest exercises; a full session
    // can host it only by replacing an accessory that is not the only one covering its own pattern
    const groups = PATTERN_GROUPS[key];
    const max = maxExercisesFor(p);
    const coversAlone = (x: PlannedExercise) => {
      const k = patternOf(x.def)?.key;
      return !!k && sessions.flatMap((s) => s.exercises).filter((y) => y !== x && patternOf(y.def)?.key === k).length === 0;
    };
    const victimIn = (sess: PlannedSession) => {
      const candidates = [...sess.exercises].reverse().filter((x) => (x.role === 'isolation' || x.role === 'core') && !patternOf(x.def)?.full && !coversAlone(x));
      const iso = candidates.find((x) => sessions.some((o) => o !== sess && o.exercises.some((y) => y.group === x.group))) ?? candidates[0];
      if (iso) return iso;
      // otherwise a secondary multi-joint whose pattern the week already covers at least twice (never a main lift)
      const count = (k: PatternKey) => sessions.flatMap((o) => o.exercises).filter((y) => patternOf(y.def)?.key === k).length;
      return [...sess.exercises].reverse().find((x) => x.role === 'secondary' && patternOf(x.def) && count(patternOf(x.def)!.key) >= 2);
    };
    const ranked = [...sessions].sort((a, b) => Number(b.template.groups.some((g) => groups.includes(g))) - Number(a.template.groups.some((g) => groups.includes(g))) || a.exercises.length - b.exercises.length);
    const target = ranked.find((x) => x.exercises.length < max) ?? ranked.find((x) => victimIn(x));
    if (!target) {
      notes.push(`${PATTERN_LABEL[key]}: non c’è spazio nelle sedute per aggiungerlo senza togliere un esercizio principale.`);
      continue;
    }
    if (target.exercises.length >= max) {
      const victim = victimIn(target)!;
      target.exercises.splice(target.exercises.indexOf(victim), 1);
      const n = `${victim.def.name} sostituito da ${def.name} per coprire lo schema ${PATTERN_LABEL[key].toLowerCase()} nella settimana.`;
      notes.push(n);
      target.notes.push(n);
    } else {
      const n = `${def.name} aggiunto per coprire lo schema ${PATTERN_LABEL[key].toLowerCase()} nella settimana.`;
      notes.push(n);
      target.notes.push(n);
    }
    const role: Role = def.kind === 'core' ? 'core' : def.kind === 'isolation' ? 'isolation' : 'secondary';
    const sets = p.level === 'beginner' || p.sessionMinutes <= 30 ? 2 : 3;
    const group = def.primary;
    const existingBlock = target.exercises.find((x) => x.group === group);
    const lastOfGroup = target.exercises.reduce((last, x, i) => (x.group === group ? i : last), -1);
    const firstCore = target.exercises.findIndex((x) => x.role === 'core');
    const at = key === 'core' ? target.exercises.length : lastOfGroup >= 0 ? lastOfGroup + 1 : firstCore >= 0 ? firstCore : target.exercises.length;
    target.exercises.splice(at, 0, {
      def,
      group,
      role,
      sets,
      blockId: existingBlock?.blockId ?? `${target.template.key}-${group}`,
      blockName: MUSCLE_SHORT[group],
      blockOrder: 0,
      orderingReason: role === 'core' ? 'Core a fine seduta: un tronco già affaticato renderebbe meno stabili i multiarticolari.' : `Aggiunto per coprire lo schema ${PATTERN_LABEL[key].toLowerCase()} nella settimana.`,
    });
    const ids = [...new Set(target.exercises.map((x) => x.blockId))];
    for (const x of target.exercises) x.blockOrder = ids.indexOf(x.blockId) + 1;
    // stay within the time: take sets from the session's accessories, then from the other exercises down to their minimum
    const added = target.exercises[at];
    const order: Record<Role, number> = { isolation: 0, core: 1, secondary: 2, main: 3 };
    for (let guard = 0; guard < 30 && sessionMinutes(target.exercises, p, restFor) > p.sessionMinutes + 2; guard++) {
      const cut = target.exercises.filter((x) => x !== added && x.sets > roleBounds(x.role, p)[0]).sort((a, b) => order[a.role] - order[b.role] || b.sets - a.sets)[0];
      if (cut) cut.sets--;
      else if (added.sets > 2) added.sets--;
      else break;
    }
    target.estimatedMinutes = Math.round(sessionMinutes(target.exercises, p, restFor));
  }
  return { notes };
}

/**
 * Week-level volume balance: compares each group's fractional sets with its target and corrects the
 * relevant deviations on the group's own direct exercises — up when clearly under (≤ 80% of target, within
 * the exercise's set range and the session's time), down when clearly over (≥ 130% of target + 1 set, never
 * below the exercise's minimum). Indirect volume counts; groups excluded for pain are never compensated.
 */
export function balanceVolume(
  sessions: PlannedSession[],
  targets: VolumeTarget[],
  p: ProgramProfile,
  restFor: (def: CatalogExercise, role: Role) => number,
  frozen: Set<MuscleGroup>,
  replaceIds: Set<string>,
  measure: (s: { exercises: { id: string; sets: number }[] }[], t: VolumeTarget[]) => { group: MuscleGroup; fractional: number; direct: number }[]
): { notes: string[] } {
  const notes: string[] = [];
  const minutes = (s: PlannedSession) => sessionMinutes(s.exercises, p, restFor);
  const asInput = () => sessions.map((s) => ({ exercises: s.exercises.map((x) => ({ id: x.def.id, sets: x.sets })) }));
  for (let guard = 0; guard < 60; guard++) {
    const vol = measure(asInput(), targets);
    let changed = false;
    for (const t of targets) {
      if (t.sets <= 0 || frozen.has(t.group)) continue;
      const v = vol.find((x) => x.group === t.group);
      const frac = v?.fractional ?? 0;
      const own = sessions.flatMap((s) => s.exercises.filter((x) => x.group === t.group || x.def.primary === t.group).map((x) => ({ s, x })));
      if (frac <= t.sets * 0.8 && t.sets - frac >= 1.5) {
        // raise: the exercise with most room in the session with most time left
        const grow = own
          .filter(({ s, x }) => x.sets < roleBounds(x.role, p)[1] && minutes(s) + setMinutes(restFor(x.def, x.role)) <= p.sessionMinutes + 2)
          .sort((a, b) => minutes(a.s) - minutes(b.s))[0];
        if (grow) {
          grow.x.sets++;
          changed = true;
        } else if (!own.length) {
          // the group has no exercise this week (cut for time earlier): add one where it fits
          // a session that trains the group: one with room, else one where an exercise of a group already at
          // target can make way (never a main lift, never the only exercise of a pattern)
          const groupFrac = (g: MuscleGroup) => vol.find((x) => x.group === g)?.fractional ?? 0;
          const groupTarget = (g: MuscleGroup) => targets.find((x) => x.group === g)?.sets ?? 0;
          const spare = (sess: PlannedSession) =>
            [...sess.exercises]
              .reverse()
              .find(
                (x) =>
                  x.role !== 'main' &&
                  x.group !== t.group &&
                  groupFrac(x.group) - x.sets >= groupTarget(x.group) * 0.8 &&
                  sessions.flatMap((o) => o.exercises).filter((y) => y !== x && patternOf(y.def)?.key === patternOf(x.def)?.key).length > 0
              );
          const hosts = sessions.filter((s) => s.template.groups.includes(t.group)).sort((a, b) => minutes(a) - minutes(b));
          const host = hosts.find((s) => s.exercises.length < maxExercisesFor(p)) ?? hosts.find((s) => spare(s));
          const def = host ? pick(t.group, 'any', 'isolation', p, host.exercises.map((x) => x.def), [], replaceIds, new Set(), 0) : null;
          if (host && def) {
            const role: Role = def.kind === 'core' ? 'core' : def.kind === 'isolation' ? 'isolation' : 'secondary';
            const extra = 1.5 + 2 * setMinutes(restFor(def, role));
            const victim = host.exercises.length >= maxExercisesFor(p) ? spare(host) : undefined;
            const freed = victim ? 1.5 + victim.sets * setMinutes(restFor(victim.def, victim.role)) : 0;
            if (minutes(host) + extra - freed <= p.sessionMinutes + 2) {
              if (victim) {
                host.exercises.splice(host.exercises.indexOf(victim), 1);
                notes.push(`${victim.def.name} tolto per fare spazio a ${def.name}: ${MUSCLE_SHORT[victim.group].toLowerCase()} è già a obiettivo nella settimana.`);
                host.notes.push(`${victim.def.name} sostituito da ${def.name}: ${MUSCLE_SHORT[t.group].toLowerCase()} non aveva lavoro diretto nella settimana.`);
              }
              const firstCore = host.exercises.findIndex((x) => x.role === 'core');
              host.exercises.splice(firstCore >= 0 ? firstCore : host.exercises.length, 0, {
                def,
                group: t.group,
                role,
                sets: 2,
                blockId: `${host.template.key}-${t.group}`,
                blockName: MUSCLE_SHORT[t.group],
                blockOrder: 0,
                orderingReason: `Isolamento che completa il blocco ${MUSCLE_SHORT[t.group].toLowerCase()}.`,
              });
              const ids = [...new Set(host.exercises.map((x) => x.blockId))];
              for (const x of host.exercises) x.blockOrder = ids.indexOf(x.blockId) + 1;
              notes.push(`${def.name} aggiunto: ${MUSCLE_SHORT[t.group].toLowerCase()} non aveva lavoro diretto nella settimana.`);
              changed = true;
            }
          }
        }
      } else if (frac >= t.sets * 1.3 + 1 && (v?.direct ?? 0) > 0) {
        const order: Record<Role, number> = { isolation: 0, core: 0, secondary: 1, main: 2 };
        const cut = own.filter(({ x }) => x.sets > roleBounds(x.role, p)[0]).sort((a, b) => order[a.x.role] - order[b.x.role] || b.x.sets - a.x.sets)[0];
        if (cut) {
          cut.x.sets--;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (const s of sessions) s.estimatedMinutes = Math.round(minutes(s));
  return { notes };
}
