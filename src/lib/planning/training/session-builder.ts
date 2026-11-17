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
import { CATALOG, MUSCLE_SHORT, type CatalogExercise, type Equipment, type MuscleGroup } from './catalog';
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
function pick(group: MuscleGroup, want: 'compound' | 'any', role: Role, p: ProgramProfile, used: CatalogExercise[], sameGroup: CatalogExercise[], replaceIds: Set<string>, avoidIds: Set<string>, rotation: number): CatalogExercise | null {
  const pool = CATALOG.filter((e) => e.primary === group && available(e, p.equipment) && !excluded(e, p, replaceIds) && e.technique <= maxTechnique(p.level, role, p) && !used.some((u) => u.id === e.id));
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

function roleBounds(role: Role): [number, number] {
  return role === 'main' ? [3, 5] : role === 'core' ? [2, 3] : [2, 4];
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
}): PlannedSession {
  const { template, perSessionTarget, perSessionMax, p, restFor, replaceIds, avoidIds, rotation } = args;
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
      const def = pick(group, wantCompound, tentativeRole, p, used, sameGroup, replaceIds, avoidIds, rotation + k);
      if (!def) {
        if (k === 0) {
          const painBlocked = CATALOG.some((e) => e.primary === group && available(e, p.equipment) && e.areas.some((a) => p.exclusions.areas.has(a)));
          notes.push(
            painBlocked
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
      const [lo, hi] = roleBounds(role);
      const share = count - k;
      const sets = Math.max(lo, Math.min(hi, Math.round(remaining / share)));
      remaining -= sets;
      used.push(def);
      sameGroup.push(def);
      add(def.primary, sets);
      for (const s of def.secondary) add(s, sets * 0.5);
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
  const minutesOf = (list: PlannedExercise[]) => {
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
  };
  let est = minutesOf(out);
  // a session stays readable and focused: at most ~1 exercise every 8–10 minutes
  const maxExercises = p.sessionMinutes <= 30 ? 4 : p.sessionMinutes <= 45 ? 5 : p.sessionMinutes <= 60 ? 6 : p.sessionMinutes <= 85 ? 7 : 8;

  // Time left over: use it for more useful volume on the session's groups, up to their per-session maximum —
  // a long session with two exercises would waste the time the person has given.
  let fillGuard = 0;
  while (est < p.sessionMinutes * 0.8 && fillGuard++ < 20) {
    let added = false;
    for (const group of template.groups) {
      const max = perSessionMax.get(group) ?? 0;
      if ((got.get(group) ?? 0) + 1 > max) continue;
      const mine = out.filter((x) => x.group === group);
      const [, hi] = mine.length ? roleBounds(mine[mine.length - 1].role) : [0, 0];
      const grow = mine.find((x) => x.role !== 'main' && x.sets < hi) ?? (mine.length === 1 && mine[0].sets < roleBounds(mine[0].role)[1] ? mine[0] : undefined);
      if (grow && mine.length >= 2) {
        grow.sets++;
        add(group, 1);
        for (const s2 of grow.def.secondary) add(s2, 0.5);
        added = true;
      } else if (mine.length < 2 && out.length < maxExercises && (got.get(group) ?? 0) + 2 <= max) {
        const def = pick(group, 'any', 'isolation', p, used, mine.map((x) => x.def), replaceIds, avoidIds, rotation + 1);
        if (!def) continue;
        const role: Role = def.kind === 'core' ? 'core' : def.kind === 'isolation' ? 'isolation' : 'secondary';
        used.push(def);
        add(def.primary, 2);
        for (const s2 of def.secondary) add(s2, 1);
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
    if (sibling) sibling.sets = Math.min(roleBounds(sibling.role)[1], sibling.sets + 1);
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
    first.sets = Math.min(roleBounds(first.role)[1], first.sets + 1);
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
